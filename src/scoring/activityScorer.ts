import { DailyForecast, ActivityRanking } from '../types';
import { scoreSkiing } from './skiing.scorer';
import { scoreSurfing } from './surfing.scorer';
import { scoreIndoorSightseeing } from './indoorSightseeing.scorer';
import { scoreOutdoorSightseeing } from './outdoorSightseeing.scorer';

export { scoreSkiing } from './skiing.scorer';
export { scoreSurfing } from './surfing.scorer';
export { scoreIndoorSightseeing } from './indoorSightseeing.scorer';
export { scoreOutdoorSightseeing } from './outdoorSightseeing.scorer';

export type ActivityScorer = (daily: DailyForecast[]) => ActivityRanking;

export const activityScorers: ActivityScorer[] = [
  scoreSkiing,
  scoreSurfing,
  scoreIndoorSightseeing,
  scoreOutdoorSightseeing,
];

export function rankActivities(daily: DailyForecast[]): ActivityRanking[] {
  return activityScorers
    .map((score) => score(daily))
    .sort((a, b) => b.score - a.score);
}
