// Test script for Odoo connection
// Run with: node scripts/test-odoo-connection.js

const axios = require('axios');

const config = {
  baseURL: 'http://localhost:8018',
  db: 'OCR',
  username: 'admin',
  password: 'admin',
};

async function testConnection() {
  console.log('Testing connection to Odoo server...');
  
  try {
    // Test authentication
    const response = await axios.post(`${config.baseURL}/web/session/authenticate`, {
      jsonrpc: '2.0',
      params: {
        db: config.db,
        login: config.username,
        password: config.password,
      },
    });
    
    if (response.data.error) {
      console.error('Authentication error:', response.data.error);
      return false;
    }
    
    console.log('Authentication successful!');
    console.log('User info:', response.data.result);
    
    return true;
  } catch (error) {
    console.error('Connection error:', error.message);
    return false;
  }
}

testConnection()
  .then(success => {
    if (success) {
      console.log('Connection test passed!');
    } else {
      console.log('Connection test failed!');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });

