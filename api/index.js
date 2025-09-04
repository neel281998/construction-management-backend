const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('../routes/auth');
const userRoutes = require('../routes/users');
const siteRoutes = require('../routes/sites');
const vehicleRoutes = require('../routes/vehicles');
const inventoryRoutes = require('../routes/inventory');
const attendanceRoutes = require('../routes/attendance');
const uploadRoutes = require('../routes/upload');
const siteTypeRoutes = require('../routes/siteTypes');
const stepRoutes = require('../routes/steps');
const stockRoutes = require('../routes/stocks');
const siteInventoryRoutes = require('../routes/siteInventory');

const app = express();

// Trust proxy for Vercel
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:8081',
    'http://localhost:8081',
    'http://localhost:3000',
    'http://localhost:19006', // Expo web
    'https://snack.expo.dev', // Expo Snack
    'https://*.vercel.app', // Vercel deployments
    'https://*.netlify.app' // Netlify deployments
  ],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: true
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Database connection with improved connection management
let isConnected = false;

async function connectDB() {
  if (isConnected) return;

  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://constructionchoudhary159632:EISf9b3Mbf8toQWe@cluster0.ug5nrys.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
    const conn = await mongoose.connect(mongoUri, {
      dbName: 'construction_management',
      bufferCommands: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
    });
    isConnected = conn.connections[0].readyState === 1;
    console.log('✅ Connected to MongoDB');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
  }
}

// Call once at startup
connectDB();

// Root endpoint for debugging
app.get('/', (req, res) => {
  res.json({ 
    message: 'Construction Management API is running!',
    status: 'OK',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      sites: '/api/sites',
      vehicles: '/api/vehicles',
      inventory: '/api/inventory',
      attendance: '/api/attendance',
      upload: '/api/upload',
      siteTypes: '/api/site-types',
      steps: '/api/steps',
      stocks: '/api/stocks',
      siteInventory: '/api/site-inventory'
    }
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/sites', siteRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/site-types', siteTypeRoutes);
app.use('/api/steps', stepRoutes);
app.use('/api/stocks', stockRoutes);
app.use('/api/site-inventory', siteInventoryRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Export for Vercel
module.exports = app;
