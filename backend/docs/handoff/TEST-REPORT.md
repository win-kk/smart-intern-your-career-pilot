# Live backend test report

Date: 2026-10-10. Target: http://127.0.0.1:3000 with live smartintern_db. Frontend/backend source files were not edited during this test.

## Verified results

- Company UI login succeeds with recruiter@techbridge.example / company123 and Company selected. Student UI login succeeds with the seeded credentials. The earlier wrong-login message was not reproduced with the correct role selected; its original cause cannot be established from that message alone.
- Browser UI: created QA Backend Workflow 2026-10-10, saved mandatory SQL level 3, Alice applied, company selected Under Review then Accepted, Alice's tracker displays Accepted after signing in again.
- Live API/MySQL: student and company profile updates persist; original profile fields restored immediately afterward.
- Live API/MySQL: QA skill create, read, update, and delete persist. Temporary catalog/association removed.
- Live API/MySQL: separate QA internship create, edit, skill requirement add/remove, and delete persist. Temporary internship removed. Foreign-company edit returned 404.
- Live API/MySQL: Bob applied to the retained QA internship, duplicate returned 409, foreign company status update returned 404, owning company moved it Under Review then Rejected. Student API and MySQL agree.
- Applicant ordering and report top five match direct MySQL query results. Status counts match the company's actual applications.
- Independently checked missing skills and scoring arithmetic for every current internship for Alice and Bob, against live skill requirements/proficiency/experience and education values.

Eleven live test groups passed; see live-test-results.json for exact retained IDs and counts. Browser evidence: company-reports.png, student-accepted.png and student-rejected.png.

## Important API gaps and behavior

- Company reports expose company-wide summary and top five applicants. Per-internship rankings are available in its applicants endpoint.
- The original live-check version exposed skill gaps only to students. The subsequent update adds an owning-company skills-report endpoint and enriched applicant responses.
- At the time of the live checks, status values were validated without transition restrictions. The subsequent backend update now enforces Pending → Under Review → Accepted/Rejected; final decisions cannot reopen. See automated verification below.
- Stored application scores remain submission snapshots; subsequent profile changes do not update stored application scores.
- Equal-score ordering is unspecified for topApplicants. Do not rely on a stable tie order.
- The company internship UI currently provides creation/requirements but no edit/delete controls; those backend operations were tested directly through HTTP.
- No application-delete endpoint exists. Application CRUD therefore means create/read/status update; delete was not claimed.

## Retained test records

One clearly named QA Backend Workflow 2026-10-10 internship remains under TechBridge Solutions with Alice Accepted and Bob Rejected. This keeps a repeatable demo/evidence example. No original applications or statuses were changed. Other CRUD test data was removed and original profile fields were restored.

## Handoff

Import SmartIntern.postman_collection.json (37 requests). See API-HANDOFF.md for role requirements, request fields, response shapes, cookies, errors, matching formula, and frontend integration notes. Requests should be sent selectively; importing the collection alone changes nothing. Avoid bulk-running mutation requests against real records.

This handoff is saved locally for you to share with your teammate; no message or files were sent to another person.

## Subsequent automated workflow/security verification

Run `node --test backend/tests/*.test.js` from the repository root (Node 24). All 15 test groups passed. The new security tests use HTTP sessions and an isolated in-memory SQLite database, executing the relevant ownership and transition SQL; they do not modify live MySQL. They verify two-student application isolation, two-company internship/applicant isolation and rejected foreign mutations, all 16 status pairs, both final-decision tracker paths, and a simulated concurrent update. The full suite also covers authentication, session rotation, roles, validation, transactions, matching, and error responses.

Company applicant lists return an empty array for inaccessible internships. Forbidden status transitions and concurrent status changes return 409. Repeating the current status returns 200. No frontend code or database schema was changed for this update.

## Company reports, frontend integration and deployment preparation

All 21 current automated test groups passed. Additional tests cover skill-report ownership and missing/proficiency/experience cases; production environment requirements; Redis setup/failure handling; actual installed RedisStore save/get/touch/destroy methods through a client double; Secure/HttpOnly/SameSite cookies; logout; and secret-free logs. A live Redis server and hosting deployment were not tested.

Live MySQL report verification: internship 35 returned Alice application 6 Accepted, score 93, matched SQL, no missing skills; Bob application 7 Rejected, score 86, matched SQL, no missing skills. These fields were independently compared with raw MySQL requirements and student skill rows.

Browser verification: company login, authenticated refresh, applicants, rejected Accepted → Pending (409 displayed), valid Pending → Under Review → Accepted on temporary QA application 9/internship 37, student login/tracker confirmation, and logout. The UI retains a rejected dropdown selection until refresh; it offers all statuses and does not display company skill detail. See FRONTEND-CHECKLIST.md for teammate changes. Temporary QA records were removed after verification. Original retained demo internship 35 remains.

See DEPLOYMENT.md for production Redis/HTTPS/secrets/proxy configuration and acceptance checks. No frontend source or database schema changes; package dependencies/lockfile and environment template were updated for backend operation.

## Request security and CI (added)

Login is limited to 20 unsuccessful attempts per IP per 15 minutes; successful logins do not consume this quota. HTTP 429 includes Retry-After. Production shares counters through Redis under smartintern:login: and fails closed on store errors; development uses memory.

Unsafe API methods validate Origin/Referer and Sec-Fetch-Site; cross-site and same-site sibling-origin requests are denied. Bodies must be application/json; empty logout requests remain supported. Browser frontend must remain same-origin. Non-browser clients such as Postman may omit browser origin metadata and send JSON; no CSRF token is required for this existing JSON-only contract. Do not enable permissive credentialed CORS or accept form/text bodies without reviewing this protection. Production now requires PUBLIC_ORIGIN as an exact HTTPS origin without a trailing slash (for example https://smartintern.example.com).

The Backend tests GitHub Actions workflow runs npm ci and npm test on Node 24 for relevant pull requests and pushes to main. Local verification passed all 25 test groups, including forged origins, simple-form request rejection, rate-limit responses/expiry, successful login quota and production origin validation. Real Redis and hosted workflow execution remain acceptance checks.
