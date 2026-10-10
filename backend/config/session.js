const { logError } = require('../utils/logger');
function createSessionRuntime(config, dependencies = {}) {
  const options = {
    secret: config.secret, resave: false, saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', secure: config.production, maxAge: 8 * 60 * 60 * 1000 }
  };
  if (!config.production) return { options, ready: Promise.resolve(), close: async () => {} };
  const createClient = dependencies.createClient || require('redis').createClient;
  const RedisStore = dependencies.RedisStore || require('connect-redis').RedisStore;
  const client = createClient({ url: config.redisUrl, disableOfflineQueue: true,
    socket: { connectTimeout: 5000, reconnectStrategy: retries => retries < 3 ? Math.min(100 * 2 ** retries, 1000) : new Error('Redis connection unavailable') }
  });
  client.on('error', error => logError('session_store_error', error));
  options.store = new RedisStore({ client, prefix: 'smartintern:sessions:' });
  const ready = client.connect();
  // The server awaits this before accepting traffic; retain a rejection handler for imports.
  ready.catch(error => logError('session_store_startup_failed', error));
  return { options, ready, client, close: async () => { if (client.isOpen) await client.quit(); } };
}
module.exports = { createSessionRuntime };
