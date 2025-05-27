# Odoo REST API Integration Guide

This guide provides detailed information on integrating with the Odoo REST API in the ExoMobile application.

## Authentication

### OAuth2 Authentication

The application uses OAuth2 for authentication with the Odoo server. The authentication flow is as follows:

1. **Request an access token**:
   ```javascript
   const getOAuthToken = async () => {
     const tokenUrl = `${config.baseURL}/api/v2/authentication/oauth2/token`;
     const formData = new URLSearchParams();
     formData.append('grant_type', 'password');
     formData.append('username', config.username);
     formData.append('password', config.password);
     formData.append('client_id', config.clientId);
     formData.append('client_secret', config.clientSecret);
     
     const response = await fetch(tokenUrl, {
       method: 'POST',
       headers: {
         'Content-Type': 'application/x-www-form-urlencoded'
       },
       body: formData
     });
     
     const tokenData = await response.json();
     return tokenData.access_token;
   };
   ```

2. **Store the token**:
   ```javascript
   const storeToken = async (token) => {
     await AsyncStorage.setItem('odooToken', token);
   };
   ```

3. **Use the token in API requests**:
   ```javascript
   const headers = {
     'Authorization': `Bearer ${token}`,
     'DATABASE': config.db,
     'Content-Type': 'application/json'
   };
   ```

### Token Refresh

When the token expires, it needs to be refreshed:

```javascript
const refreshToken = async (refreshToken) => {
  const tokenUrl = `${config.baseURL}/api/v2/authentication/oauth2/token`;
  const formData = new URLSearchParams();
  formData.append('grant_type', 'refresh_token');
  formData.append('refresh_token', refreshToken);
  formData.append('client_id', config.clientId);
  formData.append('client_secret', config.clientSecret);
  
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: formData
  });
  
  const tokenData = await response.json();
  return tokenData.access_token;
};
```

## API Endpoints

### User Information

#### Get Current User

```javascript
const getCurrentUser = async (token) => {
  const url = `${config.baseURL}/api/v2/user`;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'DATABASE': config.db,
    'Content-Type': 'application/json'
  };
  
  const response = await fetch(url, { headers });
  return await response.json();
};
```

#### Get Detailed User Information

```javascript
const getUserInfo = async (token) => {
  const url = `${config.baseURL}/api/v2/userinfo`;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'DATABASE': config.db,
    'Content-Type': 'application/json'
  };
  
  const response = await fetch(url, { headers });
  return await response.json();
};
```

### CRUD Operations

#### Search and Read Records

```javascript
const searchRead = async (model, domain, fields, limit = 10, offset = 0, token) => {
  const url = `${config.baseURL}/api/v2/search_read`;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'DATABASE': config.db,
    'Content-Type': 'application/json'
  };
  
  const params = {
    model,
    domain: JSON.stringify(domain),
    fields: JSON.stringify(fields),
    limit,
    offset
  };
  
  const queryString = Object.keys(params)
    .map(key => `${key}=${encodeURIComponent(params[key])}`)
    .join('&');
  
  const response = await fetch(`${url}?${queryString}`, { headers });
  return await response.json();
};
```

#### Read Specific Records

```javascript
const readRecords = async (model, ids, fields, token) => {
  const url = `${config.baseURL}/api/v2/read/${model}`;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'DATABASE': config.db,
    'Content-Type': 'application/json'
  };
  
  const params = {
    ids: JSON.stringify(ids),
    fields: JSON.stringify(fields)
  };
  
  const queryString = Object.keys(params)
    .map(key => `${key}=${encodeURIComponent(params[key])}`)
    .join('&');
  
  const response = await fetch(`${url}?${queryString}`, { headers });
  return await response.json();
};
```

#### Create Records

```javascript
const createRecord = async (model, values, token) => {
  const url = `${config.baseURL}/api/v2/create/${model}`;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'DATABASE': config.db,
    'Content-Type': 'application/json'
  };
  
  const params = {
    values: JSON.stringify(values)
  };
  
  const queryString = Object.keys(params)
    .map(key => `${key}=${encodeURIComponent(params[key])}`)
    .join('&');
  
  const response = await fetch(`${url}?${queryString}`, {
    method: 'POST',
    headers
  });
  
  return await response.json();
};
```

#### Update Records

```javascript
const updateRecord = async (model, ids, values, token) => {
  const url = `${config.baseURL}/api/v2/write/${model}`;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'DATABASE': config.db,
    'Content-Type': 'application/json'
  };
  
  const response = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      ids: ids,
      values: values
    })
  });
  
  return await response.json();
};
```

#### Delete Records

```javascript
const deleteRecord = async (model, ids, token) => {
  const url = `${config.baseURL}/api/v2/unlink/${model}`;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'DATABASE': config.db,
    'Content-Type': 'application/json'
  };
  
  const params = {
    ids: JSON.stringify(ids)
  };
  
  const queryString = Object.keys(params)
    .map(key => `${key}=${encodeURIComponent(params[key])}`)
    .join('&');
  
  const response = await fetch(`${url}?${queryString}`, {
    method: 'DELETE',
    headers
  });
  
  return await response.json();
};
```

### System Information

#### Get Company Information

```javascript
const getCompanyInfo = async (token) => {
  const url = `${config.baseURL}/api/v2/company`;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'DATABASE': config.db,
    'Content-Type': 'application/json'
  };
  
  const response = await fetch(url, { headers });
  return await response.json();
};
```

#### Get Database Information

```javascript
const getDatabaseInfo = async (token) => {
  const url = `${config.baseURL}/api/v2/database`;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'DATABASE': config.db,
    'Content-Type': 'application/json'
  };
  
  const response = await fetch(url, { headers });
  return await response.json();
};
```

## Error Handling

### Common Error Patterns

1. **Authentication Errors (401)**:
   ```javascript
   try {
     const response = await fetch(url, { headers });
     if (response.status === 401) {
       // Token expired, refresh and retry
       const newToken = await refreshToken(refreshToken);
       // Update stored token
       await storeToken(newToken);
       // Retry the request with new token
       headers.Authorization = `Bearer ${newToken}`;
       const retryResponse = await fetch(url, { headers });
       return await retryResponse.json();
     }
     return await response.json();
   } catch (error) {
     console.error('API request failed:', error);
     throw error;
   }
   ```

2. **Server Errors (500)**:
   ```javascript
   try {
     const response = await fetch(url, { headers });
     if (response.status >= 500) {
       console.error('Server error:', response.status);
       throw new Error(`Server error: ${response.status}`);
     }
     return await response.json();
   } catch (error) {
     console.error('API request failed:', error);
     throw error;
   }
   ```

3. **Network Errors**:
   ```javascript
   try {
     const response = await fetch(url, { headers });
     return await response.json();
   } catch (error) {
     if (error.message.includes('Network request failed')) {
       // Handle offline mode
       console.error('Network error, device may be offline');
       // Queue operation for later
       await queueOperation({ url, method, headers, body });
     }
     throw error;
   }
   ```

## Best Practices

1. **Centralize API Calls**:
   - Use a central API client for all requests
   - Implement consistent error handling
   - Add retry logic for failed requests

2. **Token Management**:
   - Store tokens securely using AsyncStorage
   - Implement automatic token refresh
   - Handle token expiration gracefully

3. **Error Handling**:
   - Provide meaningful error messages to users
   - Log errors for debugging
   - Implement fallback mechanisms

4. **Offline Support**:
   - Cache responses for offline access
   - Queue write operations when offline
   - Sync when connection is restored

5. **Performance**:
   - Limit fields in read requests
   - Use pagination for large datasets
   - Implement caching for frequently accessed data

## Testing API Integration

The project includes test scripts for API integration in the `tests/odoo_api_tests/` directory. These tests demonstrate how to interact with the Odoo API and can be used as reference for implementing API calls in the application.

To run the API tests:

```bash
cd tests/odoo_api_tests
python run_tests.py
```

## Troubleshooting

### Common Issues

1. **Authentication Failures**:
   - Verify client ID and client secret
   - Check username and password
   - Ensure database name is correct

2. **Permission Errors**:
   - Verify user has necessary permissions in Odoo
   - Check access rights for specific models

3. **Data Format Issues**:
   - Ensure JSON data is properly formatted
   - Check field names and types
   - Verify required fields are included

4. **Network Issues**:
   - Check network connectivity
   - Verify server URL is correct
   - Check for firewall or proxy issues

### Debugging Tools

1. **Network Monitoring**:
   - Use React Native Debugger to monitor network requests
   - Check request and response headers
   - Examine response data

2. **Logging**:
   - Implement comprehensive logging
   - Log request parameters and responses
   - Use different log levels for different types of information

3. **API Testing Tools**:
   - Use Postman to test API endpoints
   - Compare results with application behavior
   - Verify authentication and parameters
