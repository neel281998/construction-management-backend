const mongoose = require('mongoose');
require('dotenv').config();

const StorageSite = require('../models/StorageSite');

async function createDefaultStorageSite() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://constructionchoudhary159632:EISf9b3Mbf8toQWe@cluster0.ug5nrys.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
    await mongoose.connect(mongoUri, {
      dbName: 'construction_management',
    });
    console.log('✅ Connected to MongoDB for creating default storage site');

    // Check if Main Storage already exists
    let mainStorage = await StorageSite.findOne({ name: 'Main Storage' });
    
    if (!mainStorage) {
      // Create default Main Storage site
      mainStorage = new StorageSite({
        name: 'Main Storage',
        code: 'MS-001',
        description: 'Default main storage facility',
        address: {
          street: '123 Main Street',
          city: 'New York',
          state: 'NY',
          zipCode: '10001'
        },
        isActive: true
      });
      
      await mainStorage.save();
      console.log('✅ Created default "Main Storage" site');
    } else {
      console.log('✅ "Main Storage" site already exists');
    }

    // Create a few more sample storage sites
    const sampleSites = [
      {
        name: 'Site A Yard',
        code: 'SA-001',
        description: 'Storage yard for Site A project',
        address: {
          street: '456 Site A Road',
          city: 'New York',
          state: 'NY',
          zipCode: '10002'
        }
      },
      {
        name: 'Bridge Yard',
        code: 'BY-001',
        description: 'Storage yard for Bridge project',
        address: {
          street: '789 Bridge Avenue',
          city: 'New York',
          state: 'NY',
          zipCode: '10003'
        }
      }
    ];

    for (const siteData of sampleSites) {
      let existingSite = await StorageSite.findOne({ name: siteData.name });
      if (!existingSite) {
        const newSite = new StorageSite({
          ...siteData,
          isActive: true
        });
        await newSite.save();
        console.log(`✅ Created sample storage site: ${newSite.name}`);
      } else {
        console.log(`✅ Sample storage site already exists: ${existingSite.name}`);
      }
    }

    console.log('✅ Default storage sites created successfully!');
  } catch (error) {
    console.error('❌ Failed to create default storage sites:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

createDefaultStorageSite();
