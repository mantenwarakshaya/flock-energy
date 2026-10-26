# Urja Meter Ops Protocol Notes

These notes record observations from a browser DevTools session. Unverified behavior is explicitly marked rather than assumed.

## Environment

- **Portal URL:** https://urja-ops.flockenergy.tech
- **Date inspected:** 26 October 2026
- **Browser:** Google Chrome 155
- **Device/browser environment observed:** Android 16; mobile Chrome user agent
- **Account role/permissions:** Not verified

## Authentication

### Login

- **Request:** `POST /login`
- **Observed response:** HTTP `303`, redirect location `/meters`
- **Response headers:** A `Set-Cookie` header was present.
- **Request content type:** Not recorded.
- **Payload field names:** Not recorded.
- **CSRF mechanism:** Not verified.
- **Observed session cookie name:** `__Secure-better-auth.session_token`
- **Cookie values:** Not recorded in this document.

### Authenticated requests

- Authenticated portal requests include a `Cookie` request header.
- The meter search request returned HTTP `200` during an authenticated session.

### Sign-out

- **Request:** `POST /api/auth/sign-out`
- **Observed response:** HTTP `200 OK`
- **Observed behavior:** Session cookies were cleared using `Set-Cookie` headers with `Max-Age=0`.
- **Navigation after sign-out:** The browser landed on `/login`.

### Session expiry and re-login

- The sign-out flow and cookie-clearing behavior were observed.
- The exact response for an independently expired session has not been verified.
- Automatic re-login after session expiry has not been verified.

### Authentication implications for the adapter

- Maintain cookies across authenticated requests.
- Detect authentication failures and expired sessions.
- Re-authenticate only when supported and valid credentials are configured.
- Keep credentials in environment variables or another appropriate secret store.
- Never log or expose passwords, session cookie values, or authentication tokens.

## Data Access

### Meter List

- **Request:** `/portal/meters/search?q=&page=1`
- **Method:** `GET`
- **Observed query parameters:**
  - `q`: Search query; observed as an empty string.
  - `page`: Page number; observed as `1`.
- **Response format:** JSON object.
- **Observed response fields:**
  - `data`: Array of meter objects.
  - `total`: Total matching record count.
  - `page`: Current page number.
  - `pageSize`: Number of records per page.
- **Observed sample metadata:** `total` was `403`, `page` was `1`, and `pageSize` was `20`.
- **Observed meter fields:**
  - `meterId`
  - `serialNo`
  - `make`
  - `phaseType`
  - `installStatus`
  - `dtCode`

Example observed meter object:

```json
{
  "meterId": "J100001",
  "serialNo": "GE84132",
  "make": "L&T",
  "phaseType": "single",
  "installStatus": "Installed",
  "dtCode": "DT-002"
}
```

- **Pagination:** Pagination metadata was observed. Additional pages and boundary behavior have not been independently verified.
- **Filtering:** Search parameter `q` was observed, but its filtering semantics have not been verified.
- **Data anomalies:** No systematic data-quality audit has been performed.

### Meter Details

- **Request pattern:** `/meters/{meterId}/__data.json?x-sveltekit-invalidated=001`
- **Method:** `GET`
- **Observed example:** `/meters/J100000/__data.json?x-sveltekit-invalidated=001`
- **Response format:** SvelteKit page-data JSON, not a conventional flat REST response.
- **Observed structure:** A top-level `type` field and a `nodes` array. The relevant data node contains an indexed `data` array.
- Some objects reference values by array index rather than storing the final values directly.

Observed meter fields include:

- Meter ID
- Serial number
- Make
- Phase type
- Installation status
- Installation type

Observed values for meter `J100000` included serial number `SE33962`, make `HPL`, phase type `single`, installation status `Decommissioned`, and installation type `Whole Current`.

**Adapter implication:** Decode the indexed SvelteKit structure and map the result into a stable, normalized JSON object. Handle missing or unexpected fields safely.

### Consumption

- **Request pattern:** `/portal/meters/{meterId}/energy`
- **Method:** `GET`
- **Observed example:** `/portal/meters/J100000/energy`
- **Response format:** JSON object containing a `data` array.

Each observed reading contained:

- `timestamp`: Date/time string in `DD/MM/YYYY HH:mm` format.
- `kwh`: Energy reading represented as a string.
- `kvah`: Energy reading represented as a string.
- `voltR`: R-phase voltage reading represented as a string.

Example reading:

```json
{
  "timestamp": "23/06/2026 23:30",
  "kwh": "48438.74",
  "kvah": "52313.84",
  "voltR": "226"
}
```

- **Sampling interval:** Visible sample readings were spaced 30 minutes apart.
- **Date/range parameters:** No date or range parameters were confirmed in the inspected request.
- **Units:** The field names suggest kWh, kVAh, and R-phase voltage respectively, but the portal's explicit unit definitions have not been verified.
- **Time zone:** Not verified.
- **Missing, duplicate, or inconsistent readings:** No systematic audit has been performed.

**Adapter implication:** Define consistent public response types and document timestamp and unit conventions. Validate numeric strings before converting them, and avoid assuming every reading is present or every interval is identical.

### Hierarchy

- **Separate hierarchy endpoint:** Not confirmed.
- **Observed source:** The meter detail page-data response.
- **Observed hierarchy fields:**
  - Zone
  - Circle
  - Division
  - Subdivision
  - Sub Station
  - Feeder
  - DT (distribution transformer)

Observed example values included `Jaipur Zone 1 (Z-01)`, `Circle 1 (C-01)`, `Division 1 (D-01)`, `Subdivision 1 (SD-01)`, `Substation 1 (SS-01)`, `Feeder 1 (F-001)`, and `Malviya Nagar DT 1 (DT-001)`.

- **Parent/child relationships:** The fields appear as a hierarchy in the meter detail data, but a separate hierarchy API and its relationship rules have not been verified.
- **Inconsistent or orphan nodes:** Not audited.

## Evidence and Caveats

### Findings verified in DevTools

- Meter search uses `GET /portal/meters/search` and returns JSON with pagination metadata.
- Meter details use a SvelteKit page-data request.
- The meter detail response contains meter attributes and hierarchy values.
- Consumption uses `GET /portal/meters/{meterId}/energy` and returns a `data` array.
- The login request returned a `303` redirect to `/meters`.
- Authenticated requests included a cookie header.
- Sign-out returned HTTP `200`, cleared session cookies, and led to `/login`.

### Assumptions and unverified behavior

- Login payload field names and content type.
- Whether CSRF protection is required.
- Exact behavior for an independently expired session.
- Automatic re-login behavior.
- Search filtering semantics and pagination boundary behavior.
- Explicit consumption units, time zone, and date-range support.
- Data completeness, duplicate readings, and hierarchy consistency.
- Existence of a separate hierarchy endpoint.

### Known implementation considerations

- Portal requests require an authenticated session.
- Session cookies must be handled securely and must not be committed to source control.
- The meter detail response needs a dedicated parser for SvelteKit's indexed data representation.
- Public API responses should be normalized, validated, and independent of the portal's internal response format.
- Errors, missing data, and authentication failures should be handled consistently.
