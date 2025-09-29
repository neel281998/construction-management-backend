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

    // Define role permissions (same as in User.js)
    const rolePermissions = {
      admin: [
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
      ],
      site_manager: [
        'site.read', 'site.update', // Can only read assigned sites and update progress
        'attendance.read', 'attendance.approve',
        'report.generate'
      ],
      supervisor: [
        'user.create', 'user.read', // Can view and create users
        'site.create', 'site.read', // Can view and create sites
        'vehicle.create', 'vehicle.read', // Can view and create vehicles
        'inventory.create', 'inventory.read', // Can view and create inventory
        'attendance.read', 'attendance.approve', // Can view and approve attendance
        'report.generate' // Can generate reports
        // Note: No update/delete permissions for supervisor
      ],
      worker: [
        'site.read',
        'attendance.create', 'attendance.read'
      ],
      inventory_manager: [
        'inventory.create', 'inventory.read', 'inventory.update', 'inventory.delete',
        'storage_site.read', 'storage_site.update',
        'report.generate'
      ],
      inventory_assistant: [
        'inventory.read', 'inventory.update',
        'storage_site.read'
      ],
      step_manager: [
        'step.create', 'step.read', 'step.update', 'step.delete',
        'site.read', // Can read sites to manage steps
        'user.read', // Can read users to assign to steps
        'report.generate' // Can generate step reports
      ],
      plant_manager: [
        'plant.read', 'plant.update', // Can read and update assigned plants
        'plant_inventory.read', 'plant_inventory.update',
        'plant_output.read', 'plant_output.update',
        'site.read', // Can read sites to manage plants
        'report.generate'
      ],
      plant_operator: [
        'plant.read', // Can read assigned plants
        'plant_inventory.read', 'plant_inventory.update',
        'plant_output.create', 'plant_output.read', 'plant_output.update',
        'site.read', // Can read sites
        'report.generate'
      ]
    };

    // Get all users
    const allUsers = await User.find({});
    console.log(`Found ${allUsers.length} total users`);

    let updatedCount = 0;

    // Update each user based on their role
    for (const user of allUsers) {
      const expectedPermissions = rolePermissions[user.role] || [];
      
      // Check if permissions need updating
      const currentPermissions = user.permissions || [];
      const needsUpdate = JSON.stringify(currentPermissions.sort()) !== JSON.stringify(expectedPermissions.sort());
      
      if (needsUpdate) {
        console.log(`Updating ${user.role} user: ${user.email}`);
        console.log(`   Current permissions: ${currentPermissions.length}`);
        console.log(`   Expected permissions: ${expectedPermissions.length}`);
        
        // Update permissions
        user.permissions = expectedPermissions;
        
        // Save the user
        await user.save();
        
        console.log(`   ✅ Updated permissions for ${user.email}`);
        updatedCount++;
      } else {
        console.log(`   ✅ ${user.email} (${user.role}) already has correct permissions`);
      }
    }

    console.log(`\n✅ Updated ${updatedCount} users successfully!`);
    
    // Verification by role
    console.log('\n📋 Verification by role:');
    for (const [role, expectedPermissions] of Object.entries(rolePermissions)) {
      const usersWithRole = await User.find({ role });
      console.log(`\n${role.toUpperCase()} (${usersWithRole.length} users):`);
      
      for (const user of usersWithRole) {
        const hasCorrectPermissions = JSON.stringify((user.permissions || []).sort()) === JSON.stringify(expectedPermissions.sort());
        console.log(`   ${user.email}: ${hasCorrectPermissions ? '✅' : '❌'} (${(user.permissions || []).length} permissions)`);
      }
    }

  } catch (error) {
    console.error('❌ Error updating user permissions:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the script
fixAllUserPermissions();
