const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { authenticateUser } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'finpilot-member-secret';

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { email, password, company_name, company_id, first_name, last_name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { company_name, company_id, first_name, last_name },
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const newUserId = data.user.id;
    const displayName = [first_name, last_name].filter(Boolean).join(' ') || email;

    await supabase.from('app_users').insert([{
      user_id: newUserId,
      name: displayName,
      email,
      rights: 'Super Admin',
    }]);

    res.status(201).json({
      message: 'Account created successfully',
      user: { id: newUserId, email: data.user.email }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'An error occurred during signup' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    res.json({
      message: 'Login successful',
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at
      },
      user: { id: data.user.id, email: data.user.email }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'An error occurred during login' });
  }
});

// POST /api/auth/member-login — sub-users created by Super Admin
router.post('/member-login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { data: appUser, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('email', email)
      .not('password_hash', 'is', null)
      .maybeSingle();

    if (error || !appUser) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, appUser.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { userId: appUser.user_id, appUserId: appUser.id, rights: appUser.rights, email: appUser.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: appUser.user_id,
        appUserId: appUser.id,
        email: appUser.email,
        name: appUser.name,
        rights: appUser.rights,
      }
    });
  } catch (err) {
    console.error('Member login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticateUser, async (req, res) => {
  try {
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'An error occurred during logout' });
  }
});

// GET /api/auth/user
router.get('/user', authenticateUser, async (req, res) => {
  try {
    res.json({
      user: {
        id: req.user.id,
        email: req.user.email
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'An error occurred while fetching user' });
  }
});

module.exports = router;
