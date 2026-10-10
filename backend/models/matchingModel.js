const pool = require('./database');

const matchQuery = `
WITH current_education AS (
  SELECT student_id, gpa, study_year
  FROM student_education
  WHERE student_id = ? AND is_current = TRUE
), pair_scores AS (
  SELECT
    s.student_id,
    i.internship_id,
    i.title,
    c.company_name,
    MAX(c.description) AS company_description,
    ce.gpa,
    ce.study_year,
    i.min_gpa,
    i.min_study_year,
    GROUP_CONCAT(DISTINCT CASE
      WHEN ss.skill_id IS NOT NULL AND ss.proficiency_level >= isk.minimum_proficiency
        AND ss.years_experience >= isk.required_years THEN sk.skill_name END
      ORDER BY sk.skill_name SEPARATOR ', ') AS matched_skills,
    GROUP_CONCAT(DISTINCT CASE
      WHEN ss.skill_id IS NULL OR ss.proficiency_level < isk.minimum_proficiency
        OR ss.years_experience < isk.required_years THEN sk.skill_name END
      ORDER BY sk.skill_name SEPARATOR ', ') AS missing_skills,
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
    GROUP_CONCAT(DISTINCT sk.skill_name ORDER BY sk.skill_name SEPARATOR ', ') AS required_skills,
    GROUP_CONCAT(DISTINCT CASE WHEN isk.is_mandatory = TRUE THEN sk.skill_name END ORDER BY sk.skill_name SEPARATOR ', ') AS mandatory_skills,
    GROUP_CONCAT(DISTINCT CASE WHEN isk.is_mandatory = FALSE THEN sk.skill_name END ORDER BY sk.skill_name SEPARATOR ', ') AS optional_skills,
    GROUP_CONCAT(DISTINCT CASE
      WHEN isk.is_mandatory = TRUE
       AND (ss.skill_id IS NULL
         OR ss.proficiency_level < isk.minimum_proficiency
         OR ss.years_experience < isk.required_years)
      THEN sk.skill_name END
      ORDER BY sk.skill_name SEPARATOR ', ') AS missing_mandatory_skills
  FROM students AS s
  CROSS JOIN internships AS i
  JOIN companies AS c ON c.company_id = i.company_id
  LEFT JOIN internship_skills AS isk ON isk.internship_id = i.internship_id
  LEFT JOIN skills AS sk ON sk.skill_id = isk.skill_id
  LEFT JOIN student_skills AS ss
    ON ss.student_id = s.student_id AND ss.skill_id = isk.skill_id
  LEFT JOIN current_education AS ce ON ce.student_id = s.student_id
  WHERE s.student_id = ?
  GROUP BY s.student_id, i.internship_id, i.title, c.company_name,
           ce.gpa, ce.study_year, i.min_gpa, i.min_study_year
), scored AS (
  SELECT *,
    CASE WHEN failed_mandatory_skills > 0 THEN 0
         WHEN total_skills = 0 THEN 60
         ELSE (satisfied_skills / total_skills) * 60 END
      + CASE WHEN gpa IS NULL OR gpa < min_gpa THEN 0
             ELSE (gpa / 4.00) * 20 END
      + CASE WHEN study_year IS NULL OR study_year < min_study_year THEN 0
             ELSE (LEAST(study_year, 4) / 4.00) * 20 END AS match_score
  FROM pair_scores
)
SELECT
  scored.*,
  COALESCE(ac.application_count, 0) AS applicant_count,
  a.application_id,
  a.status AS application_status,
  CASE WHEN a.application_id IS NULL THEN FALSE ELSE TRUE END AS has_applied,
  CASE WHEN failed_mandatory_skills = 0
         AND gpa >= min_gpa
         AND study_year >= min_study_year
       THEN 'Qualified' ELSE 'Not fully qualified' END AS qualification_status
FROM scored
LEFT JOIN (
  SELECT internship_id, COUNT(*) AS application_count
  FROM applications
  GROUP BY internship_id
) AS ac ON ac.internship_id = scored.internship_id
LEFT JOIN applications AS a
  ON a.student_id = scored.student_id
 AND a.internship_id = scored.internship_id
ORDER BY match_score DESC, internship_id;
`;

async function getStudentMatches(studentId) {
  const [rows] = await pool.query(matchQuery, [studentId, studentId]);
  return rows;
}
module.exports = { getStudentMatches };
