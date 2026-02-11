export interface SurfSpot {
  id: string;
  name: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
  facing: number; // degrees the beach faces (270 = west-facing)
  idealSwellDir: [number, number]; // min/max ideal swell direction range
  idealSwellSize: [number, number]; // min/max ideal swell height in meters
  type: 'beach' | 'reef' | 'point';
  description: string;
}

export interface HourlyForecast {
  time: string;
  waveHeight: number; // meters
  waveDirection: number;
  wavePeriod: number; // seconds
  wavePeakPeriod: number;
  swellHeight: number;
  swellDirection: number;
  swellPeriod: number;
  swellPeakPeriod: number;
  windWaveHeight: number;
  windWaveDirection: number;
  windWavePeriod: number;
  windSpeed: number; // km/h
  windDirection: number;
  windGusts: number;
  temperature: number; // celsius
  weatherCode: number;
  rating: SurfRating;
  ratingScore: number;
}

export interface DailyForecast {
  date: string;
  dayLabel: string;
  hours: HourlyForecast[];
  bestRating: SurfRating;
  bestScore: number;
  maxWaveHeight: number;
  minWaveHeight: number;
  avgPeriod: number;
  dominantSwellDir: number;
}

export interface ForecastResponse {
  spot: SurfSpot;
  days: DailyForecast[];
  currentHour: HourlyForecast | null;
  fetchedAt: string;
}

export type SurfRating =
  | 'FLAT'
  | 'VERY_POOR'
  | 'POOR'
  | 'POOR_TO_FAIR'
  | 'FAIR'
  | 'FAIR_TO_GOOD'
  | 'GOOD'
  | 'EPIC';

export const RATING_CONFIG: Record<SurfRating, { label: string; color: string; bgColor: string; barCount: number }> = {
  FLAT: { label: 'Flat', color: '#9CA3AF', bgColor: '#F3F4F6', barCount: 0 },
  VERY_POOR: { label: 'Very Poor', color: '#6B7280', bgColor: '#F3F4F6', barCount: 1 },
  POOR: { label: 'Poor', color: '#EF4444', bgColor: '#FEF2F2', barCount: 2 },
  POOR_TO_FAIR: { label: 'Poor-Fair', color: '#F97316', bgColor: '#FFF7ED', barCount: 3 },
  FAIR: { label: 'Fair', color: '#EAB308', bgColor: '#FEFCE8', barCount: 4 },
  FAIR_TO_GOOD: { label: 'Fair-Good', color: '#22C55E', bgColor: '#F0FDF4', barCount: 5 },
  GOOD: { label: 'Good', color: '#16A34A', bgColor: '#DCFCE7', barCount: 6 },
  EPIC: { label: 'Epic!', color: '#7C3AED', bgColor: '#F5F3FF', barCount: 7 },
};

export function metersToFeet(m: number): number {
  return m * 3.28084;
}

export function degreesToCompass(deg: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

export function kmhToMph(kmh: number): number {
  return kmh * 0.621371;
}

export function kmhToKnots(kmh: number): number {
  return kmh * 0.539957;
}
