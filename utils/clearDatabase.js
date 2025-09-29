const mongoose = require('mongoose');
require('dotenv').config();

// Import all models
const User = require('../models/User');
const Site = require('../models/Site');
const Vehicle = require('../models/Vehicle');
const Inventory = require('../models/Inventory');
const InventoryDispatch = require('../models/InventoryDispatch');
const InventoryReceipt = require('../models/InventoryReceipt');
const InventoryTransfer = require('../models/InventoryTransfer');
const InventoryTransferReceipt = require('../models/InventoryTransferReceipt');
const Plant = require('../models/Plant');
const PlantInventory = require('../models/PlantInventory');
const PlantOutput = require('../models/PlantOutput');
const PlantOutputDispatch = require('../models/PlantOutputDispatch');
const PlantOutputReceipt = require('../models/PlantOutputReceipt');
const ProductionBatch = require('../models/ProductionBatch');
const Step = require('../models/Step');
const StepInventoryConsumption = require('../models/StepInventoryConsumption');
const StepInventoryReceipt = require('../models/StepInventoryReceipt');
const Stock = require('../models/Stock');
const StorageSite = require('../models/StorageSite');
const TripHistory = require('../models/TripHistory');
const Alert = require('../models/Alert');
const Attendance = require('../models/Attendance');
const Notification = require('../models/Notification');

async function clearDatabase() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/construction-management';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // First, let's see what's in the database
    console.log('\n📊 Current database status:');
    
    const collections = [
      { name: 'User', model: User },
      { name: 'Site', model: Site },
      { name: 'Vehicle', model: Vehicle },
      { name: 'Inventory', model: Inventory },
      { name: 'InventoryDispatch', model: InventoryDispatch },
      { name: 'InventoryReceipt', model: InventoryReceipt },
      { name: 'InventoryTransfer', model: InventoryTransfer },
      { name: 'InventoryTransferReceipt', model: InventoryTransferReceipt },
      { name: 'Plant', model: Plant },
      { name: 'PlantInventory', model: PlantInventory },
      { name: 'PlantOutput', model: PlantOutput },
      { name: 'PlantOutputDispatch', model: PlantOutputDispatch },
      { name: 'PlantOutputReceipt', model: PlantOutputReceipt },
      { name: 'ProductionBatch', model: ProductionBatch },
      { name: 'Step', model: Step },
      { name: 'StepInventoryConsumption', model: StepInventoryConsumption },
      { name: 'StepInventoryReceipt', model: StepInventoryReceipt },
      { name: 'Stock', model: Stock },
      { name: 'StorageSite', model: StorageSite },
      { name: 'TripHistory', model: TripHistory },
      { name: 'Alert', model: Alert },
      { name: 'Attendance', model: Attendance },
      { name: 'Notification', model: Notification }
    ];

    // Show current counts
    for (const collection of collections) {
      try {
        const count = await collection.model.countDocuments();
        console.log(`${collection.name}: ${count} documents`);
      } catch (error) {
        console.log(`${collection.name}: Error counting - ${error.message}`);
      }
    }

    // Find all users to see what we have
    console.log('\n👥 Current users:');
    const allUsers = await User.find({});
    allUsers.forEach(user => {
      console.log(`- ${user.fullName} (${user.email}) - Role: ${user.role}`);
    });

    // Find admin users specifically
    const adminUsers = await User.find({ role: 'admin' });
    console.log(`\n🔑 Admin users found: ${adminUsers.length}`);
    adminUsers.forEach(admin => {
      console.log(`- ${admin.fullName} (${admin.email})`);
    });

    console.log('\n🧹 Starting database cleanup...');
    console.log('⚠️  This will clear ALL data from the database!');

    // Clear all collections
    for (const collection of collections) {
      try {
        const result = await collection.model.deleteMany({});
        console.log(`✅ Cleared ${result.deletedCount} documents from ${collection.name}`);
      } catch (error) {
        console.log(`❌ Error clearing ${collection.name}:`, error.message);
      }
    }

    console.log('\n✅ Database cleanup completed!');
    console.log('🗑️  All data has been cleared from the database.');

  } catch (error) {
    console.error('❌ Error during database cleanup:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the cleanup
clearDatabase();