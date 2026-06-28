# Travel Planner API

A scalable, maintainable **GraphQL API** for travel planning, built with Node.js + TypeScript. Consumes the free [Open-Meteo](https://open-meteo.com/) APIs (no API key required) to provide:

1. **Dynamic city suggestions** — autocomplete from partial user input
2. **7-day weather forecasts** — structured daily data for any city
3. **Activity rankings** — Skiing, Surfing, Indoor Sightseeing, and Outdoor Sightseeing scored and ranked against the forecast

---

## Quick Start

```bash
# Install dependencies
npm install

# Start the development server (with hot reload)
npm run dev

# Open Apollo Sandbox
# http://localhost:4000/graphql
```

---

## Architecture

```
src/
├── index.ts                   # Express + Apollo Server 4 entry point
├── types/
│   └── index.ts               # Shared domain types (City, Forecast, etc.)
├── schema/
│   └── typeDefs.ts            # GraphQL SDL — all types, queries, enums
├── resolvers/
│   ├── index.ts               # Merged resolver map + error formatter
│   ├── city.resolver.ts       # citySuggestions query
│   ├── weather.resolver.ts    # weatherForecast query
│   └── activities.resolver.ts # activityRankings query
├── services/
│   ├── geocoding.service.ts   # Wraps Open-Meteo Geocoding API
│   └── weather.service.ts     # Wraps Open-Meteo Forecast API
├── scoring/
│   └── activityScorer.ts      # Pure scoring logic — no I/O, fully testable
└── utils/
    ├── httpClient.ts           # Fetch wrapper with centralised error handling
    └── errors.ts              # Typed error hierarchy
```

### Key Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| GraphQL server | Apollo Server 4 + Express | Industry standard, flexible middleware, great error formatting |
| TypeScript | Strict mode | Catches bugs at compile time, improves refactoring confidence |
| Stateless `cityId` | `"lat,lon"` composite key | No database needed — all queries are stateless and composable |
| Service injection | Class constructors accept optional HTTP client | Enables full test isolation without environment variables |
| Pure scorers | No I/O in `activityScorer.ts` | Pure functions are trivially unit-testable with no mocking |
| Fetch wrapper | Centralised in `httpClient.ts` | Error normalisation happens once, not in every service |

### Data Flow

```
Client
  │
  ▼
GraphQL Query (Apollo Server)
  │
  ▼
Resolver (thin orchestration layer)
  │
  ├──▶ GeocodingService ──▶ Open-Meteo Geocoding API
  │
  ├──▶ WeatherService ──▶ Open-Meteo Forecast API
  │         │
  │         ▼
  └──▶ activityScorer (pure functions)
            │
            ▼
       ActivityRanking[]
```

---

## GraphQL Schema

### Queries

#### `citySuggestions(query: String!, count: Int): [City!]!`

Search for cities matching a partial or complete name.

```graphql
query {
  citySuggestions(query: "Lon", count: 5) {
    id
    name
    country
    countryCode
    admin1
    latitude
    longitude
    timezone
    population
  }
}
```

#### `weatherForecast(cityId: ID!): WeatherForecast!`

Fetch a 7-day weather forecast. Use the `id` from `citySuggestions` as `cityId`.

```graphql
query {
  weatherForecast(cityId: "51.50853,-0.12574") {
    city { name country }
    daily {
      date
      temperatureMax
      temperatureMin
      precipitationSum
      windSpeedMax
      snowfallSum
      uvIndexMax
      weatherCode
    }
    generatedAt
  }
}
```

#### `activityRankings(cityId: ID!): [ActivityRanking!]!`

Get all four activities ranked by suitability for the city's 7-day forecast.

```graphql
query {
  activityRankings(cityId: "51.50853,-0.12574") {
    activity
    score
    label
    reasoning
  }
}
```

**Example response:**
```json
{
  "data": {
    "activityRankings": [
      {
        "activity": "OUTDOOR_SIGHTSEEING",
        "score": 74.2,
        "label": "Good",
        "reasoning": "Outdoor sightseeing is good with 5/7 clear days, 22.1°C avg high, and 1.2 mm/day avg precipitation."
      },
      {
        "activity": "INDOOR_SIGHTSEEING",
        "score": 45.0,
        "label": "Good",
        "reasoning": "Conditions are reasonable outdoors, but indoor attractions are always a worthwhile option."
      },
      {
        "activity": "SURFING",
        "score": 38.5,
        "label": "Fair",
        "reasoning": "Surfing conditions are fair with favourable wind (18 km/h avg) and 22.1°C avg high."
      },
      {
        "activity": "SKIING",
        "score": 2.1,
        "label": "Poor",
        "reasoning": "Skiing conditions are poor with limited snowfall (0.0 cm/day avg) and warm temperatures (22.1°C max avg)."
      }
    ]
  }
}
```

### Composable Query Pattern

The intended usage flow is:

1. Call `citySuggestions` with user input → get a list of `City` objects with `id` fields
2. Let the user pick a city
3. Call `weatherForecast(cityId: <id>)` and/or `activityRankings(cityId: <id>)` using the chosen `id`

---

## Activity Scoring Algorithm

Scores range from **0.0** (worst) to **100.0** (best) and are labelled:

| Label | Range |
|---|---|
| Excellent | ≥ 75 |
| Good | ≥ 50 |
| Fair | ≥ 25 |
| Poor | < 25 |

### Weather Variables Used

All variables come from the Open-Meteo `/v1/forecast` endpoint (daily aggregates):

| Variable | Description |
|---|---|
| `temperature_2m_max/min` | Daily max/min temperature (°C) |
| `precipitation_sum` | Total precipitation (mm) |
| `wind_speed_10m_max` | Max wind speed (km/h) |
| `snowfall_sum` | Total snowfall (cm) |
| `uv_index_max` | Maximum UV index |
| `weather_code` | WMO weather interpretation code |

### Scorer Summary

| Activity | Key Signals | Weights |
|---|---|---|
| 🎿 **Skiing** | Snowfall, temperature, wind | 50% snow / 30% temp / 20% wind |
| 🏄 **Surfing** | Wind speed (sweet spot 10–30), temp, precip | 40% wind / 35% temp / 25% precip |
| 🏛️ **Indoor Sightseeing** | Inverted outdoor signals — high rain/snow = high score | 40% precip / 30% extreme temp / 30% rain consistency |
| 🌳 **Outdoor Sightseeing** | Low precip, comfortable temp (18–26°C), clear sky | 40% precip / 35% temp / 25% UV+clear |

Severe WMO weather codes (thunderstorms, heavy rain, heavy snow) apply hard penalties/caps.

---

## Running Tests

```bash
# Run all tests
npm test

# With coverage report
npm run test:coverage

# Watch mode
npm run test:watch
```

### Test Structure

```
__tests__/
├── scoring/
│   └── activityScorer.test.ts   # 20+ unit tests — pure functions, no mocking needed
├── services/
│   ├── geocoding.service.test.ts # 8 unit tests — mocked Axios client
│   └── weather.service.test.ts   # 9 unit tests — mocked Axios client
└── integration/
    └── api.test.ts               # 15+ integration tests — Supertest + mocked services
```

---

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start dev server with hot reload (`tsx watch`) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled production build |
| `npm test` | Run all Jest tests |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |

---

## Omissions & Trade-offs

### What was skipped and why

| Omission | Reasoning |
|---|---|
| **Database / caching layer** | Not required for this scope. The stateless `"lat,lon"` ID approach means no persistence is needed. With more time, Redis caching for weather responses would reduce latency and API calls. |
| **Authentication / rate limiting** | Out of scope for this evaluation. In production, this would be critical (API keys, JWT, or OAuth + express-rate-limit). |
| **DataLoader / query batching** | No N+1 risk with the current schema since resolvers are independent. Would add DataLoader if the schema gained nested city queries that could batch geocoding calls. |
| **Subscriptions** | Real-time weather updates would be compelling but require WebSocket infrastructure and were out of scope. |
| **CI/CD pipeline** | GitHub Actions workflow would be straightforward to add but wasn't specified. |
| **OpenAPI / REST fallback** | GraphQL only, as specified. |
| **Persistent city metadata in weatherForecast** | When calling `weatherForecast(cityId)` directly (without a preceding `citySuggestions`), the city object only has lat/lon — name and country are omitted. In production, a geocoding reverse-lookup or client-side caching would solve this. |

---

## How I Would Extend This With More Time

1. **Caching** — Add Redis or an in-memory TTL cache for weather responses (data is valid for hours). The service layer's injection pattern makes this easy to slot in.

2. **Reverse geocoding** — Fetch city metadata from coordinates when `weatherForecast` is called directly, so `city.name` is always populated.

3. **More activity types** — The scoring engine is designed to be extended: add a new pure function, add it to `rankActivities()`, add the enum value to the schema.

4. **Historical context** — Compare current forecast to climate averages for the region to give context ("warmer than usual for January").

5. **Multi-day activity windows** — Let users specify a date range and score activities per day rather than averaging across 7 days.

6. **Confidence scoring** — Open-Meteo provides uncertainty data for later forecast days; propagate this into the `ActivityRanking` response.

7. **Observability** — Add structured logging (Winston/Pino) and request tracing (OpenTelemetry) with correlation IDs.

8. **Persisted queries** — For a production mobile client, Apollo Persisted Queries would reduce bandwidth.


---

## Environment Variables

Copy `.env.example` to `.env` to override defaults:

```bash
PORT=4000
GEOCODING_BASE_URL=https://geocoding-api.open-meteo.com/v1
WEATHER_BASE_URL=https://api.open-meteo.com/v1
```

No API keys are required — Open-Meteo is free for non-commercial use.
