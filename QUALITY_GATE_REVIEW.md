# Quality Gate Review

- Base URL used for testing: http://localhost:8787/api
- Test evidence: `evidence.txt` (cases 1-23; cases 1-19 were run against a freshly reset local D1 database, cases 20-23 were run afterwards on the same database)

## Review record

| Quality Gate area | Finding | Action taken | Evidence |
|---|---|---|---|
| Reliability | I checked that a request body that is not valid JSON does not cause a 500 error. | Body parsing is wrapped in try/catch (`readBody`). Invalid or non-object bodies return 400 with `{ "error": "Body must be a valid JSON object" }`. | evidence.txt case 10: body `{bad` -> 400 |
| Accuracy | I checked that a PATCH containing only `endAt` is still validated against the stored `startAt`. | PATCH loads the stored booking, merges the patch over it, then validates the merged object. | case 9: `endAt` 08:00 against stored `startAt` 09:00 -> 400 |
| Reliability | I checked that an update does not conflict with its own existing booking. | The overlap query excludes the booking being updated (`id != ?`). | case 8 (PATCH purpose only) -> 200; case 14 (full-payload PATCH) -> 200 |
| Reasoning | Back-to-back bookings should be allowed while real overlaps are rejected. | Bookings are half-open intervals `[start, end)`. Overlap condition: `existing.start < new.end AND existing.end > new.start`. | case 3 (starts exactly when the previous one ends) -> 201; case 2 (overlap) -> 409; case 15 -> 409 |
| You Own It | During testing I copied a booking id incorrectly (extra text `,equipmentId` was included), so PATCH/GET returned 404 and the evidence was wrong. | I noticed it in the server log (the URL contained `,equipmentId`), reset the local database, and re-ran all cases from the start with the correct id. | Server log showed 404 on the bad id; final run shows 200/400/409 as expected (cases 7-15) |

## Why each status code

- **400**: the request is invalid (malformed JSON, missing field, bad date, `startAt >= endAt`, empty PATCH body).
- **404**: the booking id or the `equipmentId` does not exist, or the route is unknown.
- **409**: the request is valid but conflicts with an existing booking for the same equipment.

## Limitations and assumptions

- The overlap check and the insert/update are two separate queries. Two simultaneous requests could both pass the check. I did not test concurrent requests.
- An unknown `equipmentId` returns 404. This is my design choice; 400 is also defensible.
- Equipment is seeded by `schema.sql` and is read-only through the API.
- Times are UTC ISO-8601 strings.

## Submission decision

READY 