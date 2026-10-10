# Frontend teammate handoff

The backend keeps the current same-origin, cookie-session API. Import SmartIntern.postman_collection.json and use API-HANDOFF.md. Demo credentials are local test accounts, not production credentials.

## Integration tasks

1. Keep frontend and `/api` on the same origin (or use your dev-server proxy). Existing fetch calls use browser default same-origin credentials correctly. Do not add bearer tokens or read the HttpOnly cookie in JavaScript.
2. On login send email, exact password, and Student/Company role. Refresh uses `/api/auth/me`; after logout it returns 401. Show API errors rather than replacing every error with wrong password.
3. Change the status dropdown to allowed choices: Pending has Pending/Under Review; Under Review has Under Review/Accepted/Rejected; Accepted and Rejected are read-only final decisions. Same-status retries are permitted. On 409, show the API error and refetch applicants so the displayed selection matches the saved database status.
4. Applicant responses now include `matchedSkills`, `missingSkills`, `missingMandatorySkills`, and structured `requirements`, alongside existing `match_score` and identity/status fields. A dedicated `GET /api/company/internships/:internshipId/skills-report` returns the same enriched rows for the owning company. Display gaps and proficiency/experience thresholds; empty arrays mean no gaps or no configured requirements, so inspect requirements.length.
5. Clearly label match_score as the score saved when applying. Skill gaps reflect the current profile and current internship requirements; they can change after application. MySQL DECIMAL values can be strings; format with Number(value).

## Browser verification and remaining frontend work

The existing UI was checked against the backend for company/student login, cookie session reuse, applicant lists, and saved decisions. A temporary QA application was moved Pending → Under Review → Accepted using the company UI, then verified in the student tracker. Previously saved Accepted/Rejected decisions also appear. The UI currently offers all four statuses and does not render the new company skill detail fields. Its error handler shows server errors but does not restore the status dropdown after a rejected update; a page reload/refetch restores the saved value. These are frontend teammate tasks. Frontend source has not been edited.

This is a local handoff document for the user to share. No external teammate was contacted and no claim is made that a teammate has completed their own acceptance run.

Request protection now requires same-origin browser requests and JSON request bodies. Empty logout still works. Handle 429 login errors using Retry-After and the API error message. Production PUBLIC_ORIGIN must match the HTTPS site exactly.
