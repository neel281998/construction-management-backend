const mongoose = require('mongoose');
require('dotenv').config();

async function forceClearDatabase() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/construction-management';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Get the database instance
    const db = mongoose.connection.db;
    
    console.log('\n📊 Current database status:');
    
    // List all collections
    const collections = await db.listCollections().toArray();
    console.log(`Found ${collections.length} collections:`);
    
    for (const collection of collections) {
      const stats = await db.collection(collection.name).stats();
      console.log(`- ${collection.name}: ${stats.count} documents`);
    }

    console.log('\n🧹 Starting FORCE database cleanup...');
    console.log('⚠️  This will DROP ALL COLLECTIONS!');

    // Drop all collections
    for (const collection of collections) {
      try {
        await db.collection(collection.name).drop();
        console.log(`✅ Dropped collection: ${collection.name}`);
      } catch (error) {
        console.log(`❌ Error dropping ${collection.name}:`, error.message);
      }
    }

    console.log('\n✅ FORCE database cleanup completed!');
    console.log('🗑️  All collections have been dropped from the database.');

    // Verify cleanup
    const remainingCollections = await db.listCollections().toArray();
    console.log(`📊 Remaining collections: ${remainingCollections.length}`);

  } catch (error) {
    console.error('❌ Error during database cleanup:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the force cleanup
forceClearDatabase();

