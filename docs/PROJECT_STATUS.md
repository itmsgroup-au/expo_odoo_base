# ExoMobile Project Status

## Current Status

ExoMobile is a React Native mobile application for Odoo ERP systems. The project aims to provide a seamless mobile experience for accessing and managing Odoo data on mobile devices, with offline capabilities and a user-friendly interface.

### Working Features

1. **Authentication System**: 
   - OAuth2 authentication with Odoo server
   - Token management and refresh
   - Session persistence

2. **Home Screen**: 
   - Tile-based dashboard
   - Quick access section
   - Activity feed

3. **Navigation**: 
   - Drawer menu
   - Stack navigation
   - Bottom tab navigation

4. **Settings Screen**: 
   - Theme selection
   - Language settings
   - Notification preferences

5. **Contact Management & Messaging**:
   - WhatsApp-style messaging interface
   - Message bubbles with sent/received styling
   - Attachment selection interface
   - Basic image handling

### In Progress Features

1. **Message Thread Enhancements**: 
   - Rich text support for messages
   - Advanced attachment handling
   - PDF and document previews
   - Multi-attachment support

2. **Profile Screen**: 
   - User information display
   - Profile editing
   - Authentication issues being resolved

3. **API Integration**: 
   - Basic CRUD operations for partners
   - Company information retrieval
   - User data management

4. **Offline Support**: 
   - Data caching
   - Offline queue
   - Synchronization

## Known Issues

1. **Message Thread Performance**:
   - RenderHtml component causes performance warnings
   - Keyboard handling needs improvement
   - Image attachment handling needs optimization
   - Large message threads can cause performance issues

2. **Profile Screen Authentication**: 
   - 401 errors when accessing profile data
   - Issues with token refresh
   - Inconsistent authentication headers

3. **API Integration**: 
   - Inconsistent response formats
   - Error handling needs improvement
   - Some endpoints not properly implemented

4. **Data Update Operations**: 
   - Issues with updating user and partner records
   - Inconsistent API usage between components
   - Error handling needs improvement

## Next Steps

1. **Enhance Messaging Features**:
   - Implement proper image preview and thumbnails
   - Add PDF and document viewer
   - Create multi-attachment support
   - Add compression options for large files
   - Implement background uploads/downloads

2. **Fix Authentication Issues**: 
   - Standardize authentication header format
   - Implement proper token refresh
   - Add better error handling for auth failures

3. **Improve API Integration**: 
   - Standardize API calls using the patterns from test examples
   - Implement proper error handling
   - Add retry logic for failed requests

4. **Complete Profile Screen**: 
   - Fix user data fetching
   - Implement profile editing
   - Add avatar management

5. **Enhance Offline Support**: 
   - Implement robust data caching
   - Add queue for offline operations
   - Develop conflict resolution strategy

6. **Add Model-Specific Screens**: 
   - Implement list views for common models
   - Create detail views
   - Add edit/create forms

## Technical Debt

1. **Message Thread Component**:
   - RenderHtml performance optimizations needed
   - Attachment handling needs refactoring
   - Memory usage optimization required

2. **API Client Inconsistency**: 
   - Multiple approaches to API calls (axios, fetch, direct)
   - Inconsistent error handling
   - Duplicate code for similar operations

3. **Authentication Management**: 
   - Token storage and refresh logic spread across files
   - Inconsistent header formatting
   - Lack of centralized auth state management

4. **Testing**: 
   - Limited test coverage
   - Manual testing required for many features
   - No automated UI tests

## Development Environment

- **Node.js**: 14+
- **React Native**: 0.72+
- **Expo**: Latest version
- **Odoo**: Version 18 (Sandbox environment)

## Odoo Server Configuration

- **URL**: https://stairmaster18.odoo-sandbox.com
- **Database**: STAIRMASTER_18_24032025
- **API**: REST API v2 with OAuth2 authentication

## API Integration

The application uses Odoo's REST API v2 with the following key endpoints:

### Authentication
- `/api/v2/authentication/oauth2/token`: OAuth2 token endpoint
- `/api/v2/session`: Session information
- `/api/v2/user`: Current user information
- `/api/v2/userinfo`: Detailed user information

### Data Operations
- `/api/v2/search_read/{model}`: Search and read records
- `/api/v2/read/{model}`: Read specific records
- `/api/v2/create/{model}`: Create new records
- `/api/v2/write/{model}`: Update existing records
- `/api/v2/unlink/{model}`: Delete records

### Messaging and Attachments
- `/api/v2/mail.message`: Message management
- `/api/v2/ir.attachment`: Attachment handling
- `/api/v2/mail.activity`: Activity tracking

### System Information
- `/api/v2/company`: Company information
- `/api/v2/database`: Database information
- `/api/v2/modules`: Installed modules

## Example API Usage

### Reading Records
```javascript
// Using fetch API
const fetchPartners = async () => {
  const token = await getAuthToken();
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'DATABASE': 'STAIRMASTER_18_24032025'
  };
  
  const response = await fetch(
    `https://stairmaster18.odoo-sandbox.com/api/v2/search_read/res.partner?domain=${encodeURIComponent(JSON.stringify([]))}&fields=${encodeURIComponent(JSON.stringify(['name', 'email', 'phone']))}&limit=10`,
    { headers }
  );
  
  return await response.json();
};
```

### Updating Records
```javascript
// Using fetch API
const updatePartner = async (partnerId, values) => {
  const token = await getAuthToken();
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'DATABASE': 'STAIRMASTER_18_24032025'
  };
  
  const response = await fetch(
    `https://stairmaster18.odoo-sandbox.com/api/v2/write/res.partner`, 
    {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        ids: [partnerId],
        values: values
      })
    }
  );
  
  return await response.json();
};
```

### Sending Messages with Attachments
```javascript
// Using fetch API with attachments
const postMessage = async (model, recordId, message, messageType, attachments) => {
  const token = await getAuthToken();
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'DATABASE': 'STAIRMASTER_18_24032025'
  };
  
  // Prepare message data
  const messageData = {
    model: model,
    res_id: recordId,
    body: message,
    message_type: messageType,
    attachments: attachments || []
  };
  
  const response = await fetch(
    `https://stairmaster18.odoo-sandbox.com/api/v2/create/mail.message`, 
    {
      method: 'POST',
      headers,
      body: JSON.stringify(messageData)
    }
  );
  
  return await response.json();
};
```

## Project Structure

```
exomobile/
├── src/
│   ├── api/                  # API integration with Odoo
│   │   ├── models/           # Model-specific API wrappers
│   │   ├── odooClient.js     # Main Odoo API client
│   │   └── auth.js           # Authentication service
│   ├── components/           # Reusable UI components
│   │   ├── MessageThread.js  # WhatsApp-style message thread component
│   │   └── tiles/            # Tile-based UI components
│   ├── contexts/             # React contexts
│   │   ├── auth/             # Authentication context
│   │   └── offline/          # Offline mode context
│   ├── features/             # Feature modules by domain
│   │   ├── auth/             # Authentication screens
│   │   ├── contacts/         # Contact management screens
│   │   ├── home/             # Home screen components
│   │   ├── profile/          # Profile screen components
│   │   └── settings/         # Settings screen
│   ├── navigation/           # Navigation configuration
│   ├── services/             # Business logic services
│   │   ├── api.js            # API service
│   │   └── storage.js        # Storage service
│   └── utils/                # Utility functions
├── tests/                    # Test configurations and scripts
│   └── odoo_api_tests/       # Tests for Odoo API integration
└── docs/                     # Documentation
```

## Getting Started

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/yourusername/exomobile.git
   cd exomobile
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Start the Development Server**:
   ```bash
   npm start
   ```

4. **Run on iOS Simulator**:
   ```bash
   npm run ios
   ```

5. **Run on Android Emulator**:
   ```bash
   npm run android
   ```

## Testing

The project includes test scripts for API integration in the `tests/odoo_api_tests/` directory. These tests demonstrate how to interact with the Odoo API and can be used as reference for implementing API calls in the application.

To run the API tests:

```bash
cd tests/odoo_api_tests
python run_tests.py
```

## Documentation

Additional documentation can be found in the `docs/` directory:

- `API_GUIDE.md`: Detailed information on the Odoo API
- `DEVELOPMENT.md`: Development guidelines and roadmap
- `TECHNICAL_GUIDE.md`: Technical architecture and implementation details
- `TASK_LIST.md`: Current tasks and progress tracking
