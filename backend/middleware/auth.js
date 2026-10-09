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

module.exports = { requireAuth, studentOnly: requireRole('Student'), companyOnly: requireRole('Company') };
