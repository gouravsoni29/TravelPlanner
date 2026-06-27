import type { AxiosInstance } from 'axios';
import { GeocodingService } from '../../src/services/geocoding.service';
import { TravelPlannerError, ErrorCode } from '../../src/utils/errors';

// Mock axios so the module-level `geocodingService` singleton can be safely
// instantiated at import time without making real HTTP calls.
// Individual tests inject their own mockClient directly into the constructor.
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn(),
    interceptors: { response: { use: jest.fn() } },
  })),
  default: {
    create: jest.fn(() => ({
      get: jest.fn(),
      interceptors: { response: { use: jest.fn() } },
    })),
  },
}));

/** Build a fake Axios instance for direct injection into GeocodingService */
function buildMockClient(responseData: unknown) {
  const mockGet = jest.fn().mockResolvedValue({ data: responseData });
  return { get: mockGet, interceptors: { response: { use: jest.fn() } } } as unknown as AxiosInstance;
}

const sampleResults = [
  {
    id: 2643743,
    name: 'London',
    latitude: 51.50853,
    longitude: -0.12574,
    country: 'United Kingdom',
    country_code: 'GB',
    admin1: 'England',
    timezone: 'Europe/London',
    population: 7556900,
  },
  {
    id: 2648110,
    name: 'London',
    latitude: 42.98339,
    longitude: -81.23304,
    country: 'Canada',
    country_code: 'CA',
    admin1: 'Ontario',
    timezone: 'America/Toronto',
    population: 346765,
  },
];

describe('GeocodingService', () => {
  describe('searchCities', () => {
    it('maps Open-Meteo results to City domain objects correctly', async () => {
      const mockClient = buildMockClient({ results: [sampleResults[0]] });
      const service = new GeocodingService(mockClient);

      const cities = await service.searchCities('London', 5);

      expect(cities).toHaveLength(1);
      expect(cities[0]).toMatchObject({
        id: '51.50853,-0.12574',
        name: 'London',
        country: 'United Kingdom',
        countryCode: 'GB',
        admin1: 'England',
        latitude: 51.50853,
        longitude: -0.12574,
        timezone: 'Europe/London',
        population: 7556900,
      });
    });

    it('returns multiple cities', async () => {
      const mockClient = buildMockClient({ results: sampleResults });
      const service = new GeocodingService(mockClient);

      const cities = await service.searchCities('London');
      expect(cities).toHaveLength(2);
    });

    it('returns empty array when API returns no results', async () => {
      const mockClient = buildMockClient({ results: undefined });
      const service = new GeocodingService(mockClient);

      const cities = await service.searchCities('zzzzz');
      expect(cities).toEqual([]);
    });

    it('generates composite id as "lat,lon"', async () => {
      const mockClient = buildMockClient({ results: [sampleResults[0]] });
      const service = new GeocodingService(mockClient);

      const cities = await service.searchCities('London');
      expect(cities[0].id).toBe('51.50853,-0.12574');
    });

    it('handles missing optional fields gracefully (null values)', async () => {
      const minimal = {
        id: 1,
        name: 'Unknown Town',
        latitude: 10.0,
        longitude: 20.0,
        // no country, country_code, admin1, timezone, population
      };
      const mockClient = buildMockClient({ results: [minimal] });
      const service = new GeocodingService(mockClient);

      const cities = await service.searchCities('Unknown');
      expect(cities[0].country).toBeNull();
      expect(cities[0].admin1).toBeNull();
      expect(cities[0].population).toBeNull();
    });

    it('throws VALIDATION_ERROR for empty query', async () => {
      const mockClient = buildMockClient({});
      const service = new GeocodingService(mockClient);

      await expect(service.searchCities('')).rejects.toThrow(TravelPlannerError);
      await expect(service.searchCities('')).rejects.toMatchObject({
        code: ErrorCode.VALIDATION_ERROR,
      });
    });

    it('clamps count to 100', async () => {
      const mockGet = jest.fn().mockResolvedValue({ data: { results: [] } });
      const mockClient = { get: mockGet } as unknown as AxiosInstance;
      const service = new GeocodingService(mockClient);

      await service.searchCities('London', 999);

      expect(mockGet).toHaveBeenCalledWith(
        '/search',
        expect.objectContaining({ params: expect.objectContaining({ count: 100 }) }),
      );
    });

    it('clamps count to minimum of 1', async () => {
      const mockGet = jest.fn().mockResolvedValue({ data: { results: [] } });
      const mockClient = { get: mockGet } as unknown as AxiosInstance;
      const service = new GeocodingService(mockClient);

      await service.searchCities('London', 0);

      expect(mockGet).toHaveBeenCalledWith(
        '/search',
        expect.objectContaining({ params: expect.objectContaining({ count: 1 }) }),
      );
    });
  });
});
