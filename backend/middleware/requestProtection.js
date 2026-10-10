const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
function requestProtection(config) {
  return (req, res, next) => {
    if (safeMethods.has(req.method)) return next();
    const site = req.get('sec-fetch-site');
    if (site && !['same-origin', 'none'].includes(site)) {
      return res.status(403).json({ error: 'Cross-site requests are not allowed' });
    }
    const expectedOrigin = config.publicOrigin || req.protocol + '://' + req.get('host');
    const origin = req.get('origin');
    const referer = req.get('referer');
    if (origin || referer) {
      try {
        const source = new URL(origin || referer);
        if (source.origin !== expectedOrigin || (origin && origin !== source.origin)) throw new Error('Origin mismatch');
      } catch {
        return res.status(403).json({ error: 'Request origin is not allowed' });
      }
    }
    // JSON cannot be sent by a cross-site HTML form. Keep empty logout requests compatible.
    const contentType = req.get('content-type');
    const hasBody = Number(req.get('content-length') || 0) > 0 || Boolean(req.get('transfer-encoding'));
    if ((hasBody || contentType) && contentType?.split(';')[0].trim().toLowerCase() !== 'application/json') {
      return res.status(415).json({ error: 'Use application/json for API requests' });
    }
    return next();
  };
}
module.exports = { requestProtection };
