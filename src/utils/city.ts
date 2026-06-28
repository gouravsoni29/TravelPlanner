import { City } from '../types';

const cityNameCache = new Map<string, string>();

function formatCityName(latitude: number, longitude: number): string {
    const latLabel = latitude >= 0 ? 'N' : 'S';
    const lonLabel = longitude >= 0 ? 'E' : 'W';
    return `${Math.abs(latitude).toFixed(5)}°${latLabel}, ${Math.abs(longitude).toFixed(5)}°${lonLabel}`;
}

export function rememberCityName(cityId: string, name: string): void {
    const trimmedName = name?.trim();
    if (cityId && trimmedName) {
        cityNameCache.set(cityId, trimmedName);
    }
}

/**
 * Build a minimal City object from a composite city id and coordinates.
 * This keeps the resolver layer simple and centralises the fallback shape
 * used when a city is reconstructed from an id alone.
 */
export function createCityFromCoordinates(
    cityId: string,
    latitude: number,
    longitude: number,
    preferredName?: string,
): City {
    return {
        id: cityId,
        name: preferredName ?? cityNameCache.get(cityId) ?? formatCityName(latitude, longitude),
        country: null,
        countryCode: null,
        admin1: null,
        latitude,
        longitude,
        timezone: null,
        population: null,
    };
}
