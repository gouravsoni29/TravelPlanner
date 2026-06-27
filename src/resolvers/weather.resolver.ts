import { weatherService, WeatherService } from '../services/weather.service';
import { City } from '../types';

export interface WeatherForecastArgs {
  cityId: string;
}

/**
 * Resolves a cityId ("lat,lon") back into a minimal City object.
 * Since there's no database, we reconstruct what we can from the coordinates.
 * The city name and metadata are fetched from the forecast API response context.
 */
function buildCityFromId(cityId: string): City {
  const { latitude, longitude } = WeatherService.parseCityId(cityId);
  return {
    id: cityId,
    name: `${latitude}, ${longitude}`, // placeholder — real data from geocoding
    country: null,
    countryCode: null,
    admin1: null,
    latitude,
    longitude,
    timezone: null,
    population: null,
  };
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
