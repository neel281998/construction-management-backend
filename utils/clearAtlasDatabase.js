const mongoose = require('mongoose');
require('dotenv').config();

async function clearAtlasDatabase() {
  try {
    // Use the actual MongoDB Atlas connection string
    const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://constructionchoudhary159632:EISf9b3Mbf8toQWe@cluster0.ug5nrys.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
    
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB Atlas');

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

    if (collections.length === 0) {
      console.log('✅ Database is already empty!');
      return;
    }

    console.log('\n🧹 Starting database cleanup...');
    console.log('⚠️  This will DROP ALL COLLECTIONS from your MongoDB Atlas database!');

    // Drop all collections
    for (const collection of collections) {
      try {
        await db.collection(collection.name).drop();
        console.log(`✅ Dropped collection: ${collection.name}`);
      } catch (error) {
        console.log(`❌ Error dropping ${collection.name}:`, error.message);
      }
    }

    console.log('\n✅ Database cleanup completed!');
    console.log('🗑️  All collections have been dropped from your MongoDB Atlas database.');

    // Verify cleanup
    const remainingCollections = await db.listCollections().toArray();
    console.log(`📊 Remaining collections: ${remainingCollections.length}`);

    if (remainingCollections.length === 0) {
      console.log('🎉 Database is now completely empty!');
    }

  } catch (error) {
    console.error('❌ Error during database cleanup:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB Atlas');
  }
}

// Run the cleanup
clearAtlasDatabase();

