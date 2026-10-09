USE smartintern_db;

INSERT INTO users (user_id, email, password_hash, role) VALUES
(1, 'alice@example.com', '$2a$12$tWnymM1EprRp4p6R0mhk.e3GMFUOMlpQKGSG0J0cz0kpuHzN9jMe.', 'Student'),
(2, 'bob@example.com', '$2a$12$tWnymM1EprRp4p6R0mhk.e3GMFUOMlpQKGSG0J0cz0kpuHzN9jMe.', 'Student'),
(3, 'chen@example.com', '$2a$12$tWnymM1EprRp4p6R0mhk.e3GMFUOMlpQKGSG0J0cz0kpuHzN9jMe.', 'Student'),
(4, 'recruiter@techbridge.example', '$2a$12$1fRSV5YhK9t1//./SzfgfetQ0AQ5iXeSg15nGmhCtGn.0jU3.jwgW', 'Company'),
(5, 'hr@dataspark.example', '$2a$12$1fRSV5YhK9t1//./SzfgfetQ0AQ5iXeSg15nGmhCtGn.0jU3.jwgW', 'Company');

INSERT INTO students (student_id, user_id, first_name, last_name) VALUES
(1, 1, 'Alice', 'Tan'),
(2, 2, 'Bob', 'Lim'),
(3, 3, 'Chen', 'Ong');

INSERT INTO companies (company_id, user_id, company_name, description) VALUES
(1, 4, 'TechBridge Solutions', 'Software development and consulting company.'),
(2, 5, 'DataSpark Analytics', 'Data analytics and business intelligence company.');

INSERT INTO skills (skill_id, skill_name, category, description) VALUES
(1, 'SQL', 'Database', 'Writing queries and working with relational databases.'),
(2, 'JavaScript', 'Programming', 'Programming for web applications.'),
(3, 'Git', 'Tools', 'Version control and collaboration.'),
(4, 'Python', 'Programming', 'General-purpose programming and data work.'),
(5, 'Data Analysis', 'Analytics', 'Cleaning, exploring, and interpreting data.'),
(6, 'HTML/CSS', 'Web', 'Building and styling web pages.');

INSERT INTO education (education_id, institution, degree) VALUES
(1, 'Smart University', 'BSc Computer Science'),
(2, 'Smart University', 'BSc Information Technology'),
(3, 'City College', 'Diploma in Computing');

INSERT INTO projects (project_id, project_code, project_name, description, technologies) VALUES
(1, 'PRJ-0001', 'SmartIntern', 'A rule-based internship matching database project.', 'MySQL, Node.js, HTML, CSS, JavaScript'),
(2, 'PRJ-0002', 'Campus Event Portal', 'A portal for managing university events.', 'MySQL, JavaScript, HTML/CSS');

INSERT INTO certifications (certification_id, certification_name, issuer) VALUES
(1, 'Database Fundamentals', 'Smart University'),
(2, 'Cloud Practitioner Basics', 'Training Provider');

INSERT INTO experience (experience_id, organization) VALUES
(1, 'University IT Help Desk'),
(2, 'Community Technology Group');

INSERT INTO internships (internship_id, company_id, title, min_gpa, min_study_year) VALUES
(1, 1, 'Junior Web Developer Intern', 3.00, 2),
(2, 1, 'Data Engineering Intern', 3.50, 3),
(3, 2, 'Business Intelligence Intern', 3.00, 2);

INSERT INTO student_skills
    (student_id, skill_id, proficiency_level, years_experience, last_used_year)
VALUES
(1, 1, 4, 2.0, 2026),
(1, 2, 3, 1.0, 2026),
(1, 3, 2, 1.0, 2026),
(1, 4, 3, 1.0, 2026),
(1, 5, 3, 1.0, 2026),
(2, 1, 3, 1.0, 2026),
(2, 2, 2, 0.5, 2026),
(2, 4, 2, 0.5, 2025),
(3, 1, 4, 2.0, 2026),
(3, 2, 3, 1.0, 2026),
(3, 3, 3, 1.0, 2026),
(3, 4, 3, 1.0, 2026),
(3, 5, 4, 2.0, 2026);

INSERT INTO internship_skills
    (internship_id, skill_id, is_mandatory, minimum_proficiency, required_years)
VALUES
(1, 1, TRUE, 3, 1.0),
(1, 2, TRUE, 2, 0.0),
(1, 3, FALSE, 2, 0.0),
(2, 1, TRUE, 3, 1.0),
(2, 4, TRUE, 3, 1.0),
(2, 5, FALSE, 3, 1.0),
(3, 1, TRUE, 3, 1.0),
(3, 5, TRUE, 3, 1.0),
(3, 3, FALSE, 2, 0.0);

INSERT INTO student_education
    (student_id, education_id, gpa, study_year, graduation_year, is_current)
VALUES
(1, 1, 3.60, 3, 2027, TRUE),
(1, 3, 3.20, 1, 2025, FALSE),
(2, 2, 3.20, 2, 2028, TRUE),
(3, 1, 2.80, 2, 2028, TRUE);

INSERT INTO student_projects (student_id, project_id, project_role) VALUES
(1, 1, 'Database designer'),
(2, 1, 'Backend contributor'),
(3, 1, 'Query and report developer'),
(1, 2, 'Frontend contributor');

INSERT INTO student_certifications (student_id, certification_id, issue_date) VALUES
(1, 1, '2026-03-15'),
(2, 1, '2026-04-20'),
(3, 2, '2026-05-10');

INSERT INTO student_experience
    (student_id, experience_id, position_title, role, duration_months)
VALUES
(1, 1, 'IT Support Assistant', 'Support assistant', 8),
(2, 1, 'IT Support Assistant', 'Support assistant', 5),
(3, 2, 'Volunteer Developer', 'Developer', 6);

INSERT INTO applications
    (application_id, student_id, internship_id, application_date, status, match_score)
VALUES
(1, 1, 1, '2026-09-20', 'Under Review', 93.00),
(2, 2, 1, '2026-09-21', 'Pending', 66.00),
(3, 3, 1, '2026-09-22', 'Pending', 70.00),
(4, 1, 2, '2026-09-23', 'Accepted', 93.00),
(5, 3, 3, '2026-09-24', 'Under Review', 70.00);
