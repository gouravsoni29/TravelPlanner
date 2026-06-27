import axios, { AxiosInstance, AxiosError } from 'axios';
import { TravelPlannerError, ErrorCode } from './errors';

/**
 * Creates a configured Axios instance for a given base URL.
 * Centralises timeout, headers, and error normalisation so all
 * service modules get consistent HTTP behaviour without duplication.
 */
export function createHttpClient(baseURL: string): AxiosInstance {
  const client = axios.create({
    baseURL,
    timeout: 10_000, // 10 s — reasonable for external weather APIs
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });

  // Response interceptor: normalise upstream errors into domain errors
  client.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      if (error.response) {
        // The server responded with a non-2xx status
        throw new TravelPlannerError(
          `Upstream API error: ${error.response.status} ${error.response.statusText}`,
          ErrorCode.UPSTREAM_API_ERROR,
          { status: error.response.status, url: error.config?.url },
        );
      }

      if (error.request) {
        // Request was made but no response received
        throw new TravelPlannerError(
          'No response from upstream API — network or timeout issue',
          ErrorCode.NETWORK_ERROR,
          { url: error.config?.url },
        );
      }

      // Something went wrong setting up the request
      throw new TravelPlannerError(
        `Request setup failed: ${error.message}`,
        ErrorCode.NETWORK_ERROR,
      );
    },
  );

  return client;
}
