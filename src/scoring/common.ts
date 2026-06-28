import { ActivityLabel, DailyForecast } from '../types';

/** Clamp a value to [min, max]. */
export function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

/** Linear interpolation: maps `value` from [inMin,inMax] to [outMin,outMax]. */
export function lerp(
    value: number,
    inMin: number,
    inMax: number,
    outMin: number,
    outMax: number,
): number {
    if (inMax === inMin) return outMin;
    const t = clamp((value - inMin) / (inMax - inMin), 0, 1);
    return outMin + t * (outMax - outMin);
}

/** Compute the average of an array of numbers. Returns 0 for empty arrays. */
export function average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Returns true for WMO codes that indicate severe/storm weather.
 * Outdoor activities get heavily penalised by these.
 */
export function isSevereWeather(code: number): boolean {
    return [65, 67, 75, 77, 95, 96, 99].includes(code);
}

/** Maps a numeric score to a human-readable quality label. */
export function scoreToLabel(score: number): ActivityLabel {
    if (score >= 75) return 'Excellent';
    if (score >= 50) return 'Good';
    if (score >= 25) return 'Fair';
    return 'Poor';
}

/** Build a rounded score and keep the logic consistent across scorers. */
export function roundScore(score: number): number {
    return Math.round(score * 10) / 10;
}

export function getAverageDailyValue(daily: DailyForecast[], key: keyof DailyForecast): number {
    return average(daily.map((day) => day[key] as number));
}
