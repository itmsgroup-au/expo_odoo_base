# Testing the Odoo Helpdesk REST API Integration

This guide provides instructions for testing the Odoo Helpdesk REST API integration in your ExoMobile application.

## Prerequisites

Before testing, ensure you have:

1. Node.js installed (version 14 or higher)
2. Access to your Odoo instance with the Helpdesk module enabled
3. Valid authentication credentials

## Authentication Configuration

The test scripts use the authentication configuration defined in `fixed_helpdesk_api_config.js`. This file contains:

```javascript
const HELPDESK_API_CONFIG = {
  // Server configuration
  baseURL: 'https://itmsgroup.com.au',
  db: 'ITMS_v17_3_backup_2025_02_17_08_15',
  
  // Authentication credentials
  username: 'mark.shaw@itmsgroup.com.au',
  password: 'hTempTWxeCFYWVswzMcv',
  
  // OAuth2 client credentials
  clientId: 'GTZmuj6gqZduLrdaPCaiaWEQJrn2eWGhhyVwFgSr',
  clientSecret: 'EExqnTlEAYcZ9b6mnP2DYooRkWSnlTISB0PRZObM',
  
  // API endpoints
  authEndpoint: '/api/v2/authentication/oauth2/token',
  apiBase: '/api/v2'
};
```

Verify that these credentials are correct before proceeding.

## Running the Test Script

The `fixed_helpdesk_api_test.js` script provides a comprehensive test of the Helpdesk API functionality. It includes an interactive menu for testing different aspects of the API.

To run the test script:

```bash
cd /src/features/helpdesk/tests/
node fixed_helpdesk_api_test.js
```

## Test Menu Options

The test script provides the following options:

1. **Authenticate (get token)** - Test OAuth2 authentication
2. **Get ticket field definitions** - Retrieve field schema for helpdesk.ticket
3. **Get helpdesk teams** - List all available helpdesk teams
4. **Get helpdesk stages** - List stages for a specific team
5. **Get helpdesk tickets** - List tickets with optional filtering
6. **Try search_extract endpoint** - Test the simplified search endpoint
7. **Create a new ticket** - Create a test ticket
8. **Get a specific ticket by ID** - Retrieve a single ticket
9. **Update a ticket** - Modify an existing ticket
10. **Get SLA policies** - List SLA policies
11. **Get ticket types** - List ticket types
12. **Get tags** - List available tags
13. **Run full test suite** - Run all tests automatically

## Troubleshooting Common Issues

### Authentication Errors

If you see "Access Denied" errors:

1. Verify credentials in `fixed_helpdesk_api_config.js`
2. Check that your user has appropriate permissions in Odoo
3. Ensure the OAuth2 client credentials are valid
4. Check if your Odoo instance requires additional headers

Example error:
```
Authentication error: Request failed with status code 400
Error response: {
  arguments: [ 'Access Denied' ],
  code: 400,
  context: {},
  message: 'Access Denied',
  name: 'odoo.exceptions.AccessDenied',
  ...
}
```

### API Endpoint Errors

If API endpoints fail:

1. Check that your Odoo instance has the MUK REST API module installed
2. Verify that the endpoint path is correct (may vary by installation)
3. Check permissions for specific models

### Data Structure Errors

When creating or updating records:

1. Use the correct field names (can be verified with option 2 in the test menu)
2. Format relational fields correctly (many2one, one2many, many2many)
3. Respect field types and constraints

## Running Individual Tests

You can also modify and run individual test functions from the script:

```javascript
// Example: Test only ticket creation
async function testTicketCreation() {
  // First authenticate
  accessToken = await getAuthToken();
  if (!accessToken) {
    console.error('Authentication failed, cannot continue');
    return;
  }
  
  // Then test ticket creation
  const teams = await helpdeskTests.getTeams();
  const teamId = teams && teams.length > 0 ? teams[0].id : null;
  
  if (!teamId) {
    console.error('No teams available, cannot create ticket');
    return;
  }
  
  const newTicketId = await helpdeskTests.createTicket(teamId);
  console.log('New ticket ID:', newTicketId);
}

testTicketCreation();
```

## Next Steps

After ensuring the API integration works correctly, you can:

1. Implement the functionality in your screens using the examples in `helpdesk_api_examples.js`
2. Customize the API service to match your specific needs
3. Add additional error handling if required

For more guidance, refer to the main README.md in the helpdesk directory.
