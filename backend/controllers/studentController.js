const { logError } = require('../utils/logger');
const pool = require('../models/database');
const bcrypt = require('bcryptjs');
const { idParam, requiredText, optionalText, numberValue, integerValue, booleanValue, dateValue } = require('../utils/validation');
const { getStudentMatches: loadStudentMatches } = require('../models/matchingModel');
const { getProfileId } = require('../models/userModel');
const allowedStatuses = ['Pending', 'Under Review', 'Accepted', 'Rejected'];

const getStudentProfile = async (req, res, next) => {
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
};

const putStudentProfile = async (req, res, next) => {
  try {
    const firstName = requiredText(req.body.firstName, 'First name', 100);
    const lastName = requiredText(req.body.lastName, 'Last name', 100);
    await pool.query('UPDATE students SET first_name = ?, last_name = ? WHERE student_id = ?', [firstName, lastName, req.session.user.profileId]);
    res.json({ first_name: firstName, last_name: lastName });
  } catch (error) { next(error); }
};

const getStudentMatches = async (req, res, next) => {
  try { res.json(await loadStudentMatches(req.session.user.profileId)); } catch (error) { next(error); }
};

const getStudentApplications = async (req, res, next) => {
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
};

const postStudentApplications = async (req, res, next) => {
  try {
    const internshipId = idParam(req.body.internshipId, 'internshipId');
    const [internshipRows] = await pool.query('SELECT internship_id FROM internships WHERE internship_id = ?', [internshipId]);
    if (!internshipRows.length) return res.status(404).json({ error: 'Internship not found' });
    const [requirementRows] = await pool.query('SELECT 1 FROM internship_skills WHERE internship_id = ? LIMIT 1', [internshipId]);
    if (!requirementRows.length) return res.status(409).json({ error: 'This internship is not accepting applications until the company adds at least one skill requirement' });
    const matches = await loadStudentMatches(req.session.user.profileId);
    const match = matches.find((row) => Number(row.internship_id) === internshipId);
    if (!match) return res.status(404).json({ error: 'Internship match not found' });
    const [result] = await pool.query(`
      INSERT INTO applications (student_id, internship_id, application_date, status, match_score)
      VALUES (?, ?, CURDATE(), 'Pending', ?)
    `, [req.session.user.profileId, internshipId, numberValue(match.match_score, 'Match score', 0, 100)]);
    res.status(201).json({ applicationId: result.insertId, matchScore: match.match_score });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'You already applied to this internship' });
    next(error);
  }
};

const postStudentSkills = async (req, res, next) => {
  let connection;
  try {
    const skillId = req.body.skillId ? idParam(req.body.skillId, 'skillId') : null;
    const skillName = optionalText(req.body.skillName, 100);
    const category = optionalText(req.body.category, 100);
    const proficiency = integerValue(req.body.proficiencyLevel, 'Proficiency level', 1, 5);
    const years = numberValue(req.body.yearsExperience, 'Years of experience', 0, 99);
    const lastUsedYear = req.body.lastUsedYear ? integerValue(req.body.lastUsedYear, 'Last used year', 1901, 2155) : null;
    if (!skillId && !skillName) return res.status(400).json({ error: 'Enter a skill name' });
    connection = await pool.getConnection();
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
  } catch (error) {
    if (connection) { try { await connection.rollback(); } catch (rollbackError) { logError('transaction_rollback_failed', rollbackError); } }
    next(error);
  } finally { connection?.release(); }
};

const deleteStudentSkillsSkillId = async (req, res, next) => {
  try {
    await pool.query('DELETE FROM student_skills WHERE student_id = ? AND skill_id = ?', [req.session.user.profileId, idParam(req.params.skillId, 'skillId')]);
    res.json({ ok: true });
  } catch (error) { next(error); }
};

const postStudentEducation = async (req, res, next) => {
  let connection;
  try {
    const educationId = req.body.educationId ? idParam(req.body.educationId, 'educationId') : null;
    const institution = optionalText(req.body.institution, 255);
    const degree = optionalText(req.body.degree, 255);
    const gpa = numberValue(req.body.gpa, 'GPA', 0, 4);
    const studyYear = integerValue(req.body.studyYear, 'Study year', 1, 10);
    const graduationYear = req.body.graduationYear ? integerValue(req.body.graduationYear, 'Graduation year', 1901, 2155) : null;
    if (!educationId && (!institution || !degree)) return res.status(400).json({ error: 'Select an education record or enter an institution and degree' });
    connection = await pool.getConnection();
    await connection.beginTransaction();
    let resolvedEducationId = educationId;
    if (!resolvedEducationId) {
      const [education] = await connection.query('INSERT INTO education (institution, degree) VALUES (?, ?) ON DUPLICATE KEY UPDATE education_id = LAST_INSERT_ID(education_id)', [institution, degree]);
      resolvedEducationId = education.insertId;
    }
    if (booleanValue(req.body.isCurrent, 'Is current')) await connection.query('UPDATE student_education SET is_current = FALSE WHERE student_id = ?', [req.session.user.profileId]);
    await connection.query(`
      INSERT INTO student_education (student_id, education_id, gpa, study_year, graduation_year, is_current)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE gpa = VALUES(gpa), study_year = VALUES(study_year),
        graduation_year = VALUES(graduation_year), is_current = VALUES(is_current)
    `, [req.session.user.profileId, resolvedEducationId, gpa, studyYear, graduationYear, booleanValue(req.body.isCurrent, 'Is current')]);
    await connection.commit();
    res.status(201).json({ ok: true });
  } catch (error) {
    if (connection) { try { await connection.rollback(); } catch (rollbackError) { logError('transaction_rollback_failed', rollbackError); } }
    next(error);
  } finally { connection?.release(); }
};

const deleteStudentEducationEducationId = async (req, res, next) => {
  try {
    await pool.query('DELETE FROM student_education WHERE student_id = ? AND education_id = ?', [req.session.user.profileId, idParam(req.params.educationId, 'educationId')]);
    res.json({ ok: true });
  } catch (error) { next(error); }
};

const postStudentProjects = async (req, res, next) => {
  let connection;
  try {
    const projectName = requiredText(req.body.projectName, 'Project name');
    const projectRole = requiredText(req.body.projectRole, 'Project role');
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [project] = await connection.query('INSERT INTO projects (project_code, project_name, description, technologies) VALUES (?, ?, ?, ?)', ['PENDING', projectName, optionalText(req.body.description), optionalText(req.body.technologies)]);
    const projectCode = `PRJ-${String(project.insertId).padStart(4, '0')}`;
    await connection.query('UPDATE projects SET project_code = ? WHERE project_id = ?', [projectCode, project.insertId]);
    await connection.query('INSERT INTO student_projects (student_id, project_id, project_role) VALUES (?, ?, ?)', [req.session.user.profileId, project.insertId, projectRole]);
    await connection.commit();
    res.status(201).json({ projectId: project.insertId, projectCode });
  } catch (error) {
    if (connection) { try { await connection.rollback(); } catch (rollbackError) { logError('transaction_rollback_failed', rollbackError); } }
    next(error);
  } finally { connection?.release(); }
};

const postStudentProjectsJoin = async (req, res, next) => {
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
};

const deleteStudentProjectsProjectId = async (req, res, next) => {
  try {
    await pool.query('DELETE FROM student_projects WHERE student_id = ? AND project_id = ?', [req.session.user.profileId, idParam(req.params.projectId, 'projectId')]);
    res.json({ ok: true });
  } catch (error) { next(error); }
};

const postStudentCertifications = async (req, res, next) => {
  try {
    const certificationId = req.body.certificationId ? idParam(req.body.certificationId, 'certificationId') : null;
    const certificationName = optionalText(req.body.certificationName, 255);
    const issuer = optionalText(req.body.issuer, 255);
    const issueDate = dateValue(req.body.issueDate, 'Issue date');
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
};

const deleteStudentCertificationsCertificationId = async (req, res, next) => {
  try {
    await pool.query('DELETE FROM student_certifications WHERE student_id = ? AND certification_id = ?', [req.session.user.profileId, idParam(req.params.certificationId, 'certificationId')]);
    res.json({ ok: true });
  } catch (error) { next(error); }
};

const postStudentExperience = async (req, res, next) => {
  let connection;
  try {
    const experienceId = req.body.experienceId ? idParam(req.body.experienceId, 'experienceId') : null;
    const organization = optionalText(req.body.organization, 255);
    const positionTitle = requiredText(req.body.positionTitle, 'Position title');
    const role = requiredText(req.body.role, 'Role');
    const durationMonths = integerValue(req.body.durationMonths, 'Duration', 0, 600);
    if (!experienceId && !organization) return res.status(400).json({ error: 'Select an organization' });
    connection = await pool.getConnection();
    await connection.beginTransaction();
    let resolvedExperienceId = experienceId;
    if (!resolvedExperienceId) {
      const [experience] = await connection.query('INSERT INTO experience (organization) VALUES (?) ON DUPLICATE KEY UPDATE experience_id = LAST_INSERT_ID(experience_id)', [organization]);
      resolvedExperienceId = experience.insertId;
    }
    await connection.query('INSERT INTO student_experience (student_id, experience_id, position_title, role, duration_months) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE position_title = VALUES(position_title), role = VALUES(role), duration_months = VALUES(duration_months)', [req.session.user.profileId, resolvedExperienceId, positionTitle, role, durationMonths]);
    await connection.commit();
    res.status(201).json({ experienceId: resolvedExperienceId });
  } catch (error) {
    if (connection) { try { await connection.rollback(); } catch (rollbackError) { logError('transaction_rollback_failed', rollbackError); } }
    next(error);
  } finally { connection?.release(); }
};

const deleteStudentExperienceExperienceId = async (req, res, next) => {
  try {
    await pool.query('DELETE FROM student_experience WHERE student_id = ? AND experience_id = ?', [req.session.user.profileId, idParam(req.params.experienceId, 'experienceId')]);
    res.json({ ok: true });
  } catch (error) { next(error); }
};

module.exports = { getStudentProfile, putStudentProfile, getStudentMatches, getStudentApplications, postStudentApplications, postStudentSkills, deleteStudentSkillsSkillId, postStudentEducation, deleteStudentEducationEducationId, postStudentProjects, postStudentProjectsJoin, deleteStudentProjectsProjectId, postStudentCertifications, deleteStudentCertificationsCertificationId, postStudentExperience, deleteStudentExperienceExperienceId };
