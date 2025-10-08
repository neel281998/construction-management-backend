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
const storageSiteRoutes = require('../routes/storageSites');
const inventoryTransferRoutes = require('../routes/inventoryTransfers');
const inventoryDispatchRoutes = require('../routes/inventoryDispatch');
const lowStockAlertsRoutes = require('../routes/lowStockAlerts');
const plantRoutes = require('../routes/plants');
const plantInventoryRoutes = require('../routes/plantInventory');
const plantOutputRoutes = require('../routes/plantOutput');
const plantOutputDispatchRoutes = require('../routes/plantOutputDispatch');
const productionBatchRoutes = require('../routes/productionBatches');
const plantOutputsRoutes = require('../routes/plantOutputs');
const stepInventoryRoutes = require('../routes/stepInventory');
const tripReportsRoutes = require('../routes/tripReports');
const alertRoutes = require('../routes/alerts');
const notificationRoutes = require('../routes/notifications');
const recentActivitiesRoutes = require('../routes/recentActivities');
const fuelStorageRoutes = require('../routes/fuelStorage');
const fuelTransferRoutes = require('../routes/fuelTransfers');
const fuelLogRoutes = require('../routes/fuelLogs');
const vehicleAnalyticsRoutes = require('../routes/vehicleAnalytics');
const vehicleMaintenanceRoutes = require('../routes/vehicleMaintenance');

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

// Database connection optimized for Vercel serverless
let connectionPromise = null;

async function connectDB() {
  // If already connected, return immediately
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  // If connection is in progress, wait for it
  if (connectionPromise) {
    return connectionPromise;
  }

  // Start new connection
  connectionPromise = mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://constructionchoudhary159632:EISf9b3Mbf8toQWe@cluster0.ug5nrys.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
    dbName: 'construction_management',
    bufferCommands: false, // Disable buffering for serverless
    maxPoolSize: 1, // Single connection for serverless
    serverSelectionTimeoutMS: 5000, // Faster timeout for serverless
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,
    maxIdleTimeMS: 10000,
    retryWrites: true,
    w: 'majority'
  });

  try {
    const conn = await connectionPromise;
    console.log('✅ Connected to MongoDB successfully');
    return conn;
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    connectionPromise = null; // Reset so we can try again
    throw err;
  }
}

// Call once at startup
connectDB();

// Connection event listeners for monitoring
mongoose.connection.on('connected', () => {
  console.log('✅ Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose connection error:', err);
  connectionPromise = null; // Reset connection promise on error
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ Mongoose disconnected from MongoDB');
  connectionPromise = null; // Reset connection promise on disconnect
});

mongoose.connection.on('reconnected', () => {
  console.log('🔄 Mongoose reconnected to MongoDB');
});

// Database connection middleware - ensures connection before processing requests
app.use(async (req, res, next) => {
  // Skip connection check for health endpoints
  if (req.path === '/' || req.path === '/api/health') {
    return next();
  }
  
  try {
    // Ensure database connection
    await connectDB();
    next();
  } catch (err) {
    console.error('Database connection failed in middleware:', err.message);
    res.status(503).json({
      success: false,
      message: 'Database connection failed. Please try again in a moment.',
      retryAfter: 3,
      connectionState: 'failed'
    });
  }
});

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
      siteInventory: '/api/site-inventory',
      storageSites: '/api/storage-sites',
      inventoryTransfers: '/api/inventory-transfers',
      inventoryDispatch: '/api/inventory-dispatch',
      lowStockAlerts: '/api/low-stock-alerts',
      plants: '/api/plants',
      plantInventory: '/api/plant-inventory',
      plantOutput: '/api/plant-output',
      plantOutputDispatch: '/api/plant-output-dispatch',
      productionBatches: '/api/production-batches',
      plantOutputs: '/api/plant-outputs',
      stepInventory: '/api/step-inventory',
      tripReports: '/api/trip-reports',
      alerts: '/api/alerts',
      notifications: '/api/notifications',
      recentActivities: '/api/recent-activities',
      fuelStorages: '/api/fuel/storages',
      fuelTransfers: '/api/fuel/transfers',
      fuelLogs: '/api/fuel/logs',
      vehicleAnalytics: '/api/vehicle-analytics',
      vehicleMaintenance: '/api/vehicle-maintenance'
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
app.use('/api/storage-sites', storageSiteRoutes);
app.use('/api/inventory-transfers', inventoryTransferRoutes);
app.use('/api/inventory-dispatch', inventoryDispatchRoutes);
app.use('/api/low-stock-alerts', lowStockAlertsRoutes);
app.use('/api/plants', plantRoutes);
app.use('/api/plant-inventory', plantInventoryRoutes);
app.use('/api/plant-output', plantOutputRoutes);
app.use('/api/plant-output-dispatch', plantOutputDispatchRoutes);
app.use('/api/production-batches', productionBatchRoutes);
app.use('/api/plant-outputs', plantOutputsRoutes);
app.use('/api/step-inventory', stepInventoryRoutes);
app.use('/api/trip-reports', tripReportsRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/recent-activities', recentActivitiesRoutes);
app.use('/api/fuel/storages', fuelStorageRoutes);
app.use('/api/fuel/transfers', fuelTransferRoutes);
app.use('/api/fuel/logs', fuelLogRoutes);
app.use('/api/vehicle-analytics', vehicleAnalyticsRoutes);
app.use('/api/vehicle-maintenance', vehicleMaintenanceRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  const connectionStates = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  
  const dbState = mongoose.connection.readyState;
  const isHealthy = dbState === 1;
  
  res.json({ 
    status: isHealthy ? 'OK' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: {
      state: connectionStates[dbState],
      readyState: dbState,
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      name: mongoose.connection.name
    },
    serverless: {
      connectionPromise: connectionPromise ? 'active' : 'none',
      environment: process.env.NODE_ENV || 'production'
    }
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
