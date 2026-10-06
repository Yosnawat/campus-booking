# API Contract: Campus Equipment Booking API

Base URL used for testing: `http://localhost:8787/api`

All request and response bodies are JSON (`Content-Type: application/json`). Times are UTC ISO-8601 strings, for example `2026-10-20T09:00:00.000Z`.

## Endpoints

| Method | Path | Success | Error statuses |
|---|---|---|---|
| GET | `/equipment` | 200 | - |
| GET | `/bookings` | 200 | - |
| GET | `/bookings/:id` | 200 | 404 |
| POST | `/bookings` | 201 | 400, 404, 409 |
| PATCH | `/bookings/:id` | 200 | 400, 404, 409 |
| DELETE | `/bookings/:id` | 204 (no body) | 404 |

## Equipment

### GET /equipment

Returns `200`:

```json
[
  { "id": "eq-1", "name": "Projector A", "location": "Building 1" },
  { "id": "eq-2", "name": "Camera Canon R6", "location": "Media Lab" },
  { "id": "eq-3", "name": "Meeting Room 201", "location": "Building 2" }
]
```

Equipment is seeded by `schema.sql` and is read-only through the API.

## Bookings

### Booking object (response)

```json
{
  "id": "bk-6c6bdbd5-d830-44be-8a60-fd80091bde1c",
  "equipmentId": "eq-1",
  "borrowerName": "Somchai Jaidee",
  "startAt": "2026-10-20T09:00:00.000Z",
  "endAt": "2026-10-20T11:00:00.000Z",
  "purpose": "Class presentation",
  "createdAt": "2026-10-06T07:03:26.734Z"
}
```

`purpose` is `null` when not provided. `createdAt` is an extra field.

### Request payload (POST and PATCH)

```json
{
  "equipmentId": "eq-1",
  "borrowerName": "Somchai Jaidee",
  "startAt": "2026-10-20T09:00:00.000Z",
  "endAt": "2026-10-20T11:00:00.000Z",
  "purpose": "Class presentation"
}
```

| Field | Type | POST | PATCH | Rule |
|---|---|---|---|---|
| `equipmentId` | string | required | optional | must match an existing equipment id |
| `borrowerName` | string | required | optional | non-empty |
| `startAt` | string | required | optional | valid ISO-8601 date |
| `endAt` | string | required | optional | valid ISO-8601 date, later than `startAt` |
| `purpose` | string | optional | optional | string if provided |

### GET /bookings

Returns `200` with an array of bookings ordered by `startAt`. Optional query: `?equipmentId=eq-1` returns only that equipment's bookings.

### GET /bookings/:id

Returns `200` with one booking, or `404` if the id does not exist.

### POST /bookings

Creates a booking. Returns `201` with the created booking.

Checks run in this order:
1. Body is a valid JSON object, fields are present and valid, `startAt < endAt` (otherwise `400`).
2. `equipmentId` exists (otherwise `404`).
3. No overlap with an existing booking for the same equipment (otherwise `409`).

### PATCH /bookings/:id

Updates a booking. Returns `200` with the updated booking.

- `404` if the booking id does not exist.
- `400` if the body is not a JSON object or contains none of the updatable fields.
- The patch is merged over the stored booking and the merged result is validated, so sending only `endAt` is checked against the stored `startAt`.
- The overlap check excludes the booking being updated, so a booking never conflicts with itself.

### DELETE /bookings/:id

Returns `204` with no body, or `404` if the id does not exist.

## Overlap rule

Bookings are half-open intervals `[startAt, endAt)`. Two bookings for the same equipment overlap when:

```
existing.startAt < new.endAt  AND  existing.endAt > new.startAt
```

A booking that starts exactly when another ends (for example 11:00 to 12:00 after 09:00 to 11:00) is allowed.

## Error format

Every error response is JSON:

```json
{ "error": "A message understandable to a user or developer" }
```

| Status | When | Example message |
|---|---|---|
| 400 | Invalid JSON, missing or wrong-type field, invalid date, `startAt >= endAt`, empty PATCH | `"startAt must be before endAt"` |
| 404 | Booking not found, `equipmentId` not found, unknown route | `"Equipment 'eq-99' not found"` |
| 409 | Time range overlaps an existing booking for the same equipment | `"Equipment is already booked in that time range"` |
| 500 | Unexpected server error | `"Internal server error"` |

## Design notes

- An unknown `equipmentId` returns `404` (the referenced resource does not exist). `400` would also be defensible; this is a documented assumption.
- Overlap check and write are separate queries, so simultaneous requests could both pass the check. Concurrent requests were not tested.