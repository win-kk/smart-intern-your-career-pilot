# Proposal Feedback Alignment

This document records the decisions made after the proposal review.

## Scope and users

- Supported account roles are `Student` and `Company` only.
- Admin accounts, administrator workflows, and career-support staff workflows are out of scope.
- Every Student profile belongs to exactly one User account.
- Every Company profile belongs to exactly one User account.
- The database implements these as one-to-one relationships using a unique `user_id` foreign key in each profile table.
- Student and Company keep separate primary keys: `student_id` and `company_id`.

## Internship rules

- Internship publication status is out of scope.
- An Internship must have at least one skill requirement before students can apply.
- The database does not need `status` or `published_at` for this rule.

## Business questions

1. Which students are the best qualified for each internship?
2. Which mandatory skills are missing for a selected student and internship?
3. What is the match score for every student-internship pair?

## Matching rules

- Skills contribute 60 points.
- GPA contributes 20 points.
- Study year contributes 20 points.
- Skill points are `(satisfied skills / total required skills) * 60`.
- Internships with no required skills are excluded from matching and cannot receive applications until a skill requirement is added.
- If any mandatory skill fails, skill points become zero.
- If GPA is below the internship minimum, GPA points become zero.
- If study year is below the internship minimum, study-year points become zero.
- When the GPA or study-year minimum is met, the component uses `GPA / 4.00 * 20` or `MIN(study_year, 4) / 4.00 * 20`, respectively.
- The current education record supplies GPA and study year.

## Data integrity rules

- A student can have multiple education records, but the application workflow maintains at most one current record.
- MySQL's unique functional index prevents more than one current education record per student.
- A student can submit only one application for each internship.
- The database enforces the application rule with `UNIQUE (student_id, internship_id)`.

## ERD mapping note

The ERD should show one-to-one relationships from User to Student and User to Company. In the relational implementation, each profile table has its own primary key and a unique foreign key to `users.user_id`.
The specialization is disjoint and partial in the database: a profile can belong to only one matching role, while the schema permits a User row without a subtype profile. The supported role values are Student and Company; Admin and career-support accounts/workflows are out of scope. The seeded demo accounts each have a matching profile.
