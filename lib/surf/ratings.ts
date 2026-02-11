import { SurfSpot, SurfRating } from './types';

/**
 * Calculate the angular difference between two compass directions.
 * Returns 0-180 (0 = same direction, 180 = opposite).
 */
function angleDiff(a: number, b: number): number {
  let diff = Math.abs(a - b) % 360;
  if (diff > 180) diff = 360 - diff;
  return diff;
}

/**
 * Check if an angle falls within a range (handling wrapping around 360).
 */
function isInRange(angle: number, min: number, max: number): boolean {
  angle = ((angle % 360) + 360) % 360;
  if (min <= max) {
    return angle >= min && angle <= max;
  }
  // Range wraps around 360 (e.g., 340 to 20)
  return angle >= min || angle <= max;
}

/**
 * Offshore wind direction for a beach facing a given direction.
 * Offshore = wind blowing from land to sea = opposite of facing direction.
 */
function offshoreDirection(facing: number): number {
  return (facing + 180) % 360;
}

interface RatingInput {
  waveHeight: number;      // meters (total)
  swellHeight: number;     // meters
  swellPeriod: number;     // seconds
  swellDirection: number;  // degrees
  windSpeed: number;       // km/h
  windDirection: number;   // degrees
}

/**
 * Calculate a surf condition rating (0-100 score) for a specific spot.
 *
 * Based on:
 * 1. Wave height relative to spot's ideal range (0-25 pts)
 * 2. Swell period (longer = better) (0-25 pts)
 * 3. Wind speed and direction relative to shore (0-30 pts)
 * 4. Swell direction alignment with spot (0-20 pts)
 */
export function calculateRatingScore(spot: SurfSpot, input: RatingInput): number {
  const { waveHeight, swellHeight, swellPeriod, swellDirection, windSpeed, windDirection } = input;

  // Use the larger of wave height or swell height for size scoring
  const effectiveHeight = Math.max(waveHeight, swellHeight);

  // 1. Wave height score (0-25)
  let heightScore = 0;
  if (effectiveHeight < 0.2) {
    heightScore = 0; // flat
  } else if (effectiveHeight < spot.idealSwellSize[0]) {
    // Below ideal range - partial score
    heightScore = (effectiveHeight / spot.idealSwellSize[0]) * 15;
  } else if (effectiveHeight <= spot.idealSwellSize[1]) {
    // In ideal range - full score
    heightScore = 25;
  } else if (effectiveHeight <= spot.idealSwellSize[1] * 1.5) {
    // Above ideal but surfable - declining score
    const overFactor = (effectiveHeight - spot.idealSwellSize[1]) / (spot.idealSwellSize[1] * 0.5);
    heightScore = 25 - overFactor * 10;
  } else {
    // Way too big for the spot
    heightScore = 10;
  }

  // 2. Swell period score (0-25)
  let periodScore = 0;
  if (swellPeriod < 5) {
    periodScore = 2;
  } else if (swellPeriod < 8) {
    periodScore = 5 + (swellPeriod - 5) * 2.5; // 5-12.5
  } else if (swellPeriod < 12) {
    periodScore = 12.5 + (swellPeriod - 8) * 2; // 12.5-20.5
  } else if (swellPeriod < 16) {
    periodScore = 20.5 + (swellPeriod - 12) * 1.125; // 20.5-25
  } else {
    periodScore = 25;
  }

  // 3. Wind score (0-30)
  let windScore = 0;
  const offshore = offshoreDirection(spot.facing);
  const windAngleDiff = angleDiff(windDirection, offshore);

  if (windSpeed < 5) {
    // Glass - nearly perfect regardless of direction
    windScore = 28;
  } else if (windSpeed < 10) {
    // Light wind - direction matters some
    if (windAngleDiff < 45) windScore = 27;       // offshore
    else if (windAngleDiff < 90) windScore = 23;   // cross-offshore
    else if (windAngleDiff < 135) windScore = 16;  // cross-onshore
    else windScore = 12;                            // onshore
  } else if (windSpeed < 20) {
    // Moderate wind - direction matters a lot
    if (windAngleDiff < 45) windScore = 24;
    else if (windAngleDiff < 90) windScore = 16;
    else if (windAngleDiff < 135) windScore = 8;
    else windScore = 3;
  } else if (windSpeed < 30) {
    // Strong wind
    if (windAngleDiff < 45) windScore = 18;
    else if (windAngleDiff < 90) windScore = 10;
    else windScore = 2;
  } else {
    // Very strong wind - bad conditions regardless
    if (windAngleDiff < 45) windScore = 12;
    else windScore = 1;
  }

  // 4. Swell direction score (0-20)
  let dirScore = 0;
  if (isInRange(swellDirection, spot.idealSwellDir[0], spot.idealSwellDir[1])) {
    dirScore = 20; // Perfect alignment
  } else {
    const midIdeal = (spot.idealSwellDir[0] + spot.idealSwellDir[1]) / 2;
    const dirDiff = angleDiff(swellDirection, midIdeal);
    if (dirDiff < 30) dirScore = 16;
    else if (dirDiff < 60) dirScore = 10;
    else if (dirDiff < 90) dirScore = 5;
    else dirScore = 2;
  }

  const total = Math.round(heightScore + periodScore + windScore + dirScore);
  return Math.min(100, Math.max(0, total));
}

/**
 * Convert a numeric score (0-100) to a surf rating category.
 */
export function scoreToRating(score: number, waveHeight: number): SurfRating {
  if (waveHeight < 0.2) return 'FLAT';
  if (score < 20) return 'VERY_POOR';
  if (score < 32) return 'POOR';
  if (score < 42) return 'POOR_TO_FAIR';
  if (score < 55) return 'FAIR';
  if (score < 68) return 'FAIR_TO_GOOD';
  if (score < 82) return 'GOOD';
  return 'EPIC';
}
