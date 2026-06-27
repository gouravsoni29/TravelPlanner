import { gql } from 'graphql-tag';

/**
 * GraphQL Schema Definition
 *
 * Design principles:
 * - City.id is a "lat,lon" composite — stateless, no DB needed
 * - Queries are intentionally composable: call citySuggestions first,
 *   then use the returned id for weatherForecast or activityRankings
 * - All nullable fields are typed as such to reflect real-world data gaps
 * - ActivityRanking.reasoning provides human-readable context for scores
 */
export const typeDefs = gql`
  """
  A geographic location representing a city or populated place.
  The 'id' field is a composite "latitude,longitude" key that can be
  passed directly to weatherForecast and activityRankings queries.
  """
  type City {
    "Composite ID in 'latitude,longitude' format — use as cityId in other queries"
    id: ID!
    "Primary name of the city"
    name: String!
    "Country name (e.g. 'United Kingdom')"
    country: String
    "ISO 3166-1 alpha-2 country code (e.g. 'GB')"
    countryCode: String
    "Administrative region, state, or province"
    admin1: String
    "WGS84 latitude"
    latitude: Float!
    "WGS84 longitude"
    longitude: Float!
    "IANA timezone identifier (e.g. 'Europe/London')"
    timezone: String
    "Approximate population (may be null for smaller localities)"
    population: Int
  }

  """
  Daily weather snapshot for a single day.
  All temperature values are in degrees Celsius.
  All precipitation/snowfall values are in millimetres/centimetres.
  Wind speed is in km/h.
  """
  type DailyForecast {
    "ISO 8601 date string (YYYY-MM-DD)"
    date: String!
    "Maximum temperature at 2m height (°C)"
    temperatureMax: Float!
    "Minimum temperature at 2m height (°C)"
    temperatureMin: Float!
    "Total precipitation sum (mm)"
    precipitationSum: Float!
    "Maximum wind speed at 10m height (km/h)"
    windSpeedMax: Float!
    "WMO weather interpretation code"
    weatherCode: Int!
    "Total snowfall (cm)"
    snowfallSum: Float!
    "Maximum UV index"
    uvIndexMax: Float!
  }

  """
  A 7-day weather forecast for a specific city.
  """
  type WeatherForecast {
    "The city this forecast applies to"
    city: City!
    "Array of daily forecasts (7 days)"
    daily: [DailyForecast!]!
    "ISO 8601 timestamp of when this forecast was generated"
    generatedAt: String!
  }

  """
  One of the four supported activity types.
  """
  enum ActivityType {
    SKIING
    SURFING
    INDOOR_SIGHTSEEING
    OUTDOOR_SIGHTSEEING
  }

  """
  A qualitative label summarising the activity score.
  """
  enum ActivityLabel {
    Excellent
    Good
    Fair
    Poor
  }

  """
  A weather-based suitability score for a single activity.
  Activities are returned sorted from best to worst score.
  """
  type ActivityRanking {
    "The activity being ranked"
    activity: ActivityType!
    "Suitability score from 0.0 (worst) to 100.0 (best)"
    score: Float!
    "Qualitative label: Excellent (≥75), Good (≥50), Fair (≥25), Poor (<25)"
    label: ActivityLabel!
    "Human-readable explanation of the score based on weather signals"
    reasoning: String!
  }

  type Query {
    """
    Search for cities matching a partial or complete name.
    Returns up to 'count' results ordered by relevance and population.
    """
    citySuggestions(
      "Partial or complete city name (e.g. 'Lon', 'London')"
      query: String!
      "Maximum number of results (1–100, default 10)"
      count: Int
    ): [City!]!

    """
    Fetch a 7-day weather forecast for a city.
    Use the 'id' field from a citySuggestions result as cityId.
    """
    weatherForecast(
      "City ID in 'latitude,longitude' format (from citySuggestions)"
      cityId: ID!
    ): WeatherForecast!

    """
    Get activities ranked by suitability for the city's 7-day weather forecast.
    Results are sorted from most to least suitable.
    """
    activityRankings(
      "City ID in 'latitude,longitude' format (from citySuggestions)"
      cityId: ID!
    ): [ActivityRanking!]!
  }
`;
