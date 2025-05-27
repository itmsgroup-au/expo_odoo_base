# ExoMobile Technical Guide

## Architecture Overview

ExoMobile follows a modular architecture designed to simplify integration with Odoo ERP systems while providing a modern mobile experience. The core components are:

### Core Modules

1. **API Layer**
   - `odooClient.js`: Central client for Odoo REST API communication
   - Model-specific API wrappers in `src/api/models/`
   - Authentication handled via OAuth2 token-based authentication

2. **UI Components**
   - Tile-based UI components for the home screen
   - List, detail, and form templates for model data
   - Shared components like headers, loading states, etc.

3. **Navigation**
   - Stack-based navigation for model screens
   - Tab-based navigation for main app sections
   - Side menu for settings and utilities

4. **State Management**
   - Context-based authentication state
   - Model data management (fetch, cache, update)
   - Offline state handling

## Technical Details

### Odoo API Integration

The app uses Odoo's REST API (v2) to communicate with the server. The main endpoints used are:

- Authentication: `/api/v2/authentication/oauth2/token`
- User information: `/api/v2/user` and `/api/v2/userinfo`
- Model search: `/api/v2/search_read`
- Model read: `/api/v2/read/{model}`
- Model create: `/api/v2/create/{model}`
- Model update: `/api/v2/write/{model}`
- Model delete: `/api/v2/unlink/{model}`

Authentication is handled via OAuth2 tokens, with the token stored in AsyncStorage.

### App Initialization Flow

1. App starts and checks for stored OAuth2 token
2. If token exists, validate it and fetch user info
3. If token is valid, proceed to home screen
4. If token is invalid or missing, redirect to login screen
5. After login, store token and navigate to home screen

### Authentication Flow

1. User enters credentials on login screen
2. App requests OAuth2 token from Odoo server
3. Token is stored in AsyncStorage with expiration time
4. Token is included in all subsequent API requests
5. When token expires, app automatically refreshes it
6. If refresh fails, user is redirected to login screen

### Data Flow

1. **Fetching Data**:
   - API request made via model-specific wrapper (e.g., `usersAPI.get()`)
   - Authentication headers automatically added
   - Results cached with a TTL (30 seconds by default)
   - UI updated with fetched data
   - Error handling for network issues and authentication failures

2. **Creating/Updating Data**:
   - Form data collected in component state
   - Validated before submission
   - Sent to Odoo via API using appropriate endpoint
   - For updates, use `/api/v2/write/{model}` with proper format:
     ```javascript
     {
       ids: [recordId],
       values: updatedFields
     }
     ```
   - Cache invalidated on success
   - Error handling with user feedback

3. **Offline Support**:
   - Network status monitored via NetInfo
   - Changes queued when offline
   - Synced when connectivity is restored
   - Conflict resolution based on timestamps
   - Local storage for offline data access

## Development Environment

### Prerequisites

- Node.js 14+ and npm
- Expo CLI
- Access to an Odoo instance with REST API enabled

### Directory Structure and Conventions

- `src/api/models/`: One file per Odoo model (e.g., `partnersApi.js`)
- `src/features/`: Domain-specific modules, each with screens and components
- `src/components/`: Shared UI components
- `scripts/`: Automation and code generation tools

### Core Dependencies

- **React Native**: Mobile app framework
- **React Navigation**: Navigation handling
- **Axios**: HTTP client for API requests
- **Async Storage**: Persistent storage solution
- **Lucide Icons**: Icon library for UI elements

## Key Configurations

### Odoo Server Configuration

The Odoo server connection is configured in `src/config/odoo.js`:

```javascript
export const ODOO_CONFIG = {
  baseURL: 'https://stairmaster18.odoo-sandbox.com',
  db: 'STAIRMASTER_18_24032025',
  username: 'ptadmin',
  password: '++Uke52br++',
  clientId: 'ZqUAbvS6PIcOobKIjz4G4OuaKgm6pK9cpcpxBz1p',
  clientSecret: 'ZDfR6WHORSfrGSl424G9zNu5yXhfle6PRMGpC69M'
};
```

This configuration can be overridden at runtime based on user input or environment variables.

### Theme Configuration

UI theming is defined in `src/styles/theme.js` with common colors, spacing, and typography settings.

## Testing and Deployment

### Testing

The app includes basic test setups for:
- Component testing
- API service testing
- Integration testing

### Building for Production

To build the app for production:

```bash
# For Android
expo build:android

# For iOS
expo build:ios
```

## Extending the Application

### Adding a New Model

1. Run code generation: `./scripts/generate-model.sh --name "model_name" --odoo-model "odoo.model.name"`
2. Customize the generated screens in `src/features/model_name/`
3. Add the model to navigation in `src/navigation/AppNavigator.tsx`

### Customizing UI Components

The tile-based UI can be customized by modifying:
- `src/components/tiles/MainTile.tsx`: For main tiles
- `src/features/home/components/`: For home screen elements

### Adding New Features

1. Create a new feature directory in `src/features/`
2. Implement screens and components
3. Add to navigation
4. Create API services as needed

## Common Issues and Solutions

### Authentication Issues

If you encounter authentication problems:
- Verify OAuth2 credentials (client ID and client secret)
- Check that the user has proper permissions in Odoo
- Ensure the DATABASE header is included in all requests
- Check token expiration and refresh mechanism
- Verify the Odoo server URL is correct and accessible

### API Integration Issues

When working with the Odoo API:
- Use the correct endpoint format for each operation
- Follow the proper data structure for each request type
- Include all required fields in create/update operations
- Handle errors gracefully with user feedback
- Use the examples in `tests/odoo_api_tests/run_tests.py` as reference

### Profile Screen Issues

If the profile screen shows authentication errors:
- Check the token refresh mechanism
- Verify the user data fetching process
- Ensure proper error handling for 401 responses
- Use the correct format for update operations:
  ```javascript
  // For updating a user
  fetch(`${config.baseURL}/api/v2/write/res.users`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'DATABASE': config.db,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      ids: [userId],
      values: updatedFields
    })
  });
  ```

### Dependency Issues

For React Native dependency problems:
- Use `--legacy-peer-deps` when installing packages
- Check for compatibility with the React Native version
- Consider using Expo for simplified dependency management
- Avoid Node.js-specific modules that aren't compatible with React Native
