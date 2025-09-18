const mongoose = require('mongoose');
const User = require('../models/User');

// Update admin permissions to include plant management
async function updateAdminPermissions() {
  try {
    console.log('Updating admin permissions...');
    
    const result = await User.updateMany(
      { role: 'admin' },
      {
        $addToSet: {
          permissions: {
            $each: [
              'plant.create', 'plant.read', 'plant.update', 'plant.delete',
              'plant_inventory.create', 'plant_inventory.read', 'plant_inventory.update', 'plant_inventory.delete',
              'plant_output.create', 'plant_output.read', 'plant_output.update', 'plant_output.delete'
            ]
          }
        }
      }
    );
    
    console.log(`Updated ${result.modifiedCount} admin users with plant permissions`);
    
    // Also update the role permissions for future users
    console.log('Admin permissions updated successfully!');
    
  } catch (error) {
    console.error('Error updating admin permissions:', error);
  }
}

// Run if called directly
if (require.main === module) {
  // Connect to MongoDB
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/construction-management';
  
  mongoose.connect(MONGODB_URI)
    .then(() => {
      console.log('Connected to MongoDB');
      return updateAdminPermissions();
    })
    .then(() => {
      console.log('Permission update completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error:', error);
      process.exit(1);
    });
}

module.exports = updateAdminPermissions;