const mongoose = require('mongoose');
const Inventory = require('../models/Inventory');
const PlantInventory = require('../models/PlantInventory');
const Vehicle = require('../models/Vehicle');
const User = require('../models/User');

// Test utility to add sample restock data with vehicle information
async function addTestRestockData() {
  try {
    console.log('🚀 Starting test restock data creation...');

    // Find or create a test vehicle
    let testVehicle = await Vehicle.findOne({ vehicleNumber: 'TEST-001' });
    if (!testVehicle) {
      testVehicle = new Vehicle({
        vehicleNumber: 'TEST-001',
        brand: 'Tata',
        model: 'Ace',
        type: 'truck',
        status: 'available',
        tripTracking: {
          dailyTrips: 0,
          totalTrips: 0,
          lastTripDate: null
        }
      });
      await testVehicle.save();
      console.log('✅ Created test vehicle:', testVehicle.vehicleNumber);
    }

    // Find or create a test user
    let testUser = await User.findOne({ email: 'test@example.com' });
    if (!testUser) {
      testUser = new User({
        name: 'Test User',
        email: 'test@example.com',
        role: 'admin',
        password: 'hashedpassword' // In real scenario, this would be properly hashed
      });
      await testUser.save();
      console.log('✅ Created test user:', testUser.email);
    }

    // Find an existing inventory item or create one
    let inventoryItem = await Inventory.findOne();
    if (!inventoryItem) {
      console.log('❌ No inventory items found. Please create an inventory item first.');
      return;
    }

    console.log('📦 Found inventory item:', inventoryItem.itemName);

    // Add test restock data
    const testRestockData = {
      quantity: 50,
      supplier: 'Test Supplier',
      restockedBy: testUser._id,
      notes: 'Test restock with vehicle tracking',
      vehicle: {
        _id: testVehicle._id,
        vehicleNumber: testVehicle.vehicleNumber,
        vehicleType: testVehicle.type
      },
      cost: 2500
    };

    // Add to restock history
    inventoryItem.restockHistory.push(testRestockData);
    inventoryItem.currentStock += testRestockData.quantity;
    inventoryItem.lastRestocked = new Date();

    await inventoryItem.save();
    console.log('✅ Added test restock data to inventory item');

    // Update vehicle trip tracking
    testVehicle.tripTracking.totalTrips += 1;
    testVehicle.tripTracking.dailyTrips += 1;
    testVehicle.tripTracking.lastTripDate = new Date();
    await testVehicle.save();
    console.log('✅ Updated vehicle trip tracking');

    console.log('🎉 Test restock data creation completed successfully!');
    console.log('📊 Summary:');
    console.log(`   - Vehicle: ${testVehicle.vehicleNumber} (${testVehicle.type})`);
    console.log(`   - Inventory Item: ${inventoryItem.itemName}`);
    console.log(`   - Restock Quantity: ${testRestockData.quantity} ${inventoryItem.unit}`);
    console.log(`   - Cost: ₹${testRestockData.cost}`);
    console.log(`   - Vehicle Total Trips: ${testVehicle.tripTracking.totalTrips}`);

  } catch (error) {
    console.error('❌ Error creating test restock data:', error);
  }
}

// Test utility to add multiple restock entries
async function addMultipleTestRestocks() {
  try {
    console.log('🚀 Adding multiple test restock entries...');

    const vehicles = await Vehicle.find().limit(3);
    const users = await User.find().limit(2);
    const inventoryItems = await Inventory.find().limit(2);

    if (vehicles.length === 0 || users.length === 0 || inventoryItems.length === 0) {
      console.log('❌ Need at least 1 vehicle, 1 user, and 1 inventory item to create test data');
      return;
    }

    for (let i = 0; i < 3; i++) {
      const vehicle = vehicles[i % vehicles.length];
      const user = users[i % users.length];
      const item = inventoryItems[i % inventoryItems.length];

      const restockData = {
        quantity: Math.floor(Math.random() * 100) + 10,
        supplier: `Test Supplier ${i + 1}`,
        restockedBy: user._id,
        notes: `Test restock entry ${i + 1}`,
        vehicle: {
          _id: vehicle._id,
          vehicleNumber: vehicle.vehicleNumber,
          vehicleType: vehicle.type
        },
        cost: Math.floor(Math.random() * 5000) + 1000
      };

      item.restockHistory.push(restockData);
      item.currentStock += restockData.quantity;
      item.lastRestocked = new Date();

      await item.save();

      // Update vehicle trip tracking
      vehicle.tripTracking.totalTrips += 1;
      vehicle.tripTracking.dailyTrips += 1;
      vehicle.tripTracking.lastTripDate = new Date();
      await vehicle.save();

      console.log(`✅ Added restock ${i + 1}: ${restockData.quantity} ${item.unit} via ${vehicle.vehicleNumber}`);
    }

    console.log('🎉 Multiple test restock entries created successfully!');

  } catch (error) {
    console.error('❌ Error creating multiple test restocks:', error);
  }
}

// Utility to clear test data
async function clearTestRestockData() {
  try {
    console.log('🧹 Clearing test restock data...');

    // Reset vehicle trip tracking
    await Vehicle.updateMany(
      { vehicleNumber: { $regex: /^TEST-/ } },
      { 
        $set: { 
          'tripTracking.dailyTrips': 0,
          'tripTracking.totalTrips': 0,
          'tripTracking.lastTripDate': null
        }
      }
    );

    // Clear restock history from inventory items
    await Inventory.updateMany(
      {},
      { 
        $set: { 
          restockHistory: [],
          lastRestocked: null
        }
      }
    );

    await PlantInventory.updateMany(
      {},
      { 
        $set: { 
          restockHistory: [],
          lastRestocked: null
        }
      }
    );

    console.log('✅ Test restock data cleared successfully!');

  } catch (error) {
    console.error('❌ Error clearing test restock data:', error);
  }
}

module.exports = {
  addTestRestockData,
  addMultipleTestRestocks,
  clearTestRestockData
};

// If running directly
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'add':
      addTestRestockData();
      break;
    case 'add-multiple':
      addMultipleTestRestocks();
      break;
    case 'clear':
      clearTestRestockData();
      break;
    default:
      console.log('Usage: node testRestockData.js [add|add-multiple|clear]');
      console.log('  add: Add single test restock entry');
      console.log('  add-multiple: Add multiple test restock entries');
      console.log('  clear: Clear all test restock data');
  }
}


