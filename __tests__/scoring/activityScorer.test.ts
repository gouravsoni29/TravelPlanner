import { describe, expect, it } from '@jest/globals';
import {
  activityScorers,
  scoreSkiing,
  scoreSurfing,
  scoreIndoorSightseeing,
  scoreOutdoorSightseeing,
  rankActivities,
} from '../../src/scoring/activityScorer';
import { ActivityType, ActivityRanking, DailyForecast } from '../../src/types';

// ---------------------------------------------------------------------------
// Test fixture factories
// ---------------------------------------------------------------------------

function makeForecast(overrides: Partial<DailyForecast> = {}): DailyForecast {
  return {
    date: '2025-01-01',
    temperatureMax: 15,
    temperatureMin: 5,
    precipitationSum: 2,
    windSpeedMax: 20,
    weatherCode: 1,
    snowfallSum: 0,
    uvIndexMax: 4,
    ...overrides,
  };
}

/** Create an array of 7 identical daily forecasts */
function makeWeek(overrides: Partial<DailyForecast> = {}): DailyForecast[] {
  return Array.from({ length: 7 }, (_, i) =>
    makeForecast({ date: `2025-01-0${i + 1}`, ...overrides }),
  );
}

// ---------------------------------------------------------------------------
// Skiing
// ---------------------------------------------------------------------------

describe('scoreSkiing', () => {
  it('returns an excellent score for ideal ski conditions', () => {
    const daily = makeWeek({ snowfallSum: 15, temperatureMax: -5, windSpeedMax: 15 });
    const result = scoreSkiing(daily);

    expect(result.activity).toBe(ActivityType.SKIING);
    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.label).toBe('Excellent');
    expect(result.reasoning).toContain('excellent');
  });

  it('returns a poor score when there is no snow', () => {
    const daily = makeWeek({ snowfallSum: 0, temperatureMax: 20, windSpeedMax: 10 });
    const result = scoreSkiing(daily);

    expect(result.score).toBeLessThan(25);
    expect(result.label).toBe('Poor');
  });

  it('penalises dangerously high wind even with good snow', () => {
    const goodSnow = makeWeek({ snowfallSum: 12, temperatureMax: -3, windSpeedMax: 80 });
    const calmSnow = makeWeek({ snowfallSum: 12, temperatureMax: -3, windSpeedMax: 10 });

    expect(scoreSkiing(goodSnow).score).toBeLessThan(scoreSkiing(calmSnow).score);
  });

  it('returns score between 0 and 100 for extreme inputs', () => {
    const extreme = makeWeek({ snowfallSum: 9999, temperatureMax: -100, windSpeedMax: 0 });
    const result = scoreSkiing(extreme);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('includes reasoning string', () => {
    const daily = makeWeek({ snowfallSum: 8, temperatureMax: -2, windSpeedMax: 20 });
    const result = scoreSkiing(daily);
    expect(result.reasoning).toBeTruthy();
    expect(typeof result.reasoning).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// Surfing
// ---------------------------------------------------------------------------

describe('scoreSurfing', () => {
  it('returns an excellent score for ideal surf conditions', () => {
    const daily = makeWeek({
      windSpeedMax: 20,
      temperatureMax: 28,
      precipitationSum: 0,
      weatherCode: 1,
    });
    const result = scoreSurfing(daily);

    expect(result.activity).toBe(ActivityType.SURFING);
    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(['Excellent', 'Good']).toContain(result.label);
  });

  it('returns a poor score for cold, calm conditions', () => {
    const daily = makeWeek({ windSpeedMax: 2, temperatureMax: 8, precipitationSum: 0 });
    const result = scoreSurfing(daily);

    expect(result.score).toBeLessThan(40);
  });

  it('penalises severe weather with a hard cap at 20', () => {
    const daily = makeWeek({
      windSpeedMax: 20,
      temperatureMax: 25,
      precipitationSum: 0,
      weatherCode: 95, // Thunderstorm
    });
    const result = scoreSurfing(daily);

    expect(result.score).toBeLessThanOrEqual(20);
    expect(result.reasoning).toContain('Severe weather');
  });

  it('returns score within [0, 100]', () => {
    const daily = makeWeek({ windSpeedMax: 100, temperatureMax: -20 });
    const result = scoreSurfing(daily);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// Indoor Sightseeing
// ---------------------------------------------------------------------------

describe('scoreIndoorSightseeing', () => {
  it('scores highly during heavy rain', () => {
    const daily = makeWeek({ precipitationSum: 15, weatherCode: 65 });
    const result = scoreIndoorSightseeing(daily);

    expect(result.activity).toBe(ActivityType.INDOOR_SIGHTSEEING);
    expect(result.score).toBeGreaterThanOrEqual(50);
    expect(['Excellent', 'Good']).toContain(result.label);
  });

  it('always has a minimum score of 30 (museums are always an option)', () => {
    const daily = makeWeek({ precipitationSum: 0, weatherCode: 0, temperatureMax: 22 });
    const result = scoreIndoorSightseeing(daily);

    expect(result.score).toBeGreaterThanOrEqual(30);
  });

  it('gets a boost from severe weather', () => {
    const normalRain = makeWeek({ precipitationSum: 5, weatherCode: 61 });
    const stormRain = makeWeek({ precipitationSum: 5, weatherCode: 95 });

    expect(scoreIndoorSightseeing(stormRain).score).toBeGreaterThan(
      scoreIndoorSightseeing(normalRain).score,
    );
  });

  it('scores well in extreme heat', () => {
    const hot = makeWeek({ temperatureMax: 42, precipitationSum: 0 });
    const result = scoreIndoorSightseeing(hot);
    expect(result.score).toBeGreaterThanOrEqual(30);
  });
});

// ---------------------------------------------------------------------------
// Outdoor Sightseeing
// ---------------------------------------------------------------------------

describe('scoreOutdoorSightseeing', () => {
  it('returns an excellent score for ideal conditions', () => {
    const daily = makeWeek({
      temperatureMax: 22,
      precipitationSum: 0,
      weatherCode: 0,
      uvIndexMax: 5,
    });
    const result = scoreOutdoorSightseeing(daily);

    expect(result.activity).toBe(ActivityType.OUTDOOR_SIGHTSEEING);
    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.label).toBe('Excellent');
  });

  it('penalises heavy rain', () => {
    const rainy = makeWeek({ precipitationSum: 15, weatherCode: 65 });
    const result = scoreOutdoorSightseeing(rainy);

    expect(result.score).toBeLessThan(40);
  });

  it('caps score at 15 for severe weather', () => {
    const storm = makeWeek({ weatherCode: 99, precipitationSum: 0, temperatureMax: 22 });
    const result = scoreOutdoorSightseeing(storm);

    expect(result.score).toBeLessThanOrEqual(15);
  });

  it('prefers temperatures in the 18-26°C sweet spot', () => {
    const perfect = makeWeek({ temperatureMax: 22, precipitationSum: 0, weatherCode: 1 });
    const cold = makeWeek({ temperatureMax: 3, precipitationSum: 0, weatherCode: 1 });
    const hot = makeWeek({ temperatureMax: 40, precipitationSum: 0, weatherCode: 1 });

    expect(scoreOutdoorSightseeing(perfect).score).toBeGreaterThan(
      scoreOutdoorSightseeing(cold).score,
    );
    expect(scoreOutdoorSightseeing(perfect).score).toBeGreaterThan(
      scoreOutdoorSightseeing(hot).score,
    );
  });
});

// ---------------------------------------------------------------------------
// rankActivities (integration of all scorers)
// ---------------------------------------------------------------------------

describe('rankActivities', () => {
  it('returns one ranking per registered activity scorer', () => {
    const daily = makeWeek();
    const rankings = rankActivities(daily);
    expect(rankings).toHaveLength(activityScorers.length);
    expect(new Set(rankings.map((ranking) => ranking.activity)).size).toBe(activityScorers.length);
  });

  it('returns rankings sorted by score descending', () => {
    const daily = makeWeek();
    const rankings = rankActivities(daily);

    for (let i = 0; i < rankings.length - 1; i++) {
      expect(rankings[i].score).toBeGreaterThanOrEqual(rankings[i + 1].score);
    }
  });

  it('ranks skiing highest for snowy alpine conditions', () => {
    const alpineWeek = makeWeek({
      snowfallSum: 15,
      temperatureMax: -5,
      temperatureMin: -12,
      windSpeedMax: 10,
      precipitationSum: 1,
      weatherCode: 71, // Snow fall
    });
    const rankings = rankActivities(alpineWeek);
    expect(rankings[0].activity).toBe(ActivityType.SKIING);
  });

  it('ranks outdoor sightseeing highest for sunny mild conditions', () => {
    const sunnyWeek = makeWeek({
      snowfallSum: 0,
      temperatureMax: 22,
      temperatureMin: 14,
      windSpeedMax: 10,
      precipitationSum: 0,
      weatherCode: 0, // Clear sky
      uvIndexMax: 5,
    });
    const rankings = rankActivities(sunnyWeek);
    expect(rankings[0].activity).toBe(ActivityType.OUTDOOR_SIGHTSEEING);
  });

  it('includes all four activity types in the result', () => {
    const daily = makeWeek();
    const rankings = rankActivities(daily);
    const types = rankings.map((r: ActivityRanking) => r.activity);

    expect(types).toContain(ActivityType.SKIING);
    expect(types).toContain(ActivityType.SURFING);
    expect(types).toContain(ActivityType.INDOOR_SIGHTSEEING);
    expect(types).toContain(ActivityType.OUTDOOR_SIGHTSEEING);
  });

  it('all scores are within [0, 100]', () => {
    const daily = makeWeek();
    const rankings = rankActivities(daily);
    for (const r of rankings) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
    }
  });
});
