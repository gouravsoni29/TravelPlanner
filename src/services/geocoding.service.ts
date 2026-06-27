import { AxiosInstance } from 'axios';
import { createHttpClient } from '../utils/httpClient';
import { TravelPlannerError, ErrorCode } from '../utils/errors';
import { City } from '../types';
import { config } from '../config';

/**
 * Raw shape of a single result from the Open-Meteo Geocoding API.
 * Typed loosely to match what the external API actually returns.
 */
interface GeocodingResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  country_code?: string;
  admin1?: string;
  timezone?: string;
  population?: number;
}

interface GeocodingApiResponse {
  results?: GeocodingResult[];
  generationtime_ms?: number;
}

/**
 * GeocodingService wraps the Open-Meteo Geocoding API.
 *
 * The service is a plain class (not a singleton) so it can be instantiated
 * with a custom httpClient in tests, enabling full isolation without
 * touching the network.
 */
export class GeocodingService {
  private readonly client: AxiosInstance;

  constructor(client?: AxiosInstance) {
    this.client = client ?? createHttpClient(config.geocodingBaseUrl);
  }

  /**
   * Search for cities matching a partial or complete name.
   *
   * @param query  - Partial or complete city name (minimum 1 character)
   * @param count  - Maximum number of results to return (1–100, default 10)
   * @returns      Array of matching City objects, empty array if none found
   */
  async searchCities(query: string, count: number = 10): Promise<City[]> {
    if (!query || query.trim().length === 0) {
      throw new TravelPlannerError(
        'Search query must not be empty',
        ErrorCode.VALIDATION_ERROR,
      );
    }

    const clampedCount = Math.min(Math.max(count, 1), 100);

    const response = await this.client.get<GeocodingApiResponse>('/search', {
      params: {
        name: query.trim(),
        count: clampedCount,
        format: 'json',
        language: 'en',
      },
    });

    const results = response.data.results ?? [];
    return results.map((r) => this.mapToCity(r));
  }

  /**
   * Maps a raw API result to a clean City domain object.
   * The composite `id` ("lat,lon") is used downstream to uniquely identify
   * a city without requiring a database — keeps the API fully stateless.
   */
  private mapToCity(result: GeocodingResult): City {
    return {
      id: `${result.latitude},${result.longitude}`,
      name: result.name,
      country: result.country ?? null,
      countryCode: result.country_code ?? null,
      admin1: result.admin1 ?? null,
      latitude: result.latitude,
      longitude: result.longitude,
      timezone: result.timezone ?? null,
      population: result.population ?? null,
    };
  }
}

// Export a default instance for production use
export const geocodingService = new GeocodingService();
