const pool = require('../models/database');
const bcrypt = require('bcryptjs');
const { idParam, requiredText, optionalText, numberValue, integerValue, booleanValue } = require('../utils/validation');
const { getStudentMatches } = require('../models/matchingModel');
const { getProfileId } = require('../models/userModel');
const allowedStatuses = ['Pending', 'Under Review', 'Accepted', 'Rejected'];

const getCompanyProfile = async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT c.company_id, c.company_name, c.description, u.email
      FROM companies AS c JOIN users AS u ON u.user_id = c.user_id
      WHERE c.company_id = ?
    `, [req.session.user.profileId]);
    res.json(rows[0]);
  } catch (error) { next(error); }
};

const putCompanyProfile = async (req, res, next) => {
  try {
    const companyName = requiredText(req.body.companyName, 'Company name');
    await pool.query('UPDATE companies SET company_name = ?, description = ? WHERE company_id = ?', [companyName, optionalText(req.body.description), req.session.user.profileId]);
    res.json({ ok: true });
  } catch (error) { next(error); }
};

const getCompanyInternships = async (req, res, next) => {
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
};

const postCompanyInternships = async (req, res, next) => {
  try {
    const title = requiredText(req.body.title, 'Title');
    const minGpa = numberValue(req.body.minGpa, 'Minimum GPA', 0, 4);
    const minStudyYear = integerValue(req.body.minStudyYear, 'Minimum study year', 1, 10);
    const [result] = await pool.query('INSERT INTO internships (company_id, title, min_gpa, min_study_year) VALUES (?, ?, ?, ?)', [req.session.user.profileId, title, minGpa, minStudyYear]);
    res.status(201).json({ internshipId: result.insertId });
  } catch (error) { next(error); }
};

const putCompanyInternshipsInternshipId = async (req, res, next) => {
  try {
    const internshipId = idParam(req.params.internshipId, 'internshipId');
    const title = requiredText(req.body.title, 'Title');
    const minGpa = numberValue(req.body.minGpa, 'Minimum GPA', 0, 4);
    const minStudyYear = integerValue(req.body.minStudyYear, 'Minimum study year', 1, 10);
    const [result] = await pool.query('UPDATE internships SET title = ?, min_gpa = ?, min_study_year = ? WHERE internship_id = ? AND company_id = ?', [title, minGpa, minStudyYear, internshipId, req.session.user.profileId]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Internship not found' });
    res.json({ ok: true });
  } catch (error) { next(error); }
};

const deleteCompanyInternshipsInternshipId = async (req, res, next) => {
  try {
    const internshipId = idParam(req.params.internshipId, 'internshipId');
    const [result] = await pool.query('DELETE FROM internships WHERE internship_id = ? AND company_id = ?', [internshipId, req.session.user.profileId]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Internship not found or has dependent records' });
    res.json({ ok: true });
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2') return res.status(409).json({ error: 'This internship has applications and cannot be deleted' });
    next(error);
  }
};

const postCompanyInternshipsInternshipIdSkills = async (req, res, next) => {
  try {
    const internshipId = idParam(req.params.internshipId, 'internshipId');
    const skillId = idParam(req.body.skillId, 'skillId');
    const minimumProficiency = integerValue(req.body.minimumProficiency, 'Minimum proficiency', 1, 5);
    const requiredYears = numberValue(req.body.requiredYears, 'Required years', 0, 99);
    const isMandatory = booleanValue(req.body.isMandatory, 'Is mandatory');
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
};

const deleteCompanyInternshipsInternshipIdSkillsSkillId = async (req, res, next) => {
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
};

const getCompanyInternshipsInternshipIdApplications = async (req, res, next) => {
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
    const [requirements] = await pool.query(`
      SELECT a.application_id, sk.skill_id, sk.skill_name, isk.is_mandatory,
             isk.minimum_proficiency, isk.required_years,
             ss.proficiency_level, ss.years_experience
      FROM applications AS a
      JOIN internships AS i ON i.internship_id = a.internship_id
      JOIN internship_skills AS isk ON isk.internship_id = i.internship_id
      JOIN skills AS sk ON sk.skill_id = isk.skill_id
      LEFT JOIN student_skills AS ss ON ss.student_id = a.student_id AND ss.skill_id = isk.skill_id
      WHERE a.internship_id = ? AND i.company_id = ?
      ORDER BY sk.skill_name, sk.skill_id
    `, [internshipId, req.session.user.profileId]);
    const byApplication = new Map();
    for (const requirement of requirements) {
      const matched = requirement.proficiency_level != null
        && Number(requirement.proficiency_level) >= Number(requirement.minimum_proficiency)
        && requirement.years_experience != null
        && Number(requirement.years_experience) >= Number(requirement.required_years);
      const detail = {
        skillId: requirement.skill_id, skillName: requirement.skill_name,
        mandatory: Boolean(Number(requirement.is_mandatory)),
        minimumProficiency: Number(requirement.minimum_proficiency),
        requiredYears: Number(requirement.required_years),
        proficiencyLevel: requirement.proficiency_level == null ? null : Number(requirement.proficiency_level),
        yearsExperience: requirement.years_experience == null ? null : Number(requirement.years_experience),
        matched
      };
      if (!byApplication.has(requirement.application_id)) byApplication.set(requirement.application_id, []);
      byApplication.get(requirement.application_id).push(detail);
    }
    for (const row of rows) {
      row.requirements = byApplication.get(row.application_id) || [];
      row.matchedSkills = row.requirements.filter(skill => skill.matched).map(skill => skill.skillName);
      row.missingSkills = row.requirements.filter(skill => !skill.matched).map(skill => skill.skillName);
      row.missingMandatorySkills = row.requirements.filter(skill => !skill.matched && skill.mandatory).map(skill => skill.skillName);
    }
    res.json(rows);
  } catch (error) { next(error); }
};

const getCompanyInternshipSkillsReport = async (req, res, next) => {
  try {
    const internshipId = idParam(req.params.internshipId, 'internshipId');
    const [owner] = await pool.query('SELECT internship_id FROM internships WHERE internship_id = ? AND company_id = ?', [internshipId, req.session.user.profileId]);
    if (!owner.length) return res.status(404).json({ error: 'Internship not found' });
    return getCompanyInternshipsInternshipIdApplications(req, res, next);
  } catch (error) { next(error); }
};

const patchCompanyApplicationsApplicationIdStatus = async (req, res, next) => {
  try {
    const applicationId = idParam(req.params.applicationId, 'applicationId');
    if (!allowedStatuses.includes(req.body.status)) return res.status(400).json({ error: 'Invalid application status' });
    const companyId = req.session.user.profileId;
    const [rows] = await pool.query(`
      SELECT a.status FROM applications AS a
      JOIN internships AS i ON i.internship_id = a.internship_id
      WHERE a.application_id = ? AND i.company_id = ?
    `, [applicationId, companyId]);
    if (!rows.length) return res.status(404).json({ error: 'Application not found' });
    const currentStatus = rows[0].status;
    const nextStatus = req.body.status;
    if (currentStatus === nextStatus) return res.json({ ok: true });
    const transitions = { Pending: ['Under Review'], 'Under Review': ['Accepted', 'Rejected'] };
    if (!transitions[currentStatus]?.includes(nextStatus)) {
      return res.status(409).json({ error: `Cannot change application status from ${currentStatus} to ${nextStatus}` });
    }
    // Compare the previous status atomically so concurrent decisions cannot overwrite each other.
    const [result] = await pool.query(`
      UPDATE applications SET status = ?
      WHERE application_id = ? AND status = ?
        AND internship_id IN (SELECT internship_id FROM internships WHERE company_id = ?)
    `, [nextStatus, applicationId, currentStatus, companyId]);
    if (!result.affectedRows) return res.status(409).json({ error: 'Application changed; refresh and try again' });
    res.json({ ok: true });
  } catch (error) { next(error); }
};

const getCompanyReports = async (req, res, next) => {
  try {
    const companyId = req.session.user.profileId;
    const [summary] = await pool.query(`
      SELECT COUNT(DISTINCT i.internship_id) AS internships,
             COUNT(a.application_id) AS applications,
             COALESCE(SUM(a.status = 'Pending'), 0) AS pending,
             COALESCE(SUM(a.status = 'Under Review'), 0) AS under_review,
             COALESCE(SUM(a.status = 'Accepted'), 0) AS accepted,
             COALESCE(SUM(a.status = 'Rejected'), 0) AS rejected
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
};

module.exports = { getCompanyInternshipSkillsReport, getCompanyProfile, putCompanyProfile, getCompanyInternships, postCompanyInternships, putCompanyInternshipsInternshipId, deleteCompanyInternshipsInternshipId, postCompanyInternshipsInternshipIdSkills, deleteCompanyInternshipsInternshipIdSkillsSkillId, getCompanyInternshipsInternshipIdApplications, patchCompanyApplicationsApplicationIdStatus, getCompanyReports };
