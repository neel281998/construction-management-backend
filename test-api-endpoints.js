// Quick test script to verify API endpoints are working
// Run with: node test-api-endpoints.js

const fetch = require('node-fetch');

const API_BASE_URL = 'https://construction-management-backend.vercel.app/api';

async function testEndpoints() {
  console.log('🧪 Testing API Endpoints...\n');

  const endpoints = [
    { method: 'GET', path: '/health', description: 'Health Check' },
    { method: 'GET', path: '/locations/types', description: 'Location Types' },
    { method: 'GET', path: '/users/available/inventory-managers', description: 'Available Inventory Managers' },
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`Testing ${endpoint.method} ${endpoint.path} - ${endpoint.description}`);
      
      const response = await fetch(`${API_BASE_URL}${endpoint.path}`, {
        method: endpoint.method,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      if (response.ok) {
        console.log(`✅ ${endpoint.path} - Status: ${response.status}`);
        if (data.success !== undefined) {
          console.log(`   Success: ${data.success}`);
        }
      } else {
        console.log(`❌ ${endpoint.path} - Status: ${response.status}`);
        console.log(`   Error: ${data.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.log(`❌ ${endpoint.path} - Network Error: ${error.message}`);
    }
    console.log('');
  }

  console.log('🎉 API endpoint testing completed!');
}

testEndpoints();
