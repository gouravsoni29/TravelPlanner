import { cityResolver } from './city.resolver';
import { weatherResolver } from './weather.resolver';
import { activitiesResolver } from './activities.resolver';
import { GraphQLFormattedError } from 'graphql';

/**
 * The shape every resolver module must export.
 * Each module owns its own Query handlers so files stay focused.
 *
 * TO ADD A NEW FEATURE RESOLVER:
 *  1. Create src/resolvers/<feature>.resolver.ts that exports
 *     `const featureResolver: ResolverModule = { Query: { ... } }`
 *  2. Import it here and spread it into the Query map below.
 */
export interface ResolverModule {
  Query: Record<string, (...args: unknown[]) => unknown>;
}

/**
 * Merged resolver map.
 * Spread new resolver modules into Query to expose additional operations.
 */
export const resolvers = {
  Query: {
    ...cityResolver.Query,
    ...weatherResolver.Query,
    ...activitiesResolver.Query,
  },
};

/**
 * Apollo Server error formatter.
 * Attaches our domain error code and metadata to the GraphQL error extensions,
 * giving API consumers a consistent, machine-readable error structure.
 *
 * Example response:
 * {
 *   "errors": [{
 *     "message": "Invalid cityId format",
 *     "extensions": { "code": "INVALID_CITY_ID", "metadata": { ... } }
 *   }]
 * }
 */
export function formatError(
  formattedError: GraphQLFormattedError,
  error: unknown,
): GraphQLFormattedError {
  // Apollo Server v5 wraps resolver errors in a GraphQLError.
  // The original TravelPlannerError lives at error.originalError.
  // We use duck-typing (not instanceof) so this works across Jest module
  // isolation boundaries where instanceof checks can fail.
  const domainError =
    findDomainError(error) ??
    findDomainError((error as Record<string, unknown>)?.originalError);

  if (domainError) {
    return {
      ...formattedError,
      extensions: {
        ...formattedError.extensions,
        code: domainError.code,
        ...(domainError.metadata ? { metadata: domainError.metadata } : {}),
      },
    };
  }
  return formattedError;
}

function findDomainError(
  err: unknown,
): { code: string; metadata?: Record<string, unknown> } | null {
  if (
    err !== null &&
    typeof err === 'object' &&
    'code' in err &&
    typeof (err as Record<string, unknown>).code === 'string'
  ) {
    return err as { code: string; metadata?: Record<string, unknown> };
  }
  return null;
}
