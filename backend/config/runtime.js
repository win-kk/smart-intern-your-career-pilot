function runtimeConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const secret = env.SESSION_SECRET || 'smartintern-local-session-secret';
  const required = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'SESSION_SECRET', 'REDIS_URL', 'PUBLIC_ORIGIN'];
  if (production) {
    for (const name of required) {
      if (!env[name] || /replace_with|smartintern-local-session-secret/i.test(env[name])) throw new Error(name + ' must be configured for production');
    }
    if (Buffer.byteLength(secret) < 32) throw new Error('SESSION_SECRET must be at least 32 bytes in production');
    if (!['redis:', 'rediss:'].includes(new URL(env.REDIS_URL).protocol)) throw new Error('REDIS_URL must use redis:// or rediss://');
  }
  let publicOrigin;
  if (env.PUBLIC_ORIGIN) {
    const origin = new URL(env.PUBLIC_ORIGIN);
    if (origin.origin !== env.PUBLIC_ORIGIN || origin.username || origin.password || (production ? origin.protocol !== 'https:' : !['http:', 'https:'].includes(origin.protocol))) throw new Error('PUBLIC_ORIGIN must be an exact web origin (HTTPS in production)');
    publicOrigin = origin.origin;
  }
  const port = Number(env.PORT || 3000);
  const dbPort = Number(env.DB_PORT || 3306);
  const trustProxy = Number(env.TRUST_PROXY_HOPS || 0);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
  if (!Number.isInteger(dbPort) || dbPort < 1 || dbPort > 65535) throw new Error('Invalid DB_PORT');
  if (!Number.isInteger(trustProxy) || trustProxy < 0 || trustProxy > 10) throw new Error('Invalid TRUST_PROXY_HOPS');
  return { production, secret, port, trustProxy, publicOrigin, redisUrl: production ? env.REDIS_URL : null };
}
module.exports = { runtimeConfig };
