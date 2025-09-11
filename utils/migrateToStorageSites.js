const mongoose = require('mongoose');
const Inventory = require('../models/Inventory');
const StorageSite = require('../models/StorageSite');
const User = require('../models/User');

/**
 * Migration script to convert existing inventory system to storage site-based system
 * 
 * This script will:
 * 1. Create a default "Main Storage" storage site
 * 2. Migrate all existing inventory items to this default storage site
 * 3. Remove the old location field and itemCode field from inventory items
 * 4. Update inventory managers to have access to the default storage site
 */

async function migrateToStorageSites() {
  try {
    console.log('🚀 Starting migration to storage site system...');
    
    // Step 1: Create default "Main Storage" storage site
    console.log('📦 Creating default "Main Storage" storage site...');
    
    let defaultStorageSite = await StorageSite.findOne({ name: 'Main Storage' });
    
    if (!defaultStorageSite) {
      defaultStorageSite = new StorageSite({
        name: 'Main Storage',
        code: 'MS-001',
        description: 'Default storage site for migrated inventory items',
        address: {
          street: 'Main Storage Yard',
          city: 'Default City',
          state: 'Default State',
          zipCode: '00000'
        },
        isActive: true
      });
      
      await defaultStorageSite.save();
      console.log('✅ Default storage site created:', defaultStorageSite.name);
    } else {
      console.log('ℹ️  Default storage site already exists:', defaultStorageSite.name);
    }
    
    // Step 2: Get all existing inventory items
    console.log('📋 Fetching existing inventory items...');
    const existingInventory = await Inventory.find({ isActive: true });
    console.log(`📊 Found ${existingInventory.length} inventory items to migrate`);
    
    // Step 3: Migrate inventory items
    console.log('🔄 Migrating inventory items...');
    let migratedCount = 0;
    let skippedCount = 0;
    
    for (const item of existingInventory) {
      try {
        // Check if item already has a storage site (already migrated)
        if (item.storageSite) {
          console.log(`⏭️  Skipping item "${item.itemName}" - already has storage site`);
          skippedCount++;
          continue;
        }
        
        // Update the item to use the default storage site
        item.storageSite = defaultStorageSite._id;
        
        // Remove the old location field if it exists
        if (item.location) {
          delete item.location;
        }
        
        // Remove the old itemCode field if it exists
        if (item.itemCode) {
          delete item.itemCode;
        }
        
        await item.save();
        migratedCount++;
        
        if (migratedCount % 10 === 0) {
          console.log(`📈 Migrated ${migratedCount} items...`);
        }
        
      } catch (error) {
        console.error(`❌ Error migrating item "${item.itemName}":`, error.message);
      }
    }
    
    console.log(`✅ Migration completed: ${migratedCount} items migrated, ${skippedCount} items skipped`);
    
    // Step 4: Update inventory managers to have access to default storage site
    console.log('👥 Updating inventory managers...');
    
    const inventoryManagers = await User.find({
      role: { $in: ['inventory_manager', 'inventory_assistant'] },
      isActive: true
    });
    
    let updatedManagers = 0;
    
    for (const manager of inventoryManagers) {
      if (!manager.assignedStorageSites.includes(defaultStorageSite._id)) {
        manager.assignedStorageSites.push(defaultStorageSite._id);
        await manager.save();
        updatedManagers++;
      }
    }
    
    console.log(`✅ Updated ${updatedManagers} inventory managers with access to default storage site`);
    
    // Step 5: Create additional storage sites if needed
    console.log('🏗️  Creating additional storage sites...');
    
    const additionalSites = [
      {
        name: 'Site A Yard',
        code: 'SA-001',
        description: 'Storage yard for Site A operations',
        address: {
          street: 'Site A Storage Yard',
          city: 'Default City',
          state: 'Default State',
          zipCode: '00001'
        }
      },
      {
        name: 'Bridge Yard',
        code: 'BY-001',
        description: 'Storage yard for bridge construction materials',
        address: {
          street: 'Bridge Construction Yard',
          city: 'Default City',
          state: 'Default State',
          zipCode: '00002'
        }
      }
    ];
    
    let createdSites = 0;
    
    for (const siteData of additionalSites) {
      const existingSite = await StorageSite.findOne({ name: siteData.name });
      
      if (!existingSite) {
        const newSite = new StorageSite(siteData);
        await newSite.save();
        createdSites++;
        console.log(`✅ Created storage site: ${newSite.name}`);
      } else {
        console.log(`ℹ️  Storage site already exists: ${existingSite.name}`);
      }
    }
    
    console.log(`✅ Created ${createdSites} additional storage sites`);
    
    // Step 6: Summary
    console.log('\n🎉 Migration Summary:');
    console.log(`📦 Default storage site: ${defaultStorageSite.name} (${defaultStorageSite.code})`);
    console.log(`📋 Inventory items migrated: ${migratedCount}`);
    console.log(`👥 Inventory managers updated: ${updatedManagers}`);
    console.log(`🏗️  Additional storage sites created: ${createdSites}`);
    console.log('\n✨ Migration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Review and update storage site details as needed');
    console.log('2. Assign inventory managers to specific storage sites');
    console.log('3. Transfer inventory items between storage sites as needed');
    console.log('4. Update frontend components to use the new storage site system');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

/**
 * Rollback function to revert the migration
 * WARNING: This will remove all storage site references and restore the old system
 */
async function rollbackMigration() {
  try {
    console.log('⚠️  Starting rollback of storage site migration...');
    console.log('⚠️  WARNING: This will remove all storage site references!');
    
    // Get all inventory items with storage sites
    const inventoryWithStorageSites = await Inventory.find({ 
      storageSite: { $exists: true },
      isActive: true 
    });
    
    console.log(`📋 Found ${inventoryWithStorageSites.length} inventory items to rollback`);
    
    let rollbackCount = 0;
    
    for (const item of inventoryWithStorageSites) {
      // Remove storage site reference
      item.storageSite = undefined;
      
      // Add back a default location if it doesn't exist
      if (!item.location) {
        item.location = 'Main Storage';
      }
      
      await item.save();
      rollbackCount++;
    }
    
    console.log(`✅ Rolled back ${rollbackCount} inventory items`);
    
    // Remove storage sites (optional - comment out if you want to keep them)
    // const deletedSites = await StorageSite.deleteMany({});
    // console.log(`🗑️  Deleted ${deletedSites.deletedCount} storage sites`);
    
    // Clear assigned storage sites from users
    await User.updateMany(
      { assignedStorageSites: { $exists: true } },
      { $unset: { assignedStorageSites: 1 } }
    );
    
    console.log('✅ Cleared assigned storage sites from users');
    console.log('✅ Rollback completed successfully!');
    
  } catch (error) {
    console.error('❌ Rollback failed:', error);
    throw error;
  }
}

// Export functions for use in other scripts
module.exports = {
  migrateToStorageSites,
  rollbackMigration
};

// Run migration if this file is executed directly
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'rollback') {
    rollbackMigration()
      .then(() => process.exit(0))
      .catch((error) => {
        console.error('Rollback failed:', error);
        process.exit(1);
      });
  } else {
    migrateToStorageSites()
      .then(() => process.exit(0))
      .catch((error) => {
        console.error('Migration failed:', error);
        process.exit(1);
      });
  }
}
