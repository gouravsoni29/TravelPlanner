import { geocodingService } from '../services/geocoding.service';

export interface CitySuggestionsArgs {
  query: string;
  count?: number;
}

/**
 * Resolver for the `citySuggestions` query.
 *
 * Delegates entirely to GeocodingService — the resolver is intentionally
 * thin, containing no business logic. This makes the resolver easy to test
 * by swapping the service, and keeps logic centrally testable in the service.
 */
export const cityResolver = {
  Query: {
    citySuggestions: async (
      _parent: unknown,
      { query, count = 10 }: CitySuggestionsArgs,
    ) => {
      return geocodingService.searchCities(query, count);
    },
  },
};
