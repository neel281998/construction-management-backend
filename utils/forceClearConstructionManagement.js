const mongoose = require('mongoose');
require('dotenv').config();

async function forceClearConstructionManagement() {
  try {
    // Connect to the specific construction_management database
    const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://constructionchoudhary159632:EISf9b3Mbf8toQWe@cluster0.ug5nrys.mongodb.net/construction_management?retryWrites=true&w=majority&appName=Cluster0';
    
    console.log('Connecting to construction_management database...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to construction_management database');

    // Get the database instance
    const db = mongoose.connection.db;
    
    console.log('\n📊 Current construction_management database status:');
    
    // List all collections including system collections
    const collections = await db.listCollections({}, { nameOnly: false }).toArray();
    console.log(`Found ${collections.length} collections:`);
    
    for (const collection of collections) {
      try {
        const stats = await db.collection(collection.name).stats();
        console.log(`- ${collection.name}: ${stats.count} documents`);
      } catch (error) {
        console.log(`- ${collection.name}: Error getting stats - ${error.message}`);
      }
    }

    console.log('\n🧹 Starting FORCE construction_management database cleanup...');
    console.log('⚠️  This will DROP ALL COLLECTIONS from construction_management database!');

    // Force drop all collections
    for (const collection of collections) {
      try {
        console.log(`Dropping ${collection.name}...`);
        await db.collection(collection.name).drop();
        console.log(`✅ Dropped collection: ${collection.name}`);
      } catch (error) {
        console.log(`❌ Error dropping ${collection.name}:`, error.message);
      }
    }

    // Also try to delete all documents from each collection as a fallback
    console.log('\n🔄 Attempting to delete all documents from remaining collections...');
    const remainingCollections = await db.listCollections().toArray();
    
    for (const collection of remainingCollections) {
      try {
        const result = await db.collection(collection.name).deleteMany({});
        console.log(`✅ Deleted ${result.deletedCount} documents from ${collection.name}`);
      } catch (error) {
        console.log(`❌ Error deleting from ${collection.name}:`, error.message);
      }
    }

    console.log('\n✅ FORCE construction_management database cleanup completed!');
    console.log('🗑️  All data has been cleared from construction_management database.');

    // Final verification
    const finalCollections = await db.listCollections().toArray();
    console.log(`📊 Final remaining collections in construction_management: ${finalCollections.length}`);

    if (finalCollections.length === 0) {
      console.log('🎉 construction_management database is now completely empty!');
    } else {
      console.log('⚠️  Some collections still exist:');
      for (const collection of finalCollections) {
        console.log(`- ${collection.name}`);
      }
    }

  } catch (error) {
    console.error('❌ Error during construction_management database cleanup:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from construction_management database');
  }
}

// Run the force cleanup
forceClearConstructionManagement();

