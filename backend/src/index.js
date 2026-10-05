require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');

const { notFoundHandler, errorHandler } = require('./utils/response');

const authRoutes = require('./routes/authRoutes');
const patientRoutes = require('./routes/patientRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const deviceRoutes = require('./routes/deviceRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const planRoutes = require('./routes/planRoutes');
const packageRoutes = require('./routes/packageRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const userRoutes = require('./routes/userRoutes');
const reportRoutes = require('./routes/reportRoutes');
const branchRoutes = require('./routes/branchRoutes');
const settingRoutes = require('./routes/settingRoutes');
const systemRoutes = require('./routes/systemRoutes');
const followUpRoutes = require('./routes/followUpRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const exportRoutes = require('./routes/exportRoutes');
const laserRoutes = require('./routes/laserRoutes');
const accountingRoutes = require('./routes/accountingRoutes');
const importRoutes = require('./routes/importRoutes');

const app = express();

const uploadsDir = process.env.UPLOADS_DIR ? path.resolve(process.env.UPLOADS_DIR) : path.resolve(__dirname, '..', '..', 'uploads');
app.use('/uploads', express.static(uploadsDir));

// CORS — configurable via env for production; default allows common dev/prod frontends
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
  : ['http://localhost:5173', 'http://127.0.0.1:5173'];
app.use(
  cors({
    origin(origin, cb) {
      // allow same-origin / no-origin requests (curl, server-to-server)
      if (!origin || corsOrigins.includes(origin)) return cb(null, true);
      const allowed = corsOrigins.some((o) => o === '*' || (o.startsWith('*') && origin.endsWith(o.slice(1))));
      cb(null, allowed);
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

app.get('/health', (req, res) => {
  res.json({ success: true, message: 'Clinic Management API is running', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/follow-ups', followUpRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/exports', exportRoutes);
app.use('/api/laser', laserRoutes);
app.use('/api/accounting', accountingRoutes);
app.use('/api/import', importRoutes);

// Serve built frontend in production (single-container Fly.io)
const isProd = process.env.NODE_ENV === 'production';
const distDir = process.env.FRONTEND_DIST || path.resolve(__dirname, '..', '..', 'frontend', 'dist');
if (isProd) {
  const fs = require('fs');
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    // SPA fallback — must come AFTER all /api routes and /uploads
    app.get('*', (req, res, next) => {
      // skip API routes
      if (req.path.startsWith('/api/') || req.path.startsWith('/uploads')) return next();
      res.sendFile(path.join(distDir, 'index.html'), (err) => { if (err) next(); });
    });
    console.log(`Serving frontend from ${distDir}`);
  } else {
    console.warn(`Frontend dist not found at ${distDir}`);
  }
}

app.use(notFoundHandler);
app.use(errorHandler);

// Production safety: require real secrets in production
if (process.env.NODE_ENV === 'production') {
  const weak = ['clinic_super_secret_key_change_in_production_2026', 'clinic_refresh_secret_key_change_in_production_2026', 'change_me'];
  if (!process.env.JWT_SECRET || weak.includes(process.env.JWT_SECRET) || !process.env.REFRESH_SECRET || weak.includes(process.env.REFRESH_SECRET)) {
    console.error('FATAL: JWT_SECRET / REFRESH_SECRET must be set to strong, non-default values in production.');
    process.exit(1);
  }
}

const PORT = process.env.PORT || 5000;

// Graceful shutdown
const server = app.listen(PORT, () => {
  console.log(`Clinic Management API running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Start background scheduler (reminders + daily backup)
const { startScheduler } = require('./utils/scheduler');
startScheduler();

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err.message);
  server.close(() => process.exit(1));
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully');
  server.close(() => process.exit(0));
});

module.exports = app;
