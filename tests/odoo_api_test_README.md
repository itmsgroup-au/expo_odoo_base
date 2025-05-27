# Odoo API Test Tool

This tool helps diagnose ExoMobile's Odoo API connection issues by testing various endpoints systematically.

## Prerequisites

- Node.js installed
- MCP CLI installed: `npm install -g @anthropic-ai/mcp-cli`
- Internet access to reach your Odoo server

## Running the Test Tool

1. Open iTerm or another terminal
2. Navigate to the directory containing the test script:
   ```
   cd /Users/markshaw/Desktop/git/exomobile/tests
   ```
3. Run the script with the MCP CLI:
   ```
   npx @anthropic-ai/mcp-cli run odoo_api_test.js
   ```
4. Follow the interactive menu to test different API endpoints

## Test Options

The tool includes the following test options:

1. **Authenticate**: Get an OAuth token from the Odoo server
2. **Get user info**: Test basic API connectivity using the user endpoint
3. **Get partner IDs**: Retrieve a list of partner IDs from the database
4. **Get single partner by ID**: Test fetching a single partner record using the read endpoint
5. **Search_read with single ID**: Test the search_read endpoint with a single ID filter
6. **Search_read with multiple IDs**: Test the problematic batch loading scenario
7. **Try search_extract endpoint**: Test the search_extract endpoint as an alternative
8. **Try RPC call method**: Test using the RPC method directly
9. **Run comprehensive test suite**: Run all tests in sequence and report results

## How to Fix the Contacts Loading Issue

After running the tests, identify which API methods work reliably for your Odoo instance. Then modify the `fetchPartnersBatch` function in `/src/api/models/partnersApi.js` to use the working approach.

The most likely solutions, in order of preference:

1. Use individual `/api/v2/read/res.partner` calls for each partner ID
2. Use the `/api/v2/search_extract/res.partner` endpoint if available
3. Use the RPC call method with small batches
4. Use individual search_read calls with `[['id', '=', singleId]]` domain filters

## Interpreting Results

- ✅ indicates a successful API call
- ❌ indicates a failed API call
- Look for specific error messages and status codes to understand what's failing
- Pay attention to which methods succeed with single IDs vs. multiple IDs

The comprehensive test suite will provide a summary of working and failing methods at the end.
