import { DailyForecast, ActivityType, ActivityLabel, ActivityRanking } from '../types';

/**
 * Activity Scoring Engine
 *
 * All scorer functions are pure: they take forecast data and return a score.
 * No I/O, no side-effects — fully unit-testable without any mocking.
 *
 * Scoring approach:
 * - Each scorer computes a 0–100 score by evaluating relevant weather signals.
 * - Multiple signals are combined with weighted averaging.
 * - Scores are then clamped to [0, 100] and labelled.
 *
 * WMO Weather Interpretation Codes (used for outdoor suitability):
 *   0       = Clear sky
 *   1,2,3   = Mainly clear, partly cloudy, overcast
 *   45,48   = Fog
 *   51–57   = Drizzle
 *   61–67   = Rain
 *   71–77   = Snow fall
 *   80–82   = Rain showers
 *   85,86   = Snow showers
 *   95      = Thunderstorm
 *   96,99   = Thunderstorm with hail
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Clamp a value to [min, max]. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Linear interpolation: maps `value` from [inMin,inMax] to [outMin,outMax]. */
function lerp(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  if (inMax === inMin) return outMin;
  const t = clamp((value - inMin) / (inMax - inMin), 0, 1);
  return outMin + t * (outMax - outMin);
}

/** Compute the average of an array of numbers. Returns 0 for empty arrays. */
function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Returns true for WMO codes that indicate severe/storm weather.
 * Outdoor activities get heavily penalised by these.
 */
function isSevereWeather(code: number): boolean {
  // Thunderstorms (95, 96, 99), heavy rain (65, 67), heavy snow (75, 77)
  return [65, 67, 75, 77, 95, 96, 99].includes(code);
}

/** Maps a numeric score to a human-readable quality label. */
function scoreToLabel(score: number): ActivityLabel {
  if (score >= 75) return 'Excellent';
  if (score >= 50) return 'Good';
  if (score >= 25) return 'Fair';
  return 'Poor';
}

// ---------------------------------------------------------------------------
// Individual scorers
// ---------------------------------------------------------------------------

/**
 * SKIING SCORER
 *
 * Ideal conditions:
 * - Significant snowfall (>= 5 cm/day is great, <= 0 is terrible)
 * - Cold temperatures (max <= 2°C ideal, above 5°C bad for snow quality)
 * - Moderate wind (< 50 km/h; very high wind = lift closures)
 *
 * Weights: snowfall 50%, temperature 30%, wind 20%
 */
export function scoreSkiing(daily: DailyForecast[]): ActivityRanking {
  const avgSnowfall = average(daily.map((d) => d.snowfallSum));
  const avgTempMax = average(daily.map((d) => d.temperatureMax));
  const avgWindMax = average(daily.map((d) => d.windSpeedMax));

  // Snowfall: 0 cm → 0 pts, ≥10 cm → 100 pts
  const snowScore = lerp(avgSnowfall, 0, 10, 0, 100);

  // Temperature: ≤ -5°C → 100 pts (powder conditions), 0°C → 80 pts, 5°C → 0 pts
  const tempScore = lerp(avgTempMax, 5, -10, 0, 100);

  // Wind: ≤ 20 km/h → 100 pts (ideal), 50 km/h → 0 pts (dangerous)
  const windScore = lerp(avgWindMax, 50, 20, 0, 100);

  const score = clamp(snowScore * 0.5 + tempScore * 0.3 + windScore * 0.2, 0, 100);
  const label = scoreToLabel(score);

  const snowDesc =
    avgSnowfall >= 5
      ? `good snowfall (${avgSnowfall.toFixed(1)} cm/day avg)`
      : `limited snowfall (${avgSnowfall.toFixed(1)} cm/day avg)`;
  const tempDesc =
    avgTempMax <= 2
      ? `cold temperatures (${avgTempMax.toFixed(1)}°C max avg)`
      : `warm temperatures (${avgTempMax.toFixed(1)}°C max avg)`;

  return {
    activity: ActivityType.SKIING,
    score: Math.round(score * 10) / 10,
    label,
    reasoning: `Skiing conditions are ${label.toLowerCase()} with ${snowDesc} and ${tempDesc}.`,
  };
}

/**
 * SURFING SCORER
 *
 * Ideal conditions:
 * - Moderate wind (10–25 km/h generates good waves; < 5 km/h = flat; > 40 km/h = dangerous)
 * - Warm temperature (≥ 20°C ideal for water sports)
 * - Low precipitation (rain itself doesn't stop surfing but storms do)
 * - No severe weather codes
 *
 * Weights: wind 40%, temperature 35%, precipitation 25%
 */
export function scoreSurfing(daily: DailyForecast[]): ActivityRanking {
  const avgWind = average(daily.map((d) => d.windSpeedMax));
  const avgTempMax = average(daily.map((d) => d.temperatureMax));
  const avgPrecip = average(daily.map((d) => d.precipitationSum));
  const hasSevere = daily.some((d) => isSevereWeather(d.weatherCode));

  // Wind: peaks at 20 km/h → 100 pts; < 5 km/h or > 45 km/h → low
  let windScore: number;
  if (avgWind >= 5 && avgWind <= 30) {
    windScore = lerp(Math.abs(avgWind - 17.5), 0, 12.5, 100, 40);
  } else if (avgWind < 5) {
    windScore = lerp(avgWind, 0, 5, 0, 40);
  } else {
    windScore = lerp(avgWind, 30, 60, 40, 0);
  }

  // Temperature: ≤ 10°C → 0, 20°C → 100
  const tempScore = lerp(avgTempMax, 10, 25, 0, 100);

  // Precipitation: 0 mm → 100, ≥ 10 mm → 0
  const precipScore = lerp(avgPrecip, 10, 0, 0, 100);

  let score = clamp(windScore * 0.4 + tempScore * 0.35 + precipScore * 0.25, 0, 100);

  // Severe weather is a hard penalty
  if (hasSevere) score = Math.min(score, 20);

  const label = scoreToLabel(score);
  const windDesc =
    avgWind >= 10 && avgWind <= 30
      ? `favourable wind (${avgWind.toFixed(0)} km/h avg)`
      : `unfavourable wind (${avgWind.toFixed(0)} km/h avg)`;
  const tempDesc = `${avgTempMax.toFixed(1)}°C avg high`;

  return {
    activity: ActivityType.SURFING,
    score: Math.round(score * 10) / 10,
    label,
    reasoning: `Surfing conditions are ${label.toLowerCase()} with ${windDesc} and ${tempDesc}.${hasSevere ? ' Severe weather detected — dangerous for water sports.' : ''}`,
  };
}

/**
 * INDOOR SIGHTSEEING SCORER
 *
 * Indoor sightseeing is best when outdoor conditions are bad —
 * this is the "rainy day" activity. It thrives when:
 * - Heavy or persistent rain/snow
 * - Extreme temperatures (very hot or very cold)
 * - Poor visibility or storms
 *
 * Strategy: invert the outdoor sightseeing signals, then boost for storms.
 * Weights: precipitation 45%, extreme temp 30%, bad weather code 25%
 */
export function scoreIndoorSightseeing(daily: DailyForecast[]): ActivityRanking {
  const avgPrecip = average(daily.map((d) => d.precipitationSum));
  const avgTempMax = average(daily.map((d) => d.temperatureMax));
  const avgTempMin = average(daily.map((d) => d.temperatureMin));
  const hasSevere = daily.some((d) => isSevereWeather(d.weatherCode));
  const rainyDays = daily.filter((d) => d.precipitationSum > 2).length;
  const rainRatio = rainyDays / daily.length;

  // Rain score: the more rain, the better for indoor
  const precipScore = lerp(avgPrecip, 0, 10, 0, 100);

  // Extreme temperature score: comfort is < 10°C or > 35°C
  const extremeTempScore =
    avgTempMax > 35
      ? lerp(avgTempMax, 35, 45, 0, 100)
      : avgTempMin < 0
        ? lerp(avgTempMin, 0, -15, 0, 100)
        : 0;

  // Rain consistency bonus
  const rainConsistency = rainRatio * 100;

  let score = clamp(
    precipScore * 0.4 + extremeTempScore * 0.3 + rainConsistency * 0.3,
    0,
    100,
  );

  // Severe weather = perfect indoor day
  if (hasSevere) score = Math.min(score + 20, 100);

  // Always floor at 30 — museums and galleries are always an option
  score = Math.max(score, 30);

  const label = scoreToLabel(score);
  const reason =
    avgPrecip >= 5
      ? `High precipitation (${avgPrecip.toFixed(1)} mm/day avg) makes indoor venues very appealing.`
      : hasSevere
        ? 'Severe weather makes indoor attractions the safe and comfortable choice.'
        : avgTempMax > 35
          ? `Intense heat (${avgTempMax.toFixed(1)}°C) makes air-conditioned venues attractive.`
          : `Conditions are reasonable outdoors, but indoor attractions are always a worthwhile option.`;

  return {
    activity: ActivityType.INDOOR_SIGHTSEEING,
    score: Math.round(score * 10) / 10,
    label,
    reasoning: reason,
  };
}

/**
 * OUTDOOR SIGHTSEEING SCORER
 *
 * Ideal conditions:
 * - Low precipitation (< 2 mm/day)
 * - Comfortable temperature (15–28°C)
 * - Good UV (some sun but not scorching)
 * - No severe weather, no fog, no storms
 *
 * Weights: precipitation 40%, temperature comfort 35%, UV/clear sky 25%
 */
export function scoreOutdoorSightseeing(daily: DailyForecast[]): ActivityRanking {
  const avgPrecip = average(daily.map((d) => d.precipitationSum));
  const avgTempMax = average(daily.map((d) => d.temperatureMax));
  const avgUv = average(daily.map((d) => d.uvIndexMax));
  const hasSevere = daily.some((d) => isSevereWeather(d.weatherCode));
  const clearDays = daily.filter((d) => d.weatherCode <= 3).length;
  const clearRatio = clearDays / daily.length;

  // Precipitation: 0 mm → 100, ≥ 8 mm → 0
  const precipScore = lerp(avgPrecip, 8, 0, 0, 100);

  // Temperature comfort: 18–26°C sweet spot → 100, too cold or too hot → drops
  let tempScore: number;
  if (avgTempMax >= 18 && avgTempMax <= 26) {
    tempScore = 100;
  } else if (avgTempMax < 18) {
    tempScore = lerp(avgTempMax, 5, 18, 0, 100);
  } else {
    tempScore = lerp(avgTempMax, 26, 40, 100, 0);
  }

  // UV + clear sky: UV 3–6 is pleasant, very high UV penalised
  const uvScore = lerp(avgUv, 0, 6, 30, 100) - lerp(avgUv, 6, 12, 0, 40);
  const clearScore = clearRatio * 100;
  const skyScore = clamp(uvScore * 0.5 + clearScore * 0.5, 0, 100);

  let score = clamp(precipScore * 0.4 + tempScore * 0.35 + skyScore * 0.25, 0, 100);

  // Hard penalty for severe weather
  if (hasSevere) score = Math.min(score, 15);

  const label = scoreToLabel(score);
  const clearDayDesc = clearDays === daily.length ? 'clear skies' : `${clearDays}/${daily.length} clear days`;
  const tempDesc = `${avgTempMax.toFixed(1)}°C avg high`;

  return {
    activity: ActivityType.OUTDOOR_SIGHTSEEING,
    score: Math.round(score * 10) / 10,
    label,
    reasoning: `Outdoor sightseeing is ${label.toLowerCase()} with ${clearDayDesc}, ${tempDesc}, and ${avgPrecip.toFixed(1)} mm/day avg precipitation.${hasSevere ? ' Severe weather detected — stay safe.' : ''}`,
  };
}

// ---------------------------------------------------------------------------
// Scorer registry
// ---------------------------------------------------------------------------

/**
 * The type signature every activity scorer must satisfy.
 * Any function that matches this signature can be registered below.
 */
export type ActivityScorer = (daily: DailyForecast[]) => ActivityRanking;

/**
 * Registry of all active activity scorers.
 *
 * TO ADD A NEW ACTIVITY:
 *  1. Write a pure scorer function that returns `ActivityRanking`
 *  2. Add a new value to `ActivityType` in src/types/index.ts
 *  3. Add the new scorer to this array — nothing else needs to change.
 *
 * The order here does NOT matter; rankings are always sorted by score.
 */
const ACTIVITY_SCORERS: ActivityScorer[] = [
  scoreSkiing,
  scoreSurfing,
  scoreIndoorSightseeing,
  scoreOutdoorSightseeing,
];

// ---------------------------------------------------------------------------
// Aggregator
// ---------------------------------------------------------------------------

/**
 * Runs every registered scorer against the provided forecast data and
 * returns results sorted from best to worst score.
 *
 * Adding a new activity requires no changes here — just update ACTIVITY_SCORERS.
 */
export function rankActivities(daily: DailyForecast[]): ActivityRanking[] {
  return ACTIVITY_SCORERS
    .map((score) => score(daily))
    .sort((a, b) => b.score - a.score);
}
