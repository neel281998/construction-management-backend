const mongoose = require('mongoose');
const StorageSite = require('./models/StorageSite');
const Inventory = require('./models/Inventory');
const Vehicle = require('./models/Vehicle');
const User = require('./models/User');

// Test script for storage site vehicle tracking
async function testStorageSiteVehicleTracking() {
  try {
    console.log('🧪 Testing Storage Site Vehicle Tracking...\n');

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/construction-management');
    console.log('✅ Connected to database');

    // Find a storage site
    const storageSite = await StorageSite.findOne();
    if (!storageSite) {
      console.log('❌ No storage site found. Please create a storage site first.');
      return;
    }
    console.log(`📦 Found storage site: ${storageSite.name}`);

    // Find a vehicle
    const vehicle = await Vehicle.findOne();
    if (!vehicle) {
      console.log('❌ No vehicle found. Please create a vehicle first.');
      return;
    }
    console.log(`🚗 Found vehicle: ${vehicle.vehicleNumber}`);

    // Find an inventory item
    const inventoryItem = await Inventory.findOne({ storageSite: storageSite._id });
    if (!inventoryItem) {
      console.log('❌ No inventory item found for this storage site. Please create inventory first.');
      return;
    }
    console.log(`📦 Found inventory item: ${inventoryItem.itemName}`);

    // Find a user
    const user = await User.findOne();
    if (!user) {
      console.log('❌ No user found. Please create a user first.');
      return;
    }
    console.log(`👤 Found user: ${user.firstName} ${user.lastName}`);

    console.log('\n🔄 Recording vehicle activity...');

    // Record vehicle activity
    await storageSite.recordVehicleActivity(
      'restock',
      vehicle,
      inventoryItem,
      {
        quantity: 50,
        supplier: 'Test Supplier',
        cost: 5000,
        notes: 'Test restock operation'
      },
      user._id
    );

    console.log('✅ Vehicle activity recorded successfully');

    // Get recent vehicle activity
    const recentActivity = storageSite.getRecentVehicleActivity(5);
    console.log(`\n📋 Recent vehicle activity (${recentActivity.length} items):`);
    recentActivity.forEach((activity, index) => {
      console.log(`  ${index + 1}. ${activity.operationType} - ${activity.vehicle.vehicleNumber} - ${activity.operationDetails.quantity} units`);
    });

    // Get vehicle usage statistics
    const vehicleStats = storageSite.getVehicleUsageStats();
    console.log('\n📊 Vehicle usage statistics:');
    console.log(`  Total trips: ${vehicleStats.totalTrips}`);
    console.log(`  Daily trips: ${vehicleStats.dailyTrips}`);
    console.log(`  Vehicles used: ${vehicleStats.vehiclesUsed.length}`);
    
    if (vehicleStats.vehiclesUsed.length > 0) {
      console.log('  Top vehicles:');
      vehicleStats.vehiclesUsed.slice(0, 3).forEach((vehicle, index) => {
        console.log(`    ${index + 1}. ${vehicle.vehicleNumber}: ${vehicle.tripCount} trips`);
      });
    }

    console.log('\n✅ Storage site vehicle tracking test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
}

// Run the test
if (require.main === module) {
  testStorageSiteVehicleTracking();
}

module.exports = { testStorageSiteVehicleTracking };

