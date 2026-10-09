require('./config/env');
const path = require('path');
const express = require('express');
const session = require('express-session');
const apiRoutes = require('./routes/apiRoutes');

const app = express();
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'smartintern-local-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 8 * 60 * 60 * 1000 }
}));
app.use(apiRoutes);
app.use(express.static(path.resolve(__dirname, '../frontend')));
app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.status || 500).json({ error: error.message || 'Server error' });
});

module.exports = app;
