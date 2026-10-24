const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const { testConnection } = require('./config/db');
const { ensureAdminKey } = require('./services/keyService');

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const studentRoutes = require('./routes/studentRoutes');
const teacherRoutes = require('./routes/teacherRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// Security & Parsing Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allows CDN scripts (Bootstrap, jQuery, Chart.js, Icons)
  crossOriginEmbedderPolicy: false
}));
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Serve Static Files
app.use(express.static(path.join(__dirname, 'public')));

// Friendly Page Navigation Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get(['/student', '/student/dashboard'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'student.html'));
});

app.get(['/teacher', '/teacher/dashboard'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'teacher.html'));
});

app.get('/settings', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'settings.html'));
});

// REST API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/settings', settingsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'University API Access Management System'
  });
});

// 404 & Central Error Handlers
app.use(notFoundHandler);
app.use(errorHandler);

// Server Initialization
async function startServer() {
  const isConnected = await testConnection();
  if (!isConnected) {
    console.error('❌ Critical: Unable to connect to MySQL database.');
    console.error('👉 Make sure XAMPP MySQL is started and database "university_api_system" is created.');
    console.error('👉 You can run "npm run seed" to automatically create the database and seed tables.');
  } else {
    console.log('✅ Connected to MySQL database successfully.');
    // Ensure the Predefined Admin Key exists
    const adminKey = process.env.ADMIN_API_KEY || 'uap_admin_secret_99887766554433221100aabbcc';
    try {
      await ensureAdminKey(adminKey);
      console.log('🔑 Admin Master Key verification complete.');
    } catch (err) {
      console.error('⚠️ Could not verify Admin Key (tables may need initialization with npm run seed):', err.message);
    }
  }

  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 University API Access Management System`);
    console.log(`🌐 Application URL: http://localhost:${PORT}`);
    console.log(`🛡️ Admin Portal:    http://localhost:${PORT}/admin`);
    console.log(`👨‍🎓 Student Portal:  http://localhost:${PORT}/student/dashboard`);
    console.log(`👨‍🏫 Teacher Portal:  http://localhost:${PORT}/teacher/dashboard`);
    console.log(`⚙️ Settings Portal: http://localhost:${PORT}/settings`);
    console.log(`=======================================================`);
  });
}

startServer();

module.exports = app;
