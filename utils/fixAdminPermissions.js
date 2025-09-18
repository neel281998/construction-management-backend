const mongoose = require('mongoose');

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://neelpatel:neelpatel123@cluster0.8qjqg.mongodb.net/construction-management?retryWrites=true&w=majority';

async function fixAdminPermissions() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get the User model
    const User = require('../models/User');

    // Find all admin users
    const adminUsers = await User.find({ role: 'admin' });
    console.log(`Found ${adminUsers.length} admin users`);

    // Define the complete admin permissions including plant permissions
    const adminPermissions = [
      'user.create', 'user.read', 'user.update', 'user.delete',
      'site.create', 'site.read', 'site.update', 'site.delete',
      'vehicle.create', 'vehicle.read', 'vehicle.update', 'vehicle.delete',
      'inventory.create', 'inventory.read', 'inventory.update', 'inventory.delete',
      'storage_site.create', 'storage_site.read', 'storage_site.update', 'storage_site.delete',
      'plant.create', 'plant.read', 'plant.update', 'plant.delete',
      'plant_inventory.create', 'plant_inventory.read', 'plant_inventory.update', 'plant_inventory.delete',
      'plant_output.create', 'plant_output.read', 'plant_output.update', 'plant_output.delete',
      'attendance.read', 'attendance.approve',
      'report.generate', 'report.export'
    ];

    // Update each admin user
    for (const admin of adminUsers) {
      console.log(`Updating admin: ${admin.email}`);
      
      // Update permissions
      admin.permissions = adminPermissions;
      
      // Save the user
      await admin.save();
      
      console.log(`✅ Updated permissions for ${admin.email}`);
      console.log(`   Permissions: ${admin.permissions.length} total`);
    }

    console.log('✅ All admin users updated successfully!');
    
    // Verify the update
    const updatedAdmins = await User.find({ role: 'admin' });
    console.log('\n📋 Verification:');
    for (const admin of updatedAdmins) {
      console.log(`   ${admin.email}: ${admin.permissions.length} permissions`);
      console.log(`   Has plant permissions: ${admin.permissions.includes('plant.create')}`);
    }

  } catch (error) {
    console.error('❌ Error updating admin permissions:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
fixAdminPermissions();
