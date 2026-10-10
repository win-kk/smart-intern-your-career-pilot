require('./config/env');
const { logError } = require('./utils/logger');
async function start() {
  const { runtimeConfig } = require('./config/runtime');
  const config = runtimeConfig();
  const app = require('./app');
  const pool = require('./models/database');
  await app.locals.sessionRuntime.ready;
  await pool.query('SELECT 1');
  const server = app.listen(config.port, () => console.log('SmartIntern listening on port ' + config.port));
  server.on('error', error => { logError('server_listen_failed', error); process.exit(1); });
  let closing = false;
  async function shutdown() {
    if (closing) return;
    closing = true;
    const timeout = setTimeout(() => process.exit(1), 10000).unref();
    try {
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      await app.locals.sessionRuntime.close();
      await pool.end();
      clearTimeout(timeout);
    } catch (error) { logError('shutdown_failed', error); process.exit(1); }
  }
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
start().catch(error => { logError('startup_failed', error); process.exit(1); });
