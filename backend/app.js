require('./config/env');
const path = require('path');
const express = require('express');
const session = require('express-session');
const apiRoutes = require('./routes/apiRoutes');

const { requestProtection } = require('./middleware/requestProtection');
const { createLoginLimiter } = require('./middleware/loginLimiter');
const { randomUUID } = require('crypto');
const { runtimeConfig } = require('./config/runtime');
const { createSessionRuntime } = require('./config/session');
const { logError } = require('./utils/logger');
function createApp(config = runtimeConfig(), sessionRuntime = createSessionRuntime(config), securityOptions = {}) {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', config.trustProxy);
  app.locals.sessionRuntime = sessionRuntime;
  app.use((req, res, next) => { req.requestId = randomUUID(); res.setHeader('X-Request-ID', req.requestId); next(); });
  app.use('/api', requestProtection(config));
  app.use('/api/auth/login', securityOptions.loginLimiter || createLoginLimiter(config, sessionRuntime));
  app.use(express.json());
  app.use(session(sessionRuntime.options));
  app.use((req, _res, next) => { req.body ??= {}; next(); });
  app.use(apiRoutes);
  app.use(express.static(path.resolve(__dirname, '../frontend')));
  app.use((error, req, res, _next) => {

    const status = error.status || (error.code === 'ER_NO_REFERENCED_ROW_2' ? 400 : 500);
    const message = error.type === 'entity.parse.failed' ? 'Invalid JSON body'
      : error.code === 'ER_NO_REFERENCED_ROW_2' ? 'Referenced record does not exist'
      : status >= 500 ? 'Server error' : error.message || 'Invalid request';
    if (status >= 500) logError('request_failed', error, { requestId: req.requestId, method: req.method, route: req.route?.path, status });
    res.status(status).json({ error: message });
  });

  return app;
}
module.exports = createApp();
module.exports.createApp = createApp;
