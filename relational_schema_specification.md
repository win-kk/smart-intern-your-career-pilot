# SmartIntern Relational Schema Specification

Status: Approved discussion design; SQL implementation has not started.

This document records the database design agreed during project discussion. The project uses MySQL and focuses on the relational database. Frontend and backend implementation are outside this specification.

## Core tables

### users

- `user_id` - primary key, integer, auto-increment
- `email` - required, unique
- `password_hash` - required
- `role` - required; allowed values: `Student`, `Company`

### students

- `student_id` - primary key, integer, auto-increment
- `user_id` - required, unique foreign key to `users.user_id`
- `first_name` - required
- `last_name` - required

### companies

- `company_id` - primary key, integer, auto-increment
- `user_id` - required, unique foreign key to `users.user_id`
- `company_name` - required
- `description` - optional

### internships

- `internship_id` - primary key, integer, auto-increment
- `company_id` - required foreign key to `companies.company_id`
- `title` - required
- `min_gpa` - required; from `0.00` to `4.00`
- `min_study_year` - required; positive integer

Internship publication status is intentionally excluded because it is not necessary for this mini project.

### skills

- `skill_id` - primary key, integer, auto-increment
- `skill_name` - required, unique
- `category` - optional
- `description` - optional

### education

- `education_id` - primary key, integer, auto-increment
- `institution` - required
- `degree` - required

### projects

- `project_id` - primary key, integer, auto-increment
- `project_name` - required
- `description` - optional
- `technologies` - optional text

Projects are reusable records and are connected to students through `student_projects`.

### certifications

- `certification_id` - primary key, integer, auto-increment
- `certification_name` - required
- `issuer` - required

### experience

- `experience_id` - primary key, integer, auto-increment
- `organization` - required

Organization records are reusable and are connected to students through `student_experience`. A single organization can therefore be connected to many students with different positions and roles.

## Bridge and transaction tables

### student_skills

- `student_id` - part of composite primary key; foreign key to `students.student_id`
- `skill_id` - part of composite primary key; foreign key to `skills.skill_id`
- `proficiency_level` - required integer from 1 to 5
- `years_experience` - required, non-negative decimal
- `last_used_year` - optional year

Composite primary key: (`student_id`, `skill_id`)

### internship_skills

- `internship_id` - part of composite primary key; foreign key to `internships.internship_id`
- `skill_id` - part of composite primary key; foreign key to `skills.skill_id`
- `is_mandatory` - required boolean, default false
- `minimum_proficiency` - required integer from 1 to 5
- `required_years` - required, non-negative decimal

Composite primary key: (`internship_id`, `skill_id`)

The `is_mandatory` field applies only to skills.

### student_education

- `student_id` - part of composite primary key; foreign key to `students.student_id`
- `education_id` - part of composite primary key; foreign key to `education.education_id`
- `gpa` - required, from `0.00` to `4.00`
- `study_year` - required, positive integer
- `graduation_year` - optional year
- `is_current` - required boolean, default true

Composite primary key: (`student_id`, `education_id`)

The current education record supplies the GPA and study year used for matching. The SQL queries use `is_current = TRUE` to select it. For this mini project, the sample data and normal data-entry process should maintain one current record per student.

### student_projects

- `student_id` - part of composite primary key; foreign key to `students.student_id`
- `project_id` - part of composite primary key; foreign key to `projects.project_id`
- `project_role` - required

Composite primary key: (`student_id`, `project_id`)

### student_certifications

- `student_id` - part of composite primary key; foreign key to `students.student_id`
- `certification_id` - part of composite primary key; foreign key to `certifications.certification_id`
- `issue_date` - required date

Composite primary key: (`student_id`, `certification_id`)

### student_experience

- `student_id` - part of composite primary key; foreign key to `students.student_id`
- `experience_id` - part of composite primary key; foreign key to `experience.experience_id`
- `position_title` - required; the student's position at the organization
- `role` - required; the student's role in the shared experience
- `duration_months` - required, non-negative integer

Composite primary key: (`student_id`, `experience_id`)

### applications

- `application_id` - primary key, integer, auto-increment
- `student_id` - required foreign key to `students.student_id`
- `internship_id` - required foreign key to `internships.internship_id`
- `application_date` - required date
- `status` - required; allowed values: `Pending`, `Under Review`, `Accepted`, `Rejected`
- `match_score` - required decimal from `0.00` to `100.00`

Unique constraint: (`student_id`, `internship_id`)

This allows only one application from a student to a particular internship. The stored match score is a snapshot of the result at application time.

## Matching rules

The match score has a maximum of 100 points:

- Skills: 60 points
- GPA: 20 points
- Study year: 20 points

Rules:

- If any mandatory skill fails, skill points become zero.
- If GPA is below `min_gpa`, GPA points become zero.
- If study year is below `min_study_year`, study-year points become zero.
- Optional skills reduce the skill score when missing but do not independently disqualify the student.
- The final score is the sum of skill, GPA, and study-year points.
- SQL reports can label a result as `Qualified` or `Not fully qualified`; this label does not need to be stored as an additional column.

## Foreign-key deletion policy

- Bridge-table records should use `ON DELETE CASCADE`.
- Important parent records such as students, companies, internships, and skills should generally use `ON DELETE RESTRICT`.
- This prevents important application and reporting data from being deleted accidentally.

## Deliberately out of scope

- Admin accounts
- Internship publication status
- AI matching or resume parsing
- Notifications
- Password reset and email verification
- Frontend and backend implementation
- Paid hosting
