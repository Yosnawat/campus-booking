# AI Log

Tool used: Claude (Anthropic chat assistant), used during the lab test.
All AI use is recorded below. Where I list "Verified myself", I ran the check on my own machine.

## Summary

| # | What I asked | What I used from the response | What I verified myself |
|---|---|---|---|
| 1 | Design the API (contract, data model, overlap logic, test plan) from the task sheet. | Table design (`equipment`, `bookings`), half-open interval `[start, end)`, overlap condition `existing.start < new.end AND existing.end > new.start`, merge-then-validate for PATCH, exclude own id on update, the 404 choice for unknown `equipmentId`. | Checked the design against the task requirements. Ran curl cases 2, 3, 8, 9 to confirm the behaviour (see `evidence.txt`). |
| 2 | Step-by-step setup in Windows CMD. | Project setup commands, `wrangler.toml`, `schema.sql`, and the Hono implementation in `src/index.ts`. | Ran the server with `npx wrangler dev`. Confirmed the 3 seeded equipment rows with `SELECT * FROM equipment`. |
| 3 | Where to save `wrangler.toml`. | Save it in the project root next to `package.json`; check it is not saved as `.toml.txt`. | Ran `dir` to check the file name. |
| 4 | Debugging: first POST returned 500 (`no such table`). | Cause: the schema was not loaded into the local database. Fix: load `schema.sql` with `d1 execute --local`, from the project folder. | Saw the server error `no such table: equipment`, loaded the schema, then POST returned 201. |
| 5 | Debugging: `near "npx": syntax error` when loading the schema. | Cause: a command had been pasted into `schema.sql`. Fix: recreate the file with SQL only. | Opened the file with `type schema.sql`, fixed it, and the load printed `4 commands executed successfully`. |
| 6 | Asked whether I must deploy to the cloud, and what to submit. | Local `wrangler dev` is enough; the task allows local SQLite/D1 and shows a `localhost` Base URL. List of required files. | Re-read the task sheet's tools line and submission list myself. |
| 7 | Reviewed my results against the Quality Gate and curl test guide. | Extra evidence cases (GET lists, full-payload PATCH, unknown route, DELETE/PATCH on missing id, empty PATCH, equipment filter). | Ran cases 1-23 and recorded them in `evidence.txt`. |
| 8 | Debugging: PATCH/GET returned 404 in the server log. | The id I copied had extra text (`,equipmentId`) after it. I should copy only the characters from `bk-` to the closing quote. | Saw `,equipmentId` in the server log URL, reset `.wrangler\state`, reloaded the schema, and re-ran all cases from case 1 with the correct id. |
| 9 | Drafted `QUALITY_GATE_REVIEW.md`, `README.md`, and `API_CONTRACT.md`. | The structure and wording. I changed wording so each Quality Gate row says "I checked..." instead of claiming bugs I did not hit. | Compared the documents with `evidence.txt` (error messages, status codes, field names, case numbers). |

## What AI wrote and what I did

- **AI-written, then run and tested by me:** the code in `src/index.ts`, `schema.sql`, `wrangler.toml`.
- **AI-drafted, then edited and checked by me:** `README.md`, `API_CONTRACT.md`, `QUALITY_GATE_REVIEW.md`, `AI_LOG.md`.
- **Done by me:** running all commands, running all curl test cases, reading the server logs, resetting the database, finding and fixing the wrong-id mistake, committing to git.
- **Code I reviewed and can explain:** `validate` (checks every field and the date order), `overlap` (the SQL overlap query), the PATCH merge (stored values + patch, then validate), and `readBody` (try/catch that returns 400 for bad JSON).

## What I did not take from AI as-is

- I did not claim a race-condition test: the overlap check and the write are separate queries, and I did not test concurrent requests. This is written as a limitation in `README.md` and `QUALITY_GATE_REVIEW.md`.
- AI suggested an optional atomic `INSERT ... WHERE NOT EXISTS` fix. I did not apply it because of the time limit, and I documented the limitation instead.

## Things I can explain

- **Status codes:** 400 means the request itself is invalid (bad JSON, missing field, bad date, `startAt >= endAt`). 404 means the booking, the equipment, or the route does not exist. 409 means the request is valid but conflicts with an existing booking.
- **Overlap check:** two bookings for the same equipment overlap when `existing.start < new.end AND existing.end > new.start`. On update, the booking's own id is excluded so it does not conflict with itself.
- **PATCH merge:** the request may contain only some fields, so I merge it over the stored booking and validate the merged result. This catches a lone `endAt` that is before the stored `startAt`.
- **`.bind()`:** parameters are sent separately from the SQL text, so request data cannot change the query (prevents SQL injection).