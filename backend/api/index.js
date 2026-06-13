// Vercel serverless entry point.
// server.js exports the configured Express app (without calling app.listen on Vercel),
// and Vercel invokes the exported app as the request handler for every route.
module.exports = require('../server');
