USE smartintern_db;

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

-- Query 7: Show the highest-scoring applicants for every internship.
WITH ranked_applications AS (
    SELECT i.internship_id, i.title,
           CONCAT(s.first_name, ' ', s.last_name) AS student_name,
           a.match_score, a.status,
           DENSE_RANK() OVER (
               PARTITION BY i.internship_id ORDER BY a.match_score DESC
           ) AS score_rank
    FROM applications AS a
    JOIN internships AS i ON i.internship_id = a.internship_id
    JOIN students AS s ON s.student_id = a.student_id
)
SELECT internship_id, title, student_name, match_score, status
FROM ranked_applications
WHERE score_rank = 1
ORDER BY internship_id;

-- Query 8: Find missing mandatory skills for a selected student and internship.
-- Change the values in the parameters CTE to test another pair.
WITH selected_pair AS (
    SELECT 2 AS selected_student_id, 2 AS selected_internship_id
)
SELECT sk.skill_name, isk.minimum_proficiency, isk.required_years,
       COALESCE(ss.proficiency_level, 0) AS student_proficiency,
       COALESCE(ss.years_experience, 0) AS student_years_experience
FROM selected_pair AS p
JOIN internship_skills AS isk ON isk.internship_id = p.selected_internship_id
JOIN skills AS sk ON sk.skill_id = isk.skill_id
LEFT JOIN student_skills AS ss
  ON ss.skill_id = isk.skill_id AND ss.student_id = p.selected_student_id
WHERE isk.is_mandatory = TRUE
  AND (ss.skill_id IS NULL
       OR ss.proficiency_level < isk.minimum_proficiency
       OR ss.years_experience < isk.required_years);

-- Query 9: Calculate match scores for every student-internship pair.
WITH current_education AS (
    SELECT student_id, gpa, study_year
    FROM student_education
    WHERE is_current = TRUE
), pair_scores AS (
    SELECT
        s.student_id,
        i.internship_id,
        COUNT(isk.skill_id) AS total_skills,
        SUM(CASE
            WHEN ss.skill_id IS NOT NULL
             AND ss.proficiency_level >= isk.minimum_proficiency
             AND ss.years_experience >= isk.required_years
            THEN 1 ELSE 0 END) AS satisfied_skills,
        SUM(CASE
            WHEN isk.is_mandatory = TRUE
             AND (ss.skill_id IS NULL
                  OR ss.proficiency_level < isk.minimum_proficiency
                  OR ss.years_experience < isk.required_years)
            THEN 1 ELSE 0 END) AS failed_mandatory_skills,
        ce.gpa,
        ce.study_year,
        i.min_gpa,
        i.min_study_year
    FROM students AS s
    CROSS JOIN internships AS i
    JOIN internship_skills AS isk ON isk.internship_id = i.internship_id
    LEFT JOIN student_skills AS ss
      ON ss.student_id = s.student_id AND ss.skill_id = isk.skill_id
    JOIN current_education AS ce ON ce.student_id = s.student_id
    GROUP BY s.student_id, i.internship_id, ce.gpa, ce.study_year,
             i.min_gpa, i.min_study_year
), scored_pairs AS (
    SELECT *,
           CASE
               WHEN failed_mandatory_skills > 0 THEN 0
               ELSE (satisfied_skills / total_skills) * 60
           END AS skill_points,
           CASE
               WHEN gpa < min_gpa THEN 0
               ELSE (gpa / 4.00) * 20
           END AS gpa_points,
           CASE
               WHEN study_year < min_study_year THEN 0
               ELSE (study_year / 4.00) * 20
           END AS study_year_points
    FROM pair_scores
)
SELECT student_id, internship_id,
       ROUND(skill_points, 2) AS skill_points,
       ROUND(gpa_points, 2) AS gpa_points,
       ROUND(study_year_points, 2) AS study_year_points,
       ROUND(skill_points + gpa_points + study_year_points, 2) AS match_score,
       CASE
           WHEN failed_mandatory_skills = 0
            AND gpa >= min_gpa
            AND study_year >= min_study_year
           THEN 'Qualified'
           ELSE 'Not fully qualified'
       END AS qualification_status
FROM scored_pairs
ORDER BY internship_id, match_score DESC;

-- Query 10: Show qualified students for each internship.
WITH current_education AS (
    SELECT
        student_id,
        gpa,
        study_year
    FROM student_education
    WHERE is_current = TRUE
), pair_scores AS (
    SELECT
        s.student_id,
        i.internship_id,
        i.title,
        CONCAT(s.first_name, ' ', s.last_name) AS student_name,
        ce.gpa,
        ce.study_year,
        i.min_gpa,
        i.min_study_year,
        COUNT(isk.skill_id) AS total_skills,
        SUM(CASE
            WHEN ss.skill_id IS NOT NULL
             AND ss.proficiency_level >= isk.minimum_proficiency
             AND ss.years_experience >= isk.required_years
            THEN 1 ELSE 0 END) AS satisfied_skills,
        SUM(CASE
            WHEN isk.is_mandatory = TRUE
             AND (ss.skill_id IS NULL
                  OR ss.proficiency_level < isk.minimum_proficiency
                  OR ss.years_experience < isk.required_years)
            THEN 1 ELSE 0 END) AS failed_mandatory_skills
    FROM students AS s
    CROSS JOIN internships AS i
    JOIN internship_skills AS isk
        ON isk.internship_id = i.internship_id
    LEFT JOIN student_skills AS ss
        ON ss.student_id = s.student_id
       AND ss.skill_id = isk.skill_id
    JOIN current_education AS ce
        ON ce.student_id = s.student_id
    GROUP BY
        s.student_id,
        i.internship_id,
        i.title,
        s.first_name,
        s.last_name,
        ce.gpa,
        ce.study_year,
        i.min_gpa,
        i.min_study_year
), scored AS (
    SELECT
        *,
        CASE
            WHEN failed_mandatory_skills > 0 THEN 0
            ELSE (satisfied_skills / total_skills) * 60
        END
        + CASE
            WHEN gpa < min_gpa THEN 0
            ELSE (gpa / 4.00) * 20
        END
        + CASE
            WHEN study_year < min_study_year THEN 0
            ELSE (study_year / 4.00) * 20
        END AS match_score
    FROM pair_scores
)
SELECT
    internship_id,
    title,
    student_id,
    student_name,
    ROUND(match_score, 2) AS match_score
FROM scored
WHERE failed_mandatory_skills = 0
  AND gpa >= min_gpa
  AND study_year >= min_study_year
ORDER BY internship_id, match_score DESC;
