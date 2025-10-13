const mongoose = require('mongoose');
const Inventory = require('./models/Inventory');
const Vehicle = require('./models/Vehicle');
const User = require('./models/User');

// Test script to verify inventory restock with vehicle tracking
async function testInventoryRestock() {
  try {
    console.log('🧪 Testing Inventory Restock with Vehicle Tracking...\n');

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/construction-management');
    console.log('✅ Connected to database');

    // Find an inventory item
    const inventoryItem = await Inventory.findOne();
    if (!inventoryItem) {
      console.log('❌ No inventory item found. Please create an inventory item first.');
      return;
    }
    console.log(`📦 Found inventory item: ${inventoryItem.materialName}`);

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

    console.log('\n🔄 Performing restock operation...');

    // Perform restock
    await inventoryItem.restock(
      100, // quantity
      'Test Supplier', // supplier
      user._id, // performedBy
      'Test restock with vehicle tracking', // notes
      vehicle, // vehicle
      5000 // cost
    );

    console.log('✅ Restock completed successfully');

    // Reload the item to see updated data
    const updatedItem = await Inventory.findById(inventoryItem._id);
    
    console.log('\n📊 Updated inventory item data:');
    console.log(`  Current Stock: ${updatedItem.currentStock}`);
    console.log(`  Last Restocked: ${updatedItem.lastRestocked}`);
    console.log(`  Restock History Count: ${updatedItem.restockHistory.length}`);

    if (updatedItem.restockHistory.length > 0) {
      const lastRestock = updatedItem.restockHistory[updatedItem.restockHistory.length - 1];
      console.log('\n🚗 Last restock vehicle details:');
      console.log(`  Vehicle: ${lastRestock.vehicle.vehicleNumber}`);
      console.log(`  Type: ${lastRestock.vehicle.vehicleType}`);
      console.log(`  Quantity: ${lastRestock.quantity}`);
      console.log(`  Supplier: ${lastRestock.supplier}`);
      console.log(`  Cost: ₹${lastRestock.cost}`);
      console.log(`  Date: ${lastRestock.date}`);
    }

    console.log('\n✅ Inventory restock test completed successfully!');
    console.log('🎯 Now you should see vehicle details in the inventory detail page.');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
}

// Run the test
if (require.main === module) {
  testInventoryRestock();
}

module.exports = { testInventoryRestock };

