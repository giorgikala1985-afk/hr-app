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
const departmentRoutes = require('./routes/departments');
const overtimeRateRoutes = require('./routes/overtime_rates');
const taxCodeRoutes = require('./routes/tax_codes');
const insuranceListRoutes = require('./routes/insurance_list');
const fitpassListRoutes = require('./routes/fitpass_list');
const documentRoutes = require('./routes/documents');
const salaryDeferralRoutes = require('./routes/salary_deferrals');
const accountingRoutes = require('./routes/accounting');
const bonusRoutes = require('./routes/bonuses');
const userRoutes = require('./routes/users');
const userMatrixRoutes = require('./routes/user_matrix');
const toolRoutes = require('./routes/tools');
const stockLocationRoutes = require('./routes/stock_locations');
const agreementRoutes = require('./routes/agreements');
const portalRoutes = require('./routes/portal');
const adminRoutes = require('./routes/admin');
const tbcBankRoutes = require('./routes/tbc_bank');
const billingRoutes = require('./routes/billing');
const rsgeRoutes = require('./routes/rsge');
const finbotsRoutes = require('./routes/finbots');
const notificationRoutes = require('./routes/notifications');
const requestRoutes = require('./routes/requests');
const testDebugRoutes = require('./routes/test_debug');
const { authenticateUser } = require('./middleware/auth');

// Force restart to apply FinBot debug changes
console.log('Server is initializing routes...');

const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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
app.use('/api/departments', authenticateUser, departmentRoutes);
app.use('/api/overtime-rates', authenticateUser, overtimeRateRoutes);
app.use('/api/tax-codes', authenticateUser, taxCodeRoutes);
app.use('/api/insurance-list', authenticateUser, insuranceListRoutes);
app.use('/api/fitpass-list', authenticateUser, fitpassListRoutes);
app.use('/api/salary-deferrals', authenticateUser, salaryDeferralRoutes);
app.use('/api/accounting', authenticateUser, accountingRoutes);
app.use('/api/bonuses', authenticateUser, bonusRoutes);
app.use('/api/users', authenticateUser, userRoutes);
app.use('/api/user-matrix', authenticateUser, userMatrixRoutes);
app.use('/api/tools', authenticateUser, toolRoutes);
app.use('/api/stock-locations', authenticateUser, stockLocationRoutes);
app.use('/api/agreements', authenticateUser, agreementRoutes);
// TBC Bank integration
app.use('/api/tbc-bank', authenticateUser, tbcBankRoutes);
// RS.ge integration (Revenue Service)
app.use('/api/rsge', authenticateUser, rsgeRoutes);
// Billing / Subscriptions
app.use('/api/billing', billingRoutes);
// FinBots: AI assistants connected to company data
app.use('/api/finbots', authenticateUser, finbotsRoutes);
// Notifications
app.use('/api/notifications', authenticateUser, notificationRoutes);
// Requests
app.use('/api/requests', authenticateUser, requestRoutes);
// Admin: super admin panel
app.use('/api/admin', adminRoutes);
// Portal: handles its own auth internally
app.use('/api/portal', portalRoutes);

app.use('/api/test-debug', testDebugRoutes);
// Documents: sign route is public (no auth), rest needs auth
app.use('/api/documents/sign', documentRoutes);
app.use('/api/documents', authenticateUser, documentRoutes);

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
    return res.status(400).json({ error: 'File too large.' });
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
