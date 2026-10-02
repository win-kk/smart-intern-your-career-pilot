require('dotenv').config();

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const mysql = require('mysql2/promise');

const app = express();
const port = Number(process.env.PORT || 3002);

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'smartintern_db',
  waitForConnections: true,
  connectionLimit: 8,
  dateStrings: true
});

app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'smartintern-local-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 8 * 60 * 60 * 1000 }
}));
app.use(express.static(path.join(__dirname, 'public')));

const allowedStatuses = ['Pending', 'Under Review', 'Accepted', 'Rejected'];

function idParam(value, name) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) {
    const error = new Error(`${name} must be a positive integer`);
    error.status = 400;
    throw error;
  }
  return id;
}

function requiredText(value, name, maxLength = 255) {
  const text = String(value ?? '').trim();
  if (!text || text.length > maxLength) {
    const error = new Error(`${name} is required and must be at most ${maxLength} characters`);
    error.status = 400;
    throw error;
  }
  return text;
}

function optionalText(value, maxLength = 2000) {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, maxLength) : null;
}

function numberValue(value, name, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    const error = new Error(`${name} must be between ${min} and ${max}`);
    error.status = 400;
    throw error;
  }
  return number;
}

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Please log in first' });
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.session.user) return res.status(401).json({ error: 'Please log in first' });
    if (req.session.user.role !== role) return res.status(403).json({ error: 'This account cannot access that area' });
    next();
  };
}

const studentOnly = requireRole('Student');
const companyOnly = requireRole('Company');

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
      THEN 1 ELSE 0 END) AS failed_mandatory_skills,
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
  JOIN internship_skills AS isk ON isk.internship_id = i.internship_id
  JOIN skills AS sk ON sk.skill_id = isk.skill_id
  LEFT JOIN student_skills AS ss
    ON ss.student_id = s.student_id AND ss.skill_id = isk.skill_id
  JOIN current_education AS ce ON ce.student_id = s.student_id
  WHERE s.student_id = ?
  GROUP BY s.student_id, i.internship_id, i.title, c.company_name,
           ce.gpa, ce.study_year, i.min_gpa, i.min_study_year
), scored AS (
  SELECT *,
    CASE WHEN failed_mandatory_skills > 0 THEN 0
         ELSE (satisfied_skills / total_skills) * 60 END
      + CASE WHEN gpa < min_gpa THEN 0
             ELSE (gpa / 4.00) * 20 END
      + CASE WHEN study_year < min_study_year THEN 0
             ELSE (study_year / 4.00) * 20 END AS match_score
  FROM pair_scores
)
SELECT
  scored.*,
  a.application_id,
  a.status AS application_status,
  CASE WHEN a.application_id IS NULL THEN FALSE ELSE TRUE END AS has_applied,
  CASE WHEN failed_mandatory_skills = 0
         AND gpa >= min_gpa
         AND study_year >= min_study_year
       THEN 'Qualified' ELSE 'Not fully qualified' END AS qualification_status
FROM scored
LEFT JOIN applications AS a
  ON a.student_id = scored.student_id
 AND a.internship_id = scored.internship_id
ORDER BY match_score DESC, internship_id;
`;

async function getStudentMatches(studentId) {
  const [rows] = await pool.query(matchQuery, [studentId, studentId]);
  return rows;
}

async function getProfileId(userId, role) {
  const table = role === 'Student' ? 'students' : 'companies';
  const key = role === 'Student' ? 'student_id' : 'company_id';
  const [rows] = await pool.query(`SELECT ${key} AS profile_id FROM ${table} WHERE user_id = ?`, [userId]);
  return rows[0]?.profile_id || null;
}

app.get('/api/health', async (_req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT 1 AS database_connected');
    res.json({ ok: true, database: rows[0].database_connected === 1 });
  } catch (error) { next(error); }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const email = requiredText(req.body.email, 'Email');
    const password = requiredText(req.body.password, 'Password');
    const role = requiredText(req.body.role, 'Role');
    if (!['Student', 'Company'].includes(role)) return res.status(400).json({ error: 'Choose Student or Company' });
    const [rows] = await pool.query('SELECT user_id, email, password_hash, role FROM users WHERE email = ? AND role = ?', [email, role]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Email, password, or selected role is incorrect' });
    }
    const profileId = await getProfileId(user.user_id, user.role);
    req.session.user = { userId: user.user_id, email: user.email, role: user.role, profileId };
    res.json(req.session.user);
  } catch (error) { next(error); }
});

app.get('/api/auth/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
  res.json(req.session.user);
});

app.post('/api/auth/logout', (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

app.get('/api/catalog/skills', requireAuth, async (_req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT skill_id, skill_name, category FROM skills ORDER BY skill_name');
    res.json(rows);
  } catch (error) { next(error); }
});

app.get('/api/catalog/education', studentOnly, async (_req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT education_id, institution, degree FROM education ORDER BY institution, degree');
    res.json(rows);
  } catch (error) { next(error); }
});

app.get('/api/catalog/certifications', studentOnly, async (_req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT certification_id, certification_name, issuer FROM certifications ORDER BY certification_name');
    res.json(rows);
  } catch (error) { next(error); }
});

app.get('/api/catalog/experience', studentOnly, async (_req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT experience_id, organization FROM experience ORDER BY organization');
    res.json(rows);
  } catch (error) { next(error); }
});

app.get('/api/student/profile', studentOnly, async (req, res, next) => {
  try {
    const studentId = req.session.user.profileId;
    const [profileRows] = await pool.query(`
      SELECT s.student_id, s.first_name, s.last_name, u.email
      FROM students AS s JOIN users AS u ON u.user_id = s.user_id
      WHERE s.student_id = ?
    `, [studentId]);
    const [education] = await pool.query(`
      SELECT se.student_id, se.education_id, e.institution, e.degree,
             se.gpa, se.study_year, se.graduation_year, se.is_current
      FROM student_education AS se JOIN education AS e ON e.education_id = se.education_id
      WHERE se.student_id = ? ORDER BY se.is_current DESC, se.graduation_year DESC
    `, [studentId]);
    const [skills] = await pool.query(`
      SELECT ss.skill_id, sk.skill_name, sk.category,
             ss.proficiency_level, ss.years_experience, ss.last_used_year
      FROM student_skills AS ss JOIN skills AS sk ON sk.skill_id = ss.skill_id
      WHERE ss.student_id = ? ORDER BY sk.skill_name
    `, [studentId]);
    const [projects] = await pool.query(`
      SELECT sp.project_id, p.project_code, p.project_name, p.description, p.technologies, sp.project_role
      FROM student_projects AS sp JOIN projects AS p ON p.project_id = sp.project_id
      WHERE sp.student_id = ? ORDER BY p.project_name
    `, [studentId]);
    const [certifications] = await pool.query(`
      SELECT sc.certification_id, c.certification_name, c.issuer, sc.issue_date
      FROM student_certifications AS sc JOIN certifications AS c ON c.certification_id = sc.certification_id
      WHERE sc.student_id = ? ORDER BY sc.issue_date DESC
    `, [studentId]);
    const [experience] = await pool.query(`
      SELECT sx.experience_id, x.organization, sx.position_title, sx.role, sx.duration_months
      FROM student_experience AS sx JOIN experience AS x ON x.experience_id = sx.experience_id
      WHERE sx.student_id = ? ORDER BY sx.duration_months DESC
    `, [studentId]);
    res.json({ profile: profileRows[0], education, skills, projects, certifications, experience });
  } catch (error) { next(error); }
});

app.put('/api/student/profile', studentOnly, async (req, res, next) => {
  try {
    const firstName = requiredText(req.body.firstName, 'First name', 100);
    const lastName = requiredText(req.body.lastName, 'Last name', 100);
    await pool.query('UPDATE students SET first_name = ?, last_name = ? WHERE student_id = ?', [firstName, lastName, req.session.user.profileId]);
    res.json({ first_name: firstName, last_name: lastName });
  } catch (error) { next(error); }
});

app.get('/api/student/matches', studentOnly, async (req, res, next) => {
  try { res.json(await getStudentMatches(req.session.user.profileId)); } catch (error) { next(error); }
});

app.get('/api/student/applications', studentOnly, async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT a.application_id, a.application_date, a.status, a.match_score,
             i.internship_id, i.title, c.company_name
      FROM applications AS a
      JOIN internships AS i ON i.internship_id = a.internship_id
      JOIN companies AS c ON c.company_id = i.company_id
      WHERE a.student_id = ? ORDER BY a.application_date DESC
    `, [req.session.user.profileId]);
    res.json(rows);
  } catch (error) { next(error); }
});

app.post('/api/student/applications', studentOnly, async (req, res, next) => {
  try {
    const internshipId = idParam(req.body.internshipId, 'internshipId');
    const matches = await getStudentMatches(req.session.user.profileId);
    const match = matches.find((row) => row.internship_id === internshipId);
    if (!match) return res.status(404).json({ error: 'Internship match not found' });
    const [result] = await pool.query(`
      INSERT INTO applications (student_id, internship_id, application_date, status, match_score)
      VALUES (?, ?, CURDATE(), 'Pending', ?)
    `, [req.session.user.profileId, internshipId, Number(match.match_score)]);
    res.status(201).json({ applicationId: result.insertId, matchScore: match.match_score });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'You already applied to this internship' });
    next(error);
  }
});

app.post('/api/student/skills', studentOnly, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const skillId = req.body.skillId ? idParam(req.body.skillId, 'skillId') : null;
    const skillName = optionalText(req.body.skillName);
    const category = optionalText(req.body.category);
    const proficiency = numberValue(req.body.proficiencyLevel, 'Proficiency level', 1, 5);
    const years = numberValue(req.body.yearsExperience, 'Years of experience', 0, 99);
    const lastUsedYear = req.body.lastUsedYear ? Number(req.body.lastUsedYear) : null;
    if (!skillId && !skillName) return res.status(400).json({ error: 'Enter a skill name' });
    await connection.beginTransaction();
    let resolvedSkillId = skillId;
    if (!resolvedSkillId) {
      const [skill] = await connection.query('INSERT INTO skills (skill_name, category) VALUES (?, ?) ON DUPLICATE KEY UPDATE skill_id = LAST_INSERT_ID(skill_id), category = COALESCE(VALUES(category), category)', [skillName, category]);
      resolvedSkillId = skill.insertId;
    }
    await connection.query(`
      INSERT INTO student_skills (student_id, skill_id, proficiency_level, years_experience, last_used_year)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE proficiency_level = VALUES(proficiency_level),
        years_experience = VALUES(years_experience), last_used_year = VALUES(last_used_year)
    `, [req.session.user.profileId, resolvedSkillId, proficiency, years, lastUsedYear]);
    await connection.commit();
    res.status(201).json({ ok: true });
  } catch (error) { await connection.rollback(); next(error); } finally { connection.release(); }
});

app.delete('/api/student/skills/:skillId', studentOnly, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM student_skills WHERE student_id = ? AND skill_id = ?', [req.session.user.profileId, idParam(req.params.skillId, 'skillId')]);
    res.json({ ok: true });
  } catch (error) { next(error); }
});

app.post('/api/student/education', studentOnly, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const educationId = req.body.educationId ? idParam(req.body.educationId, 'educationId') : null;
    const institution = optionalText(req.body.institution);
    const degree = optionalText(req.body.degree);
    const gpa = numberValue(req.body.gpa, 'GPA', 0, 4);
    const studyYear = numberValue(req.body.studyYear, 'Study year', 1, 10);
    const graduationYear = req.body.graduationYear ? Number(req.body.graduationYear) : null;
    if (!educationId && (!institution || !degree)) return res.status(400).json({ error: 'Select an education record or enter an institution and degree' });
    await connection.beginTransaction();
    let resolvedEducationId = educationId;
    if (!resolvedEducationId) {
      const [education] = await connection.query('INSERT INTO education (institution, degree) VALUES (?, ?) ON DUPLICATE KEY UPDATE education_id = LAST_INSERT_ID(education_id)', [institution, degree]);
      resolvedEducationId = education.insertId;
    }
    if (req.body.isCurrent) await connection.query('UPDATE student_education SET is_current = FALSE WHERE student_id = ?', [req.session.user.profileId]);
    await connection.query(`
      INSERT INTO student_education (student_id, education_id, gpa, study_year, graduation_year, is_current)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE gpa = VALUES(gpa), study_year = VALUES(study_year),
        graduation_year = VALUES(graduation_year), is_current = VALUES(is_current)
    `, [req.session.user.profileId, resolvedEducationId, gpa, studyYear, graduationYear, Boolean(req.body.isCurrent)]);
    await connection.commit();
    res.status(201).json({ ok: true });
  } catch (error) { await connection.rollback(); next(error); } finally { connection.release(); }
});

app.delete('/api/student/education/:educationId', studentOnly, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM student_education WHERE student_id = ? AND education_id = ?', [req.session.user.profileId, idParam(req.params.educationId, 'educationId')]);
    res.json({ ok: true });
  } catch (error) { next(error); }
});

app.post('/api/student/projects', studentOnly, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const projectName = requiredText(req.body.projectName, 'Project name');
    const projectRole = requiredText(req.body.projectRole, 'Project role');
    await connection.beginTransaction();
    const [project] = await connection.query('INSERT INTO projects (project_code, project_name, description, technologies) VALUES (?, ?, ?, ?)', ['PENDING', projectName, optionalText(req.body.description), optionalText(req.body.technologies)]);
    const projectCode = `PRJ-${String(project.insertId).padStart(4, '0')}`;
    await connection.query('UPDATE projects SET project_code = ? WHERE project_id = ?', [projectCode, project.insertId]);
    await connection.query('INSERT INTO student_projects (student_id, project_id, project_role) VALUES (?, ?, ?)', [req.session.user.profileId, project.insertId, projectRole]);
    await connection.commit();
    res.status(201).json({ projectId: project.insertId, projectCode });
  } catch (error) { await connection.rollback(); next(error); } finally { connection.release(); }
});

app.post('/api/student/projects/join', studentOnly, async (req, res, next) => {
  try {
    const projectCode = requiredText(req.body.projectCode, 'Project code', 30).toUpperCase();
    const projectRole = requiredText(req.body.projectRole, 'Project role');
    const [projects] = await pool.query('SELECT project_id FROM projects WHERE project_code = ?', [projectCode]);
    if (!projects.length) return res.status(404).json({ error: 'Project code was not found' });
    await pool.query('INSERT INTO student_projects (student_id, project_id, project_role) VALUES (?, ?, ?)', [req.session.user.profileId, projects[0].project_id, projectRole]);
    res.status(201).json({ projectId: projects[0].project_id });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'You are already connected to this project' });
    next(error);
  }
});

app.delete('/api/student/projects/:projectId', studentOnly, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM student_projects WHERE student_id = ? AND project_id = ?', [req.session.user.profileId, idParam(req.params.projectId, 'projectId')]);
    res.json({ ok: true });
  } catch (error) { next(error); }
});

app.post('/api/student/certifications', studentOnly, async (req, res, next) => {
  try {
    const certificationId = req.body.certificationId ? idParam(req.body.certificationId, 'certificationId') : null;
    const certificationName = optionalText(req.body.certificationName);
    const issuer = optionalText(req.body.issuer);
    const issueDate = requiredText(req.body.issueDate, 'Issue date');
    if (!certificationId && (!certificationName || !issuer)) return res.status(400).json({ error: 'Select a certification or enter its name and issuer' });
    let resolvedCertificationId = certificationId;
    if (!resolvedCertificationId) {
      const [certification] = await pool.query('INSERT INTO certifications (certification_name, issuer) VALUES (?, ?) ON DUPLICATE KEY UPDATE certification_id = LAST_INSERT_ID(certification_id)', [certificationName, issuer]);
      resolvedCertificationId = certification.insertId;
    }
    await pool.query(`
      INSERT INTO student_certifications (student_id, certification_id, issue_date)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE issue_date = VALUES(issue_date)
    `, [req.session.user.profileId, resolvedCertificationId, issueDate]);
    res.status(201).json({ ok: true });
  } catch (error) { next(error); }
});

app.delete('/api/student/certifications/:certificationId', studentOnly, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM student_certifications WHERE student_id = ? AND certification_id = ?', [req.session.user.profileId, idParam(req.params.certificationId, 'certificationId')]);
    res.json({ ok: true });
  } catch (error) { next(error); }
});

app.post('/api/student/experience', studentOnly, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const experienceId = req.body.experienceId ? idParam(req.body.experienceId, 'experienceId') : null;
    const organization = optionalText(req.body.organization);
    const positionTitle = requiredText(req.body.positionTitle, 'Position title');
    const role = requiredText(req.body.role, 'Role');
    const durationMonths = numberValue(req.body.durationMonths, 'Duration', 0, 600);
    if (!experienceId && !organization) return res.status(400).json({ error: 'Select an organization' });
    await connection.beginTransaction();
    let resolvedExperienceId = experienceId;
    if (!resolvedExperienceId) {
      const [experience] = await connection.query('INSERT INTO experience (organization) VALUES (?) ON DUPLICATE KEY UPDATE experience_id = LAST_INSERT_ID(experience_id)', [organization]);
      resolvedExperienceId = experience.insertId;
    }
    await connection.query('INSERT INTO student_experience (student_id, experience_id, position_title, role, duration_months) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE position_title = VALUES(position_title), role = VALUES(role), duration_months = VALUES(duration_months)', [req.session.user.profileId, resolvedExperienceId, positionTitle, role, durationMonths]);
    await connection.commit();
    res.status(201).json({ experienceId: experience.insertId });
  } catch (error) { await connection.rollback(); next(error); } finally { connection.release(); }
});

app.delete('/api/student/experience/:experienceId', studentOnly, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM student_experience WHERE student_id = ? AND experience_id = ?', [req.session.user.profileId, idParam(req.params.experienceId, 'experienceId')]);
    res.json({ ok: true });
  } catch (error) { next(error); }
});

app.get('/api/company/profile', companyOnly, async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT c.company_id, c.company_name, c.description, u.email
      FROM companies AS c JOIN users AS u ON u.user_id = c.user_id
      WHERE c.company_id = ?
    `, [req.session.user.profileId]);
    res.json(rows[0]);
  } catch (error) { next(error); }
});

app.put('/api/company/profile', companyOnly, async (req, res, next) => {
  try {
    const companyName = requiredText(req.body.companyName, 'Company name');
    await pool.query('UPDATE companies SET company_name = ?, description = ? WHERE company_id = ?', [companyName, optionalText(req.body.description), req.session.user.profileId]);
    res.json({ ok: true });
  } catch (error) { next(error); }
});

app.get('/api/company/internships', companyOnly, async (req, res, next) => {
  try {
    const [internships] = await pool.query(`
      SELECT i.internship_id, i.title, i.min_gpa, i.min_study_year,
             COUNT(a.application_id) AS application_count
      FROM internships AS i
      LEFT JOIN applications AS a ON a.internship_id = i.internship_id
      WHERE i.company_id = ?
      GROUP BY i.internship_id, i.title, i.min_gpa, i.min_study_year
      ORDER BY i.internship_id DESC
    `, [req.session.user.profileId]);
    for (const internship of internships) {
      const [skills] = await pool.query(`
        SELECT isk.skill_id, sk.skill_name, isk.is_mandatory,
               isk.minimum_proficiency, isk.required_years
        FROM internship_skills AS isk JOIN skills AS sk ON sk.skill_id = isk.skill_id
        WHERE isk.internship_id = ? ORDER BY isk.is_mandatory DESC, sk.skill_name
      `, [internship.internship_id]);
      internship.skills = skills;
    }
    res.json(internships);
  } catch (error) { next(error); }
});

app.post('/api/company/internships', companyOnly, async (req, res, next) => {
  try {
    const title = requiredText(req.body.title, 'Title');
    const minGpa = numberValue(req.body.minGpa, 'Minimum GPA', 0, 4);
    const minStudyYear = numberValue(req.body.minStudyYear, 'Minimum study year', 1, 10);
    const [result] = await pool.query('INSERT INTO internships (company_id, title, min_gpa, min_study_year) VALUES (?, ?, ?, ?)', [req.session.user.profileId, title, minGpa, minStudyYear]);
    res.status(201).json({ internshipId: result.insertId });
  } catch (error) { next(error); }
});

app.put('/api/company/internships/:internshipId', companyOnly, async (req, res, next) => {
  try {
    const internshipId = idParam(req.params.internshipId, 'internshipId');
    const title = requiredText(req.body.title, 'Title');
    const minGpa = numberValue(req.body.minGpa, 'Minimum GPA', 0, 4);
    const minStudyYear = numberValue(req.body.minStudyYear, 'Minimum study year', 1, 10);
    const [result] = await pool.query('UPDATE internships SET title = ?, min_gpa = ?, min_study_year = ? WHERE internship_id = ? AND company_id = ?', [title, minGpa, minStudyYear, internshipId, req.session.user.profileId]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Internship not found' });
    res.json({ ok: true });
  } catch (error) { next(error); }
});

app.delete('/api/company/internships/:internshipId', companyOnly, async (req, res, next) => {
  try {
    const internshipId = idParam(req.params.internshipId, 'internshipId');
    const [result] = await pool.query('DELETE FROM internships WHERE internship_id = ? AND company_id = ?', [internshipId, req.session.user.profileId]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Internship not found or has dependent records' });
    res.json({ ok: true });
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2') return res.status(409).json({ error: 'This internship has applications and cannot be deleted' });
    next(error);
  }
});

app.post('/api/company/internships/:internshipId/skills', companyOnly, async (req, res, next) => {
  try {
    const internshipId = idParam(req.params.internshipId, 'internshipId');
    const skillId = idParam(req.body.skillId, 'skillId');
    const minimumProficiency = numberValue(req.body.minimumProficiency, 'Minimum proficiency', 1, 5);
    const requiredYears = numberValue(req.body.requiredYears, 'Required years', 0, 99);
    const isMandatory = Boolean(req.body.isMandatory);
    const [owner] = await pool.query('SELECT internship_id FROM internships WHERE internship_id = ? AND company_id = ?', [internshipId, req.session.user.profileId]);
    if (!owner.length) return res.status(404).json({ error: 'Internship not found' });
    await pool.query(`
      INSERT INTO internship_skills (internship_id, skill_id, is_mandatory, minimum_proficiency, required_years)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE is_mandatory = VALUES(is_mandatory),
        minimum_proficiency = VALUES(minimum_proficiency), required_years = VALUES(required_years)
    `, [internshipId, skillId, isMandatory, minimumProficiency, requiredYears]);
    res.status(201).json({ ok: true });
  } catch (error) { next(error); }
});

app.delete('/api/company/internships/:internshipId/skills/:skillId', companyOnly, async (req, res, next) => {
  try {
    const internshipId = idParam(req.params.internshipId, 'internshipId');
    const skillId = idParam(req.params.skillId, 'skillId');
    await pool.query(`
      DELETE isk FROM internship_skills AS isk
      JOIN internships AS i ON i.internship_id = isk.internship_id
      WHERE isk.internship_id = ? AND isk.skill_id = ? AND i.company_id = ?
    `, [internshipId, skillId, req.session.user.profileId]);
    res.json({ ok: true });
  } catch (error) { next(error); }
});

app.get('/api/company/internships/:internshipId/applications', companyOnly, async (req, res, next) => {
  try {
    const internshipId = idParam(req.params.internshipId, 'internshipId');
    const [rows] = await pool.query(`
      SELECT a.application_id, a.status, a.application_date, a.match_score,
             s.student_id, s.first_name, s.last_name, u.email
      FROM applications AS a
      JOIN students AS s ON s.student_id = a.student_id
      JOIN users AS u ON u.user_id = s.user_id
      JOIN internships AS i ON i.internship_id = a.internship_id
      WHERE a.internship_id = ? AND i.company_id = ?
      ORDER BY a.match_score DESC, a.application_date
    `, [internshipId, req.session.user.profileId]);
    res.json(rows);
  } catch (error) { next(error); }
});

app.patch('/api/company/applications/:applicationId/status', companyOnly, async (req, res, next) => {
  try {
    const applicationId = idParam(req.params.applicationId, 'applicationId');
    if (!allowedStatuses.includes(req.body.status)) return res.status(400).json({ error: 'Invalid application status' });
    const [result] = await pool.query(`
      UPDATE applications AS a
      JOIN internships AS i ON i.internship_id = a.internship_id
      SET a.status = ?
      WHERE a.application_id = ? AND i.company_id = ?
    `, [req.body.status, applicationId, req.session.user.profileId]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Application not found' });
    res.json({ ok: true });
  } catch (error) { next(error); }
});

app.get('/api/company/reports', companyOnly, async (req, res, next) => {
  try {
    const companyId = req.session.user.profileId;
    const [summary] = await pool.query(`
      SELECT COUNT(DISTINCT i.internship_id) AS internships,
             COUNT(a.application_id) AS applications,
             SUM(a.status = 'Pending') AS pending,
             SUM(a.status = 'Under Review') AS under_review,
             SUM(a.status = 'Accepted') AS accepted,
             SUM(a.status = 'Rejected') AS rejected
      FROM internships AS i
      LEFT JOIN applications AS a ON a.internship_id = i.internship_id
      WHERE i.company_id = ?
    `, [companyId]);
    const [topApplicants] = await pool.query(`
      SELECT i.title, CONCAT(s.first_name, ' ', s.last_name) AS student_name,
             a.match_score, a.status
      FROM applications AS a
      JOIN internships AS i ON i.internship_id = a.internship_id
      JOIN students AS s ON s.student_id = a.student_id
      WHERE i.company_id = ?
      ORDER BY a.match_score DESC LIMIT 5
    `, [companyId]);
    res.json({ summary: summary[0], topApplicants });
  } catch (error) { next(error); }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.status || 500).json({ error: error.message || 'Server error' });
});

app.listen(port, () => {
  console.log(`SmartIntern is running at http://localhost:${port}`);
});
