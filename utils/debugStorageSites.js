const mongoose = require('mongoose');
const StorageSite = require('../models/StorageSite');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://constructionchoudhary159632:EISf9b3Mbf8toQWe@cluster0.ug5nrys.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0');

async function debugStorageSites() {
  try {
    console.log('✅ Connected to MongoDB for debugging storage sites');

    // Check collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Available collections:', collections.map(c => c.name));

    // Try to find storage sites
    const storageSites = await StorageSite.find({});
    console.log(`Found ${storageSites.length} storage sites:`, storageSites);

    // Try to find with different query
    const allSites = await StorageSite.find({}).lean();
    console.log(`Found ${allSites.length} storage sites (lean):`, allSites);

  } catch (error) {
    console.error('❌ Error debugging storage sites:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

debugStorageSites();





