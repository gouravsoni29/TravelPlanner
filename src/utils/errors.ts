/**
 * Custom error types for the Travel Planner API.
 * Using a typed error hierarchy makes it easy to produce meaningful
 * GraphQL error extensions (code, metadata) without coupling
 * business logic to GraphQL internals.
 */

export enum ErrorCode {
  UPSTREAM_API_ERROR = 'UPSTREAM_API_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INVALID_CITY_ID = 'INVALID_CITY_ID',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
}

export class TravelPlannerError extends Error {
  public readonly code: ErrorCode;
  public readonly metadata?: Record<string, unknown>;

  constructor(message: string, code: ErrorCode, metadata?: Record<string, unknown>) {
    super(message);
    this.name = 'TravelPlannerError';
    this.code = code;
    this.metadata = metadata;
    // Restore prototype chain (needed when extending built-ins in TS)
    Object.setPrototypeOf(this, TravelPlannerError.prototype);
  }
}
