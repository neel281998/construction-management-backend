const mongoose = require('mongoose');
require('dotenv').config();

// Database connection strings
const SOURCE_DB = 'test';
const TARGET_DB = 'construction_management';
const mongoUri = 'mongodb+srv://constructionchoudhary159632:EISf9b3Mbf8toQWe@cluster0.ug5nrys.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function migrateDatabase() {
  try {
    console.log('🔄 Starting database migration...');
    console.log(`📤 Source: ${SOURCE_DB}`);
    console.log(`📥 Target: ${TARGET_DB}`);

    // Connect to source database
    const sourceConnection = await mongoose.createConnection(mongoUri, {
      dbName: SOURCE_DB,
      bufferCommands: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
    });

    // Connect to target database
    const targetConnection = await mongoose.createConnection(mongoUri, {
      dbName: TARGET_DB,
      bufferCommands: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
    });

    // Wait for connections to be ready
    await sourceConnection.asPromise();
    await targetConnection.asPromise();

    console.log('✅ Connected to both databases');

    // Collections to migrate
    const collections = [
      'attendances',
      'inventories', 
      'siteinventories',
      'sites',
      'steps',
      'stocks',
      'users',
      'vehicles'
    ];

    for (const collectionName of collections) {
      try {
        console.log(`\n📋 Processing collection: ${collectionName}`);
        
        // Get source collection
        const sourceCollection = sourceConnection.collection(collectionName);
        const targetCollection = targetConnection.collection(collectionName);

        // Count documents in source
        const sourceCount = await sourceCollection.countDocuments();
        console.log(`   📊 Source documents: ${sourceCount}`);

        if (sourceCount === 0) {
          console.log(`   ⏭️  Skipping empty collection: ${collectionName}`);
          continue;
        }

        // Check if target collection exists and has data
        const targetCount = await targetCollection.countDocuments();
        console.log(`   📊 Target documents: ${targetCount}`);

        if (targetCount > 0) {
          console.log(`   ⚠️  Target collection already has data. Skipping to avoid duplicates.`);
          continue;
        }

        // Get all documents from source
        const documents = await sourceCollection.find({}).toArray();
        console.log(`   📥 Retrieved ${documents.length} documents`);

        if (documents.length > 0) {
          // Insert documents into target
          await targetCollection.insertMany(documents);
          console.log(`   ✅ Migrated ${documents.length} documents to ${collectionName}`);
        }

      } catch (error) {
        console.error(`   ❌ Error migrating ${collectionName}:`, error.message);
      }
    }

    // Close connections
    await sourceConnection.close();
    await targetConnection.close();

    console.log('\n🎉 Database migration completed!');
    console.log('\n📋 Next steps:');
    console.log('1. Verify data in construction_management database');
    console.log('2. Test your application');
    console.log('3. Remove test database if no longer needed');

  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

// Run migration
migrateDatabase().then(() => {
  console.log('Migration script finished');
  process.exit(0);
}).catch(error => {
  console.error('Migration script failed:', error);
  process.exit(1);
});
