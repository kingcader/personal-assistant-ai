import { NextRequest, NextResponse } from 'next/server';
import { getSpotById } from '@/lib/surf/spots';
import { calculateRatingScore, scoreToRating } from '@/lib/surf/ratings';
import { HourlyForecast, DailyForecast, ForecastResponse } from '@/lib/surf/types';

interface OpenMeteoMarineResponse {
  hourly: {
    time: string[];
    wave_height: (number | null)[];
    wave_direction: (number | null)[];
    wave_period: (number | null)[];
    wave_peak_period: (number | null)[];
    swell_wave_height: (number | null)[];
    swell_wave_direction: (number | null)[];
    swell_wave_period: (number | null)[];
    swell_wave_peak_period: (number | null)[];
    wind_wave_height: (number | null)[];
    wind_wave_direction: (number | null)[];
    wind_wave_period: (number | null)[];
  };
}

interface OpenMeteoWeatherResponse {
  hourly: {
    time: string[];
    temperature_2m: (number | null)[];
    wind_speed_10m: (number | null)[];
    wind_direction_10m: (number | null)[];
    wind_gusts_10m: (number | null)[];
    weather_code: (number | null)[];
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const spotId = searchParams.get('spotId');

  if (!spotId) {
    return NextResponse.json({ error: 'spotId is required' }, { status: 400 });
  }

  const spot = getSpotById(spotId);
  if (!spot) {
    return NextResponse.json({ error: 'Spot not found' }, { status: 404 });
  }

  try {
    // Fetch marine data and weather data in parallel from Open-Meteo (free, no API key)
    const marineParams = [
      'wave_height', 'wave_direction', 'wave_period', 'wave_peak_period',
      'swell_wave_height', 'swell_wave_direction', 'swell_wave_period', 'swell_wave_peak_period',
      'wind_wave_height', 'wind_wave_direction', 'wind_wave_period',
    ].join(',');

    const weatherParams = [
      'temperature_2m', 'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m', 'weather_code',
    ].join(',');

    const [marineRes, weatherRes] = await Promise.all([
      fetch(
        `https://marine-api.open-meteo.com/v1/marine?latitude=${spot.latitude}&longitude=${spot.longitude}&hourly=${marineParams}&forecast_days=7&timezone=auto`,
        { next: { revalidate: 1800 } } // cache 30 min
      ),
      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${spot.latitude}&longitude=${spot.longitude}&hourly=${weatherParams}&forecast_days=7&timezone=auto`,
        { next: { revalidate: 1800 } }
      ),
    ]);

    if (!marineRes.ok) {
      throw new Error(`Marine API error: ${marineRes.status}`);
    }
    if (!weatherRes.ok) {
      throw new Error(`Weather API error: ${weatherRes.status}`);
    }

    const marine: OpenMeteoMarineResponse = await marineRes.json();
    const weather: OpenMeteoWeatherResponse = await weatherRes.json();

    // Combine hourly data
    const hourlyForecasts: HourlyForecast[] = marine.hourly.time.map((time, i) => {
      const waveHeight = marine.hourly.wave_height[i] ?? 0;
      const waveDirection = marine.hourly.wave_direction[i] ?? 0;
      const wavePeriod = marine.hourly.wave_period[i] ?? 0;
      const wavePeakPeriod = marine.hourly.wave_peak_period[i] ?? 0;
      const swellHeight = marine.hourly.swell_wave_height[i] ?? 0;
      const swellDirection = marine.hourly.swell_wave_direction[i] ?? 0;
      const swellPeriod = marine.hourly.swell_wave_period[i] ?? 0;
      const swellPeakPeriod = marine.hourly.swell_wave_peak_period[i] ?? 0;
      const windWaveHeight = marine.hourly.wind_wave_height[i] ?? 0;
      const windWaveDirection = marine.hourly.wind_wave_direction[i] ?? 0;
      const windWavePeriod = marine.hourly.wind_wave_period[i] ?? 0;

      const windSpeed = weather.hourly.wind_speed_10m[i] ?? 0;
      const windDirection = weather.hourly.wind_direction_10m[i] ?? 0;
      const windGusts = weather.hourly.wind_gusts_10m[i] ?? 0;
      const temperature = weather.hourly.temperature_2m[i] ?? 0;
      const weatherCode = weather.hourly.weather_code[i] ?? 0;

      const ratingScore = calculateRatingScore(spot, {
        waveHeight,
        swellHeight,
        swellPeriod,
        swellDirection,
        windSpeed,
        windDirection,
      });

      const rating = scoreToRating(ratingScore, Math.max(waveHeight, swellHeight));

      return {
        time,
        waveHeight,
        waveDirection,
        wavePeriod,
        wavePeakPeriod,
        swellHeight,
        swellDirection,
        swellPeriod,
        swellPeakPeriod,
        windWaveHeight,
        windWaveDirection,
        windWavePeriod,
        windSpeed,
        windDirection,
        windGusts,
        temperature,
        weatherCode,
        rating,
        ratingScore,
      };
    });

    // Group by day
    const dayMap = new Map<string, HourlyForecast[]>();
    for (const h of hourlyForecasts) {
      const dateStr = h.time.split('T')[0];
      if (!dayMap.has(dateStr)) {
        dayMap.set(dateStr, []);
      }
      dayMap.get(dateStr)!.push(h);
    }

    const days: DailyForecast[] = Array.from(dayMap.entries()).map(([date, hours]) => {
      const bestHour = hours.reduce((best, h) => (h.ratingScore > best.ratingScore ? h : best), hours[0]);
      const waveHeights = hours.map((h) => Math.max(h.waveHeight, h.swellHeight));
      const periods = hours.filter((h) => h.swellPeriod > 0).map((h) => h.swellPeriod);

      // Dominant swell direction = direction of the hour with highest swell
      const maxSwellHour = hours.reduce((best, h) => (h.swellHeight > best.swellHeight ? h : best), hours[0]);

      const d = new Date(date + 'T12:00:00');
      const today = new Date();
      today.setHours(12, 0, 0, 0);
      const diffDays = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      let dayLabel: string;
      if (diffDays === 0) dayLabel = 'Today';
      else if (diffDays === 1) dayLabel = 'Tomorrow';
      else dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });

      return {
        date,
        dayLabel,
        hours,
        bestRating: bestHour.rating,
        bestScore: bestHour.ratingScore,
        maxWaveHeight: Math.max(...waveHeights),
        minWaveHeight: Math.min(...waveHeights.filter((h) => h > 0), 0),
        avgPeriod: periods.length > 0 ? periods.reduce((s, p) => s + p, 0) / periods.length : 0,
        dominantSwellDir: maxSwellHour.swellDirection,
      };
    });

    // Find current hour
    const now = new Date();
    const currentHourStr = now.toISOString().split(':')[0]; // "2025-01-20T14"
    let currentHour = hourlyForecasts.find((h) => h.time.startsWith(currentHourStr)) || null;
    if (!currentHour && hourlyForecasts.length > 0) {
      // Find closest hour
      const nowMs = now.getTime();
      currentHour = hourlyForecasts.reduce((closest, h) => {
        const hMs = new Date(h.time).getTime();
        const closestMs = new Date(closest.time).getTime();
        return Math.abs(hMs - nowMs) < Math.abs(closestMs - nowMs) ? h : closest;
      });
    }

    const response: ForecastResponse = {
      spot,
      days,
      currentHour,
      fetchedAt: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Surf forecast error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch forecast data' },
      { status: 500 }
    );
  }
}
