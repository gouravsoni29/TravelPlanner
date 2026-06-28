import { weatherService, WeatherService } from '../services/weather.service';
import { createCityFromCoordinates } from '../utils/city';

export interface WeatherForecastArgs {
  cityId: string;
}

/**
 * Reconstruct a minimal City from a composite city id.
 * The resolver stays thin while the helper keeps the fallback shape consistent.
 */
function buildCityFromId(cityId: string) {
  const { latitude, longitude } = WeatherService.parseCityId(cityId);
  return createCityFromCoordinates(cityId, latitude, longitude);
}

/**
 * Resolver for the `weatherForecast` query.
 *
 * The cityId is parsed back into coordinates and used to fetch the forecast.
 * City metadata (name, country, etc.) is not re-fetched here — in a
 * production system, a caching layer or a combined query would handle this.
 */
export const weatherResolver = {
  Query: {
    weatherForecast: async (_parent: unknown, { cityId }: WeatherForecastArgs) => {
      const city = buildCityFromId(cityId);
      return weatherService.getForecast(city);
    },
  },
};
