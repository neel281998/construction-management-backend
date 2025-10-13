const mongoose = require('mongoose');
const Inventory = require('./models/Inventory');
const Vehicle = require('./models/Vehicle');
const User = require('./models/User');
const StorageSite = require('./models/StorageSite');

// Test script for new inventory item creation with vehicle tracking
async function testNewItemVehicleTracking() {
  try {
    console.log('🧪 Testing New Inventory Item Creation with Vehicle Tracking...\n');

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/construction-management');
    console.log('✅ Connected to database');

    // Find a storage site
    const storageSite = await StorageSite.findOne();
    if (!storageSite) {
      console.log('❌ No storage site found. Please create a storage site first.');
      return;
    }
    console.log(`🏢 Found storage site: ${storageSite.name}`);

    // Find a vehicle
    const vehicle = await Vehicle.findOne();
    if (!vehicle) {
      console.log('❌ No vehicle found. Please create a vehicle first.');
      return;
    }
    console.log(`🚗 Found vehicle: ${vehicle.vehicleNumber}`);

    // Find a user
    const user = await User.findOne();
    if (!user) {
      console.log('❌ No user found. Please create a user first.');
      return;
    }
    console.log(`👤 Found user: ${user.firstName} ${user.lastName}`);

    console.log('\n🔄 Creating new inventory item with vehicle tracking...');

    // Create new inventory item with vehicle information
    const newInventoryItem = new Inventory({
      itemName: 'Test Item with Vehicle',
      category: 'Building Materials',
      description: 'Test item created with vehicle tracking',
      unit: 'kg',
      currentStock: 100,
      minimumStock: 10,
      maximumStock: 1000,
      storageSite: storageSite._id,
      broughtByVehicle: {
        _id: vehicle._id,
        vehicleNumber: vehicle.vehicleNumber,
        vehicleType: vehicle.type
      },
      supplier: {
        name: 'Test Supplier',
        contact: '1234567890',
        email: 'test@supplier.com',
        address: 'Test Address'
      }
    });

    await newInventoryItem.save();
    console.log('✅ New inventory item created successfully');

    // Record vehicle activity in storage site
    await storageSite.recordVehicleActivity(
      'receipt',
      vehicle,
      newInventoryItem,
      {
        quantity: 100,
        supplier: 'Test Supplier',
        cost: 5000,
        notes: 'New inventory item created'
      },
      user._id
    );

    console.log('✅ Vehicle activity recorded in storage site');

    // Update vehicle trip tracking
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const lastTripDate = vehicle.tripTracking.lastTripDate;
    const lastTripDateStr = lastTripDate ? lastTripDate.toISOString().split('T')[0] : null;
    
    // If it's a new day, reset daily trips
    if (lastTripDateStr !== todayStr) {
      vehicle.tripTracking.dailyTrips = 1;
    } else {
      vehicle.tripTracking.dailyTrips += 1;
    }
    
    vehicle.tripTracking.totalTrips += 1;
    vehicle.tripTracking.lastTripDate = today;
    
    await vehicle.save();
    console.log('✅ Vehicle trip tracking updated');

    // Verify the results
    const createdItem = await Inventory.findById(newInventoryItem._id);
    const updatedStorageSite = await StorageSite.findById(storageSite._id);
    const updatedVehicle = await Vehicle.findById(vehicle._id);

    console.log('\n📊 Verification Results:');
    console.log(`  📦 Created Item: ${createdItem.itemName}`);
    console.log(`  🚗 Brought By Vehicle: ${createdItem.broughtByVehicle.vehicleNumber}`);
    console.log(`  🏢 Storage Site: ${updatedStorageSite.name}`);
    console.log(`  📈 Vehicle Total Trips: ${updatedVehicle.tripTracking.totalTrips}`);
    console.log(`  📅 Vehicle Daily Trips: ${updatedVehicle.tripTracking.dailyTrips}`);
    console.log(`  🎯 Storage Site Total Trips: ${updatedStorageSite.tripStatistics.totalTrips}`);
    console.log(`  📋 Storage Site Vehicle Activities: ${updatedStorageSite.vehicleActivity.length}`);

    console.log('\n✅ New inventory item creation with vehicle tracking test completed successfully!');
    console.log('🎯 Now when you create new inventory items, you should see:');
    console.log('  - Vehicle information in the inventory detail page');
    console.log('  - Vehicle trip count increased');
    console.log('  - Storage site vehicle activity recorded');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
}

// Run the test
if (require.main === module) {
  testNewItemVehicleTracking();
}

module.exports = { testNewItemVehicleTracking };

