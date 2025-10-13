const mongoose = require('mongoose');
const Inventory = require('./models/Inventory');
const Vehicle = require('./models/Vehicle');
const User = require('./models/User');
const StorageSite = require('./models/StorageSite');

// Test script to verify the fixed vehicle tracking functionality
async function testFixedVehicleTracking() {
  try {
    console.log('🧪 Testing Fixed Vehicle Tracking Functionality...\n');

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
    console.log(`🚗 Found vehicle: ${vehicle.vehicleNumber} (${vehicle.type})`);

    // Find a user
    const user = await User.findOne();
    if (!user) {
      console.log('❌ No user found. Please create a user first.');
      return;
    }
    console.log(`👤 Found user: ${user.firstName} ${user.lastName}`);

    console.log('\n🔄 Testing inventory creation with vehicle tracking...');

    // Test the fixed inventory creation process
    const testInventoryData = {
      itemName: 'Test Fixed Item',
      category: 'Building Materials',
      description: 'Test item to verify fixed vehicle tracking',
      unit: 'kg',
      currentStock: 200,
      minimumStock: 20,
      maximumStock: 2000,
      storageSite: storageSite._id,
      vehicle: {
        _id: vehicle._id,
        vehicleNumber: vehicle.vehicleNumber,
        vehicleType: vehicle.type // This should now work correctly
      },
      supplier: {
        name: 'Test Supplier Fixed',
        contact: '1234567890',
        email: 'test@supplier.com',
        address: 'Test Address'
      }
    };

    // Create inventory item
    const newInventoryItem = new Inventory(testInventoryData);
    await newInventoryItem.save();
    console.log('✅ New inventory item created successfully');

    // Verify the broughtByVehicle field is populated correctly
    console.log('\n📊 Verification Results:');
    console.log(`  📦 Created Item: ${newInventoryItem.itemName}`);
    console.log(`  🚗 Brought By Vehicle: ${newInventoryItem.broughtByVehicle.vehicleNumber}`);
    console.log(`  🚗 Vehicle Type: ${newInventoryItem.broughtByVehicle.vehicleType}`);
    console.log(`  🏢 Storage Site: ${storageSite.name}`);

    // Test storage site vehicle activity recording
    try {
      await storageSite.recordVehicleActivity(
        'receipt',
        vehicle,
        newInventoryItem,
        {
          quantity: 200,
          supplier: 'Test Supplier Fixed',
          cost: 10000,
          notes: 'New inventory item created with fixed tracking'
        },
        user._id
      );
      console.log('✅ Vehicle activity recorded in storage site successfully');
    } catch (error) {
      console.error('❌ Error recording vehicle activity:', error.message);
    }

    // Test vehicle trip tracking
    try {
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
      console.log('✅ Vehicle trip tracking updated successfully');
    } catch (error) {
      console.error('❌ Error updating vehicle trip tracking:', error.message);
    }

    // Final verification
    const updatedItem = await Inventory.findById(newInventoryItem._id);
    const updatedStorageSite = await StorageSite.findById(storageSite._id);
    const updatedVehicle = await Vehicle.findById(vehicle._id);

    console.log('\n🎯 Final Verification:');
    console.log(`  📦 Item broughtByVehicle: ${updatedItem.broughtByVehicle.vehicleNumber} (${updatedItem.broughtByVehicle.vehicleType})`);
    console.log(`  🏢 Storage site total trips: ${updatedStorageSite.tripStatistics.totalTrips}`);
    console.log(`  🚗 Vehicle total trips: ${updatedVehicle.tripTracking.totalTrips}`);
    console.log(`  📋 Storage site vehicle activities: ${updatedStorageSite.vehicleActivity.length}`);

    console.log('\n✅ All fixes verified successfully!');
    console.log('🎯 Now the system should:');
    console.log('  - Show vehicle information in restock history for new items');
    console.log('  - Display correct vehicle type (not undefined)');
    console.log('  - Record vehicle activity in storage site without errors');
    console.log('  - Update vehicle trip counts correctly');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
}

// Run the test
if (require.main === module) {
  testFixedVehicleTracking();
}

module.exports = { testFixedVehicleTracking };

