import { describe, expect, it } from '@jest/globals';
import { createCityFromCoordinates } from '../../src/utils/city';

describe('createCityFromCoordinates', () => {
    it('builds a city object from a composite id and coordinates', () => {
        const city = createCityFromCoordinates('51.50853,-0.12574', 51.50853, -0.12574);

        expect(city).toMatchObject({
            id: '51.50853,-0.12574',
            name: '51.50853°N, 0.12574°W',
            latitude: 51.50853,
            longitude: -0.12574,
            country: null,
            countryCode: null,
            admin1: null,
            timezone: null,
            population: null,
        });
    });
});
