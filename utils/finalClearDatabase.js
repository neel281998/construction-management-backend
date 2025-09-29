const mongoose = require('mongoose');
require('dotenv').config();

async function finalClearDatabase() {
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

    console.log('\n🧹 Starting FINAL database cleanup...');
    console.log('⚠️  This will DROP ALL COLLECTIONS from your MongoDB Atlas database!');

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

    // Also try to drop the entire database and recreate it
    try {
      console.log('\n🔄 Attempting to drop entire database...');
      await db.dropDatabase();
      console.log('✅ Database dropped successfully');
    } catch (error) {
      console.log('❌ Error dropping database:', error.message);
    }

    console.log('\n✅ FINAL database cleanup completed!');
    console.log('🗑️  All data has been cleared from your MongoDB Atlas database.');

    // Verify cleanup
    const remainingCollections = await db.listCollections().toArray();
    console.log(`📊 Remaining collections: ${remainingCollections.length}`);

    if (remainingCollections.length === 0) {
      console.log('🎉 Database is now completely empty!');
    } else {
      console.log('⚠️  Some collections still exist:');
      for (const collection of remainingCollections) {
        console.log(`- ${collection.name}`);
      }
    }

  } catch (error) {
    console.error('❌ Error during database cleanup:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB Atlas');
  }
}

// Run the final cleanup
finalClearDatabase();

