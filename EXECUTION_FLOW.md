# Travel Planner API — Execution Flow & Testing Guide

## System Overview

```
Client (curl / Apollo Sandbox / Postman)
    │
    │  POST /graphql  (or GET /health)
    ▼
┌─────────────────────────────────────────┐
│  Express HTTP Server  (src/index.ts)    │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  Apollo Server v5 (GraphQL layer) │  │
│  │                                   │  │
│  │  typeDefs  ──►  resolvers         │  │
│  │                    │              │  │
│  │            ┌───────┼────────┐     │  │
│  │            ▼       ▼        ▼     │  │
│  │        city    weather  activities│  │
│  │        resolver resolver resolver │  │
│  └──────────┼────────┼─────────┼────┘  │
│             │        │         │        │
└─────────────┼────────┼─────────┼────────┘
              │        │         │
              ▼        ▼         │
    GeocodingService  WeatherService ◄──┘
              │        │
              └───┬────┘
                  ▼
         Open-Meteo API (free, no key)
         geocoding-api.open-meteo.com
         api.open-meteo.com
```

```
WeatherForecast data
        │
        ▼
┌────────────────────────┐
│  Activity Scoring      │
│  Engine                │
│                        │
│  ACTIVITY_SCORERS[]    │
│  ├─ scoreSkiing        │
│  ├─ scoreSurfing       │
│  ├─ scoreIndoor        │   each returns ActivityRanking { score, label, reasoning }
│  └─ scoreOutdoor       │
│                        │
│  rankActivities()      │──► sorted ActivityRanking[]
└────────────────────────┘
```

---

## 1 — Local Setup

```bash
# Clone and install
git clone <repo>
cd Travel-Planner
npm install

# (Optional) copy and customise environment
cp .env.example .env

# Start the dev server with hot-reload
npm run dev
```

The server starts on **http://localhost:4000**.

### Available Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start with hot-reload (`tsx watch`) |
| `npm run build` | Compile TypeScript → `dist/` |
| `npm start` | Run compiled build (production) |
| `npm test` | Run all 54 Jest tests |
| `npm run test:coverage` | Tests + HTML coverage report |
| `npm run lint` | ESLint across `src/` and `__tests__/` |

---

## 2 — Manual Testing via Apollo Sandbox

1. Start the dev server: `npm run dev`
2. Open **http://localhost:4000/graphql** in your browser
3. Apollo Sandbox opens automatically — paste any query below

---

## 3 — Query Reference with Examples

### 3.1  Health Check

```bash
curl http://localhost:4000/health
```

**Response:**
```json
{ "status": "ok", "timestamp": "2025-01-15T10:30:00.000Z" }
```

---

### 3.2  `citySuggestions` — Search for Cities

Returns up to `count` cities whose name matches `query` (partial match supported).

**GraphQL query:**
```graphql
query CitySuggestions($query: String!, $count: Int) {
  citySuggestions(query: $query, count: $count) {
    id           # "lat,lon" composite — use this in weatherForecast / activityRankings
    name
    country
    countryCode
    admin1       # state / province / region
    latitude
    longitude
    timezone
    population
  }
}
```

**Variables:**
```json
{ "query": "London", "count": 3 }
```

**Expected response:**
```json
{
  "data": {
    "citySuggestions": [
      {
        "id": "51.50853,-0.12574",
        "name": "London",
        "country": "United Kingdom",
        "countryCode": "GB",
        "admin1": "England",
        "latitude": 51.50853,
        "longitude": -0.12574,
        "timezone": "Europe/London",
        "population": 7556900
      }
    ]
  }
}
```

**curl equivalent:**
```bash
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { citySuggestions(query: \"London\", count: 3) { id name country } }"
  }'
```

---

### 3.3  `weatherForecast` — 7-Day Forecast for a City

Takes the `id` returned by `citySuggestions` and fetches a 7-day forecast.

**GraphQL query:**
```graphql
query WeatherForecast($cityId: ID!) {
  weatherForecast(cityId: $cityId) {
    city {
      name
      country
      timezone
    }
    daily {
      date
      temperatureMax    # °C
      temperatureMin    # °C
      precipitationSum  # mm
      windSpeedMax      # km/h
      weatherCode       # WMO code (0 = clear, 95 = thunderstorm)
      snowfallSum       # cm
      uvIndexMax
    }
    generatedAt
  }
}
```

**Variables:**
```json
{ "cityId": "51.50853,-0.12574" }
```

> **Tip:** The `cityId` format is always `"latitude,longitude"` — copy it directly from a `citySuggestions` result.

**curl equivalent:**
```bash
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { weatherForecast(cityId: \"51.50853,-0.12574\") { city { name } daily { date temperatureMax precipitationSum } generatedAt } }"
  }'
```

---

### 3.4  `activityRankings` — Ranked Activities Based on Weather

Returns all four activities ranked from most to least suitable for the given city's forecast.

**GraphQL query:**
```graphql
query ActivityRankings($cityId: ID!) {
  activityRankings(cityId: $cityId) {
    activity    # SKIING | SURFING | INDOOR_SIGHTSEEING | OUTDOOR_SIGHTSEEING
    score       # 0–100
    label       # Excellent | Good | Fair | Poor
    reasoning   # Human-readable explanation of the score
  }
}
```

**Variables:**
```json
{ "cityId": "51.50853,-0.12574" }
```

**Expected response (example — scores vary by real weather):**
```json
{
  "data": {
    "activityRankings": [
      {
        "activity": "OUTDOOR_SIGHTSEEING",
        "score": 68.4,
        "label": "Good",
        "reasoning": "Outdoor sightseeing is good with 4/7 clear days, 14.2°C avg high..."
      },
      {
        "activity": "INDOOR_SIGHTSEEING",
        "score": 47.1,
        "label": "Fair",
        "reasoning": "Conditions are reasonable outdoors, but indoor attractions are always worthwhile."
      },
      {
        "activity": "SURFING",
        "score": 35.0,
        "label": "Fair",
        "reasoning": "Surfing conditions are fair with favourable wind (18 km/h avg)..."
      },
      {
        "activity": "SKIING",
        "score": 2.1,
        "label": "Poor",
        "reasoning": "Skiing conditions are poor with limited snowfall (0.0 cm/day avg)..."
      }
    ]
  }
}
```

**curl equivalent:**
```bash
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { activityRankings(cityId: \"51.50853,-0.12574\") { activity score label reasoning } }"
  }'
```

---

### 3.5  Full Chained Query (Single Request)

Fetch city + forecast + rankings in one round-trip using GraphQL aliases:

```graphql
query TravelPlan($query: String!, $cityId: ID!) {
  cities: citySuggestions(query: $query, count: 5) {
    id
    name
    country
  }
  forecast: weatherForecast(cityId: $cityId) {
    daily {
      date
      temperatureMax
      weatherCode
    }
  }
  rankings: activityRankings(cityId: $cityId) {
    activity
    score
    label
  }
}
```

**Variables:**
```json
{
  "query": "Tokyo",
  "cityId": "35.6895,139.6917"
}
```

---

## 4 — Error Responses

All domain errors return a consistent structure:

```json
{
  "errors": [
    {
      "message": "Invalid cityId format: \"abc\". Expected \"latitude,longitude\".",
      "locations": [{ "line": 2, "column": 3 }],
      "path": ["weatherForecast"],
      "extensions": {
        "code": "INVALID_CITY_ID"
      }
    }
  ],
  "data": null
}
```

| `extensions.code` | When it occurs |
|---|---|
| `VALIDATION_ERROR` | Empty or invalid search query |
| `INVALID_CITY_ID` | Malformed `cityId` (not `lat,lon` format) |
| `NOT_FOUND` | No forecast data returned by Open-Meteo |
| `UPSTREAM_API_ERROR` | Open-Meteo returned a non-2xx HTTP status |
| `NETWORK_ERROR` | Timeout or no response from Open-Meteo |
| `INTERNAL_SERVER_ERROR` | Unexpected error (bug) |

---

## 5 — Automated Test Suite

```bash
npm test                # run all tests once
npm run test:coverage   # run with HTML coverage report (opens in coverage/index.html)
```

### Test layout

```
__tests__/
├── scoring/
│   └── activityScorer.test.ts   (24 tests — pure unit, no mocks needed)
├── services/
│   ├── geocoding.service.test.ts (8 tests — mock HTTP client injected)
│   └── weather.service.test.ts   (9 tests — mock HTTP client injected)
└── integration/
    └── api.test.ts               (14 tests — full HTTP via Supertest)
```

### What each suite covers

| Suite | Strategy | What's tested |
|---|---|---|
| `activityScorer` | Pure unit — no mocks | Score values, labels, reasoning strings, edge cases, sort order |
| `geocoding.service` | HTTP client injected | API mapping, null handling, validation, count clamping |
| `weather.service` | HTTP client injected | Column→row mapping, timestamp, NOT_FOUND, parseCityId |
| `api` (integration) | Supertest + service mocks | All 3 queries end-to-end, error codes, health check |

### Running individual test files

```bash
# Run only the scorer unit tests
npx jest activityScorer

# Run only integration tests
npx jest api.test

# Run with verbose output
npx jest --verbose

# Watch mode during development
npm run test:watch
```

---

## 6 — How to Extend the System

### Add a new activity (e.g., Hiking)

Only **3 files** need to change:

**Step 1 — `src/types/index.ts`**: add to the enum
```typescript
export enum ActivityType {
  SKIING             = 'SKIING',
  SURFING            = 'SURFING',
  INDOOR_SIGHTSEEING = 'INDOOR_SIGHTSEEING',
  OUTDOOR_SIGHTSEEING= 'OUTDOOR_SIGHTSEEING',
  HIKING             = 'HIKING',   // ← add here
}
```

**Step 2 — `src/schema/typeDefs.ts`**: add to the GraphQL enum
```graphql
enum ActivityType {
  SKIING
  SURFING
  INDOOR_SIGHTSEEING
  OUTDOOR_SIGHTSEEING
  HIKING   # ← add here
}
```

**Step 3 — `src/scoring/activityScorer.ts`**: write a scorer and add it to the registry
```typescript
export function scoreHiking(daily: DailyForecast[]): ActivityRanking {
  // ... pure scoring logic ...
  return { activity: ActivityType.HIKING, score, label, reasoning };
}

// Then add to the registry — rankActivities() needs no changes:
const ACTIVITY_SCORERS: ActivityScorer[] = [
  scoreSkiing,
  scoreSurfing,
  scoreIndoorSightseeing,
  scoreOutdoorSightseeing,
  scoreHiking,   // ← add here
];
```

---

### Add a new GraphQL query (e.g., `pointsOfInterest`)

**Step 1** — Add to `src/schema/typeDefs.ts`:
```graphql
type Query {
  # ... existing queries ...
  pointsOfInterest(cityId: ID!): [PointOfInterest!]!
}
```

**Step 2** — Create `src/resolvers/poi.resolver.ts`:
```typescript
import { ResolverModule } from './index';

export const poiResolver: ResolverModule = {
  Query: {
    pointsOfInterest: async (_parent, args) => {
      // ... implementation ...
    },
  },
};
```

**Step 3** — Register in `src/resolvers/index.ts`:
```typescript
import { poiResolver } from './poi.resolver';

export const resolvers = {
  Query: {
    ...cityResolver.Query,
    ...weatherResolver.Query,
    ...activitiesResolver.Query,
    ...poiResolver.Query,   // ← add here
  },
};
```

---

### Add a new environment variable

Add to **`src/config.ts`** only:
```typescript
export const config = {
  // ... existing config ...
  myNewSetting: process.env.MY_NEW_SETTING ?? 'default-value',
} as const;
```

Then import `config.myNewSetting` wherever needed. Update `.env.example` with a comment.

---

## 7 — Scoring Algorithm Reference

| Activity | Key Signals | Weights | Hard Caps |
|---|---|---|---|
| Skiing | Snowfall, temperature, wind | 50 / 30 / 20 | None |
| Surfing | Wind speed, temperature, precipitation | 40 / 35 / 25 | Max 20 if severe weather |
| Indoor Sightseeing | Precipitation, extreme temp, rain frequency | 40 / 30 / 30 | Min floor of 30 |
| Outdoor Sightseeing | Precipitation, temp comfort, UV/clear sky | 40 / 35 / 25 | Max 15 if severe weather |

**Score Labels:**

| Range | Label |
|---|---|
| 75 – 100 | Excellent |
| 50 – 74 | Good |
| 25 – 49 | Fair |
| 0 – 24 | Poor |

**Severe WMO Codes** (trigger hard caps): `65, 67, 75, 77, 95, 96, 99`
