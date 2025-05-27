/**
 * Helpdesk API Test Script
 * 
 * This script tests the Helpdesk REST API functionality by performing
 * CRUD operations on helpdesk.ticket records.
 * 
 * Run with: node helpdeskApiTest.js
 */

import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables from .env file
dotenv.config();

// Server configuration
const SERVER_CONFIG = {
  baseURL: process.env.ODOO_URL || 'https://itmsgroup.com.au',
  db: process.env.ODOO_DB || '', // Your Odoo database name
  username: process.env.ODOO_USERNAME || 'admin',
  password: process.env.ODOO_PASSWORD || 'admin',
  clientId: process.env.ODOO_CLIENT_ID || 'GTZmuj6gqZduLrdaPCaiaWEQJrn2eWGhhyVwFgSr',
  clientSecret: process.env.ODOO_CLIENT_SECRET || 'EExqnTlEAYcZ9b6mnP2DYooRkWSnlTISB0PRZObM',
};

// Token storage (in-memory for testing)
let tokenData = null;

// Create axios instance
const client = axios.create({
  baseURL: SERVER_CONFIG.baseURL,
  headers: {
    'Content-Type': 'application/json',
    'DATABASE': SERVER_CONFIG.db
  }
});

// Add request interceptor for authentication
client.interceptors.request.use(
  async config => {
    // Check if we have a valid token
    if (!tokenData || tokenData.expiresAt <= Date.now()) {
      console.log('Getting new OAuth token...');
      tokenData = await getOAuthToken();
    }
    
    // Add token to request
    if (tokenData && tokenData.accessToken) {
      config.headers['Authorization'] = `Bearer ${tokenData.accessToken}`;
    }
    
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// Get OAuth token
async function getOAuthToken() {
  try {
    console.log('Authenticating with Odoo...');
    
    // Create form data for OAuth request
    const formData = new URLSearchParams();
    formData.append('client_id', SERVER_CONFIG.clientId);
    formData.append('client_secret', SERVER_CONFIG.clientSecret);
    formData.append('username', SERVER_CONFIG.username);
    formData.append('password', SERVER_CONFIG.password);
    formData.append('grant_type', 'password');
    
    const response = await axios.post(
      `${SERVER_CONFIG.baseURL}/api/v2/authentication/oauth2/token`,
      formData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    if (response.data && response.data.access_token) {
      console.log('Authentication successful!');
      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in || 3600,
        expiresAt: Date.now() + ((response.data.expires_in || 3600) * 1000),
        tokenType: response.data.token_type || 'Bearer'
      };
    } else {
      console.error('Invalid token response:', response.data);
      throw new Error('Invalid token response');
    }
  } catch (error) {
    console.error('Authentication error:', error.message);
    if (error.response) {
      console.error('Error response:', error.response.data);
      console.error('Status code:', error.response.status);
    }
    throw error;
  }
}

// Helpdesk API functions
const helpdeskAPI = {
  // Get helpdesk tickets
  async getTickets(limit = 20, offset = 0) {
    try {
      console.log(`Fetching helpdesk tickets (limit: ${limit}, offset: ${offset})...`);
      
      const response = await client.get('/api/v2/search_read/helpdesk.ticket', {
        params: {
          fields: JSON.stringify([
            'id', 
            'name', 
            'description', 
            'team_id', 
            'user_id', 
            'partner_id', 
            'partner_name',
            'stage_id',
            'priority',
            'create_date',
            'ticket_ref'
          ]),
          limit,
          offset
        }
      });
      
      console.log(`Retrieved ${response.data.length} ticket(s)`);
      return response.data;
    } catch (error) {
      console.error('Error fetching tickets:', error.message);
      if (error.response) {
        console.error('Error response:', error.response.data);
        console.error('Status code:', error.response.status);
      }
      return [];
    }
  },
  
  // Get a single helpdesk ticket
  async getTicket(ticketId) {
    try {
      console.log(`Fetching helpdesk ticket #${ticketId}...`);
      
      const response = await client.get(`/api/v2/read/helpdesk.ticket`, {
        params: {
          ids: JSON.stringify([ticketId]),
          fields: JSON.stringify([
            'id', 
            'name', 
            'description', 
            'team_id', 
            'user_id', 
            'partner_id', 
            'partner_name',
            'stage_id',
            'priority',
            'create_date',
            'ticket_ref'
          ])
        }
      });
      
      if (response.data && response.data.length > 0) {
        console.log(`Retrieved ticket #${ticketId}`);
        return response.data[0];
      } else {
        console.log(`No ticket found with ID ${ticketId}`);
        return null;
      }
    } catch (error) {
      console.error(`Error fetching ticket #${ticketId}:`, error.message);
      if (error.response) {
        console.error('Error response:', error.response.data);
        console.error('Status code:', error.response.status);
      }
      return null;
    }
  },
  
  // Create a new helpdesk ticket
  async createTicket(ticketData) {
    try {
      console.log(`Creating new helpdesk ticket "${ticketData.name}"...`);
      
      const response = await client.post(`/api/v2/create/helpdesk.ticket`, {
        values: ticketData
      });
      
      if (response.data) {
        console.log(`Created ticket with ID ${response.data}`);
        return response.data;
      } else {
        console.error('Failed to create ticket, no ID returned');
        return null;
      }
    } catch (error) {
      console.error('Error creating ticket:', error.message);
      if (error.response) {
        console.error('Error response:', error.response.data);
        console.error('Status code:', error.response.status);
      }
      return null;
    }
  },
  
  // Update an existing helpdesk ticket
  async updateTicket(ticketId, ticketData) {
    try {
      console.log(`Updating helpdesk ticket #${ticketId}...`);
      
      const response = await client.put(`/api/v2/write/helpdesk.ticket`, {
        ids: [ticketId],
        values: ticketData
      });
      
      if (response.data) {
        console.log(`Updated ticket #${ticketId} successfully`);
        return true;
      } else {
        console.error(`Failed to update ticket #${ticketId}`);
        return false;
      }
    } catch (error) {
      console.error(`Error updating ticket #${ticketId}:`, error.message);
      if (error.response) {
        console.error('Error response:', error.response.data);
        console.error('Status code:', error.response.status);
      }
      return false;
    }
  },
  
  // Delete a helpdesk ticket
  async deleteTicket(ticketId) {
    try {
      console.log(`Deleting helpdesk ticket #${ticketId}...`);
      
      const response = await client.delete(`/api/v2/unlink/helpdesk.ticket`, {
        data: { ids: [ticketId] }
      });
      
      if (response.data) {
        console.log(`Deleted ticket #${ticketId} successfully`);
        return true;
      } else {
        console.error(`Failed to delete ticket #${ticketId}`);
        return false;
      }
    } catch (error) {
      console.error(`Error deleting ticket #${ticketId}:`, error.message);
      if (error.response) {
        console.error('Error response:', error.response.data);
        console.error('Status code:', error.response.status);
      }
      return false;
    }
  },
  
  // Get helpdesk teams
  async getTeams() {
    try {
      console.log('Fetching helpdesk teams...');
      
      const response = await client.get('/api/v2/search_read/helpdesk.team', {
        params: {
          fields: JSON.stringify(['id', 'name', 'description']),
        }
      });
      
      console.log(`Retrieved ${response.data.length} team(s)`);
      return response.data;
    } catch (error) {
      console.error('Error fetching teams:', error.message);
      if (error.response) {
        console.error('Error response:', error.response.data);
        console.error('Status code:', error.response.status);
      }
      return [];
    }
  },
  
  // Get helpdesk stages
  async getStages() {
    try {
      console.log('Fetching helpdesk stages...');
      
      const response = await client.get('/api/v2/search_read/helpdesk.stage', {
        params: {
          fields: JSON.stringify(['id', 'name', 'sequence']),
        }
      });
      
      console.log(`Retrieved ${response.data.length} stage(s)`);
      return response.data;
    } catch (error) {
      console.error('Error fetching stages:', error.message);
      if (error.response) {
        console.error('Error response:', error.response.data);
        console.error('Status code:', error.response.status);
      }
      return [];
    }
  }
};

// Run the tests
async function runTests() {
  try {
    console.log('Starting Helpdesk API tests...');
    
    // Test 1: Get tickets
    console.log('\n=== Test 1: Get Tickets ===');
    const tickets = await helpdeskAPI.getTickets();
    console.log('Tickets sample:', tickets.slice(0, 3));
    
    // Test 2: Get teams
    console.log('\n=== Test 2: Get Teams ===');
    const teams = await helpdeskAPI.getTeams();
    console.log('Teams:', teams);
    
    let teamId = null;
    if (teams && teams.length > 0) {
      teamId = teams[0].id;
    }
    
    // Test 3: Get stages
    console.log('\n=== Test 3: Get Stages ===');
    const stages = await helpdeskAPI.getStages();
    console.log('Stages:', stages);
    
    let stageId = null;
    if (stages && stages.length > 0) {
      stageId = stages[0].id;
    }
    
    // Test 4: Create ticket
    console.log('\n=== Test 4: Create Ticket ===');
    const newTicketData = {
      name: `Test Ticket ${new Date().toISOString()}`,
      description: '<p>This is a test ticket created by the API test script.</p>',
      team_id: teamId,
      priority: '1'
    };
    
    const newTicketId = await helpdeskAPI.createTicket(newTicketData);
    
    if (newTicketId) {
      // Test 5: Get created ticket
      console.log('\n=== Test 5: Get Created Ticket ===');
      const createdTicket = await helpdeskAPI.getTicket(newTicketId);
      console.log('Created ticket:', createdTicket);
      
      // Test 6: Update ticket
      console.log('\n=== Test 6: Update Ticket ===');
      const updateData = {
        name: `${createdTicket.name} (Updated)`,
        priority: '2',
      };
      
      if (stageId) {
        updateData.stage_id = stageId;
      }
      
      const updateSuccess = await helpdeskAPI.updateTicket(newTicketId, updateData);
      console.log('Update success:', updateSuccess);
      
      // Test 7: Get updated ticket
      console.log('\n=== Test 7: Get Updated Ticket ===');
      const updatedTicket = await helpdeskAPI.getTicket(newTicketId);
      console.log('Updated ticket:', updatedTicket);
      
      // Test 8: Delete ticket (uncomment to test deletion)
      /*
      console.log('\n=== Test 8: Delete Ticket ===');
      const deleteSuccess = await helpdeskAPI.deleteTicket(newTicketId);
      console.log('Delete success:', deleteSuccess);
      
      // Verify deletion
      const deletedTicket = await helpdeskAPI.getTicket(newTicketId);
      console.log('Ticket after deletion (should be null):', deletedTicket);
      */
    }
    
    // Save the field definitions to a reference file
    console.log('\n=== Saving Field Reference ===');
    await saveFieldDefinitions();
    
    console.log('\nAll tests completed!');
  } catch (error) {
    console.error('Test execution error:', error);
  }
}

// Helper function to get and save field definitions
async function saveFieldDefinitions() {
  try {
    const response = await client.get('/api/v2/fields/helpdesk.ticket', {
      params: {
        attributes: JSON.stringify(['type'])
      }
    });
    
    if (response.data) {
      const fieldsData = response.data;
      console.log(`Retrieved ${Object.keys(fieldsData).length} field definitions`);
      
      // Save to a file
      const outputDir = path.resolve('./helpdesk_reference');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const outputFile = path.join(outputDir, 'ticket_fields.json');
      fs.writeFileSync(outputFile, JSON.stringify(fieldsData, null, 2));
      console.log(`Field definitions saved to ${outputFile}`);
      
      return fieldsData;
    }
  } catch (error) {
    console.error('Error retrieving field definitions:', error.message);
    return null;
  }
}

// Run the tests
runTests();
