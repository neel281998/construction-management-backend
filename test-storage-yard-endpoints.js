const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

// Test storage yard inventory endpoints
async function testStorageYardEndpoints() {
  try {
    console.log('🧪 Testing Storage Yard Inventory Endpoints...\n');

    // Test 1: Get storage yard inventory categories
    console.log('1. Testing GET /storage-yard-inventory/meta/categories');
    try {
      const response = await axios.get(`${BASE_URL}/storage-yard-inventory/meta/categories`);
      console.log('✅ Categories endpoint working:', response.data);
    } catch (error) {
      console.log('❌ Categories endpoint failed:', error.response?.data || error.message);
    }

    // Test 2: Get storage yard inventory items
    console.log('\n2. Testing GET /storage-yard-inventory');
    try {
      const response = await axios.get(`${BASE_URL}/storage-yard-inventory`);
      console.log('✅ Inventory endpoint working:', response.data);
    } catch (error) {
      console.log('❌ Inventory endpoint failed:', error.response?.data || error.message);
    }

    // Test 3: Get low stock alerts
    console.log('\n3. Testing GET /storage-yard-inventory/alerts/low-stock');
    try {
      const response = await axios.get(`${BASE_URL}/storage-yard-inventory/alerts/low-stock`);
      console.log('✅ Low stock alerts endpoint working:', response.data);
    } catch (error) {
      console.log('❌ Low stock alerts endpoint failed:', error.response?.data || error.message);
    }

    // Test 4: Get stock requests
    console.log('\n4. Testing GET /stock-requests');
    try {
      const response = await axios.get(`${BASE_URL}/stock-requests`);
      console.log('✅ Stock requests endpoint working:', response.data);
    } catch (error) {
      console.log('❌ Stock requests endpoint failed:', error.response?.data || error.message);
    }

    // Test 5: Get stock request stats
    console.log('\n5. Testing GET /stock-requests/stats/overview');
    try {
      const response = await axios.get(`${BASE_URL}/stock-requests/stats/overview`);
      console.log('✅ Stock request stats endpoint working:', response.data);
    } catch (error) {
      console.log('❌ Stock request stats endpoint failed:', error.response?.data || error.message);
    }

    console.log('\n🎉 Storage Yard Inventory Endpoints Test Complete!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testStorageYardEndpoints();
