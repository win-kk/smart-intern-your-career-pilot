const { rateLimit } = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
function createLoginLimiter(config, runtime, options = {}) {
  let store;
  if (config.production) {
    if (!runtime.client) throw new Error('Production login limiter requires Redis');
    store = new RedisStore({ prefix: 'smartintern:login:', sendCommand: async (...args) => {
      await runtime.ready;
      return runtime.client.sendCommand(args);
    } });
  }
  return rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000,
    limit: options.limit || 20,
    standardHeaders: 'draft-7', legacyHeaders: false,
    skipSuccessfulRequests: true,
    passOnStoreError: false,
    message: { error: 'Too many login attempts; try again later' },
    ...(store ? { store } : {})
  });
}
module.exports = { createLoginLimiter };
