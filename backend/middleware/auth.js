const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const JWT_SECRET = process.env.JWT_SECRET || 'finpilot-member-secret';

const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No authentication token provided' });
    }

    const token = authHeader.replace('Bearer ', '');

    // Try Supabase auth first (Super Admin)
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (!error && user) {
      req.user = user;
      req.userId = user.id;
      return next();
    }

    // Try custom member JWT (sub-users)
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      req.userId = payload.userId;
      req.appUserId = payload.appUserId;
      req.userRights = payload.rights;
      req.user = { id: payload.userId, email: payload.email };
      return next();
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  } catch (error) {
    console.error('Authentication middleware error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
};

module.exports = { authenticateUser };
