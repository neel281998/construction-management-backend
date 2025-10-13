const mongoose = require('mongoose');
const PlantInventory = require('./models/PlantInventory');
const Plant = require('./models/Plant');
const Vehicle = require('./models/Vehicle');
const User = require('./models/User');

// Test script for plant inventory detail functionality
async function testPlantInventoryDetail() {
  try {
    console.log('🧪 Testing Plant Inventory Detail Functionality...\n');

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/construction-management');
    console.log('✅ Connected to database');

    // Find a plant
    const plant = await Plant.findOne();
    if (!plant) {
      console.log('❌ No plant found. Please create a plant first.');
      return;
    }
    console.log(`🏭 Found plant: ${plant.name}`);

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

    console.log('\n🔄 Creating plant inventory item with vehicle tracking...');

    // Create plant inventory item with vehicle information
    const plantInventoryData = {
      itemName: 'Test Plant Item',
      category: 'Cement',
      materialType: 'raw_material',
      description: 'Test plant inventory item with vehicle tracking',
      unit: 'kg',
      currentStock: 1000,
      minimumStock: 100,
      maximumStock: 5000,
      plant: plant._id,
      broughtByVehicle: {
        _id: vehicle._id,
        vehicleNumber: vehicle.vehicleNumber,
        vehicleType: vehicle.type
      },
      supplier: {
        name: 'Test Plant Supplier',
        contact: '1234567890',
        email: 'test@plantsupplier.com',
        address: 'Test Plant Address'
      },
      consumptionRate: {
        daily: 50,
        weekly: 350,
        monthly: 1500
      }
    };

    const newPlantInventoryItem = new PlantInventory(plantInventoryData);
    await newPlantInventoryItem.save();
    console.log('✅ New plant inventory item created successfully');

    // Test restock functionality
    console.log('\n🔄 Testing restock functionality...');
    
    await newPlantInventoryItem.restock(
      200, // quantity
      'Test Plant Supplier', // supplier
      user._id, // restockedBy
      'Test restock with vehicle tracking', // notes
      vehicle, // vehicle
      10000 // cost
    );

    console.log('✅ Plant inventory restock completed successfully');

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
    const createdItem = await PlantInventory.findById(newPlantInventoryItem._id);
    const updatedVehicle = await Vehicle.findById(vehicle._id);

    console.log('\n📊 Verification Results:');
    console.log(`  📦 Created Item: ${createdItem.itemName}`);
    console.log(`  🏭 Plant: ${plant.name}`);
    console.log(`  🚗 Brought By Vehicle: ${createdItem.broughtByVehicle.vehicleNumber}`);
    console.log(`  🚗 Vehicle Type: ${createdItem.broughtByVehicle.vehicleType}`);
    console.log(`  📈 Current Stock: ${createdItem.currentStock} ${createdItem.unit}`);
    console.log(`  📋 Restock History Count: ${createdItem.restockHistory.length}`);
    console.log(`  🚗 Vehicle Total Trips: ${updatedVehicle.tripTracking.totalTrips}`);
    console.log(`  📅 Vehicle Daily Trips: ${updatedVehicle.tripTracking.dailyTrips}`);

    if (createdItem.restockHistory.length > 0) {
      const lastRestock = createdItem.restockHistory[createdItem.restockHistory.length - 1];
      console.log('\n🚗 Last restock vehicle details:');
      console.log(`  Vehicle: ${lastRestock.vehicle.vehicleNumber}`);
      console.log(`  Type: ${lastRestock.vehicle.vehicleType}`);
      console.log(`  Quantity: ${lastRestock.quantity}`);
      console.log(`  Supplier: ${lastRestock.supplier}`);
      console.log(`  Cost: ₹${lastRestock.cost}`);
      console.log(`  Date: ${lastRestock.restockedAt}`);
    }

    console.log('\n✅ Plant inventory detail functionality test completed successfully!');
    console.log('🎯 The plant inventory detail page should now show:');
    console.log('  - Vehicle information for initial item creation');
    console.log('  - Restock history with vehicle details');
    console.log('  - Complete vehicle tracking and trip counting');
    console.log('  - All the same functionality as storage site inventory details');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
}

// Run the test
if (require.main === module) {
  testPlantInventoryDetail();
}

module.exports = { testPlantInventoryDetail };
