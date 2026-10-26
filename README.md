# Flock Energy — Urja Meter Ops API

A Node.js and Express REST API wrapper around the legacy Urja Meter Ops portal. The service exposes meter information, consumption records, and hierarchy data through a versioned API while keeping portal-specific HTTP requests and response parsing inside a dedicated adapter.

## Features

- Read-only API endpoints for meter listing, meter details, and consumption records.
- Pagination and search for meter listing.
- Date-range filtering for consumption records.
- Hierarchy reconstruction from meter details.
- Centralized error handling and query-parameter validation.
- OpenAPI schema and Swagger UI documentation.
- Environment-based configuration for the portal connection.

## Requirements

- Node.js 18 or later
- npm
- Authorized access to the Urja Meter Ops portal

## Setup

Clone or extract the project and enter its directory:

```bash
cd flock-energy-api
npm install
cp .env.example .env
```

Configure the required values in `.env` locally:

```env
PORT=3000
URJA_BASE_URL=https://urja-ops.flockenergy.tech
URJA_USERNAME=
URJA_PASSWORD=
REQUEST_TIMEOUT_MS=10000
```

Keep credentials, session cookies, and tokens private. Never commit `.env` or include it in a shared submission archive.

**Authentication note:** The adapter currently relies on the portal session cookie supplied through its configured environment. The username and password variables are not a substitute for a verified automatic login flow.

## Run the API

Start the development server:

```bash
npm run dev
```

Or start it normally:

```bash
npm start
```

By default, the service listens at `http://localhost:3000`.

## API endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Checks whether the API process is running |
| `GET` | `/api/v1/meters` | Lists meters with optional pagination and search |
| `GET` | `/api/v1/meters/:id` | Retrieves details for a meter |
| `GET` | `/api/v1/meters/:id/consumption` | Retrieves consumption records, optionally filtered by date |
| `GET` | `/api/v1/hierarchy` | Reconstructs hierarchy data from meter records |
| `GET` | `/openapi.json` | Returns the OpenAPI document |
| `GET` | `/docs` | Opens the Swagger UI documentation |

### Meter listing

Optional query parameters:

- `limit`: number of records to return, from 1 to 100.
- `offset`: zero-based number of records to skip.
- `search`: search text passed to the portal meter search.

Example:

```bash
curl "http://localhost:3000/api/v1/meters?limit=5&offset=0"
```

Example search:

```bash
curl "http://localhost:3000/api/v1/meters?search=J100005"
```

### Meter details

```bash
curl "http://localhost:3000/api/v1/meters/J100000"
```

The response includes available meter information and its parsed hierarchy fields.

### Consumption records

```bash
curl "http://localhost:3000/api/v1/meters/J100000/consumption"
```

Optional `from` and `to` query parameters filter records by timestamp. Supply valid date/time values that JavaScript can parse, preferably in ISO 8601 format.

```bash
curl "http://localhost:3000/api/v1/meters/J100000/consumption?from=2026-06-24T00:00:00&to=2026-06-24T02:00:00"
```

Invalid dates and ranges are rejected with a client error.

### Hierarchy

```bash
curl "http://localhost:3000/api/v1/hierarchy"
```

The adapter gathers meter records, retrieves their details, and deduplicates available hierarchy paths. This operation makes multiple portal requests and may take longer than an individual meter request.

### Health check

```bash
curl "http://localhost:3000/health"
```

Expected response:

```json
{
  "status": "ok",
  "service": "flock-energy-api"
}
```

## Error handling

Errors use a consistent JSON structure:

```json
{
  "error": {
    "code": "INVALID_QUERY_PARAMETER",
    "message": "limit must be an integer between 1 and 100."
  }
}
```

The API validates pagination values and consumption date filters. It also handles missing meters and unexpected portal responses. Internal server errors return a generic message rather than exposing implementation details to API consumers.

## Project structure

```text
flock-energy-api/
├── src/
│   ├── server.js
│   ├── routes/
│   │   └── meters.js
│   └── portal/
│       └── client.js
├── .env.example
├── .gitignore
├── openapi.json
├── PROTOCOL.md
├── README.md
├── REFLECTION.md
└── package.json
```

- `src/server.js`: configures Express, routes, documentation, and error handling.
- `src/routes/meters.js`: handles meter API routes and validates incoming parameters.
- `src/portal/client.js`: communicates with the portal, parses responses, and normalizes data.
- `PROTOCOL.md`: records observed portal endpoints, authentication behavior, and response formats.
- `openapi.json`: describes the public API contract.
- `REFLECTION.md`: discusses implementation decisions, difficulties, and limitations.

## Verification

The following behaviors were manually checked during development:

- Health endpoint response.
- Meter listing, pagination, and search.
- Valid and invalid pagination parameters.
- Meter detail retrieval and missing-meter handling.
- Consumption retrieval and date-range filtering.
- Invalid date and date-range handling.
- Hierarchy reconstruction.
- Swagger UI and OpenAPI endpoint availability.

These are manual checks, not a substitute for an automated test suite.

## Known limitations

- The adapter depends on the legacy portal's current endpoints, response formats, and session behavior.
- Automatic login and session-expiry recovery are not implemented as a complete flow.
- Some portal meter records have incomplete hierarchy fields; the reconstructed hierarchy can therefore contain incomplete paths.
- The hierarchy endpoint requires many sequential portal requests and may be slow.
- Automated unit and integration tests, sanitized response fixtures, and retry handling for transient failures are future improvements.
- Portal behavior that has not been verified is documented as uncertain in `PROTOCOL.md`.

## Further improvements

1. Add automated tests using sanitized portal-response fixtures.
2. Improve hierarchy reconstruction and explicitly represent missing hierarchy fields.
3. Add bounded retries for transient failures and a robust session-expiry strategy.
4. Reduce the number of requests required to build the hierarchy.
5. Add structured logging with sensitive values redacted.
6. Keep the OpenAPI document aligned with actual endpoint behavior and error responses.
