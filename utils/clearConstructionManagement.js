const mongoose = require('mongoose');
require('dotenv').config();

async function clearConstructionManagement() {
  try {
    // Connect to the specific construction_management database
    const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://constructionchoudhary159632:EISf9b3Mbf8toQWe@cluster0.ug5nrys.mongodb.net/construction_management?retryWrites=true&w=majority&appName=Cluster0';
    
    console.log('Connecting to construction_management database...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to construction_management database');

    // Get the database instance
    const db = mongoose.connection.db;
    
    console.log('\n📊 Current construction_management database status:');
    
    // List all collections
    const collections = await db.listCollections().toArray();
    console.log(`Found ${collections.length} collections:`);
    
    for (const collection of collections) {
      const stats = await db.collection(collection.name).stats();
      console.log(`- ${collection.name}: ${stats.count} documents`);
    }

    if (collections.length === 0) {
      console.log('✅ construction_management database is already empty!');
      return;
    }

    console.log('\n🧹 Starting construction_management database cleanup...');
    console.log('⚠️  This will DROP ALL COLLECTIONS from construction_management database!');

    // Drop all collections
    for (const collection of collections) {
      try {
        console.log(`Dropping ${collection.name}...`);
        await db.collection(collection.name).drop();
        console.log(`✅ Dropped collection: ${collection.name}`);
      } catch (error) {
        console.log(`❌ Error dropping ${collection.name}:`, error.message);
      }
    }

    console.log('\n✅ construction_management database cleanup completed!');
    console.log('🗑️  All collections have been dropped from construction_management database.');

    // Verify cleanup
    const remainingCollections = await db.listCollections().toArray();
    console.log(`📊 Remaining collections in construction_management: ${remainingCollections.length}`);

    if (remainingCollections.length === 0) {
      console.log('🎉 construction_management database is now completely empty!');
    } else {
      console.log('⚠️  Some collections still exist:');
      for (const collection of remainingCollections) {
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

// Run the cleanup
clearConstructionManagement();

