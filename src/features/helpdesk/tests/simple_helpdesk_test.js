// Simple Helpdesk API Test Script (No external dependencies)
// Run with: node simple_helpdesk_test.js

const axios = require('axios');
const readline = require('readline');

// Configuration - Using the credentials you provided
const config = {
  baseURL: 'https://itmsgroup.com.au',
  db: 'ITMS_v17_3_backup_2025_02_17_08_15',
  username: 'mark.shaw@itmsgroup.com.au',
  password: 'hTempTWxeCFYWVswzMcv',
  clientId: 'GTZmuj6gqZduLrdaPCaiaWEQJrn2eWGhhyVwFgSr',
  clientSecret: 'EExqnTlEAYcZ9b6mnP2DYooRkWSnlTISB0PRZObM',
  authEndpoint: '/api/v2/authentication/oauth2/token',
  apiBase: '/api/v2'
};

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Global access token
let accessToken = null;

// Helper function to get user input
const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));

// Format JSON output
const formatJSON = (data) => JSON.stringify(data, null, 2);

// Get OAuth token
const getAuthToken = async () => {
  try {
    console.log('Requesting OAuth token...');
    const tokenUrl = `${config.baseURL}${config.authEndpoint}`;
    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append('username', config.username);
    params.append('password', config.password);
    params.append('client_id', config.clientId);
    params.append('client_secret', config.clientSecret);

    const response = await axios.post(tokenUrl, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (response.data && response.data.access_token) {
      console.log('✅ Authentication successful');
      console.log(`Token: ${response.data.access_token.substring(0, 10)}...`);
      return response.data.access_token;
    } else {
      console.error('❌ Authentication failed: No access token in response');
      console.log('Response:', formatJSON(response.data));
      return null;
    }
  } catch (error) {
    console.error('❌ Authentication error:', error.message);
    if (error.response) {
      console.error('Error response:', formatJSON(error.response.data));
    }
    return null;
  }
};

// Make API request with proper headers
const makeApiRequest = async (method, endpoint, params = null, data = null) => {
  if (!accessToken) {
    console.error('No access token available. Please authenticate first.');
    return null;
  }

  try {
    const url = `${config.baseURL}${endpoint}`;
    console.log(`\n🔄 Making ${method.toUpperCase()} request to: ${url}`);
    if (params) console.log('Params:', formatJSON(params));
    if (data) console.log('Data:', formatJSON(data));

    const requestConfig = {
      method,
      url,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'DATABASE': config.db,
        'Content-Type': 'application/json'
      }
    };

    if (params) requestConfig.params = params;
    if (data) requestConfig.data = data;

    const response = await axios(requestConfig);
    console.log(`✅ Request successful (${response.status})`);
    return response.data;
  } catch (error) {
    console.error(`❌ API request error: ${error.message}`);
    if (error.response) {
      console.error(`Status code: ${error.response.status}`);
      console.error('Error response:', formatJSON(error.response.data));
    }
    return null;
  }
};

// Helpdesk specific test endpoints
const helpdeskTests = {
  // Get helpdesk tickets
  getTickets: async (limit = 20) => {
    console.log('\n===== Testing Helpdesk Tickets Retrieval =====');
    const params = {
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
      offset: 0
    };
    
    const data = await makeApiRequest('get', '/api/v2/search_read/helpdesk.ticket', params);
    
    if (data) {
      console.log(`✅ Retrieved ${data.length} tickets`);
      if (data.length > 0) {
        console.log('First ticket:', formatJSON(data[0]));
      }
    }
    
    return data;
  },
  
  // Get helpdesk teams
  getTeams: async () => {
    console.log('\n===== Testing Helpdesk Teams Retrieval =====');
    const params = {
      fields: JSON.stringify(['id', 'name', 'description'])
    };
    
    const data = await makeApiRequest('get', '/api/v2/search_read/helpdesk.team', params);
    
    if (data) {
      console.log(`✅ Retrieved ${data.length} teams`);
      console.log('Teams:', formatJSON(data));
    }
    
    return data;
  },
  
  // Get helpdesk stages
  getStages: async (teamId = null) => {
    console.log('\n===== Testing Helpdesk Stages Retrieval =====');
    const params = {
      fields: JSON.stringify(['id', 'name', 'sequence', 'team_ids']),
    };
    
    if (teamId) {
      params.domain = JSON.stringify([['team_ids', 'in', [teamId]]]);
    }
    
    const data = await makeApiRequest('get', '/api/v2/search_read/helpdesk.stage', params);
    
    if (data) {
      console.log(`✅ Retrieved ${data.length} stages`);
      console.log('Stages:', formatJSON(data));
    }
    
    return data;
  },
  
  // Try search_extract endpoint (simpler and more reliable)
  useSearchExtract: async (limit = 10) => {
    console.log('\n===== Testing search_extract Endpoint =====');
    
    const data = await makeApiRequest('get', '/api/v2/search_extract/helpdesk.ticket', {
      fields: JSON.stringify(['name']),
      limit
    });
    
    if (data) {
      console.log(`✅ search_extract successful, found ${data.length} tickets`);
      console.log('Tickets:', formatJSON(data));
    }
    
    return data;
  },
  
  // Create a helpdesk ticket
  createTicket: async (teamId) => {
    console.log('\n===== Testing Helpdesk Ticket Creation =====');
    
    if (!teamId) {
      console.log('No team ID provided, fetching teams first...');
      const teams = await helpdeskTests.getTeams();
      if (teams && teams.length > 0) {
        teamId = teams[0].id;
        console.log(`Selected team ID: ${teamId}`);
      } else {
        console.error('❌ No teams available for ticket creation');
        return null;
      }
    }
    
    const ticketData = {
      name: `Test Ticket ${new Date().toISOString()}`,
      description: '<p>This is a test ticket created via the REST API for testing purposes.</p>',
      team_id: teamId,
      priority: '1'
    };
    
    const data = await makeApiRequest('post', '/api/v2/create/helpdesk.ticket', null, {
      values: ticketData
    });
    
    if (data) {
      console.log(`✅ Created ticket with ID: ${data}`);
    }
    
    return data;
  },
  
  // Get a single ticket by ID
  getTicket: async (ticketId) => {
    console.log(`\n===== Testing Helpdesk Ticket Retrieval (ID: ${ticketId}) =====`);
    const params = {
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
    };
    
    const data = await makeApiRequest('get', '/api/v2/read/helpdesk.ticket', params);
    
    if (data && data.length > 0) {
      console.log(`✅ Retrieved ticket: ${data[0].name}`);
      console.log('Ticket details:', formatJSON(data[0]));
    }
    
    return data && data.length > 0 ? data[0] : null;
  },
  
  // Update a ticket
  updateTicket: async (ticketId, stageId) => {
    console.log(`\n===== Testing Helpdesk Ticket Update (ID: ${ticketId}) =====`);
    
    // If no stage ID is provided, try to get one first
    if (!stageId) {
      console.log('No stage ID provided, fetching stages first...');
      const stages = await helpdeskTests.getStages();
      if (stages && stages.length > 0) {
        stageId = stages[0].id;
        console.log(`Selected stage ID: ${stageId}`);
      }
    }
    
    const updateData = {
      name: `Updated Test Ticket ${new Date().toISOString()}`,
      priority: '2' // Medium priority
    };
    
    if (stageId) {
      updateData.stage_id = stageId;
    }
    
    const data = await makeApiRequest('put', '/api/v2/write/helpdesk.ticket', null, {
      ids: [ticketId],
      values: updateData
    });
    
    if (data) {
      console.log(`✅ Updated ticket successfully`);
      
      // Fetch the updated ticket to verify changes
      const updatedTicket = await helpdeskTests.getTicket(ticketId);
      if (updatedTicket) {
        console.log('Verified updated ticket:', formatJSON(updatedTicket));
      }
    }
    
    return data;
  }
};

// Run the full test suite
const runFullTestSuite = async () => {
  console.log('\n===== Running Full Helpdesk API Test Suite =====');
  console.log(`Server: ${config.baseURL}`);
  console.log(`Database: ${config.db}`);
  console.log(`Username: ${config.username}`);
  console.log('========================================\n');
  
  // Get token first
  accessToken = await getAuthToken();
  if (!accessToken) {
    console.error('❌ Authentication failed, cannot continue tests');
    return;
  }
  
  // 1. Try the simplified search_extract endpoint first
  await helpdeskTests.useSearchExtract(5);
  
  // 2. Get helpdesk teams
  const teams = await helpdeskTests.getTeams();
  let teamId = null;
  if (teams && teams.length > 0) {
    teamId = teams[0].id;
  }
  
  // 3. Get helpdesk stages
  const stages = await helpdeskTests.getStages(teamId);
  let stageId = null;
  if (stages && stages.length > 0) {
    stageId = stages[0].id;
  }
  
  // 4. Get helpdesk tickets
  const tickets = await helpdeskTests.getTickets();
  
  // 5. If we have tickets, test single ticket retrieval
  if (tickets && tickets.length > 0) {
    const ticketId = tickets[0].id;
    
    // Get a single ticket
    await helpdeskTests.getTicket(ticketId);
    
    // Update the ticket
    await helpdeskTests.updateTicket(ticketId, stageId);
  }
  
  // 6. Create a new ticket
  const newTicketId = await helpdeskTests.createTicket(teamId);
  
  // 7. If ticket creation was successful, get and update it
  if (newTicketId) {
    // Get the created ticket
    await helpdeskTests.getTicket(newTicketId);
    
    // Update the ticket
    await helpdeskTests.updateTicket(newTicketId, stageId);
  }
  
  console.log('\n===== Test Suite Complete =====');
};

// Show menu
const showMenu = async () => {
  console.log('\n===== Helpdesk API Test Menu =====');
  console.log('1. Authenticate (get token)');
  console.log('2. Get helpdesk teams');
  console.log('3. Get helpdesk stages');
  console.log('4. Get helpdesk tickets');
  console.log('5. Try search_extract endpoint');
  console.log('6. Create a new ticket');
  console.log('7. Get a specific ticket by ID');
  console.log('8. Update a ticket');
  console.log('9. Run full test suite');
  console.log('0. Exit');

  const choice = await askQuestion('\nEnter your choice: ');

  switch (choice) {
    case '1':
      accessToken = await getAuthToken();
      break;
    case '2':
      await helpdeskTests.getTeams();
      break;
    case '3':
      const teamId = await askQuestion('Enter team ID (optional): ');
      await helpdeskTests.getStages(teamId ? parseInt(teamId) : null);
      break;
    case '4':
      const limit = await askQuestion('Enter limit (default 20): ');
      await helpdeskTests.getTickets(parseInt(limit) || 20);
      break;
    case '5':
      const extractLimit = await askQuestion('Enter limit (default 10): ');
      await helpdeskTests.useSearchExtract(parseInt(extractLimit) || 10);
      break;
    case '6':
      const createTeamId = await askQuestion('Enter team ID (optional): ');
      await helpdeskTests.createTicket(createTeamId ? parseInt(createTeamId) : null);
      break;
    case '7':
      const ticketId = await askQuestion('Enter ticket ID: ');
      await helpdeskTests.getTicket(parseInt(ticketId));
      break;
    case '8':
      const updateTicketId = await askQuestion('Enter ticket ID: ');
      const updateStageId = await askQuestion('Enter stage ID (optional): ');
      await helpdeskTests.updateTicket(
        parseInt(updateTicketId), 
        updateStageId ? parseInt(updateStageId) : null
      );
      break;
    case '9':
      await runFullTestSuite();
      break;
    case '0':
      console.log('Exiting...');
      rl.close();
      return false;
    default:
      console.log('Invalid choice, please try again.');
  }
  return true;
};

// Main function
const main = async () => {
  console.log('📱 Simple Helpdesk API Test Tool 📱');
  console.log('This tool helps test the Odoo Helpdesk REST API functionality.\n');

  let continueRunning = true;
  while (continueRunning) {
    continueRunning = await showMenu();
  }
};

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  rl.close();
});
