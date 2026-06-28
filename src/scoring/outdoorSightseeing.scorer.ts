import { ActivityRanking, ActivityType, DailyForecast } from '../types';
import { average, clamp, isSevereWeather, lerp, roundScore, scoreToLabel } from './common';

export function scoreOutdoorSightseeing(daily: DailyForecast[]): ActivityRanking {
    const avgPrecip = average(daily.map((day) => day.precipitationSum));
    const avgTempMax = average(daily.map((day) => day.temperatureMax));
    const avgUv = average(daily.map((day) => day.uvIndexMax));
    const hasSevere = daily.some((day) => isSevereWeather(day.weatherCode));
    const clearDays = daily.filter((day) => day.weatherCode <= 3).length;
    const clearRatio = clearDays / daily.length;

    const precipScore = lerp(avgPrecip, 8, 0, 0, 100);

    let tempScore: number;
    if (avgTempMax >= 18 && avgTempMax <= 26) {
        tempScore = 100;
    } else if (avgTempMax < 18) {
        tempScore = lerp(avgTempMax, 5, 18, 0, 100);
    } else {
        tempScore = lerp(avgTempMax, 26, 40, 100, 0);
    }

    const uvScore = lerp(avgUv, 0, 6, 30, 100) - lerp(avgUv, 6, 12, 0, 40);
    const clearScore = clearRatio * 100;
    const skyScore = clamp(uvScore * 0.5 + clearScore * 0.5, 0, 100);

    let score = clamp(precipScore * 0.4 + tempScore * 0.35 + skyScore * 0.25, 0, 100);

    if (hasSevere) score = Math.min(score, 15);

    const label = scoreToLabel(score);
    const clearDayDesc = clearDays === daily.length ? 'clear skies' : `${clearDays}/${daily.length} clear days`;
    const tempDesc = `${avgTempMax.toFixed(1)}°C avg high`;

    return {
        activity: ActivityType.OUTDOOR_SIGHTSEEING,
        score: roundScore(score),
        label,
        reasoning: `Outdoor sightseeing is ${label.toLowerCase()} with ${clearDayDesc}, ${tempDesc}, and ${avgPrecip.toFixed(1)} mm/day avg precipitation.${hasSevere ? ' Severe weather detected — stay safe.' : ''}`,
    };
}
