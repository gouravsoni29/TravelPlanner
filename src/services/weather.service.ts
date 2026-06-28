import { createHttpClient, FetchHttpClient } from '../utils/httpClient';
import { TravelPlannerError, ErrorCode } from '../utils/errors';
import { City, DailyForecast, WeatherForecast } from '../types';
import { config } from '../config';

/**
 * Variables requested from Open-Meteo forecast API.
 * These cover all signals needed by the activity scoring engine.
 */
const DAILY_VARIABLES = [
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_sum',
  'wind_speed_10m_max',
  'weather_code',
  'snowfall_sum',
  'uv_index_max',
].join(',');

const FORECAST_DAYS = 7;

/** Raw daily arrays returned by the Open-Meteo forecast API */
interface ForecastDailyRaw {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_sum: number[];
  wind_speed_10m_max: number[];
  weather_code: number[];
  snowfall_sum: number[];
  uv_index_max: number[];
}

interface ForecastApiResponse {
  latitude: number;
  longitude: number;
  timezone: string;
  daily: ForecastDailyRaw;
  generationtime_ms: number;
}

function unwrapForecastResponse(response: ForecastApiResponse | { data: ForecastApiResponse }): ForecastApiResponse {
  if (response && typeof response === 'object' && 'data' in response) {
    return (response as { data: ForecastApiResponse }).data;
  }

  return response as ForecastApiResponse;
}

/**
 * WeatherService wraps the Open-Meteo Forecast API.
 *
 * Like GeocodingService, the HTTP client is injected so tests can
 * mock it without network calls.
 */
export class WeatherService {
  private readonly client: FetchHttpClient;

  constructor(client?: FetchHttpClient) {
    this.client = client ?? createHttpClient(config.weatherBaseUrl);
  }

  /**
   * Fetch a 7-day weather forecast for the given coordinates.
   *
   * @param city - The City domain object (provides lat/lon and metadata)
   * @returns    Structured WeatherForecast with one DailyForecast per day
   */
  async getForecast(city: City): Promise<WeatherForecast> {
    const response = await this.client.get<ForecastApiResponse>('/forecast', {
      latitude: city.latitude,
      longitude: city.longitude,
      daily: DAILY_VARIABLES,
      timezone: city.timezone ?? 'UTC',
      forecast_days: FORECAST_DAYS,
    });

    const raw = unwrapForecastResponse(response);

    if (!raw.daily || !raw.daily.time || raw.daily.time.length === 0) {
      throw new TravelPlannerError(
        `No forecast data returned for coordinates (${city.latitude}, ${city.longitude})`,
        ErrorCode.NOT_FOUND,
      );
    }

    return {
      city,
      daily: this.mapDailyForecasts(raw.daily),
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Converts the column-oriented API response (arrays of values)
   * into a row-oriented array of DailyForecast objects.
   */
  private mapDailyForecasts(daily: ForecastDailyRaw): DailyForecast[] {
    return daily.time.map((date, i) => ({
      date,
      temperatureMax: daily.temperature_2m_max[i] ?? 0,
      temperatureMin: daily.temperature_2m_min[i] ?? 0,
      precipitationSum: daily.precipitation_sum[i] ?? 0,
      windSpeedMax: daily.wind_speed_10m_max[i] ?? 0,
      weatherCode: daily.weather_code[i] ?? 0,
      snowfallSum: daily.snowfall_sum[i] ?? 0,
      uvIndexMax: daily.uv_index_max[i] ?? 0,
    }));
  }

  /**
   * Parse a "lat,lon" composite city ID back into numeric coordinates.
   * Used by resolvers to reconstruct a minimal City from just an ID.
   */
  static parseCityId(cityId: string): { latitude: number; longitude: number } {
    const parts = cityId.split(',');
    if (parts.length !== 2) {
      throw new TravelPlannerError(
        `Invalid cityId format: "${cityId}". Expected "latitude,longitude".`,
        ErrorCode.INVALID_CITY_ID,
      );
    }

    const latitude = parseFloat(parts[0]);
    const longitude = parseFloat(parts[1]);

    if (isNaN(latitude) || isNaN(longitude)) {
      throw new TravelPlannerError(
        `cityId contains non-numeric coordinates: "${cityId}"`,
        ErrorCode.INVALID_CITY_ID,
      );
    }

    return { latitude, longitude };
  }
}

// Export a default instance for production use
export const weatherService = new WeatherService();
