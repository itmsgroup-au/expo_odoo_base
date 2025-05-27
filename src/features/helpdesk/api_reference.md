# Odoo Helpdesk REST API Reference

This document provides a comprehensive reference of all the Odoo Helpdesk REST API endpoints used in the ExoMobile application.

## Base URL

All API requests should be made to:

```
https://itmsgroup.com.au/api/v2/
```

## Authentication

Authentication is performed using OAuth2 with the password grant type.

**Endpoint:** `/api/v2/authentication/oauth2/token`

**Method:** POST

**Parameters:**
- `grant_type`: "password"
- `username`: Your Odoo username
- `password`: Your Odoo password
- `client_id`: Your OAuth client ID
- `client_secret`: Your OAuth client secret

**Response:**
```json
{
  "access_token": "your_access_token",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "your_refresh_token"
}
```

**Usage:**
```javascript
const tokenUrl = `${baseURL}/api/v2/authentication/oauth2/token`;
const params = new URLSearchParams();
params.append('grant_type', 'password');
params.append('username', username);
params.append('password', password);
params.append('client_id', clientId);
params.append('client_secret', clientSecret);

const response = await axios.post(tokenUrl, params, {
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded'
  }
});

const accessToken = response.data.access_token;
```

## Common Headers

All API requests should include these headers:

```javascript
{
  'Authorization': `Bearer ${accessToken}`,
  'DATABASE': databaseName,
  'Content-Type': 'application/json'
}
```

## Helpdesk Tickets

### Get Tickets

**Endpoint:** `/api/v2/search_read/helpdesk.ticket`

**Method:** GET

**Parameters:**
- `domain`: JSON string of domain filters
- `fields`: JSON string of fields to retrieve
- `limit`: Maximum number of records (default: 80)
- `offset`: Offset for pagination (default: 0)

**Example:**
```javascript
const params = {
  domain: JSON.stringify([['team_id', '=', 5]]),
  fields: JSON.stringify(['id', 'name', 'stage_id', 'user_id']),
  limit: 20,
  offset: 0
};

const response = await axios.get(`${baseURL}/api/v2/search_read/helpdesk.ticket`, {
  params,
  headers
});
```

### Get a Single Ticket

**Endpoint:** `/api/v2/read/helpdesk.ticket`

**Method:** GET

**Parameters:**
- `ids`: JSON string of record IDs
- `fields`: JSON string of fields to retrieve

**Example:**
```javascript
const params = {
  ids: JSON.stringify([ticketId]),
  fields: JSON.stringify(['id', 'name', 'description', 'team_id', 'stage_id'])
};

const response = await axios.get(`${baseURL}/api/v2/read/helpdesk.ticket`, {
  params,
  headers
});
```

### Create a Ticket

**Endpoint:** `/api/v2/create/helpdesk.ticket`

**Method:** POST

**Data:**
```json
{
  "values": {
    "name": "Ticket Subject",
    "description": "<p>Ticket description</p>",
    "team_id": 5,
    "priority": "1",
    "partner_name": "Customer Name",
    "partner_email": "customer@example.com"
  }
}
```

**Example:**
```javascript
const data = {
  values: {
    name: "Ticket Subject",
    description: "<p>Ticket description</p>",
    team_id: 5,
    priority: "1"
  }
};

const response = await axios.post(`${baseURL}/api/v2/create/helpdesk.ticket`, data, {
  headers
});
```

### Update a Ticket

**Endpoint:** `/api/v2/write/helpdesk.ticket`

**Method:** PUT

**Data:**
```json
{
  "ids": [123],
  "values": {
    "name": "Updated Subject",
    "stage_id": 2
  }
}
```

**Example:**
```javascript
const data = {
  ids: [ticketId],
  values: {
    name: "Updated Subject",
    stage_id: 2
  }
};

const response = await axios.put(`${baseURL}/api/v2/write/helpdesk.ticket`, data, {
  headers
});
```

### Delete a Ticket

**Endpoint:** `/api/v2/unlink/helpdesk.ticket`

**Method:** DELETE

**Data:**
```json
{
  "ids": [123]
}
```

**Example:**
```javascript
const data = {
  ids: [ticketId]
};

const response = await axios.delete(`${baseURL}/api/v2/unlink/helpdesk.ticket`, {
  data,
  headers
});
```

## Helpdesk Teams

### Get Teams

**Endpoint:** `/api/v2/search_read/helpdesk.team`

**Method:** GET

**Parameters:**
- `fields`: JSON string of fields to retrieve

**Example:**
```javascript
const params = {
  fields: JSON.stringify(['id', 'name', 'description'])
};

const response = await axios.get(`${baseURL}/api/v2/search_read/helpdesk.team`, {
  params,
  headers
});
```

## Helpdesk Stages

### Get Stages

**Endpoint:** `/api/v2/search_read/helpdesk.stage`

**Method:** GET

**Parameters:**
- `domain`: JSON string of domain filters (optional)
- `fields`: JSON string of fields to retrieve

**Example:**
```javascript
const params = {
  domain: JSON.stringify([['team_ids', 'in', [teamId]]]),
  fields: JSON.stringify(['id', 'name', 'sequence', 'team_ids'])
};

const response = await axios.get(`${baseURL}/api/v2/search_read/helpdesk.stage`, {
  params,
  headers
});
```

## Helpdesk Ticket Types

### Get Ticket Types

**Endpoint:** `/api/v2/search_read/helpdesk.ticket.type`

**Method:** GET

**Parameters:**
- `fields`: JSON string of fields to retrieve

**Example:**
```javascript
const params = {
  fields: JSON.stringify(['id', 'name'])
};

const response = await axios.get(`${baseURL}/api/v2/search_read/helpdesk.ticket.type`, {
  params,
  headers
});
```

## Helpdesk Tags

### Get Tags

**Endpoint:** `/api/v2/search_read/helpdesk.tag`

**Method:** GET

**Parameters:**
- `fields`: JSON string of fields to retrieve

**Example:**
```javascript
const params = {
  fields: JSON.stringify(['id', 'name', 'color'])
};

const response = await axios.get(`${baseURL}/api/v2/search_read/helpdesk.tag`, {
  params,
  headers
});
```

## Helpdesk SLA Policies

### Get SLA Policies

**Endpoint:** `/api/v2/search_read/helpdesk.sla`

**Method:** GET

**Parameters:**
- `domain`: JSON string of domain filters (optional)
- `fields`: JSON string of fields to retrieve

**Example:**
```javascript
const params = {
  domain: JSON.stringify([['team_id', '=', teamId]]),
  fields: JSON.stringify(['id', 'name', 'team_id', 'stage_id', 'time', 'priority'])
};

const response = await axios.get(`${baseURL}/api/v2/search_read/helpdesk.sla`, {
  params,
  headers
});
```

### Get SLA Status for a Ticket

**Endpoint:** `/api/v2/search_read/helpdesk.sla.status`

**Method:** GET

**Parameters:**
- `domain`: JSON string of domain filters
- `fields`: JSON string of fields to retrieve

**Example:**
```javascript
const params = {
  domain: JSON.stringify([['ticket_id', '=', ticketId]]),
  fields: JSON.stringify(['id', 'sla_id', 'ticket_id', 'deadline', 'reached_datetime', 'status'])
};

const response = await axios.get(`${baseURL}/api/v2/search_read/helpdesk.sla.status`, {
  params,
  headers
});
```

## Alternative Endpoint: RPC Call

For any operation, you can also use the generic RPC call endpoint:

**Endpoint:** `/api/v2/call`

**Method:** POST

**Data:**
```json
{
  "model": "helpdesk.ticket",
  "method": "read",
  "args": [[123], ["id", "name", "description"]],
  "kwargs": {}
}
```

**Example:**
```javascript
const data = {
  model: "helpdesk.ticket",
  method: "read",
  args: [[ticketId], ["id", "name", "description"]],
  kwargs: {}
};

const response = await axios.post(`${baseURL}/api/v2/call`, data, {
  headers
});

// Response will have a "result" property
const result = response.data.result;
```

## Field Formats

### Many2one Fields

For many2one fields (e.g., team_id), use the ID directly:

```javascript
{
  "team_id": 5
}
```

### Many2many Fields

For many2many fields (e.g., tag_ids), use the special format:

```javascript
{
  "tag_ids": [[6, 0, [1, 2, 3]]]
}
```

The `[6, 0, [1, 2, 3]]` format means:
- Command 6: Replace all records
- 0: Unused
- [1, 2, 3]: List of record IDs

### Date and Datetime Fields

Format dates as ISO strings:

```javascript
{
  "date_field": "2025-05-06",
  "datetime_field": "2025-05-06T14:30:00"
}
```

## Error Handling

If an API call fails, the error response will typically include:

```json
{
  "code": 400,
  "name": "odoo.exceptions.AccessDenied",
  "message": "Access Denied",
  "arguments": ["Access Denied"],
  "traceback": [...]
}
```

## Performance Considerations

1. Request only the fields you need using the `fields` parameter
2. Use domain filters to limit results (e.g., only get tickets for a specific team)
3. Use pagination (limit/offset) for large result sets
4. Consider implementing caching for frequently accessed data

## Conclusion

This API reference provides a comprehensive guide to the Odoo Helpdesk REST API endpoints. For implementation examples, refer to the files in the `/src/features/helpdesk/examples/` directory.
