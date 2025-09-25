const mongoose = require('mongoose');
const User = require('../models/User');
const StorageSite = require('../models/StorageSite');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://constructionchoudhary159632:EISf9b3Mbf8toQWe@cluster0.ug5nrys.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0');

async function assignAdminToStorageSites() {
  try {
    console.log('✅ Connected to MongoDB for admin storage site assignment');

    // Get all storage sites
    const storageSites = await StorageSite.find({});
    const storageSiteIds = storageSites.map(site => site._id);
    
    console.log(`Found ${storageSites.length} storage sites:`, storageSites.map(s => s.name));

    // Update admin users to have access to all storage sites
    const adminUsers = await User.find({ role: 'admin' });
    for (const user of adminUsers) {
      user.assignedStorageSites = storageSiteIds;
      await user.save();
      console.log(`✅ Assigned all storage sites to admin: ${user.email}`);
    }

    // Update inventory managers to have access to all storage sites
    const inventoryManagers = await User.find({ role: 'inventory_manager' });
    for (const user of inventoryManagers) {
      user.assignedStorageSites = storageSiteIds;
      await user.save();
      console.log(`✅ Assigned all storage sites to inventory manager: ${user.email}`);
    }

    console.log('✅ All users assigned to storage sites successfully!');

  } catch (error) {
    console.error('❌ Error assigning storage sites:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

assignAdminToStorageSites();


















