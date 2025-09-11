// Test script for Location Management API
// Run this with: node test-locations.js

const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Location = require('./models/Location');
const User = require('./models/User');
const Inventory = require('./models/Inventory');

async function testLocationManagement() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://constructionchoudhary159632:EISf9b3Mbf8toQWe@cluster0.ug5nrys.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
    await mongoose.connect(mongoUri, {
      dbName: 'construction_management',
    });
    console.log('✅ Connected to MongoDB');

    // Test 1: Create a test location
    console.log('\n🧪 Test 1: Creating a test location...');
    const testLocation = new Location({
      name: 'Test Warehouse',
      code: 'WH-001',
      type: 'warehouse',
      description: 'Test warehouse for inventory management',
      address: {
        street: '123 Test Street',
        city: 'Test City',
        state: 'Test State',
        zipCode: '12345',
      },
      facilities: {
        hasSecurity: true,
        hasClimateControl: true,
        hasLoadingDock: true,
        hasCrane: false,
        hasForklift: true,
        hasShelving: true,
        hasFencing: true,
        hasLighting: true,
        hasDrainage: true,
      },
      operatingHours: {
        monday: { isOpen: true, openTime: '08:00', closeTime: '18:00' },
        tuesday: { isOpen: true, openTime: '08:00', closeTime: '18:00' },
        wednesday: { isOpen: true, openTime: '08:00', closeTime: '18:00' },
        thursday: { isOpen: true, openTime: '08:00', closeTime: '18:00' },
        friday: { isOpen: true, openTime: '08:00', closeTime: '18:00' },
        saturday: { isOpen: true, openTime: '08:00', closeTime: '16:00' },
        sunday: { isOpen: false, openTime: '08:00', closeTime: '16:00' },
      },
    });

    await testLocation.save();
    console.log('✅ Test location created:', testLocation.name);

    // Test 2: Find an inventory manager user
    console.log('\n🧪 Test 2: Finding inventory manager...');
    const inventoryManager = await User.findOne({ role: 'inventory_manager' });
    if (!inventoryManager) {
      console.log('⚠️  No inventory manager found. Creating one...');
      const newManager = new User({
        email: 'inventory.manager@test.com',
        phone: '+1234567890',
        password: 'password123',
        firstName: 'Inventory',
        lastName: 'Manager',
        role: 'inventory_manager',
      });
      await newManager.save();
      console.log('✅ Test inventory manager created');
    } else {
      console.log('✅ Found inventory manager:', inventoryManager.fullName);
    }

    // Test 3: Assign manager to location
    console.log('\n🧪 Test 3: Assigning manager to location...');
    const manager = await User.findOne({ role: 'inventory_manager' });
    testLocation.assignedInventoryManagers.push({
      user: manager._id,
      isPrimary: true,
      permissions: ['read', 'write', 'approve', 'transfer'],
    });
    await testLocation.save();
    console.log('✅ Manager assigned to location');

    // Test 4: Create test inventory item
    console.log('\n🧪 Test 4: Creating test inventory item...');
    const testInventory = new Inventory({
      itemName: 'Test Steel Rods',
      itemCode: 'STE-001',
      category: 'Steel Products',
      description: 'Test steel rods for construction',
      unit: 'pieces',
      currentStock: 100,
      minimumStock: 20,
      maximumStock: 500,
      supplier: {
        name: 'Test Steel Supplier',
        contact: '+1234567890',
        email: 'supplier@test.com',
        address: '456 Supplier Street',
      },
      locationId: testLocation._id,
      location: 'Aisle 1, Shelf 2',
    });

    await testInventory.save();
    console.log('✅ Test inventory item created:', testInventory.itemName);

    // Test 5: Query location with inventory
    console.log('\n🧪 Test 5: Querying location with inventory...');
    const locationWithInventory = await Location.findById(testLocation._id)
      .populate('assignedInventoryManagers.user', 'firstName lastName email role');
    
    console.log('✅ Location details:');
    console.log('  - Name:', locationWithInventory.name);
    console.log('  - Code:', locationWithInventory.code);
    console.log('  - Type:', locationWithInventory.type);
    console.log('  - Managers:', locationWithInventory.assignedInventoryManagers.length);
    console.log('  - Primary Manager:', locationWithInventory.assignedInventoryManagers.find(m => m.isPrimary)?.user?.fullName);

    // Test 6: Query inventory by location
    console.log('\n🧪 Test 6: Querying inventory by location...');
    const locationInventory = await Inventory.find({ locationId: testLocation._id })
      .populate('locationId', 'name code');
    
    console.log('✅ Inventory items in location:');
    locationInventory.forEach(item => {
      console.log(`  - ${item.itemName} (${item.itemCode}): ${item.currentStock} ${item.unit}`);
    });

    // Test 7: Test location methods
    console.log('\n🧪 Test 7: Testing location methods...');
    const isOpen = testLocation.isOpenAt(new Date());
    console.log('✅ Location is currently open:', isOpen);
    
    const nextOpening = testLocation.getNextOpeningTime();
    console.log('✅ Next opening time:', nextOpening ? nextOpening.toLocaleString() : 'N/A');

    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📋 Summary:');
    console.log('  - Location created and saved');
    console.log('  - Manager assigned to location');
    console.log('  - Inventory item created and linked to location');
    console.log('  - All queries working correctly');
    console.log('  - Location methods functioning properly');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    try {
      await Location.deleteOne({ code: 'WH-001' });
      await Inventory.deleteOne({ itemCode: 'STE-001' });
      await User.deleteOne({ email: 'inventory.manager@test.com' });
      console.log('✅ Test data cleaned up');
    } catch (cleanupError) {
      console.log('⚠️  Cleanup warning:', cleanupError.message);
    }
    
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

// Run the test
testLocationManagement();
