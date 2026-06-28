/// <reference types="jest" />
import { describe, expect, it, jest } from '@jest/globals';
import type { FetchHttpClient } from '../../src/utils/httpClient';
import { WeatherService } from '../../src/services/weather.service';
import { TravelPlannerError, ErrorCode } from '../../src/utils/errors';
import { City } from '../../src/types';

const testCity: City = {
  id: '51.50853,-0.12574',
  name: 'London',
  country: 'United Kingdom',
  countryCode: 'GB',
  admin1: 'England',
  latitude: 51.50853,
  longitude: -0.12574,
  timezone: 'Europe/London',
  population: 7556900,
};

/** Build 7 days of fake daily array data */
function makeRawDailyResponse(days: number = 7) {
  const time = Array.from({ length: days }, (_, i) => `2025-01-0${i + 1}`);
  return {
    time,
    temperature_2m_max: time.map(() => 12),
    temperature_2m_min: time.map(() => 5),
    precipitation_sum: time.map(() => 2),
    wind_speed_10m_max: time.map(() => 20),
    weather_code: time.map(() => 1),
    snowfall_sum: time.map(() => 0),
    uv_index_max: time.map(() => 3),
  };
}

function buildMockClient(responseData: unknown) {
  const mockGet = jest.fn(async () => responseData);
  return { get: mockGet as FetchHttpClient['get'] } as FetchHttpClient;
}

describe('WeatherService', () => {
  describe('getForecast', () => {
    it('maps column-oriented API response to structured DailyForecast array', async () => {
      const mockClient = buildMockClient({
        latitude: 51.50853,
        longitude: -0.12574,
        timezone: 'Europe/London',
        generationtime_ms: 1.5,
        daily: makeRawDailyResponse(),
      });
      const service = new WeatherService(mockClient);

      const forecast = await service.getForecast(testCity);

      expect(forecast.city).toEqual(testCity);
      expect(forecast.daily).toHaveLength(7);
      expect(forecast.daily[0]).toMatchObject({
        date: '2025-01-01',
        temperatureMax: 12,
        temperatureMin: 5,
        precipitationSum: 2,
        windSpeedMax: 20,
        weatherCode: 1,
        snowfallSum: 0,
        uvIndexMax: 3,
      });
    });

    it('sets generatedAt to an ISO timestamp', async () => {
      const mockClient = buildMockClient({
        latitude: 51.5,
        longitude: -0.1,
        timezone: 'UTC',
        generationtime_ms: 1,
        daily: makeRawDailyResponse(),
      });
      const service = new WeatherService(mockClient);
      const forecast = await service.getForecast(testCity);

      expect(() => new Date(forecast.generatedAt)).not.toThrow();
      expect(forecast.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('throws NOT_FOUND when API returns empty daily data', async () => {
      const mockClient = buildMockClient({
        latitude: 51.5,
        longitude: -0.1,
        timezone: 'UTC',
        generationtime_ms: 1,
        daily: { time: [] },
      });
      const service = new WeatherService(mockClient);

      await expect(service.getForecast(testCity)).rejects.toMatchObject({
        code: ErrorCode.NOT_FOUND,
      });
    });

    it('passes correct query parameters to the API', async () => {
      const mockGet = jest.fn(async () => ({
        latitude: 51.5,
        longitude: -0.1,
        timezone: 'Europe/London',
        generationtime_ms: 1,
        daily: makeRawDailyResponse(),
      }));
      const mockClient = { get: mockGet as FetchHttpClient['get'] } as FetchHttpClient;
      const service = new WeatherService(mockClient);

      await service.getForecast(testCity);

      expect(mockGet).toHaveBeenCalledWith(
        '/forecast',
        expect.objectContaining({
          latitude: 51.50853,
          longitude: -0.12574,
          forecast_days: 7,
        }),
      );
    });
  });

  describe('parseCityId', () => {
    it('parses valid "lat,lon" id correctly', () => {
      const result = WeatherService.parseCityId('51.50853,-0.12574');
      expect(result).toEqual({ latitude: 51.50853, longitude: -0.12574 });
    });

    it('throws INVALID_CITY_ID for malformed id', () => {
      expect(() => WeatherService.parseCityId('not-a-valid-id')).toThrow(TravelPlannerError);
      expect(() => WeatherService.parseCityId('not-a-valid-id')).toThrow(
        expect.objectContaining({ code: ErrorCode.INVALID_CITY_ID }),
      );
    });

    it('throws INVALID_CITY_ID for non-numeric coordinates', () => {
      expect(() => WeatherService.parseCityId('abc,def')).toThrow(
        expect.objectContaining({ code: ErrorCode.INVALID_CITY_ID }),
      );
    });

    it('throws INVALID_CITY_ID for too many segments', () => {
      expect(() => WeatherService.parseCityId('51.5,-0.1,100')).toThrow(
        expect.objectContaining({ code: ErrorCode.INVALID_CITY_ID }),
      );
    });

    it('handles negative coordinates', () => {
      const result = WeatherService.parseCityId('-33.8688,151.2093');
      expect(result).toEqual({ latitude: -33.8688, longitude: 151.2093 });
    });
  });
});
