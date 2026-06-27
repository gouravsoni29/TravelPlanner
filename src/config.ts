/**
 * Application Configuration
 *
 * Single source of truth for all environment-based settings.
 * Centralising config here means you only ever update one file
 * when adding a new env var — resolvers and services import from here,
 * not directly from process.env.
 *
 * To override defaults, copy .env.example to .env and set values there.
 */
export const config = {
  /** HTTP port for the Express server */
  port: parseInt(process.env.PORT ?? '4001', 10),

  /** Base URL for the Open-Meteo Geocoding API */
  geocodingBaseUrl:
    process.env.GEOCODING_BASE_URL ?? 'https://geocoding-api.open-meteo.com/v1',

  /** Base URL for the Open-Meteo Forecast API */
  weatherBaseUrl:
    process.env.WEATHER_BASE_URL ?? 'https://api.open-meteo.com/v1',

  /** Whether to run in development mode (enables Apollo introspection, verbose errors) */
  isDevelopment: process.env.NODE_ENV !== 'production',
} as const;
