function logError(event, error, context = {}) {
  // Never log bodies, credentials, cookie headers, SQL, stacks or exception messages.
  console.error(JSON.stringify({
    level: 'error', event,
    requestId: context.requestId,
    method: context.method,
    route: context.route,
    status: context.status,
    code: /^[A-Z_0-9]{1,64}$/.test(error?.code || '') ? error.code : undefined
  }));
}
module.exports = { logError };
