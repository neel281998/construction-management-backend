const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const siteRoutes = require('./routes/sites');
const vehicleRoutes = require('./routes/vehicles');
const inventoryRoutes = require('./routes/inventory');
const attendanceRoutes = require('./routes/attendance');
const uploadRoutes = require('./routes/upload');
const siteTypeRoutes = require('./routes/siteTypes');
const stepRoutes = require('./routes/steps');
const stockRoutes = require('./routes/stocks');
const siteInventoryRoutes = require('./routes/siteInventory');
const storageSiteRoutes = require('./routes/storageSites');
const inventoryTransferRoutes = require('./routes/inventoryTransfers');
const inventoryDispatchRoutes = require('./routes/inventoryDispatch');
const lowStockAlertsRoutes = require('./routes/lowStockAlerts');
const plantRoutes = require('./routes/plants');
const plantInventoryRoutes = require('./routes/plantInventory');
const plantOutputRoutes = require('./routes/plantOutput');
const plantOutputDispatchRoutes = require('./routes/plantOutputDispatch');
const productionBatchRoutes = require('./routes/productionBatches');
const plantOutputsRoutes = require('./routes/plantOutputs');
const stepInventoryRoutes = require('./routes/stepInventory');
const tripReportsRoutes = require('./routes/tripReports');
const alertRoutes = require('./routes/alerts');
const notificationRoutes = require('./routes/notifications');
const recentActivitiesRoutes = require('./routes/recentActivities');
const fuelStorageRoutes = require('./routes/fuelStorage');
const fuelTransferRoutes = require('./routes/fuelTransfers');
const fuelLogRoutes = require('./routes/fuelLogs');
const fuelManagementRoutes = require('./routes/fuelManagement');
const vehicleAnalyticsRoutes = require('./routes/vehicleAnalytics');
const vehicleMaintenanceRoutes = require('./routes/vehicleMaintenance');
const plantReportsRoutes = require('./routes/plantReports');
const { initializeCronJobs } = require('./utils/cronJobs');
 
// Load environment variables
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy - Required when behind Nginx reverse proxy
app.set('trust proxy', 1);

// Compression middleware - compress all responses
app.use(compression());

// Security middleware
app.use(helmet());
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, curl, etc.)
    // Mobile apps don't send Origin header, so they're automatically allowed
    if (!origin) return callback(null, true);
    
    // List of allowed origins for web builds
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      process.env.BACKEND_URL,
      'http://localhost:8081',
      'http://localhost:3000',
      'http://localhost:19006', // Expo web
      'https://snack.expo.dev', // Expo Snack
      // Add your domain here after DNS setup:
      // 'http://api.yourdomain.com',
      // 'https://api.yourdomain.com', // After SSL setup
    ].filter(Boolean);
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // For development, allow all origins (comment out in production for security)
      // In production, you may want to restrict this further
      callback(null, true);
      // Uncomment below and remove above line for stricter CORS in production:
      // callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: true // Trust proxy for accurate IP detection behind Nginx
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
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is required');
    }
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
      fuelManagement: '/api/fuel'
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
app.use('/api/fuel', fuelManagementRoutes);
app.use('/api/vehicle-analytics', vehicleAnalyticsRoutes);
app.use('/api/vehicle-maintenance', vehicleMaintenanceRoutes);
app.use('/api/plant-reports', plantReportsRoutes);

// Health check endpoint - Updated to include database status
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

// Only start the server if this file is run directly (not imported)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📱 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:8081'}`);
    console.log(`🗄️  Database: ${process.env.MONGODB_URI || 'mongodb://localhost:27017/construction_management'}`);
    
    // Initialize cron jobs
    initializeCronJobs();
  });
}

module.exports = app;