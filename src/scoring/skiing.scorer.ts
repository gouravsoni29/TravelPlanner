import { ActivityRanking, ActivityType, DailyForecast } from '../types';
import { average, clamp, lerp, roundScore, scoreToLabel } from './common';

export function scoreSkiing(daily: DailyForecast[]): ActivityRanking {
    const avgSnowfall = average(daily.map((day) => day.snowfallSum));
    const avgTempMax = average(daily.map((day) => day.temperatureMax));
    const avgWindMax = average(daily.map((day) => day.windSpeedMax));

    const snowScore = lerp(avgSnowfall, 0, 10, 0, 100);
    const tempScore = lerp(avgTempMax, 5, -10, 0, 100);
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
        score: roundScore(score),
        label,
        reasoning: `Skiing conditions are ${label.toLowerCase()} with ${snowDesc} and ${tempDesc}.`,
    };
}
