# Quality Gate Review

- Base URL used for testing (local): http://localhost:8787/api
- Base URL used for testing (cloud): https://campus-booking.my-taskflow.workers.dev/api
- Test evidence (local): `evidence.txt` (cases 1-23; cases 1-19 were run against a freshly reset local D1 database, cases 20-23 were run afterwards on the same database)
- Test evidence (cloud): `evidence_cloud.txt` (cases C1-C8, run on Cloudflare Workers + remote D1)
- First-version snapshot (before minute 30): I did not save a separate screenshot at minute 30. The earliest verifiable record of the first working version is the first local test in `evidence.txt` (case 1, valid POST -> 201, `createdAt` 2026-10-06T07:03:26Z). The Quality Gate review and the fixes below were made after that first version. I understand a missing separate snapshot may reduce marks for this item.

## Review record

| Quality Gate area | Finding | Action taken | Evidence |
|---|---|---|---|
| Reliability | I checked that a request body that is not valid JSON does not cause a 500 error. | Body parsing is wrapped in try/catch (`readBody`). Invalid or non-object bodies return 400 with `{ "error": "Body must be a valid JSON object" }`. | evidence.txt case 10: body `{bad` -> 400 |
| Accuracy | I checked that a PATCH containing only `endAt` is still validated against the stored `startAt`. | PATCH loads the stored booking, merges the patch over it, then validates the merged object. | case 9: `endAt` 08:00 against stored `startAt` 09:00 -> 400 |
| Reliability | I checked that an update does not conflict with its own existing booking. | The overlap query excludes the booking being updated (`id != ?`). | case 8 (PATCH purpose only) -> 200; case 14 (full-payload PATCH) -> 200 |
| Reasoning | Back-to-back bookings should be allowed while real overlaps are rejected. | Bookings are half-open intervals `[start, end)`. Overlap condition: `existing.start < new.end AND existing.end > new.start`. | case 3 (starts exactly when the previous one ends) -> 201; case 2 (overlap) -> 409; case 15 -> 409 |
| Accuracy / Delivery | My first cloud test returned `404 {"error":"Route not found"}` for every case (old `evidence_cloud.txt`). | The JSON error showed the Worker was running and my code was answering, so the problem was the URL, not the deployment. The code uses `basePath('/api')`, but the Base URL I used had no `https://` and no `/api`. I corrected `BASE`, deleted the old log (`>>` appends), and re-ran the cases. | New `evidence_cloud.txt`: C1-C8 return 200 / 201 / 409 / 400 / 404 / 404 / 400 / 200 |
| Reliability | There was no evidence that a non-date value in `startAt` is handled safely. | Added cloud case C7 (`startAt: "abc"`) to check the `iso()` validation. | C7 -> 400 `{"error":"startAt must be a valid ISO-8601 date"}`; C8 confirms nothing was saved by the bad request |
| Reasoning | I needed to explain what the cloud 404 meant. | A `Route not found` body in my own JSON format means the request reached my Hono app and matched no route (`app.notFound`). A missing deployment or a missing database would give a different error (Cloudflare error page, or 500 `no such table`). | Same JSON body on C1-C6 of the failed run; fixed run returns normal responses |
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