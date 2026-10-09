const pool = require('../models/database');
const bcrypt = require('bcryptjs');
const { idParam, requiredText, optionalText, numberValue } = require('../utils/validation');
const { getStudentMatches } = require('../models/matchingModel');
const { getProfileId } = require('../models/userModel');
const allowedStatuses = ['Pending', 'Under Review', 'Accepted', 'Rejected'];

const getHealth = async (_req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT 1 AS database_connected');
    res.json({ ok: true, database: rows[0].database_connected === 1 });
  } catch (error) { next(error); }
};

module.exports = { getHealth };
