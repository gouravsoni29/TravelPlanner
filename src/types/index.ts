/**
 * Domain types shared across the application.
 * These mirror the GraphQL schema types but live in the domain layer,
 * keeping the business logic independent of the GraphQL transport.
 */

export interface City {
  id: string; // Composite key: "lat,lon"
  name: string;
  country: string | null;
  countryCode: string | null;
  admin1: string | null; // State / Region
  latitude: number;
  longitude: number;
  timezone: string | null;
  population: number | null;
}

export interface DailyForecast {
  date: string;
  temperatureMax: number;
  temperatureMin: number;
  precipitationSum: number; // mm
  windSpeedMax: number; // km/h
  weatherCode: number; // WMO weather interpretation code
  snowfallSum: number; // cm
  uvIndexMax: number;
}

export interface WeatherForecast {
  city: City;
  daily: DailyForecast[];
  generatedAt: string;
}

export enum ActivityType {
  SKIING = 'SKIING',
  SURFING = 'SURFING',
  INDOOR_SIGHTSEEING = 'INDOOR_SIGHTSEEING',
  OUTDOOR_SIGHTSEEING = 'OUTDOOR_SIGHTSEEING',
}

export type ActivityLabel = 'Excellent' | 'Good' | 'Fair' | 'Poor';

export interface ActivityRanking {
  activity: ActivityType;
  score: number; // 0.0 – 100.0
  label: ActivityLabel;
  reasoning: string;
}
