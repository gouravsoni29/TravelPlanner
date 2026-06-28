import { weatherService, WeatherService } from '../services/weather.service';
import { rankActivities } from '../scoring/activityScorer';
import { createCityFromCoordinates } from '../utils/city';

export interface ActivityRankingsArgs {
  cityId: string;
}

/**
 * Resolver for the `activityRankings` query.
 *
 * Fetches the weather forecast for a city and passes the daily data
 * to the pure scoring engine. The resolver itself has no business logic —
 * it is purely an orchestration layer between the transport and the domain.
 */
export const activitiesResolver = {
  Query: {
    activityRankings: async (_parent: unknown, { cityId }: ActivityRankingsArgs) => {
      const { latitude, longitude } = WeatherService.parseCityId(cityId);
      const city = createCityFromCoordinates(cityId, latitude, longitude);

      const forecast = await weatherService.getForecast(city);
      return rankActivities(forecast.daily);
    },
  },
};
