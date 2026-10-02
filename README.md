# SmartIntern Demo Application

This is the full live-demo application for the SmartIntern database project. It uses Node.js, Express, vanilla HTML/CSS/JavaScript, and the local MySQL database.

## Setup

1. Make sure the `smartintern_db` database has been created and populated using `01_create_schema.sql` and `02_sample_data.sql` in `sql/`.
2. If the database was created before the shared-organization experience and project-code updates, run `05_update_experience_structure.sql` and `06_update_project_codes.sql` once in MySQL Workbench.
3. Copy `.env.example` to `.env`.
4. Put the MySQL root password in `.env` as `DB_PASSWORD`. Do not commit `.env`.
5. Install dependencies:

```text
npm install
```

If npm is unavailable, use the installed pnpm command instead:

```text
pnpm install
```

## Run

```text
npm start
```

Then open [http://localhost:3000](http://localhost:3000).

## Local demo credentials

These credentials are for the local presentation database only:

- Student accounts: `student123`
- Company accounts: `company123`

## Demo features

- Student view with current education and internship match scores.
- Missing mandatory-skill display.
- Student application submission.
- Company view with internship application counts.
- Company review of applicants and application-status updates.

## API routes

- `GET /api/health`
- `GET /api/students`
- `GET /api/companies`
- `GET /api/students/:studentId/matches`
- `GET /api/companies/:companyId/internships`
- `GET /api/internships/:internshipId/applications`
- `POST /api/applications`
- `PATCH /api/applications/:applicationId/status`
