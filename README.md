# SmartIntern Database Matching Demo

SmartIntern is a local internship matching demo built with MySQL, Node.js, Express, and vanilla HTML/CSS/JavaScript.

## Project structure

```text
frontend/                 View: HTML, styles, and browser-side JavaScript
backend/
  config/                 Environment configuration
  controllers/            Request handling and application logic
  middleware/             Authentication and role checks
  models/                 MySQL connection and reusable data queries
  routes/                 API endpoint-to-controller mapping
  utils/                  Input validation helpers
  app.js                  Express configuration
  server.js               Application entry point
database/                 Schema, sample data, and report queries
```

The backend uses a layered MVC-style structure: the frontend provides the View, routes map HTTP endpoints, controllers handle application logic, and models provide database access.

## Database setup

In MySQL Workbench, run these files in order:

1. `database/01_create_schema.sql` (run once against a fresh database; requires MySQL 8.0.13 or later)
2. `database/02_sample_data.sql` (run once on an empty schema)
3. `database/04_seed_demo_opportunities.sql` (optional; adds 8 companies and 17 internships; safe to rerun)
4. `database/03_business_queries.sql` (reports; safe to rerun)

The demo opportunity seed brings the sample catalog to 10 companies and 20 internships. New demo company accounts use the `company123` password. The schema prevents applications to internships until at least one skill requirement exists; matching also hides internships until requirements are added.

## Application setup

1. Copy `.env.example` to `.env` in the project root.
2. Set the MySQL connection values in `.env`. For the app, use a dedicated MySQL user with access to `smartintern_db`.
3. Install dependencies with `npm install`.
4. Start the app with `npm start` and open [http://localhost:3000](http://localhost:3000).

## Demo credentials

- Student accounts use the password `student123`.
- Company accounts use the password `company123`.

The sample database uses fabricated records for local demonstration.
