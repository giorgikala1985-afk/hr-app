require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const employeeRoutes = require('./routes/employees');
const salaryRoutes = require('./routes/salaries');
const holidayRoutes = require('./routes/holidays');
const analyticsRoutes = require('./routes/analytics');
const unitRoutes = require('./routes/units');
const positionRoutes = require('./routes/positions');
const taxCodeRoutes = require('./routes/tax_codes');
const insuranceListRoutes = require('./routes/insurance_list');
const { authenticateUser } = require('./middleware/auth');

const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'HR API is running', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/employees', authenticateUser, employeeRoutes);
app.use('/api/salaries', authenticateUser, salaryRoutes);
app.use('/api/holidays', authenticateUser, holidayRoutes);
app.use('/api/analytics', authenticateUser, analyticsRoutes);
app.use('/api/units', authenticateUser, unitRoutes);
app.use('/api/positions', authenticateUser, positionRoutes);
app.use('/api/tax-codes', authenticateUser, taxCodeRoutes);
app.use('/api/insurance-list', authenticateUser, insuranceListRoutes);

// Serve React build in production
if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, '../frontend/build');
  app.use(express.static(buildPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'));
  });
} else {
  // 404 for dev
  app.use((req, res) => {
    res.status(404).json({ error: 'Not Found', message: `Cannot ${req.method} ${req.path}` });
  });
}

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large. Maximum size is 5MB' });
  }

  if (err.message === 'Only JPEG, PNG, and WebP images are allowed') {
    return res.status(400).json({ error: err.message });
  }

  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`HR API running on http://localhost:${PORT}`);
});

module.exports = app;
