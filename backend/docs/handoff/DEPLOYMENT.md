# Deployment preparation

Local development: `npm ci`, configure your ignored `.env`, then `npm run dev`. `npm test` runs isolated regression tests (Node 24). Local sessions remain in memory; restarting local development signs users out.

Production now requires:

- `NODE_ENV=production`
- `PORT` (default 3000)
- `DB_HOST`, `DB_PORT` (default 3306), `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `SESSION_SECRET`: randomly generated secret of at least 32 bytes, supplied by your hosting secret manager. Do not commit it or use example values.
- `REDIS_URL`: private authenticated Redis endpoint; use `rediss://` when transport requires TLS. Redis holds sessions under `smartintern:sessions:` with expiry. Keep Redis isolated and configure persistence/high availability if sessions must survive service restarts.
- `TRUST_PROXY_HOPS`: exact trusted reverse-proxy hop count; 0 for direct HTTPS, 1 for a single trusted TLS-terminating proxy. Prevent clients from reaching the app directly behind a proxy. Do not enable a guessed hop count.

The startup sequence waits for Redis and MySQL before listening. Production never falls back to MemoryStore. Startup, listen and shutdown failures are structured error events. SIGTERM/SIGINT stop accepting requests and close sessions/database connections; a ten-second shutdown deadline applies.

Cookies are HttpOnly, SameSite=Lax, Secure in production, and expire after eight hours. Serve browser traffic exclusively over HTTPS, with frontend and `/api` on the same origin. Direct HTTP cannot establish a production browser session. If using separate frontend/backend origins, agree proxy/CORS and CSRF policy first; this implementation keeps the existing same-origin contract.

Logs contain event names, internal request IDs, method, route template, status and allowlisted error codes. They exclude exception messages/stacks, SQL, request bodies, credentials and cookie headers. A response X-Request-ID can correlate a reported error with logs. Configure the host to collect stderr and alert on startup_failed, request_failed and session_store_error. Do not enable verbose SQL/credential logging in production.

Deployment acceptance checks on the actual host:

1. Run `npm ci` and `npm test` against the lockfile.
2. Confirm Redis credentials/TLS, connection, expiry and sessions surviving app restart; verify cross-instance sessions when scaling.
3. Confirm MySQL network/TLS requirements with the database owner; this project does not configure remote MySQL TLS automatically. Keep the runtime database account limited to necessary CRUD privileges, and manage backups outside the runtime.
4. Through the real HTTPS proxy: login, refresh, `/api/auth/me`, logout, then confirm the old cookie no longer authenticates. Confirm Secure/HttpOnly/SameSite flags.
5. Test Pending -> Under Review -> Accepted/Rejected and the company skills-report endpoint with two company/student accounts.
6. Ensure real secrets, private service access, backup/recovery, monitoring and deployment rollback are configured. Remove demo accounts/data from public production through the agreed data-owner process.

Verified here: environment rejection cases, Redis adapter wiring and failure propagation with test doubles, cookie HTTPS/proxy policy via HTTP tests, logout/session behavior, redacted logs, live local MySQL reports, and browser integration. No live Redis service is running locally; production persistence/restart and real HTTPS proxy tests remain deployment acceptance checks. No hosting deployment was performed.

References: [Express sessions](https://expressjs.com/en/resources/middleware/session/), [connect-redis setup](https://github.com/tj/connect-redis).

## Request security and CI (added)

Login is limited to 20 unsuccessful attempts per IP per 15 minutes; successful logins do not consume this quota. HTTP 429 includes Retry-After. Production shares counters through Redis under smartintern:login: and fails closed on store errors; development uses memory.

Unsafe API methods validate Origin/Referer and Sec-Fetch-Site; cross-site and same-site sibling-origin requests are denied. Bodies must be application/json; empty logout requests remain supported. Browser frontend must remain same-origin. Non-browser clients such as Postman may omit browser origin metadata and send JSON; no CSRF token is required for this existing JSON-only contract. Do not enable permissive credentialed CORS or accept form/text bodies without reviewing this protection. Production now requires PUBLIC_ORIGIN as an exact HTTPS origin without a trailing slash (for example https://smartintern.example.com).

The Backend tests GitHub Actions workflow runs npm ci and npm test on Node 24 for relevant pull requests and pushes to main. Local verification passed all 25 test groups, including forged origins, simple-form request rejection, rate-limit responses/expiry, successful login quota and production origin validation. Real Redis and hosted workflow execution remain acceptance checks.
