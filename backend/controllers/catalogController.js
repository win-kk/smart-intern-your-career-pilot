const pool = require('../models/database');
const bcrypt = require('bcryptjs');
const { idParam, requiredText, optionalText, numberValue } = require('../utils/validation');
const { getStudentMatches } = require('../models/matchingModel');
const { getProfileId } = require('../models/userModel');
const allowedStatuses = ['Pending', 'Under Review', 'Accepted', 'Rejected'];

const getCatalogSkills = async (_req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT skill_id, skill_name, category FROM skills ORDER BY skill_name');
    res.json(rows);
  } catch (error) { next(error); }
};

const getCatalogEducation = async (_req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT education_id, institution, degree FROM education ORDER BY institution, degree');
    res.json(rows);
  } catch (error) { next(error); }
};

const getCatalogCertifications = async (_req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT certification_id, certification_name, issuer FROM certifications ORDER BY certification_name');
    res.json(rows);
  } catch (error) { next(error); }
};

const getCatalogExperience = async (_req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT experience_id, organization FROM experience ORDER BY organization');
    res.json(rows);
  } catch (error) { next(error); }
};

module.exports = { getCatalogSkills, getCatalogEducation, getCatalogCertifications, getCatalogExperience };
