const mongoose = require('mongoose');

// Connect to MongoDB
const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://constructionchoudhary159632:EISf9b3Mbf8toQWe@cluster0.ug5nrys.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function fixItemCodeIndex() {
  try {
    await mongoose.connect(mongoUri, {
      dbName: 'construction_management',
    });
    
    console.log('Connected to MongoDB');
    
    const db = mongoose.connection.db;
    const collection = db.collection('inventories');
    
    // Drop the existing itemCode index
    try {
      await collection.dropIndex('itemCode_1');
      console.log('Dropped existing itemCode index');
    } catch (error) {
      console.log('Index might not exist or already dropped:', error.message);
    }
    
    // Create a new sparse unique index
    await collection.createIndex({ itemCode: 1 }, { 
      unique: true, 
      sparse: true,
      name: 'itemCode_1_sparse'
    });
    
    console.log('Created new sparse unique index on itemCode');
    
    // Verify the index
    const indexes = await collection.indexes();
    console.log('Current indexes:', indexes.map(idx => ({ name: idx.name, key: idx.key, options: idx })));
    
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    
  } catch (error) {
    console.error('Error fixing itemCode index:', error);
    process.exit(1);
  }
}

fixItemCodeIndex();






