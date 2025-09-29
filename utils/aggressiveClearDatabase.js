const mongoose = require('mongoose');
require('dotenv').config();

async function aggressiveClearDatabase() {
  try {
    console.log('🚀 Starting AGGRESSIVE database cleanup...');
    
    // Try multiple connection strings to ensure we're hitting the right database
    const connectionStrings = [
      process.env.MONGODB_URI,
      'mongodb+srv://constructionchoudhary159632:EISf9b3Mbf8toQWe@cluster0.ug5nrys.mongodb.net/construction_management?retryWrites=true&w=majority&appName=Cluster0',
      'mongodb+srv://constructionchoudhary159632:EISf9b3Mbf8toQWe@cluster0.ug5nrys.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0'
    ];

    for (let i = 0; i < connectionStrings.length; i++) {
      const mongoUri = connectionStrings[i];
      if (!mongoUri) continue;

      console.log(`\n🔗 Attempting connection ${i + 1}: ${mongoUri.split('@')[1]?.split('/')[0] || 'Unknown'}`);
      
      try {
        await mongoose.connect(mongoUri);
        console.log('✅ Connected successfully');

        const db = mongoose.connection.db;
        const dbName = db.databaseName;
        console.log(`📊 Database name: ${dbName}`);

        // List all collections
        const collections = await db.listCollections().toArray();
        console.log(`Found ${collections.length} collections in ${dbName}:`);

        for (const collection of collections) {
          try {
            const stats = await db.collection(collection.name).stats();
            console.log(`- ${collection.name}: ${stats.count} documents`);
          } catch (error) {
            console.log(`- ${collection.name}: Error getting stats`);
          }
        }

        if (collections.length > 0) {
          console.log(`\n🧹 Clearing ${collections.length} collections from ${dbName}...`);
          
          // Drop all collections
          for (const collection of collections) {
            try {
              console.log(`Dropping ${collection.name}...`);
              await db.collection(collection.name).drop();
              console.log(`✅ Dropped: ${collection.name}`);
            } catch (error) {
              console.log(`❌ Error dropping ${collection.name}: ${error.message}`);
            }
          }

          // Also try to delete all documents as fallback
          console.log('\n🔄 Fallback: Deleting all documents from remaining collections...');
          const remainingCollections = await db.listCollections().toArray();
          
          for (const collection of remainingCollections) {
            try {
              const result = await db.collection(collection.name).deleteMany({});
              console.log(`✅ Deleted ${result.deletedCount} documents from ${collection.name}`);
            } catch (error) {
              console.log(`❌ Error deleting from ${collection.name}: ${error.message}`);
            }
          }

          console.log(`✅ ${dbName} cleanup completed!`);
        } else {
          console.log(`✅ ${dbName} is already empty`);
        }

        await mongoose.disconnect();
        console.log(`Disconnected from ${dbName}`);

      } catch (error) {
        console.log(`❌ Connection failed: ${error.message}`);
        if (mongoose.connection.readyState === 1) {
          await mongoose.disconnect();
        }
      }
    }

    console.log('\n🎉 AGGRESSIVE database cleanup completed!');
    console.log('🗑️  All accessible databases have been cleared.');

  } catch (error) {
    console.error('❌ Error during aggressive cleanup:', error);
  }
}

// Run the aggressive cleanup
aggressiveClearDatabase();

