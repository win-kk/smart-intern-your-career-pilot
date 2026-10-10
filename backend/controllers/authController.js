const pool = require('../models/database');
const bcrypt = require('bcryptjs');
const { idParam, requiredText, optionalText, numberValue } = require('../utils/validation');
const { getStudentMatches } = require('../models/matchingModel');
const { getProfileId } = require('../models/userModel');
const allowedStatuses = ['Pending', 'Under Review', 'Accepted', 'Rejected'];

const postAuthLogin = async (req, res, next) => {
  try {
    const email = requiredText(req.body?.email, 'Email');
    const password = req.body?.password;
    if (typeof password !== 'string' || !password || Buffer.byteLength(password, 'utf8') > 72) {
      return res.status(400).json({ error: 'Password is required and must be at most 72 bytes' });
    }
    const role = requiredText(req.body?.role, 'Role');
    if (!['Student', 'Company'].includes(role)) return res.status(400).json({ error: 'Choose Student or Company' });
    const [rows] = await pool.query('SELECT user_id, email, password_hash, role FROM users WHERE email = ? AND role = ?', [email, role]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Email, password, or selected role is incorrect' });
    }
    const profileId = await getProfileId(user.user_id, user.role);
    if (!Number.isSafeInteger(profileId) || profileId < 1) {
      return res.status(403).json({ error: 'Account profile is unavailable' });
    }
    await new Promise((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
    req.session.user = { userId: user.user_id, email: user.email, role: user.role, profileId };
    await new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
    res.json(req.session.user);
  } catch (error) { next(error); }
};

const getAuthMe = (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
  res.json(req.session.user);
};

const postAuthLogout = (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
};

module.exports = { postAuthLogin, getAuthMe, postAuthLogout };
