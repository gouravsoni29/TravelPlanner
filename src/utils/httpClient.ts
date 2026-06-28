import { TravelPlannerError, ErrorCode } from './errors';

const DEFAULT_TIMEOUT_MS = 10_000;

export interface FetchHttpClient {
  get<T>(path: string, params?: Record<string, string | number | boolean>): Promise<T>;
}

function buildQueryString(params: Record<string, string | number | boolean> = {}): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query.length ? `?${query}` : '';
}

export function createHttpClient(baseURL: string): FetchHttpClient {
  return {
    async get<T>(path: string, params?: Record<string, string | number | boolean>): Promise<T> {
      const url = `${baseURL}${path}${buildQueryString(params)}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new TravelPlannerError(
            `Upstream API error: ${response.status} ${response.statusText}`,
            ErrorCode.UPSTREAM_API_ERROR,
            { status: response.status, url },
          );
        }

        const body = await response.json();
        return body as T;
      } catch (error: unknown) {
        if (error instanceof TravelPlannerError) {
          throw error;
        }

        if (error instanceof DOMException && error.name === 'AbortError') {
          throw new TravelPlannerError(
            'No response from upstream API — network or timeout issue',
            ErrorCode.NETWORK_ERROR,
            { url },
          );
        }

        throw new TravelPlannerError(
          error instanceof Error ? `Request failed: ${error.message}` : 'Request failed',
          ErrorCode.NETWORK_ERROR,
        );
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
