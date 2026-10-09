const pool = require('./database');

async function getProfileId(userId, role) {
  const table = role === 'Student' ? 'students' : 'companies';
  const key = role === 'Student' ? 'student_id' : 'company_id';
  const [rows] = await pool.query(`SELECT ${key} AS profile_id FROM ${table} WHERE user_id = ?`, [userId]);
  return rows[0]?.profile_id || null;
}

module.exports = { getProfileId };
