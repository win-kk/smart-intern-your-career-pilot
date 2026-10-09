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
- If any mandatory skill fails, skill points become zero.
- If GPA is below the internship minimum, GPA points become zero.
- If study year is below the internship minimum, study-year points become zero.
- The current education record supplies GPA and study year.

## Data integrity rules

- A student can have multiple education records, but at most one can be current.
- A student can submit only one application for each internship.
- The database enforces the application rule with `UNIQUE (student_id, internship_id)`.

## ERD mapping note

The ERD should show one-to-one relationships from User to Student and User to Company. In the relational implementation, each profile table has its own primary key and a unique foreign key to `users.user_id`.
