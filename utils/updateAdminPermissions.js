const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');

async function updateAdminPermissions() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://constructionchoudhary159632:EISf9b3Mbf8toQWe@cluster0.ug5nrys.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
    await mongoose.connect(mongoUri, {
      dbName: 'construction_management',
    });
    console.log('✅ Connected to MongoDB for permission update');

    // Find all admin users
    const adminUsers = await User.find({ role: 'admin' });
    console.log(`Found ${adminUsers.length} admin users`);

    for (const user of adminUsers) {
      console.log(`Updating permissions for admin: ${user.email}`);
      
      // Update permissions to include storage site permissions
      user.permissions = [
        'user.create', 'user.read', 'user.update', 'user.delete',
        'site.create', 'site.read', 'site.update', 'site.delete',
        'vehicle.create', 'vehicle.read', 'vehicle.update', 'vehicle.delete',
        'inventory.create', 'inventory.read', 'inventory.update', 'inventory.delete',
        'storage_site.create', 'storage_site.read', 'storage_site.update', 'storage_site.delete',
        'attendance.read', 'attendance.approve',
        'report.generate', 'report.export'
      ];

      await user.save();
      console.log(`✅ Updated permissions for ${user.email}`);
    }

    // Also update inventory managers
    const inventoryManagers = await User.find({ role: 'inventory_manager' });
    console.log(`Found ${inventoryManagers.length} inventory managers`);

    for (const user of inventoryManagers) {
      console.log(`Updating permissions for inventory manager: ${user.email}`);
      
      user.permissions = [
        'inventory.create', 'inventory.read', 'inventory.update', 'inventory.delete',
        'storage_site.read', 'storage_site.update',
        'report.generate'
      ];

      await user.save();
      console.log(`✅ Updated permissions for ${user.email}`);
    }

    // Also update inventory assistants
    const inventoryAssistants = await User.find({ role: 'inventory_assistant' });
    console.log(`Found ${inventoryAssistants.length} inventory assistants`);

    for (const user of inventoryAssistants) {
      console.log(`Updating permissions for inventory assistant: ${user.email}`);
      
      user.permissions = [
        'inventory.read', 'inventory.update',
        'storage_site.read'
      ];

      await user.save();
      console.log(`✅ Updated permissions for ${user.email}`);
    }

    console.log('✅ All user permissions updated successfully!');
  } catch (error) {
    console.error('❌ Permission update failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

updateAdminPermissions();









