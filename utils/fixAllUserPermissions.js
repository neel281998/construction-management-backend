const mongoose = require('mongoose');

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://neelpatel:neelpatel123@cluster0.8qjqg.mongodb.net/construction-management?retryWrites=true&w=majority';

async function fixAllUserPermissions() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get the User model
    const User = require('../models/User');

    // Only ensure admins have full permissions; non-admin users are managed manually
    const adminPermissions = [
      'user.create', 'user.read', 'user.update', 'user.delete',
      'site.create', 'site.read', 'site.update', 'site.delete',
      'vehicle.create', 'vehicle.read', 'vehicle.update', 'vehicle.delete',
      'inventory.create', 'inventory.read', 'inventory.update', 'inventory.delete',
      'storage_site.create', 'storage_site.read', 'storage_site.update', 'storage_site.delete',
      'plant.create', 'plant.read', 'plant.update', 'plant.delete',
      'plant_inventory.create', 'plant_inventory.read', 'plant_inventory.update', 'plant_inventory.delete', 'plant_inventory.transfer',
      'plant_output.create', 'plant_output.read', 'plant_output.update', 'plant_output.delete',
      'fuel.create', 'fuel.read', 'fuel.update', 'fuel.delete', 'fuel.restock', 'fuel.reading', 'fuel.refuel',
      'attendance.read', 'attendance.approve',
      'report.generate', 'report.export'
    ];

    const result = await User.updateMany(
      { role: 'admin' },
      { $set: { permissions: adminPermissions, hasCustomPermissions: false } }
    );

    console.log(`\n✅ Updated ${result.modifiedCount} admin users. Non-admin users left unchanged.`);

  } catch (error) {
    console.error('❌ Error updating user permissions:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the script
fixAllUserPermissions();


