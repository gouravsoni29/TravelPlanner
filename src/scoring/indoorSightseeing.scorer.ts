import { ActivityRanking, ActivityType, DailyForecast } from '../types';
import { average, clamp, isSevereWeather, lerp, roundScore, scoreToLabel } from './common';

export function scoreIndoorSightseeing(daily: DailyForecast[]): ActivityRanking {
    const avgPrecip = average(daily.map((day) => day.precipitationSum));
    const avgTempMax = average(daily.map((day) => day.temperatureMax));
    const avgTempMin = average(daily.map((day) => day.temperatureMin));
    const hasSevere = daily.some((day) => isSevereWeather(day.weatherCode));
    const rainyDays = daily.filter((day) => day.precipitationSum > 2).length;
    const rainRatio = rainyDays / daily.length;

    const precipScore = lerp(avgPrecip, 0, 10, 0, 100);
    const extremeTempScore =
        avgTempMax > 35
            ? lerp(avgTempMax, 35, 45, 0, 100)
            : avgTempMin < 0
                ? lerp(avgTempMin, 0, -15, 0, 100)
                : 0;
    const rainConsistency = rainRatio * 100;

    let score = clamp(
        precipScore * 0.4 + extremeTempScore * 0.3 + rainConsistency * 0.3,
        0,
        100,
    );

    if (hasSevere) score = Math.min(score + 20, 100);
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
        score: roundScore(score),
        label,
        reasoning: reason,
    };
}
