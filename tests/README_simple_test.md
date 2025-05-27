# Odoo API Simple Test Tool

This tool helps diagnose ExoMobile's Odoo API connection issues by testing various endpoints systematically.

## Prerequisites

- Node.js installed
- Axios package (install with `npm install axios` if needed)

## Running the Test Tool

1. Open iTerm or another terminal
2. Navigate to the directory containing the test script:
   ```
   cd /Users/markshaw/Desktop/git/exomobile/tests
   ```
3. Run the script with Node.js:
   ```
   node odoo_api_simple_test.js
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

### Common Solutions Based on Test Results

#### If Individual Fetch Works But Batch Fails

Update the `fetchPartnersBatch` function to use a loop with individual partner fetches:

```javascript
const fetchPartnersBatch = async (ids, fields = []) => {
  try {
    if (!ids || ids.length === 0) return [];
    
    console.log(`Fetching ${ids.length} partners individually...`);
    const partners = [];
    
    for (const id of ids) {
      try {
        const response = await api.get('/api/v2/read/res.partner', {
          params: {
            ids: JSON.stringify([id]),
            fields: JSON.stringify(fields.length > 0 ? fields : ['name', 'id', 'email', 'phone', 'mobile', 'image_128', 'street', 'city', 'country_id', 'is_company'])
          }
        });
        
        if (response.data && response.data.length > 0) {
          partners.push(response.data[0]);
        }
      } catch (err) {
        console.log(`Error fetching partner ${id}:`, err);
      }
    }
    
    return partners;
  } catch (error) {
    console.error('Error in fetchPartnersBatch:', error);
    return [];
  }
};
```

#### If RPC Call Method Works

Update the function to use the RPC method with small batches:

```javascript
const fetchPartnersBatch = async (ids, fields = []) => {
  try {
    if (!ids || ids.length === 0) return [];
    
    console.log(`Fetching ${ids.length} partners using RPC...`);
    const partners = [];
    const batchSize = 5;
    
    for (let i = 0; i < ids.length; i += batchSize) {
      const batchIds = ids.slice(i, i + batchSize);
      try {
        const response = await api.post('/api/v2/call', {
          model: 'res.partner',
          method: 'read',
          args: [batchIds, fields.length > 0 ? fields : ['name', 'id', 'email', 'phone', 'mobile', 'image_128', 'street', 'city', 'country_id', 'is_company']],
          kwargs: {}
        });
        
        if (response.data && response.data.result) {
          partners.push(...response.data.result);
        }
      } catch (err) {
        console.log(`Error fetching batch ${i/batchSize}:`, err);
      }
    }
    
    return partners;
  } catch (error) {
    console.error('Error in fetchPartnersBatch:', error);
    return [];
  }
};
```

#### If Search_Extract Endpoint Works

```javascript
const fetchPartnersBatch = async (ids, fields = []) => {
  try {
    if (!ids || ids.length === 0) return [];
    
    console.log(`Fetching partners using search_extract...`);
    const limit = ids.length;
    
    const response = await api.get(`/api/v2/search_extract/res.partner/${limit}/0/id`);
    
    if (response.data && Array.isArray(response.data)) {
      // Depending on what search_extract returns, you might need to filter or map the results
      return response.data;
    }
    
    return [];
  } catch (error) {
    console.error('Error in fetchPartnersBatch:', error);
    return [];
  }
};
```

## Interpreting Results

- ✅ indicates a successful API call
- ❌ indicates a failed API call
- Look for specific error messages and status codes to understand what's failing
- Pay attention to which methods succeed with single IDs vs. multiple IDs

The comprehensive test suite will provide a summary of working and failing methods at the end.
