const mongoose = require('mongoose');
const Inventory = require('./models/Inventory');
const Vehicle = require('./models/Vehicle');
const User = require('./models/User');

// Test script to verify restock functionality works correctly
async function testRestockFunctionality() {
  try {
    console.log('🧪 Testing restock functionality...');

    // Find an existing inventory item
    const inventoryItem = await Inventory.findOne();
    if (!inventoryItem) {
      console.log('❌ No inventory items found. Please create an inventory item first.');
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

    console.log('📦 Testing with inventory item:', inventoryItem.itemName);
    console.log('🚗 Testing with vehicle:', vehicle.vehicleNumber);
    console.log('👤 Testing with user:', user.name);

    const initialStock = inventoryItem.currentStock;
    const initialHistoryLength = inventoryItem.restockHistory.length;

    console.log('📊 Initial state:');
    console.log(`   - Current Stock: ${initialStock}`);
    console.log(`   - Restock History Length: ${initialHistoryLength}`);

    // Test the restock method
    const testRestockData = {
      quantity: 25,
      supplier: 'Test Supplier',
      restockedBy: user._id,
      notes: 'Test restock to verify vehicle details are saved',
      vehicle: {
        _id: vehicle._id,
        vehicleNumber: vehicle.vehicleNumber,
        vehicleType: vehicle.type
      },
      cost: 1500
    };

    console.log('🔄 Calling restock method...');
    await inventoryItem.restock(
      testRestockData.quantity,
      testRestockData.supplier,
      testRestockData.restockedBy,
      testRestockData.notes,
      testRestockData.vehicle,
      testRestockData.cost
    );

    // Refresh the item from database
    const updatedItem = await Inventory.findById(inventoryItem._id);

    console.log('📊 Final state:');
    console.log(`   - Current Stock: ${updatedItem.currentStock}`);
    console.log(`   - Restock History Length: ${updatedItem.restockHistory.length}`);
    console.log(`   - Last Restocked: ${updatedItem.lastRestocked}`);

    // Check if the restock history was properly added
    if (updatedItem.restockHistory.length > initialHistoryLength) {
      const lastRestock = updatedItem.restockHistory[updatedItem.restockHistory.length - 1];
      console.log('✅ Restock history entry added successfully!');
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
      console.log('❌ Restock history was not added!');
    }

    // Check if stock was updated
    if (updatedItem.currentStock === initialStock + testRestockData.quantity) {
      console.log('✅ Stock updated correctly!');
    } else {
      console.log('❌ Stock was not updated correctly!');
    }

    console.log('🎉 Test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
if (require.main === module) {
  testRestockFunctionality().then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error('Test error:', error);
    process.exit(1);
  });
}

module.exports = { testRestockFunctionality };

