# SmartIntern backend API handoff

Verified locally on 2026-10-10. Base URL: http://127.0.0.1:3000. Start from the repository root with npm.cmd run dev; MySQL80 must be running and .env must contain local credentials. Do not share .env.

## Authentication and frontend integration

The backend uses express-session cookies (connect.sid), not JWT. Select Student or Company explicitly; role matching is case-sensitive. Student demo: alice@example.com / student123. Company demo: recruiter@techbridge.example / company123. These are fabricated demo credentials.

Keep frontend and API on the same origin. In browser requests use credentials: 'same-origin' (or 'include' where an explicitly configured cross-origin deployment is used). No CORS middleware is currently configured. A frontend dev server on another port needs a same-origin proxy or a separately agreed backend CORS setup.

POST /api/auth/login sets a fresh session cookie. GET /api/auth/me restores identity. POST /api/auth/logout destroys the session. Profiles and write ownership are derived from the session; never send user/profile IDs to impersonate another account.

### Importing the Postman collection

Import SmartIntern.postman_collection.json. Set baseUrl. Send Login Student or Login Company as needed; Postman retains cookies automatically. Logging in as another role replaces the active session for that host. Use catalog/list responses to fill ID variables. Create responses automatically capture internshipId, applicationId, projectId, projectCode and experienceId. Use raw JSON bodies and Content-Type: application/json. Do not run all requests blindly: profile edits and DELETE requests mutate live data.

## Errors and validation

Errors use {"error":"message"}. 400: invalid input/missing referenced record; 401: not logged in or wrong credentials; 403: wrong role/missing account profile; 404: missing or inaccessible owned record; 409: duplicate application/project membership or internship with dependent applications; 500: generic server error. Do not turn all errors into “wrong password”; show the API error and HTTP status.

IDs are positive safe integers. GPA: 0–4; study year: integer 1–10; proficiency: integer 1–5; experience years: 0–99; duration months: integer 0–600. Date format: YYYY-MM-DD. Year fields: 1901–2155 when supplied. Booleans accept true/false, 1/0 and equivalent strings. Password spaces are preserved. Invalid input must be shown to the user. MySQL DECIMAL values often arrive as JSON strings: convert scores/GPA explicitly with Number(value).

## Matching and applications

Skill points: 60 × satisfied requirements / total requirements, or zero if any mandatory requirement is unmet. No skill requirements gives 60 points. A satisfied skill meets both proficiency and required years. GPA points: zero below minimum or absent; otherwise GPA/4 × 20. Study-year points: zero below minimum or absent; otherwise min(year,4)/4 × 20. Qualification requires all mandatory skills and both minimums. Projects/certifications/experience do not add matching points. Scores should stay within 0–100.

Match rows include matched_skills, missing_skills and missing_mandatory_skills as comma-separated names or null. Applications store the server-computed match score at submission; changing a profile later recalculates discovery scores but does not rewrite existing application scores. Distinguish live match scores from stored applicant rankings.

Workflow: student POST /api/student/applications → owning company GET /api/company/internships/:internshipId/applications → PATCH /api/company/applications/:applicationId/status → student GET /api/student/applications. Status values: Pending, Under Review, Accepted, Rejected. The API enforces Pending → Under Review → Accepted/Rejected. Accepted and Rejected are final and cannot be reopened. Repeating the current status succeeds without changing data. Invalid transitions or concurrent changes return 409. There is no application-delete endpoint.

Reports return company-wide counts and the top five stored applicant scores. Per-internship applicants are separately ordered by score descending then application date. There is no company-side missing-skills report endpoint; missing skills are returned in the student matching API. Equal-score ordering in topApplicants is not guaranteed.

## Endpoint reference

### GET /api/health

Role: Public. Success: 200. Response: {ok, database}

### POST /api/auth/login

Role: Public. Success: 200. Response: {userId, email, role, profileId}; session cookie is set

Example JSON (replace variables with values):

```json
{
  "email": "{{studentEmail}}",
  "password": "{{studentPassword}}",
  "role": "Student"
}
```

### GET /api/auth/me

Role: Student or Company. Success: 200. Response: {userId, email, role, profileId}

### POST /api/auth/logout

Role: Public. Success: 200. Response: {ok}

### GET /api/catalog/skills

Role: Student or Company. Success: 200. Response: Writes: {ok:true}; reads: array of database records.

### GET /api/catalog/education

Role: Student. Success: 200. Response: Writes: {ok:true}; reads: array of database records.

### GET /api/catalog/certifications

Role: Student. Success: 200. Response: Writes: {ok:true}; reads: array of database records.

### GET /api/catalog/experience

Role: Student. Success: 200. Response: Writes: {ok:true}; reads: array of database records.

### GET /api/student/profile

Role: Student. Success: 200. Response: GET: {profile, education[], skills[], projects[], certifications[], experience[]}; PUT: {first_name,last_name}

### PUT /api/student/profile

Role: Student. Success: 200. Response: GET: {profile, education[], skills[], projects[], certifications[], experience[]}; PUT: {first_name,last_name}

Example JSON (replace variables with values):

```json
{
  "firstName": "Alice",
  "lastName": "Tan"
}
```

### GET /api/student/matches

Role: Student. Success: 200. Response: Array of matches with internship_id, title, company_name, gpa, study_year, requirements, matched_skills, missing_skills, missing_mandatory_skills, match_score, qualification_status, applicant_count, has_applied, application_status

### GET /api/student/applications

Role: Student. Success: 200. Response: GET: application rows; POST: {applicationId, matchScore}

### POST /api/student/applications

Role: Student. Success: 201. Response: GET: application rows; POST: {applicationId, matchScore}

Example JSON (replace variables with values):

```json
{
  "internshipId": "{{internshipId}}"
}
```

### POST /api/student/skills

Role: Student. Success: 201. Response: Writes: {ok:true}; reads: array of database records.

Example JSON (replace variables with values):

```json
{
  "skillId": "{{skillId}}",
  "proficiencyLevel": 3,
  "yearsExperience": 0,
  "lastUsedYear": 2026
}
```

### DELETE /api/student/skills/:skillId

Role: Student. Success: 200. Response: Writes: {ok:true}; reads: array of database records.

### POST /api/student/education

Role: Student. Success: 201. Response: Writes: {ok:true}; reads: array of database records.

Example JSON (replace variables with values):

```json
{
  "educationId": "{{educationId}}",
  "gpa": 3.5,
  "studyYear": 3,
  "graduationYear": 2027,
  "isCurrent": true
}
```

### DELETE /api/student/education/:educationId

Role: Student. Success: 200. Response: Writes: {ok:true}; reads: array of database records.

### POST /api/student/projects

Role: Student. Success: 201. Response: POST: {projectId,projectCode}

Example JSON (replace variables with values):

```json
{
  "projectName": "QA API Project",
  "projectRole": "Developer",
  "description": "Local demo project",
  "technologies": "Node.js, SQL"
}
```

### POST /api/student/projects/join

Role: Student. Success: 201. Response: POST: {projectId}

Example JSON (replace variables with values):

```json
{
  "projectCode": "{{projectCode}}",
  "projectRole": "Developer"
}
```

### DELETE /api/student/projects/:projectId

Role: Student. Success: 200. Response: Writes: {ok:true}; reads: array of database records.

### POST /api/student/certifications

Role: Student. Success: 201. Response: Writes: {ok:true}; reads: array of database records.

Example JSON (replace variables with values):

```json
{
  "certificationId": "{{certificationId}}",
  "issueDate": "2026-10-10"
}
```

### DELETE /api/student/certifications/:certificationId

Role: Student. Success: 200. Response: Writes: {ok:true}; reads: array of database records.

### POST /api/student/experience

Role: Student. Success: 201. Response: POST: {experienceId}

Example JSON (replace variables with values):

```json
{
  "experienceId": "{{experienceId}}",
  "positionTitle": "Intern",
  "role": "Developer",
  "durationMonths": 3
}
```

### DELETE /api/student/experience/:experienceId

Role: Student. Success: 200. Response: Writes: {ok:true}; reads: array of database records.

### GET /api/company/profile

Role: Company. Success: 200. Response: GET: {company_id,company_name,description,email}; PUT: {ok}

### PUT /api/company/profile

Role: Company. Success: 200. Response: GET: {company_id,company_name,description,email}; PUT: {ok}

Example JSON (replace variables with values):

```json
{
  "companyName": "TechBridge Solutions",
  "description": "Software development and consulting company."
}
```

### GET /api/company/internships

Role: Company. Success: 200. Response: GET: internship rows with skills[] and application_count; POST: {internshipId}

### POST /api/company/internships

Role: Company. Success: 201. Response: GET: internship rows with skills[] and application_count; POST: {internshipId}

Example JSON (replace variables with values):

```json
{
  "title": "QA API Internship",
  "minGpa": 3,
  "minStudyYear": 2
}
```

### PUT /api/company/internships/:internshipId

Role: Company. Success: 200. Response: Writes: {ok:true}; reads: array of database records.

Example JSON (replace variables with values):

```json
{
  "title": "QA API Internship Updated",
  "minGpa": 3,
  "minStudyYear": 2
}
```

### DELETE /api/company/internships/:internshipId

Role: Company. Success: 200. Response: Writes: {ok:true}; reads: array of database records.

### POST /api/company/internships/:internshipId/skills

Role: Company. Success: 201. Response: Writes: {ok:true}; reads: array of database records.

Example JSON (replace variables with values):

```json
{
  "skillId": "{{skillId}}",
  "isMandatory": true,
  "minimumProficiency": 3,
  "requiredYears": 0
}
```

### DELETE /api/company/internships/:internshipId/skills/:skillId

Role: Company. Success: 200. Response: Writes: {ok:true}; reads: array of database records.

### GET /api/company/internships/:internshipId/applications

Role: Company. Success: 200. Response: Application rows with student names/email, match_score and status, ordered by score descending then application_date

### PATCH /api/company/applications/:applicationId/status

Role: Company. Success: 200. Response: Writes: {ok:true}; reads: array of database records.

Example JSON (replace variables with values):

```json
{
  "status": "Under Review"
}
```

### GET /api/company/reports

Role: Company. Success: 200. Response: {summary:{internships,applications,pending,under_review,accepted,rejected}, topApplicants:[{title,student_name,match_score,status}]}

## Optional create fields

Student skills may use skillId, or skillName and optional category. Education may use educationId, or institution and degree, plus gpa, studyYear, optional graduationYear and isCurrent. Certifications may use certificationId, or certificationName and issuer, plus issueDate. Experience may use experienceId, or organization, plus positionTitle, role and durationMonths. Skills, education, certifications and experience catalog entities can be shared; student DELETE endpoints remove the student's association. Deleting a project association does not delete the shared project.

## Test evidence and remaining scope

See live-test-results.json and TEST-REPORT.md. Browser UI covered company login, internship creation/skill requirement, student application, company Under Review/Accepted, company reports and student status verification. Direct live API/MySQL checks supplement update/delete and rejected paths. No production deployment, multi-user load/concurrency, password reset, admin role, or email features were tested.

## Company skill-gap report (added)

GET /api/company/internships/:internshipId/skills-report requires Company role and internship ownership (401 unauthenticated, 403 Student, 404 foreign/missing internship). Returns an array of applicant rows in stored score order, each with existing fields plus matchedSkills, missingSkills, missingMandatorySkills (arrays of names) and requirements (array of skillId, skillName, mandatory, minimumProficiency, requiredYears, proficiencyLevel, yearsExperience, matched). Missing student values are null. No applicants returns []. No requirements yields empty arrays. The existing applicants endpoint includes the same additional fields, preserving its existing response shape. Skill detail is current; match_score is the application-time snapshot.

See DEPLOYMENT.md and FRONTEND-CHECKLIST.md for production configuration and teammate acceptance tasks.

## Request security and CI (added)

Login is limited to 20 unsuccessful attempts per IP per 15 minutes; successful logins do not consume this quota. HTTP 429 includes Retry-After. Production shares counters through Redis under smartintern:login: and fails closed on store errors; development uses memory.

Unsafe API methods validate Origin/Referer and Sec-Fetch-Site; cross-site and same-site sibling-origin requests are denied. Bodies must be application/json; empty logout requests remain supported. Browser frontend must remain same-origin. Non-browser clients such as Postman may omit browser origin metadata and send JSON; no CSRF token is required for this existing JSON-only contract. Do not enable permissive credentialed CORS or accept form/text bodies without reviewing this protection. Production now requires PUBLIC_ORIGIN as an exact HTTPS origin without a trailing slash (for example https://smartintern.example.com).

The Backend tests GitHub Actions workflow runs npm ci and npm test on Node 24 for relevant pull requests and pushes to main. Local verification passed all 25 test groups, including forged origins, simple-form request rejection, rate-limit responses/expiry, successful login quota and production origin validation. Real Redis and hosted workflow execution remain acceptance checks.
