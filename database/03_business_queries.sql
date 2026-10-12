USE smartintern_db;

-- Matching uses the single current education row; the schema enforces at most one.
-- The three agreed business questions:
-- 1. Who has the highest match score for a selected internship?
-- 2. Which mandatory skills are missing for a selected student and internship?
-- 3. What is the current status of a selected student's applications?

-- Query 1: List all student profiles.
SELECT s.student_id, s.first_name, s.last_name, u.email
FROM students AS s
JOIN users AS u ON u.user_id = s.user_id
ORDER BY s.student_id;

-- Query 2: List all internships and their companies.
SELECT i.internship_id, i.title, c.company_name, i.min_gpa, i.min_study_year
FROM internships AS i
JOIN companies AS c ON c.company_id = i.company_id
ORDER BY i.internship_id;

-- Query 3: Show each student's current education record.
SELECT s.student_id, s.first_name, s.last_name,
       e.institution, e.degree, se.gpa, se.study_year, se.graduation_year
FROM students AS s
JOIN student_education AS se
  ON se.student_id = s.student_id AND se.is_current = TRUE
JOIN education AS e ON e.education_id = se.education_id
ORDER BY s.student_id;

-- Query 4: Show the skills held by each student.
SELECT s.student_id, CONCAT(s.first_name, ' ', s.last_name) AS student_name,
       sk.skill_name, ss.proficiency_level, ss.years_experience
FROM student_skills AS ss
JOIN students AS s ON s.student_id = ss.student_id
JOIN skills AS sk ON sk.skill_id = ss.skill_id
ORDER BY s.student_id, sk.skill_name;

-- Query 5: Show the requirements for each internship.
SELECT i.internship_id, i.title, sk.skill_name,
       isk.is_mandatory, isk.minimum_proficiency, isk.required_years
FROM internship_skills AS isk
JOIN internships AS i ON i.internship_id = isk.internship_id
JOIN skills AS sk ON sk.skill_id = isk.skill_id
ORDER BY i.internship_id, isk.is_mandatory DESC, sk.skill_name;

-- Query 6: Count applications by internship and application status.
SELECT i.internship_id, i.title, a.status, COUNT(*) AS application_count
FROM applications AS a
JOIN internships AS i ON i.internship_id = a.internship_id
GROUP BY i.internship_id, i.title, a.status
ORDER BY i.internship_id, a.status;

-- Query 7: Find the highest-scoring applicant for a selected internship.
-- Change the internship_id value to test another internship.
SELECT a.student_id,
       CONCAT(s.first_name, ' ', s.last_name) AS student_name,
       a.match_score,
       a.status
FROM applications AS a
JOIN students AS s ON s.student_id = a.student_id
WHERE a.internship_id = 1
ORDER BY a.match_score DESC
LIMIT 1;

-- Query 8: Find missing mandatory skills for a selected student and internship.
-- Change student_id and internship_id to test another pair.
SELECT sk.skill_name, isk.minimum_proficiency, isk.required_years,
       ss.proficiency_level AS student_proficiency,
       ss.years_experience AS student_years_experience
FROM internship_skills AS isk
JOIN skills AS sk ON sk.skill_id = isk.skill_id
LEFT JOIN student_skills AS ss
  ON ss.skill_id = isk.skill_id
 AND ss.student_id = 2
WHERE isk.internship_id = 2
  AND isk.is_mandatory = TRUE
  AND (ss.student_id IS NULL
       OR ss.proficiency_level < isk.minimum_proficiency
       OR ss.years_experience < isk.required_years);


-- Query 9: Calculate the match score for one selected student and internship.
-- Matching formula for the selected student and internship:
-- Skill points = satisfied skills / total skills * 60
-- GPA points = GPA / 4 * 20
-- Study-year points = minimum(study year, 4) / 4 * 20
-- Match score = skill points + GPA points + study-year points
-- A failed mandatory skill makes only the skill component zero.
-- GPA and study-year components become zero when their minimum is not met.
SET @student_id = 1;
SET @internship_id = 1;

-- Calculate the skill component of the match score.
SELECT
    ROUND(
        CASE
            -- A failed mandatory skill makes the skill component zero.
            WHEN SUM(
                CASE
                    WHEN isk.is_mandatory = TRUE
                     AND (
                          ss.skill_id IS NULL
                          OR ss.proficiency_level < isk.minimum_proficiency
                          OR ss.years_experience < isk.required_years
                     )
                    THEN 1
                    ELSE 0
                END
            ) > 0
            THEN 0
            -- Otherwise, award points based on satisfied skill requirements.
            ELSE
                SUM(
                    CASE
                        WHEN ss.skill_id IS NOT NULL
                         AND ss.proficiency_level >= isk.minimum_proficiency
                         AND ss.years_experience >= isk.required_years
                        THEN 1
                        ELSE 0
                    END
                ) / COUNT(*) * 60
        END,
        2
    ) AS skill_points,

    -- Calculate the GPA component, worth up to 20 points.
    ROUND(
        CASE
            WHEN se.gpa < i.min_gpa THEN 0
            ELSE se.gpa / 4.00 * 20
        END,
        2
    ) AS gpa_points,

    -- Calculate the study-year component, worth up to 20 points.
    ROUND(
        CASE
            WHEN se.study_year < i.min_study_year THEN 0
            ELSE LEAST(se.study_year, 4) / 4.00 * 20
        END,
        2
    ) AS study_year_points

-- Get the selected internship's skill requirements.
FROM internship_skills AS isk
JOIN internships AS i
  ON i.internship_id = isk.internship_id

-- Use the selected student's current education record.
JOIN student_education AS se
  ON se.student_id = @student_id
 AND se.is_current = TRUE

-- Match the student's skills with the internship requirements.
LEFT JOIN student_skills AS ss
  ON ss.student_id = @student_id
 AND ss.skill_id = isk.skill_id

-- Limit the calculation to the selected internship.
WHERE isk.internship_id = @internship_id

-- Group the selected student's education values for the calculation.
GROUP BY se.gpa, se.study_year, i.min_gpa, i.min_study_year;

-- Query 10: Show the current application status for a selected student.
-- Change the student_id value to test another student.
SELECT a.application_id,
       i.title,
       c.company_name,
       a.application_date,
       a.status,
       a.match_score
FROM applications AS a
JOIN internships AS i ON i.internship_id = a.internship_id
JOIN companies AS c ON c.company_id = i.company_id
WHERE a.student_id = 1
ORDER BY a.application_date DESC;

