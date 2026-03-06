const jwt = require('jsonwebtoken');

function authenticatePortalEmployee(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No portal token provided' });
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const decoded = jwt.verify(token, process.env.PORTAL_JWT_SECRET);
    req.portalEmployee = decoded;
    req.employeeId = decoded.employeeId;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired portal token' });
  }
}

module.exports = { authenticatePortalEmployee };
