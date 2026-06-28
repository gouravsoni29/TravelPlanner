import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../../src/index';
import { geocodingService } from '../../src/services/geocoding.service';
import { weatherService } from '../../src/services/weather.service';
import { ActivityType } from '../../src/types';
import express from 'express';

// Mock external services so integration tests don't hit the real Open-Meteo API.
// WeatherService is mocked with a factory so the real static parseCityId() is preserved —
// the resolvers call parseCityId() to validate cityId before delegating to getForecast.
jest.mock('../../src/services/geocoding.service', () => ({
  geocodingService: { searchCities: jest.fn() },
}));

jest.mock('../../src/services/weather.service', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const actual = jest.requireActual<typeof import('../../src/services/weather.service')>(
    '../../src/services/weather.service',
  );
  return {
    WeatherService: {
      parseCityId: actual.WeatherService.parseCityId.bind(actual.WeatherService),
    },
    weatherService: { getForecast: jest.fn() },
  };
});

const mockGeocodingService = geocodingService as jest.Mocked<typeof geocodingService>;
const mockWeatherService = weatherService as jest.Mocked<typeof weatherService>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockCity = {
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

const mockDailyForecast = {
  date: '2025-01-01',
  temperatureMax: 10,
  temperatureMin: 4,
  precipitationSum: 3,
  windSpeedMax: 18,
  weatherCode: 61,
  snowfallSum: 0,
  uvIndexMax: 2,
};

const mockForecast = {
  city: mockCity,
  daily: Array.from({ length: 7 }, (_, i) => ({
    ...mockDailyForecast,
    date: `2025-01-0${i + 1}`,
  })),
  generatedAt: '2025-01-01T00:00:00.000Z',
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let app: express.Application;

beforeAll(async () => {
  app = await createApp();
});

beforeEach(() => {
  mockGeocodingService.searchCities.mockResolvedValue([mockCity]);
  mockWeatherService.getForecast.mockResolvedValue(mockForecast);
});

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

async function graphql(query: string, variables: Record<string, unknown> = {}) {
  return request(app)
    .post('/graphql')
    .send({ query, variables })
    .set('Content-Type', 'application/json');
}

// ---------------------------------------------------------------------------
// Health Check
// ---------------------------------------------------------------------------

describe('GET /health', () => {
  it('returns 200 with ok status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// citySuggestions
// ---------------------------------------------------------------------------

describe('Query: citySuggestions', () => {
  const CITY_SUGGESTIONS_QUERY = `
    query CitySuggestions($query: String!, $count: Int) {
      citySuggestions(query: $query, count: $count) {
        id
        name
        country
        countryCode
        admin1
        latitude
        longitude
        timezone
        population
      }
    }
  `;

  it('returns city suggestions for a valid query', async () => {
    const res = await graphql(CITY_SUGGESTIONS_QUERY, { query: 'London', count: 5 });

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeUndefined();

    const cities = res.body.data.citySuggestions;
    expect(cities).toHaveLength(1);
    expect(cities[0]).toMatchObject({
      id: '51.50853,-0.12574',
      name: 'London',
      country: 'United Kingdom',
      countryCode: 'GB',
      latitude: 51.50853,
      longitude: -0.12574,
    });
  });

  it('calls geocoding service with correct arguments', async () => {
    await graphql(CITY_SUGGESTIONS_QUERY, { query: 'Paris', count: 3 });
    expect(mockGeocodingService.searchCities).toHaveBeenCalledWith('Paris', 3);
  });

  it('returns empty array when no cities found', async () => {
    mockGeocodingService.searchCities.mockResolvedValue([]);
    const res = await graphql(CITY_SUGGESTIONS_QUERY, { query: 'zzzznonexistent' });

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.citySuggestions).toEqual([]);
  });

  it('returns GraphQL error for missing required query argument', async () => {
    const res = await graphql(`{ citySuggestions { id name } }`);
    expect(res.body.errors).toBeDefined();
  });

  it('propagates service errors as GraphQL errors', async () => {
    mockGeocodingService.searchCities.mockRejectedValue(new Error('Network timeout'));
    const res = await graphql(CITY_SUGGESTIONS_QUERY, { query: 'London' });

    expect(res.body.errors).toBeDefined();
    expect(res.body.errors[0].message).toContain('Network timeout');
  });
});

// ---------------------------------------------------------------------------
// weatherForecast
// ---------------------------------------------------------------------------

describe('Query: weatherForecast', () => {
  const WEATHER_FORECAST_QUERY = `
    query WeatherForecast($cityId: ID!) {
      weatherForecast(cityId: $cityId) {
        city {
          id
          latitude
          longitude
        }
        daily {
          date
          temperatureMax
          temperatureMin
          precipitationSum
          windSpeedMax
          weatherCode
          snowfallSum
          uvIndexMax
        }
        generatedAt
      }
    }
  `;

  it('returns a 7-day forecast for a valid cityId', async () => {
    const res = await graphql(WEATHER_FORECAST_QUERY, { cityId: '51.50853,-0.12574' });

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeUndefined();

    const forecast = res.body.data.weatherForecast;
    expect(forecast.daily).toHaveLength(7);
    expect(forecast.generatedAt).toBe('2025-01-01T00:00:00.000Z');
    expect(forecast.daily[0]).toMatchObject({
      date: '2025-01-01',
      temperatureMax: 10,
      precipitationSum: 3,
    });
  });

  it('returns error for malformed cityId', async () => {
    const res = await graphql(WEATHER_FORECAST_QUERY, { cityId: 'not-valid' });

    expect(res.body.errors).toBeDefined();
    expect(res.body.errors[0].message).toContain('Invalid cityId');
  });

  it('includes error extension code for domain errors', async () => {
    const res = await graphql(WEATHER_FORECAST_QUERY, { cityId: 'abc,def' });
    expect(res.body.errors).toBeDefined();
    expect(res.body.errors[0].extensions?.code).toBe('INVALID_CITY_ID');
  });
});

// ---------------------------------------------------------------------------
// activityRankings
// ---------------------------------------------------------------------------

describe('Query: activityRankings', () => {
  const ACTIVITY_RANKINGS_QUERY = `
    query ActivityRankings($cityId: ID!) {
      activityRankings(cityId: $cityId) {
        activity
        score
        label
        reasoning
      }
    }
  `;

  it('returns 4 ranked activities for a valid cityId', async () => {
    const res = await graphql(ACTIVITY_RANKINGS_QUERY, { cityId: '51.50853,-0.12574' });

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeUndefined();

    const rankings = res.body.data.activityRankings;
    expect(rankings).toHaveLength(4);
  });

  it('returns activities in descending score order', async () => {
    const res = await graphql(ACTIVITY_RANKINGS_QUERY, { cityId: '51.50853,-0.12574' });
    const rankings = res.body.data.activityRankings;

    for (let i = 0; i < rankings.length - 1; i++) {
      expect(rankings[i].score).toBeGreaterThanOrEqual(rankings[i + 1].score);
    }
  });

  it('returns all four activity types', async () => {
    const res = await graphql(ACTIVITY_RANKINGS_QUERY, { cityId: '51.50853,-0.12574' });
    const types = res.body.data.activityRankings.map((r: { activity: string }) => r.activity);

    expect(types).toContain(ActivityType.SKIING);
    expect(types).toContain(ActivityType.SURFING);
    expect(types).toContain(ActivityType.INDOOR_SIGHTSEEING);
    expect(types).toContain(ActivityType.OUTDOOR_SIGHTSEEING);
  });

  it('includes score, label, and reasoning for each activity', async () => {
    const res = await graphql(ACTIVITY_RANKINGS_QUERY, { cityId: '51.50853,-0.12574' });

    for (const ranking of res.body.data.activityRankings) {
      expect(ranking.score).toBeGreaterThanOrEqual(0);
      expect(ranking.score).toBeLessThanOrEqual(100);
      expect(['Excellent', 'Good', 'Fair', 'Poor']).toContain(ranking.label);
      expect(typeof ranking.reasoning).toBe('string');
      expect(ranking.reasoning.length).toBeGreaterThan(0);
    }
  });

  it('returns error for malformed cityId', async () => {
    const res = await graphql(ACTIVITY_RANKINGS_QUERY, { cityId: 'invalid' });
    expect(res.body.errors).toBeDefined();
  });
});
