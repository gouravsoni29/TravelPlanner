import { ActivityRanking, ActivityType, DailyForecast } from '../types';
import { average, clamp, isSevereWeather, lerp, roundScore, scoreToLabel } from './common';

export function scoreSurfing(daily: DailyForecast[]): ActivityRanking {
    const avgWind = average(daily.map((day) => day.windSpeedMax));
    const avgTempMax = average(daily.map((day) => day.temperatureMax));
    const avgPrecip = average(daily.map((day) => day.precipitationSum));
    const hasSevere = daily.some((day) => isSevereWeather(day.weatherCode));

    let windScore: number;
    if (avgWind >= 5 && avgWind <= 30) {
        windScore = lerp(Math.abs(avgWind - 17.5), 0, 12.5, 100, 40);
    } else if (avgWind < 5) {
        windScore = lerp(avgWind, 0, 5, 0, 40);
    } else {
        windScore = lerp(avgWind, 30, 60, 40, 0);
    }

    const tempScore = lerp(avgTempMax, 10, 25, 0, 100);
    const precipScore = lerp(avgPrecip, 10, 0, 0, 100);

    let score = clamp(windScore * 0.4 + tempScore * 0.35 + precipScore * 0.25, 0, 100);

    if (hasSevere) score = Math.min(score, 20);

    const label = scoreToLabel(score);
    const windDesc =
        avgWind >= 10 && avgWind <= 30
            ? `favourable wind (${avgWind.toFixed(0)} km/h avg)`
            : `unfavourable wind (${avgWind.toFixed(0)} km/h avg)`;
    const tempDesc = `${avgTempMax.toFixed(1)}°C avg high`;

    return {
        activity: ActivityType.SURFING,
        score: roundScore(score),
        label,
        reasoning: `Surfing conditions are ${label.toLowerCase()} with ${windDesc} and ${tempDesc}.${hasSevere ? ' Severe weather detected — dangerous for water sports.' : ''}`,
    };
}
