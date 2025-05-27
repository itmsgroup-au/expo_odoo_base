# Odoo Helpdesk REST API Integration

This document provides a comprehensive guide to the Odoo Helpdesk REST API integration implemented for the ExoMobile application.

## Table of Contents

1. [Overview](#overview)
2. [Project Structure](#project-structure)
3. [Service Modules](#service-modules)
4. [Test Scripts](#test-scripts)
5. [Usage Examples](#usage-examples)
6. [Authentication](#authentication)
7. [Troubleshooting](#troubleshooting)

## Overview

This integration provides robust access to the Odoo Helpdesk module via the REST API. It includes comprehensive error handling, fallback mechanisms, and practical usage examples to help you implement Helpdesk functionality in your mobile application.

The integration focuses on:
- Reliable authentication with OAuth2
- Comprehensive CRUD operations for helpdesk tickets
- Access to related entities (teams, stages, SLA policies, etc.)
- Error handling with multiple fallback approaches
- Practical usage examples

## Project Structure

Here's the file structure of the implementation:

```
/src
├── api
│   ├── odooClient.js           - Base Odoo REST API client
│   ├── helpdeskService.js      - Original helpdesk service (can be replaced)
│   └── helpdeskServiceV2.js    - Enhanced helpdesk service (recommended)
│
└── features
    └── helpdesk
        ├── navigation
        │   └── HelpdeskNavigator.js
        │
        ├── screens
        │   ├── HelpdeskTicketDetailScreen.js
        │   ├── HelpdeskTicketFormScreen.js
        │   ├── HelpdeskTicketsScreen.js
        │   └── SimpleHelpdeskTicketsScreen.js
        │
        ├── tests
        │   ├── fixed_helpdesk_api_config.js  - Correct auth config for testing
        │   ├── fixed_helpdesk_api_test.js    - Fixed API test script
        │   ├── helpdeskApiTest.js            - Original test script
        │   └── helpdeskRestClient.js         - Dedicated REST client
        │
        ├── examples
        │   └── helpdesk_api_examples.js      - Practical implementation examples
        │
        └── README.md                         - This documentation
```

## Service Modules

The implementation includes two service modules:

### helpdeskServiceV2.js (Recommended)

This is the enhanced service module that provides comprehensive functionality:

- Better error handling with multiple fallback approaches
- Support for all Helpdesk operations (CRUD)
- Access to related entities (teams, stages, SLA, etc.)
- Optimized for React Native with proper caching

**Location**: `/src/api/helpdeskServiceV2.js`

### helpdeskService.js (Legacy)

This is the original service module. It can be replaced by helpdeskServiceV2.js, which provides more robust functionality. We recommend migrating to the new service module, but kept this for backward compatibility.

**Location**: `/src/api/helpdeskService.js`

## Test Scripts

Several test scripts have been created to verify the Helpdesk API functionality:

### fixed_helpdesk_api_test.js

A comprehensive test script that can be run to test all Helpdesk API operations. It includes proper authentication and tests for all major operations.

**Location**: `/src/features/helpdesk/tests/fixed_helpdesk_api_test.js`

**Usage**:
```bash
node fixed_helpdesk_api_test.js
```

### helpdeskRestClient.js

A dedicated REST client specifically for the Helpdesk module. It provides a more object-oriented approach to interacting with the Helpdesk API.

**Location**: `/src/features/helpdesk/tests/helpdeskRestClient.js`

### fixed_helpdesk_api_config.js

Contains the correct authentication configuration for connecting to your Odoo instance.

**Location**: `/src/features/helpdesk/tests/fixed_helpdesk_api_config.js`

## Usage Examples

Practical implementation examples are provided in the helpdesk_api_examples.js file.

**Location**: `/src/features/helpdesk/examples/helpdesk_api_examples.js`

The examples cover common use cases such as:
- Fetching tickets for a specific team
- Fetching tickets assigned to the current user
- Filtering tickets by multiple criteria
- Creating new tickets
- Updating ticket stages
- Assigning tickets to users
- Logging time on tickets
- Getting detailed ticket information
- Loading form data for ticket creation/editing

Each example includes sample React Native component code showing how to integrate the API calls into your application.

## Authentication

Authentication is handled via OAuth2. The correct configuration should be set in your application's config file:

```javascript
const AUTH_CONFIG = {
  baseURL: 'https://itmsgroup.com.au',
  db: 'ITMS_v17_3_backup_2025_02_17_08_15',
  username: 'mark.shaw@itmsgroup.com.au',
  password: 'hTempTWxeCFYWVswzMcv',
  clientId: 'GTZmuj6gqZduLrdaPCaiaWEQJrn2eWGhhyVwFgSr',
  clientSecret: 'EExqnTlEAYcZ9b6mnP2DYooRkWSnlTISB0PRZObM'
};
```

You can update this configuration in your application's environment settings or config file.

## Troubleshooting

If you encounter issues with the Helpdesk API, here are some common troubleshooting steps:

### Authentication Issues

If you see "Access Denied" errors:
1. Verify that your credentials are correct
2. Ensure that your user has the necessary permissions in Odoo
3. Check that your client_id and client_secret are valid

### API Request Issues

If API requests fail:
1. Check that you're using the correct endpoint paths
2. Verify that the field names in your requests match Odoo's field names
3. Ensure you're using the correct format for relational fields (many2one, one2many, many2many)

### Data Format Issues

For many2many fields like tag_ids, use the format: `[[6, 0, [id1, id2, id3]]]`
For many2one fields like team_id, use the format: `team_id: teamId` (just the ID)

## Migration from helpdeskService.js to helpdeskServiceV2.js

If you're currently using the original helpdeskService.js, you can migrate to helpdeskServiceV2.js with minimal changes to your code:

1. Update your imports:
   ```javascript
   // Old import
   import { getHelpdeskTickets, getHelpdeskTicket } from '../api/helpdeskService';
   
   // New import
   import { getHelpdeskTickets, getHelpdeskTicket } from '../api/helpdeskServiceV2';
   ```

2. The function signatures are compatible, so most of your code should work without changes
3. Take advantage of the new functionality available in helpdeskServiceV2.js

The helpdeskServiceV2.js module provides additional functions not available in the original module, such as:
- getHelpdeskTicketTypes
- getHelpdeskTags
- getHelpdeskSLAPolicies
- getTicketSLAStatus
- createTicketTimesheet
- getTicketTimesheets
- getTicketAttachments
