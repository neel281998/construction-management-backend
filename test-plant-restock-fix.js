const mongoose = require('mongoose');
const PlantInventory = require('./models/PlantInventory');
const Vehicle = require('./models/Vehicle');
const User = require('./models/User');
const Plant = require('./models/Plant');

// Test script to verify plant inventory restock functionality works correctly
async function testPlantInventoryRestockFunctionality() {
  try {
    console.log('🧪 Testing plant inventory restock functionality...');

    // Find an existing plant inventory item
    const plantInventoryItem = await PlantInventory.findOne();
    if (!plantInventoryItem) {
      console.log('❌ No plant inventory items found. Please create a plant inventory item first.');
      return;
    }

    // Find an existing vehicle
    const vehicle = await Vehicle.findOne();
    if (!vehicle) {
      console.log('❌ No vehicles found. Please create a vehicle first.');
      return;
    }

    // Find an existing user
    const user = await User.findOne();
    if (!user) {
      console.log('❌ No users found. Please create a user first.');
      return;
    }

    console.log('🌱 Testing with plant inventory item:', plantInventoryItem.itemName);
    console.log('🚗 Testing with vehicle:', vehicle.vehicleNumber);
    console.log('👤 Testing with user:', user.name);

    const initialStock = plantInventoryItem.currentStock;
    const initialHistoryLength = plantInventoryItem.restockHistory.length;

    console.log('📊 Initial state:');
    console.log(`   - Current Stock: ${initialStock}`);
    console.log(`   - Restock History Length: ${initialHistoryLength}`);

    // Test the restock method
    const testRestockData = {
      quantity: 30,
      supplier: 'Test Plant Supplier',
      restockedBy: user._id,
      notes: 'Test plant inventory restock to verify vehicle details are saved',
      vehicle: {
        _id: vehicle._id,
        vehicleNumber: vehicle.vehicleNumber,
        vehicleType: vehicle.type
      },
      cost: 2000
    };

    console.log('🔄 Calling plant inventory restock method...');
    await plantInventoryItem.restock(
      testRestockData.quantity,
      testRestockData.supplier,
      testRestockData.restockedBy,
      testRestockData.notes,
      testRestockData.vehicle,
      testRestockData.cost
    );

    // Refresh the item from database
    const updatedItem = await PlantInventory.findById(plantInventoryItem._id);

    console.log('📊 Final state:');
    console.log(`   - Current Stock: ${updatedItem.currentStock}`);
    console.log(`   - Restock History Length: ${updatedItem.restockHistory.length}`);
    console.log(`   - Last Restocked: ${updatedItem.lastRestocked}`);

    // Check if the restock history was properly added
    if (updatedItem.restockHistory.length > initialHistoryLength) {
      const lastRestock = updatedItem.restockHistory[updatedItem.restockHistory.length - 1];
      console.log('✅ Plant inventory restock history entry added successfully!');
      console.log('📝 Last restock entry:', {
        quantity: lastRestock.quantity,
        supplier: lastRestock.supplier,
        vehicle: lastRestock.vehicle,
        cost: lastRestock.cost,
        notes: lastRestock.notes
      });

      if (lastRestock.vehicle) {
        console.log('✅ Vehicle details saved correctly!');
        console.log(`   - Vehicle: ${lastRestock.vehicle.vehicleNumber}`);
        console.log(`   - Type: ${lastRestock.vehicle.vehicleType}`);
      } else {
        console.log('❌ Vehicle details not saved!');
      }
    } else {
      console.log('❌ Plant inventory restock history was not added!');
    }

    // Check if stock was updated
    if (updatedItem.currentStock === initialStock + testRestockData.quantity) {
      console.log('✅ Plant inventory stock updated correctly!');
    } else {
      console.log('❌ Plant inventory stock was not updated correctly!');
    }

    console.log('🎉 Plant inventory test completed!');

  } catch (error) {
    console.error('❌ Plant inventory test failed:', error);
  }
}

// Test utility to add multiple plant inventory restock entries
async function addMultiplePlantInventoryRestocks() {
  try {
    console.log('🚀 Adding multiple plant inventory test restock entries...');

    const vehicles = await Vehicle.find().limit(3);
    const users = await User.find().limit(2);
    const plantInventoryItems = await PlantInventory.find().limit(2);

    if (vehicles.length === 0 || users.length === 0 || plantInventoryItems.length === 0) {
      console.log('❌ Need at least 1 vehicle, 1 user, and 1 plant inventory item to create test data');
      return;
    }

    for (let i = 0; i < 3; i++) {
      const vehicle = vehicles[i % vehicles.length];
      const user = users[i % users.length];
      const item = plantInventoryItems[i % plantInventoryItems.length];

      const restockData = {
        quantity: Math.floor(Math.random() * 100) + 10,
        supplier: `Test Plant Supplier ${i + 1}`,
        restockedBy: user._id,
        notes: `Test plant inventory restock entry ${i + 1}`,
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

      console.log(`✅ Added plant inventory restock ${i + 1}: ${restockData.quantity} ${item.unit} via ${vehicle.vehicleNumber}`);
    }

    console.log('🎉 Multiple plant inventory test restock entries created successfully!');

  } catch (error) {
    console.error('❌ Error creating multiple plant inventory test restocks:', error);
  }
}

// Utility to clear plant inventory test data
async function clearPlantInventoryTestData() {
  try {
    console.log('🧹 Clearing plant inventory test restock data...');

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

    // Clear restock history from plant inventory items
    await PlantInventory.updateMany(
      {},
      { 
        $set: { 
          restockHistory: [],
          lastRestocked: null
        }
      }
    );

    console.log('✅ Plant inventory test restock data cleared successfully!');

  } catch (error) {
    console.error('❌ Error clearing plant inventory test restock data:', error);
  }
}

module.exports = {
  testPlantInventoryRestockFunctionality,
  addMultiplePlantInventoryRestocks,
  clearPlantInventoryTestData
};

// If running directly
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'add':
      testPlantInventoryRestockFunctionality();
      break;
    case 'add-multiple':
      addMultiplePlantInventoryRestocks();
      break;
    case 'clear':
      clearPlantInventoryTestData();
      break;
    default:
      console.log('Usage: node test-plant-restock-fix.js [add|add-multiple|clear]');
      console.log('  add: Add single plant inventory test restock entry');
      console.log('  add-multiple: Add multiple plant inventory test restock entries');
      console.log('  clear: Clear all plant inventory test restock data');
  }
}
