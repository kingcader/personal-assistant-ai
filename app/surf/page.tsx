'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Wind,
  Waves,
  Compass,
  Thermometer,
  ChevronDown,
  MapPin,
  ArrowUp,
  RefreshCw,
  Star,
  Clock,
  Info,
} from 'lucide-react';
import { SURF_SPOTS, REGIONS, getSpotsByRegion } from '@/lib/surf/spots';
import {
  ForecastResponse,
  DailyForecast,
  HourlyForecast,
  RATING_CONFIG,
  SurfRating,
  metersToFeet,
  degreesToCompass,
  kmhToMph,
  SurfSpot,
} from '@/lib/surf/types';

const FAVORITES_KEY = 'surf-favorites';
const LAST_SPOT_KEY = 'surf-last-spot';
const UNITS_KEY = 'surf-units';

type Units = 'imperial' | 'metric';

function getFavorites(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveFavorites(ids: string[]) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
}

// --- Rating Badge ---
function RatingBadge({ rating, size = 'md' }: { rating: SurfRating; size?: 'sm' | 'md' | 'lg' }) {
  const config = RATING_CONFIG[rating];
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5 font-semibold',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${sizeClasses[size]}`}
      style={{ backgroundColor: config.bgColor, color: config.color }}
    >
      <span className="flex gap-0.5">
        {Array.from({ length: 7 }).map((_, i) => (
          <span
            key={i}
            className={`inline-block rounded-sm ${size === 'sm' ? 'w-1 h-2.5' : size === 'md' ? 'w-1 h-3' : 'w-1.5 h-4'}`}
            style={{
              backgroundColor: i < config.barCount ? config.color : `${config.color}25`,
            }}
          />
        ))}
      </span>
      {config.label}
    </span>
  );
}

// --- Wind Direction Arrow ---
function WindArrow({ direction, className = '' }: { direction: number; className?: string }) {
  return (
    <ArrowUp
      className={className}
      style={{ transform: `rotate(${(direction + 180) % 360}deg)` }}
    />
  );
}

// --- Swell Direction Arrow ---
function SwellArrow({ direction, size = 16 }: { direction: number; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="inline-block">
      <g transform={`rotate(${direction}, 12, 12)`}>
        <path d="M12 2L8 10h8L12 2z" fill="currentColor" />
        <line x1="12" y1="10" x2="12" y2="22" stroke="currentColor" strokeWidth="2" />
      </g>
    </svg>
  );
}

// --- Simple SVG Line Chart ---
function MiniChart({
  data,
  color,
  height = 60,
  width = '100%',
  fill = false,
}: {
  data: number[];
  color: string;
  height?: number;
  width?: string | number;
  fill?: boolean;
}) {
  if (data.length === 0) return null;
  const max = Math.max(...data, 0.1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const padding = 4;

  const points = data.map((val, i) => {
    const x = padding + (i / (data.length - 1)) * (100 - padding * 2);
    const y = padding + (1 - (val - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  });

  const pathD = `M${points.join(' L')}`;
  const fillD = fill ? `${pathD} L${100 - padding},${height - padding} L${padding},${height - padding} Z` : '';

  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" style={{ width, height }} className="block">
      {fill && <path d={fillD} fill={`${color}20`} />}
      <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// --- Weather icon from WMO code ---
function weatherIcon(code: number): string {
  if (code === 0) return '☀️';
  if (code <= 3) return '⛅';
  if (code <= 48) return '🌫️';
  if (code <= 57) return '🌦️';
  if (code <= 67) return '🌧️';
  if (code <= 77) return '🌨️';
  if (code <= 82) return '🌧️';
  if (code <= 86) return '🌨️';
  if (code <= 99) return '⛈️';
  return '🌤️';
}

// --- Format height for display ---
function formatHeight(meters: number, units: Units): string {
  if (units === 'imperial') {
    const ft = metersToFeet(meters);
    return `${ft.toFixed(1)}ft`;
  }
  return `${meters.toFixed(1)}m`;
}

function formatHeightRange(min: number, max: number, units: Units): string {
  if (units === 'imperial') {
    return `${metersToFeet(min).toFixed(0)}-${metersToFeet(max).toFixed(1)}ft`;
  }
  return `${min.toFixed(1)}-${max.toFixed(1)}m`;
}

function formatWind(kmh: number, units: Units): string {
  if (units === 'imperial') {
    return `${kmhToMph(kmh).toFixed(0)}mph`;
  }
  return `${kmh.toFixed(0)}km/h`;
}

function formatTemp(celsius: number, units: Units): string {
  if (units === 'imperial') {
    return `${Math.round(celsius * 9 / 5 + 32)}°F`;
  }
  return `${Math.round(celsius)}°C`;
}

// ==========================================================================
// MAIN PAGE
// ==========================================================================
export default function SurfForecastPage() {
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSpotId, setSelectedSpotId] = useState<string>('');
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [spotPickerOpen, setSpotPickerOpen] = useState(false);
  const [spotPickerRegion, setSpotPickerRegion] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [units, setUnits] = useState<Units>('imperial');
  const [showSpotInfo, setShowSpotInfo] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Init state from localStorage
  useEffect(() => {
    const savedFavs = getFavorites();
    setFavorites(savedFavs);

    const savedUnits = localStorage.getItem(UNITS_KEY) as Units;
    if (savedUnits) setUnits(savedUnits);

    const lastSpot = localStorage.getItem(LAST_SPOT_KEY);
    if (lastSpot && SURF_SPOTS.find((s) => s.id === lastSpot)) {
      setSelectedSpotId(lastSpot);
    } else if (savedFavs.length > 0) {
      setSelectedSpotId(savedFavs[0]);
    } else {
      // Default to Tamarindo (user is in Costa Rica)
      setSelectedSpotId('tamarindo');
    }
  }, []);

  // Fetch forecast when spot changes
  const fetchForecast = useCallback(async (spotId: string) => {
    if (!spotId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/surf/forecast?spotId=${spotId}`);
      if (!res.ok) throw new Error('Failed to fetch forecast');
      const data: ForecastResponse = await res.json();
      setForecast(data);
      setSelectedDayIdx(0);
      localStorage.setItem(LAST_SPOT_KEY, spotId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load forecast');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (selectedSpotId) {
      fetchForecast(selectedSpotId);
    }
  }, [selectedSpotId, fetchForecast]);

  const toggleFavorite = (spotId: string) => {
    setFavorites((prev) => {
      const next = prev.includes(spotId) ? prev.filter((id) => id !== spotId) : [...prev, spotId];
      saveFavorites(next);
      return next;
    });
  };

  const toggleUnits = () => {
    setUnits((prev) => {
      const next = prev === 'imperial' ? 'metric' : 'imperial';
      localStorage.setItem(UNITS_KEY, next);
      return next;
    });
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchForecast(selectedSpotId);
  };

  const selectedDay: DailyForecast | null = forecast?.days[selectedDayIdx] ?? null;
  const currentHour = forecast?.currentHour ?? null;
  const spot = forecast?.spot ?? SURF_SPOTS.find((s) => s.id === selectedSpotId) ?? null;

  // Daylight hours filter (show 5am - 9pm)
  const daylightHours = useMemo(() => {
    if (!selectedDay) return [];
    return selectedDay.hours.filter((h) => {
      const hour = new Date(h.time).getHours();
      return hour >= 5 && hour <= 21;
    });
  }, [selectedDay]);

  // Chart data for selected day
  const chartSwellData = useMemo(() => daylightHours.map((h) => h.swellHeight), [daylightHours]);
  const chartWindData = useMemo(() => daylightHours.map((h) => h.windSpeed), [daylightHours]);
  const chartPeriodData = useMemo(() => daylightHours.map((h) => h.swellPeriod), [daylightHours]);

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* ===== HEADER ===== */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Waves className="h-6 w-6 text-primary" />
              Surf Forecast
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleUnits}
              className="btn-ios-secondary text-xs px-3 py-1.5"
            >
              {units === 'imperial' ? 'ft/mph' : 'm/km/h'}
            </button>
            <button
              onClick={handleRefresh}
              className="btn-ios-secondary p-2"
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* ===== SPOT SELECTOR ===== */}
        <button
          onClick={() => setSpotPickerOpen(true)}
          className="card-ios w-full flex items-center justify-between mb-4 cursor-pointer hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <MapPin className="h-5 w-5 text-primary" />
            <div className="text-left">
              <div className="font-semibold">{spot?.name ?? 'Select a spot'}</div>
              <div className="text-sm text-muted-foreground">
                {spot?.region}, {spot?.country} &middot; {spot?.type}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {spot && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFavorite(spot.id);
                }}
                className="p-1"
              >
                <Star
                  className={`h-5 w-5 ${favorites.includes(spot.id) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`}
                />
              </button>
            )}
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          </div>
        </button>

        {/* ===== LOADING / ERROR ===== */}
        {loading && !forecast && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
          </div>
        )}

        {error && (
          <div className="card-ios bg-destructive/10 text-destructive mb-4 text-center">
            <p>{error}</p>
            <button onClick={() => fetchForecast(selectedSpotId)} className="btn-ios-primary mt-3 text-sm">
              Retry
            </button>
          </div>
        )}

        {/* ===== CURRENT CONDITIONS ===== */}
        {currentHour && forecast && (
          <div className="card-ios mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                Current Conditions
              </div>
              <RatingBadge rating={currentHour.rating} size="md" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Wave Height */}
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">
                  {formatHeight(Math.max(currentHour.waveHeight, currentHour.swellHeight), units)}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">Wave Height</div>
              </div>

              {/* Swell */}
              <div className="text-center">
                <div className="text-lg font-semibold flex items-center justify-center gap-1">
                  {formatHeight(currentHour.swellHeight, units)}
                  <span className="text-sm text-muted-foreground">@ {currentHour.swellPeriod.toFixed(0)}s</span>
                </div>
                <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <SwellArrow direction={currentHour.swellDirection} size={12} />
                  {degreesToCompass(currentHour.swellDirection)} swell
                </div>
              </div>

              {/* Wind */}
              <div className="text-center">
                <div className="text-lg font-semibold flex items-center justify-center gap-1">
                  <WindArrow direction={currentHour.windDirection} className="h-4 w-4 text-muted-foreground" />
                  {formatWind(currentHour.windSpeed, units)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {degreesToCompass(currentHour.windDirection)} wind
                  {currentHour.windGusts > currentHour.windSpeed * 1.3 && (
                    <span> (gusts {formatWind(currentHour.windGusts, units)})</span>
                  )}
                </div>
              </div>

              {/* Temp */}
              <div className="text-center">
                <div className="text-lg font-semibold flex items-center justify-center gap-1">
                  <span>{weatherIcon(currentHour.weatherCode)}</span>
                  {formatTemp(currentHour.temperature, units)}
                </div>
                <div className="text-xs text-muted-foreground">Air Temp</div>
              </div>
            </div>
          </div>
        )}

        {/* ===== SPOT INFO TOGGLE ===== */}
        {spot && (
          <button
            onClick={() => setShowSpotInfo(!showSpotInfo)}
            className="text-sm text-primary flex items-center gap-1 mb-4 hover:underline"
          >
            <Info className="h-3.5 w-3.5" />
            {showSpotInfo ? 'Hide' : 'Show'} spot info
          </button>
        )}

        {showSpotInfo && spot && (
          <div className="card-ios mb-4 text-sm">
            <p className="text-muted-foreground mb-2">{spot.description}</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div>Type: <span className="text-foreground capitalize">{spot.type} break</span></div>
              <div>Facing: <span className="text-foreground">{degreesToCompass(spot.facing)} ({spot.facing}°)</span></div>
              <div>
                Ideal swell: <span className="text-foreground">
                  {formatHeightRange(spot.idealSwellSize[0], spot.idealSwellSize[1], units)}
                </span>
              </div>
              <div>
                Ideal direction: <span className="text-foreground">
                  {degreesToCompass(spot.idealSwellDir[0])}-{degreesToCompass(spot.idealSwellDir[1])}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ===== DAY SELECTOR ===== */}
        {forecast && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 mb-4 -mx-4 px-4">
            {forecast.days.map((day, idx) => {
              const isSelected = idx === selectedDayIdx;
              const ratingConfig = RATING_CONFIG[day.bestRating];
              return (
                <button
                  key={day.date}
                  onClick={() => setSelectedDayIdx(idx)}
                  className={`flex-shrink-0 rounded-xl px-3 py-2 text-center transition-all min-w-[72px] ${
                    isSelected
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'bg-card shadow-sm hover:bg-muted/50'
                  }`}
                >
                  <div className={`text-xs font-medium ${isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                    {day.dayLabel}
                  </div>
                  <div className={`text-sm font-bold ${isSelected ? '' : ''}`}>
                    {formatHeight(day.maxWaveHeight, units)}
                  </div>
                  <div className="mt-1 flex justify-center gap-0.5">
                    {Array.from({ length: 7 }).map((_, i) => (
                      <span
                        key={i}
                        className="inline-block w-1 h-2 rounded-sm"
                        style={{
                          backgroundColor: i < ratingConfig.barCount
                            ? (isSelected ? 'rgba(255,255,255,0.9)' : ratingConfig.color)
                            : (isSelected ? 'rgba(255,255,255,0.25)' : `${ratingConfig.color}25`),
                        }}
                      />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* ===== HOURLY FORECAST TABLE ===== */}
        {selectedDay && (
          <div className="card-ios mb-4 overflow-hidden">
            <h3 className="text-sm font-semibold mb-3 px-1">
              Hourly Forecast &mdash; {selectedDay.dayLabel}{' '}
              <span className="text-muted-foreground font-normal">
                {new Date(selectedDay.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </h3>

            <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b">
                    <th className="text-left py-2 pr-2 font-medium">Time</th>
                    <th className="text-center py-2 px-1 font-medium">Rating</th>
                    <th className="text-center py-2 px-1 font-medium">Surf</th>
                    <th className="text-center py-2 px-1 font-medium">Swell</th>
                    <th className="text-center py-2 px-1 font-medium">Wind</th>
                    <th className="text-center py-2 pl-1 font-medium hidden sm:table-cell">Temp</th>
                  </tr>
                </thead>
                <tbody>
                  {daylightHours.map((h) => {
                    const time = new Date(h.time);
                    const ratingConfig = RATING_CONFIG[h.rating];
                    const isCurrentHour =
                      forecast?.currentHour?.time === h.time;
                    return (
                      <tr
                        key={h.time}
                        className={`border-b border-border/50 last:border-0 ${isCurrentHour ? 'bg-primary/5' : ''}`}
                      >
                        <td className="py-2 pr-2 font-medium whitespace-nowrap">
                          {time.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true })}
                          {isCurrentHour && <span className="text-[10px] text-primary ml-1">NOW</span>}
                        </td>
                        <td className="py-2 px-1 text-center">
                          <span className="flex justify-center gap-0.5">
                            {Array.from({ length: 7 }).map((_, i) => (
                              <span
                                key={i}
                                className="inline-block w-1 h-2.5 rounded-sm"
                                style={{
                                  backgroundColor:
                                    i < ratingConfig.barCount ? ratingConfig.color : `${ratingConfig.color}25`,
                                }}
                              />
                            ))}
                          </span>
                        </td>
                        <td className="py-2 px-1 text-center font-semibold">
                          {formatHeight(Math.max(h.waveHeight, h.swellHeight), units)}
                        </td>
                        <td className="py-2 px-1 text-center text-muted-foreground whitespace-nowrap">
                          <span className="inline-flex items-center gap-0.5">
                            <SwellArrow direction={h.swellDirection} size={10} />
                            {h.swellPeriod.toFixed(0)}s
                          </span>
                        </td>
                        <td className="py-2 px-1 text-center text-muted-foreground whitespace-nowrap">
                          <span className="inline-flex items-center gap-0.5">
                            <WindArrow direction={h.windDirection} className="h-3 w-3" />
                            {formatWind(h.windSpeed, units)}
                          </span>
                        </td>
                        <td className="py-2 pl-1 text-center text-muted-foreground hidden sm:table-cell">
                          {weatherIcon(h.weatherCode)} {formatTemp(h.temperature, units)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===== SWELL CHART ===== */}
        {selectedDay && chartSwellData.length > 0 && (
          <div className="card-ios mb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <Waves className="h-4 w-4 text-blue-500" />
                Swell Height
              </h3>
              <span className="text-xs text-muted-foreground">
                Max {formatHeight(Math.max(...chartSwellData), units)}
              </span>
            </div>
            <MiniChart data={chartSwellData} color="#3B82F6" height={70} fill />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1 px-1">
              <span>5AM</span>
              <span>12PM</span>
              <span>9PM</span>
            </div>
          </div>
        )}

        {/* ===== SWELL PERIOD CHART ===== */}
        {selectedDay && chartPeriodData.length > 0 && (
          <div className="card-ios mb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <Compass className="h-4 w-4 text-teal-500" />
                Swell Period
              </h3>
              <span className="text-xs text-muted-foreground">
                Avg {selectedDay.avgPeriod.toFixed(0)}s
              </span>
            </div>
            <MiniChart data={chartPeriodData} color="#14B8A6" height={60} />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1 px-1">
              <span>5AM</span>
              <span>12PM</span>
              <span>9PM</span>
            </div>
          </div>
        )}

        {/* ===== WIND CHART ===== */}
        {selectedDay && chartWindData.length > 0 && (
          <div className="card-ios mb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <Wind className="h-4 w-4 text-orange-500" />
                Wind Speed
              </h3>
              <span className="text-xs text-muted-foreground">
                Max {formatWind(Math.max(...chartWindData), units)}
              </span>
            </div>
            <MiniChart data={chartWindData} color="#F97316" height={60} />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1 px-1">
              <span>5AM</span>
              <span>12PM</span>
              <span>9PM</span>
            </div>

            {/* Wind direction indicators */}
            <div className="flex justify-between mt-2 px-1">
              {daylightHours
                .filter((_, i) => i % 3 === 0)
                .map((h) => (
                  <div key={h.time} className="flex flex-col items-center gap-0.5">
                    <WindArrow direction={h.windDirection} className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[9px] text-muted-foreground">{degreesToCompass(h.windDirection)}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ===== 7-DAY OVERVIEW ===== */}
        {forecast && (
          <div className="card-ios mb-4">
            <h3 className="text-sm font-semibold mb-3">7-Day Overview</h3>
            <div className="space-y-2">
              {forecast.days.map((day, idx) => {
                const ratingConfig = RATING_CONFIG[day.bestRating];
                return (
                  <button
                    key={day.date}
                    onClick={() => setSelectedDayIdx(idx)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${
                      idx === selectedDayIdx ? 'bg-primary/10' : 'hover:bg-muted/50'
                    }`}
                  >
                    <div className="w-12 text-sm font-medium text-left">{day.dayLabel}</div>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 7 }).map((_, i) => (
                        <span
                          key={i}
                          className="inline-block w-1 h-3 rounded-sm"
                          style={{
                            backgroundColor: i < ratingConfig.barCount ? ratingConfig.color : `${ratingConfig.color}25`,
                          }}
                        />
                      ))}
                    </div>
                    <div className="flex-1 text-sm font-semibold text-right">
                      {formatHeight(day.maxWaveHeight, units)}
                    </div>
                    <div className="text-xs text-muted-foreground w-10 text-right">
                      {day.avgPeriod.toFixed(0)}s
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <SwellArrow direction={day.dominantSwellDir} size={12} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ===== NEARBY SPOTS (same region) ===== */}
        {spot && (
          <div className="card-ios mb-4">
            <h3 className="text-sm font-semibold mb-3">
              More in {spot.region}
            </h3>
            <div className="space-y-1">
              {getSpotsByRegion(spot.region)
                .filter((s) => s.id !== spot.id)
                .slice(0, 5)
                .map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedSpotId(s.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-muted/50 transition-colors text-left"
                  >
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm flex-1">{s.name}</span>
                    {favorites.includes(s.id) && (
                      <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400 flex-shrink-0" />
                    )}
                    <span className="text-xs text-muted-foreground capitalize">{s.type}</span>
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* ===== SPOT PICKER MODAL ===== */}
      {spotPickerOpen && (
        <SpotPickerModal
          favorites={favorites}
          selectedSpotId={selectedSpotId}
          onSelect={(id) => {
            setSelectedSpotId(id);
            setSpotPickerOpen(false);
          }}
          onClose={() => {
            setSpotPickerOpen(false);
            setSpotPickerRegion(null);
          }}
          region={spotPickerRegion}
          onRegionChange={setSpotPickerRegion}
          onToggleFavorite={toggleFavorite}
        />
      )}
    </div>
  );
}

// ==========================================================================
// SPOT PICKER MODAL
// ==========================================================================
function SpotPickerModal({
  favorites,
  selectedSpotId,
  onSelect,
  onClose,
  region,
  onRegionChange,
  onToggleFavorite,
}: {
  favorites: string[];
  selectedSpotId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  region: string | null;
  onRegionChange: (r: string | null) => void;
  onToggleFavorite: (id: string) => void;
}) {
  const [search, setSearch] = useState('');

  const filteredSpots = useMemo(() => {
    let spots = SURF_SPOTS;
    if (search) {
      const q = search.toLowerCase();
      spots = spots.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.region.toLowerCase().includes(q) ||
          s.country.toLowerCase().includes(q)
      );
    } else if (region) {
      spots = spots.filter((s) => s.region === region);
    }
    return spots;
  }, [search, region]);

  const favoriteSpots = useMemo(
    () => SURF_SPOTS.filter((s) => favorites.includes(s.id)),
    [favorites]
  );

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="absolute inset-x-0 bottom-0 top-12 md:top-20 bg-card rounded-t-3xl flex flex-col overflow-hidden">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <input
            type="text"
            placeholder="Search spots..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              if (e.target.value) onRegionChange(null);
            }}
            className="input-ios"
            autoFocus
          />
        </div>

        {/* Region tabs */}
        {!search && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 pb-3">
            <button
              onClick={() => onRegionChange(null)}
              className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full transition-colors ${
                !region ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
              }`}
            >
              {favorites.length > 0 ? 'Favorites' : 'All'}
            </button>
            {REGIONS.map((r) => (
              <button
                key={r}
                onClick={() => onRegionChange(r)}
                className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full transition-colors ${
                  region === r ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        )}

        {/* Spot list */}
        <div className="flex-1 overflow-y-auto px-4 pb-safe">
          {/* Favorites section */}
          {!search && !region && favoriteSpots.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">
                Favorites
              </h3>
              {favoriteSpots.map((s) => (
                <SpotRow
                  key={s.id}
                  spot={s}
                  isFavorite
                  isSelected={s.id === selectedSpotId}
                  onSelect={onSelect}
                  onToggleFavorite={onToggleFavorite}
                />
              ))}
            </div>
          )}

          {/* All/filtered spots */}
          {!search && !region && favorites.length > 0 && (
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">
              All Regions
            </h3>
          )}

          {search || region ? (
            filteredSpots.map((s) => (
              <SpotRow
                key={s.id}
                spot={s}
                isFavorite={favorites.includes(s.id)}
                isSelected={s.id === selectedSpotId}
                onSelect={onSelect}
                onToggleFavorite={onToggleFavorite}
              />
            ))
          ) : (
            REGIONS.map((r) => (
              <div key={r} className="mb-4">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 px-1">
                  {r}
                </h4>
                {getSpotsByRegion(r).map((s) => (
                  <SpotRow
                    key={s.id}
                    spot={s}
                    isFavorite={favorites.includes(s.id)}
                    isSelected={s.id === selectedSpotId}
                    onSelect={onSelect}
                    onToggleFavorite={onToggleFavorite}
                  />
                ))}
              </div>
            ))
          )}

          {filteredSpots.length === 0 && search && (
            <div className="text-center py-8 text-muted-foreground">
              No spots found for &ldquo;{search}&rdquo;
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SpotRow({
  spot,
  isFavorite,
  isSelected,
  onSelect,
  onToggleFavorite,
}: {
  spot: SurfSpot;
  isFavorite: boolean;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
        isSelected ? 'bg-primary/10' : 'hover:bg-muted/50'
      }`}
      onClick={() => onSelect(spot.id)}
    >
      <MapPin className={`h-4 w-4 flex-shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium truncate ${isSelected ? 'text-primary' : ''}`}>
          {spot.name}
        </div>
        <div className="text-xs text-muted-foreground">{spot.country} &middot; {spot.type}</div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite(spot.id);
        }}
        className="p-1 flex-shrink-0"
      >
        <Star
          className={`h-4 w-4 ${isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/40'}`}
        />
      </button>
    </div>
  );
}
