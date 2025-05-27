import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { resetAllCache } from './api';

// Constants for storage keys
const STORAGE_KEYS = {
  SERVER_CONFIG: 'serverConfig',
  SESSION_INFO: 'sessionInfo',
  AUTH_TOKEN: 'authToken',
};

/**
 * Authenticate user with Odoo server using OAuth2
 * @param {Object} serverConfig - Server configuration object
 * @returns {Object} Authentication result
 */
export const authenticateUser = async (serverConfig) => {
  try {
    console.log('Attempting to authenticate with:', serverConfig.serverUrl);

    // Import the odooClient module here to avoid circular dependencies
    const odooClient = require('../api/odooClient');

    // Prepare OAuth2 config
    const oauthConfig = {
      baseURL: serverConfig.serverUrl,
      db: serverConfig.database,
      username: serverConfig.username,
      password: serverConfig.password,
      clientId: serverConfig.clientId || 'GTZmuj6gqZduLrdaPCaiaWEQJrn2eWGhhyVwFgSr',
      clientSecret: serverConfig.clientSecret || 'EExqnTlEAYcZ9b6mnP2DYooRkWSnlTISB0PRZObM',
      authEndpoint: '/api/v2/authentication/oauth2/token',
      grantType: 'password'
    };

    // Try to get OAuth token
    try {
      // Log the server config for debugging
      console.log('Server config:', {
        serverUrl: serverConfig.serverUrl,
        database: serverConfig.database,
        username: serverConfig.username
      });

      // Create a new axios instance for authentication
      const authClient = axios.create({
        baseURL: serverConfig.serverUrl,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Create form data for the request (this is what the test script uses)
      const formData = new URLSearchParams();
      formData.append('client_id', oauthConfig.clientId);
      formData.append('client_secret', oauthConfig.clientSecret);
      formData.append('username', oauthConfig.username);
      formData.append('password', oauthConfig.password);
      formData.append('grant_type', oauthConfig.grantType);

      // Add 2FA code if provided
      if (serverConfig.twoFactorCode) {
        console.log('Adding 2FA code to request');
        formData.append('totp_code', serverConfig.twoFactorCode);
      }

      console.log('Requesting OAuth token with form data...');
      const tokenResponse = await authClient.post(
        oauthConfig.authEndpoint,
        formData,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      console.log('Token response status:', tokenResponse.status);
      console.log('Token response data:', tokenResponse.data);

      if (tokenResponse.status === 200 && tokenResponse.data.access_token) {
        console.log('Successfully obtained OAuth token');
        // Store token data
        const tokenData = {
          accessToken: tokenResponse.data.access_token,
          refreshToken: tokenResponse.data.refresh_token,
          expiresIn: tokenResponse.data.expires_in || 3600,
          expiresAt: Date.now() + ((tokenResponse.data.expires_in || 3600) * 1000),
          tokenType: tokenResponse.data.token_type || 'Bearer',
          // Store the server config with the token
          serverConfig: {
            baseURL: serverConfig.serverUrl,
            db: serverConfig.database,
            username: serverConfig.username
          }
        };

        await AsyncStorage.setItem('odooTokenData', JSON.stringify(tokenData));
        console.log('OAuth token obtained and stored');

        // Get session info to verify authentication
        try {
          console.log('Getting session info with token');
          const sessionResponse = await authClient.get('/api/v2/session', {
            headers: {
              'Authorization': `Bearer ${tokenData.accessToken}`,
              'DATABASE': serverConfig.database
            }
          });

          console.log('Session response status:', sessionResponse.status);
          console.log('Session response data:', sessionResponse.data);

          if (sessionResponse.status === 200) {
            return handleSuccessfulOAuthAuth(sessionResponse, serverConfig, tokenData);
          }
        } catch (sessionError) {
          console.error('Error getting session info:', sessionError);

          // Even if session info fails, we still have a token, so consider login successful
          return handleSuccessfulOAuthAuth({
            data: { uid: 1 },
            headers: {}
          }, serverConfig, tokenData);
        }
      }
    } catch (error) {
      console.error('OAuth authentication failed:', error);

      // Check if the error response indicates 2FA is required
      if (error.response && error.response.data) {
        console.log('OAuth error response data:', JSON.stringify(error.response.data));

        // Check for various 2FA error indicators
        const errorData = error.response.data;
        if (errorData.error === 'mfa_required' ||
            errorData.error === 'totp_required' ||
            (errorData.error_description && (
              errorData.error_description.includes('two-factor') ||
              errorData.error_description.includes('2fa') ||
              errorData.error_description.includes('MFA') ||
              errorData.error_description.includes('totp')
            ))) {
          console.log('2FA authentication required detected');
          return {
            success: false,
            error: 'auth_error',
            requires2FA: true,
            message: 'Two-factor authentication is required'
          };
        }
      }

      // Try using the odooAuth.login method as fallback
      if (odooClient && odooClient.odooAuth) {
        console.log('Trying fallback authentication method...');
        return await odooClient.odooAuth.login(serverConfig);
      }
    }

    return {
      success: false,
      error: 'auth_error',
      message: 'Authentication failed with all methods'
    };
  } catch (error) {
    console.error('Authentication error:', error);

    // Check if server is reachable
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.message.includes('Network Error')) {
      return {
        success: false,
        error: 'server_error',
        message: 'Could not connect to server'
      };
    }

    // Check if it's an authentication error
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      // Check if the error message indicates 2FA is required
      const errorData = error.response.data;
      if (errorData &&
          (errorData.error === 'mfa_required' ||
           errorData.error_description?.includes('two-factor') ||
           errorData.error_description?.includes('2fa') ||
           errorData.error_description?.includes('MFA'))) {
        return {
          success: false,
          error: 'auth_error',
          requires2FA: true,
          message: 'Two-factor authentication is required'
        };
      }

      return {
        success: false,
        error: 'auth_error',
        message: 'Invalid username or password'
      };
    }

    return {
      success: false,
      error: 'unknown_error',
      message: error.message || 'An unknown error occurred'
    };
  }
};

/**
 * Handle successful OAuth authentication response
 */
const handleSuccessfulOAuthAuth = (response, serverConfig, tokenData) => {
  console.log('OAuth Authentication successful!');

  // Extract session data from response
  const sessionData = response.data;

  console.log('Processing session data:', sessionData);
  console.log('Session headers:', response.headers);

  // Create and store session info
  const sessionInfo = {
    userId: sessionData.uid || 1, // Default to 1 if not found
    username: serverConfig.username,
    serverUrl: serverConfig.serverUrl,
    database: serverConfig.database,
    userContext: sessionData.user_context || {},
    apiVersion: sessionData.server_version_info?.join('.') || 'unknown',
    serverVersion: sessionData.server_version || 'unknown',
    lastLogin: new Date().toISOString(),
    sessionId: response.headers['set-cookie']?.join(';') || null,
    sessionExpiry: new Date(Date.now() + (tokenData.expiresIn * 1000)).toISOString()
  };

  console.log('Created session info:', sessionInfo);

  // Save session info
  AsyncStorage.setItem(STORAGE_KEYS.SESSION_INFO, JSON.stringify(sessionInfo));

  // Import the API module here to avoid circular dependencies
  const api = require('./api').default;

  // Configure API with token
  if (api) {
    api.defaults.baseURL = serverConfig.serverUrl;
    api.defaults.headers.common['Authorization'] = `Bearer ${tokenData.accessToken}`;
    if (serverConfig.database) {
      api.defaults.headers.common['DATABASE'] = serverConfig.database;
    }
  }

  // Save server config for future use
  saveServerConfig(serverConfig);

  return {
    success: true,
    userId: sessionInfo.userId,
    sessionInfo
  };
};

/**
 * Save server configuration
 * @param {Object} config - Server configuration object
 */
export const saveServerConfig = async (config) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.SERVER_CONFIG, JSON.stringify(config));
    return true;
  } catch (error) {
    console.error('Error saving server config:', error);
    return false;
  }
};

/**
 * Load server configuration
 * @returns {Object|null} Server configuration object or null if not found
 */
export const loadServerConfig = async () => {
  try {
    const config = await AsyncStorage.getItem(STORAGE_KEYS.SERVER_CONFIG);
    return config ? JSON.parse(config) : null;
  } catch (error) {
    console.error('Error loading server config:', error);
    return null;
  }
};

/**
 * Get current session information
 * @returns {Object|null} Session information object or null if not found
 */
export const getSessionInfo = async () => {
  try {
    console.log('Getting session info from storage');

    // First check if we have a local session
    const sessionInfo = await AsyncStorage.getItem(STORAGE_KEYS.SESSION_INFO);
    if (!sessionInfo) {
      console.log('No session info found in storage');
      return null;
    }

    const parsedSession = JSON.parse(sessionInfo);
    console.log('Session info found:', {
      userId: parsedSession.userId,
      username: parsedSession.username,
      serverUrl: parsedSession.serverUrl,
      database: parsedSession.database
    });

    // In a real app, we might validate the session with the server here
    // For now, just return the stored session

    return parsedSession;
  } catch (error) {
    console.error('Error getting session info:', error);
    return null;
  }
};

/**
 * Check if user is authenticated
 * @returns {boolean} Whether user is authenticated
 */
export const isAuthenticated = async () => {
  try {
    console.log('Checking authentication status');

    // Check for OAuth token
    const tokenData = await AsyncStorage.getItem('odooTokenData');
    const sessionInfo = await AsyncStorage.getItem(STORAGE_KEYS.SESSION_INFO);

    console.log('Token data exists:', !!tokenData);
    console.log('Session info exists:', !!sessionInfo);

    if (tokenData && sessionInfo) {
      // Parse token data
      const parsedToken = JSON.parse(tokenData);
      const sessionData = JSON.parse(sessionInfo);

      console.log('Token data:', {
        expiresAt: parsedToken.expiresAt ? new Date(parsedToken.expiresAt).toISOString() : 'none',
        serverConfig: parsedToken.serverConfig
      });

      console.log('Session data:', {
        userId: sessionData.userId,
        username: sessionData.username,
        serverUrl: sessionData.serverUrl,
        database: sessionData.database
      });

      // Check if token is expired
      const now = Date.now();
      if (parsedToken.expiresAt && now >= parsedToken.expiresAt) {
        console.log('Token is expired, attempting to refresh');
        // Token is expired, try to refresh it
        try {
          // Import the odooClient module here to avoid circular dependencies
          const odooClient = require('../api/odooClient');
          if (odooClient && odooClient.refreshOAuthToken) {
            await odooClient.refreshOAuthToken();
            console.log('Token refreshed successfully');
          }
        } catch (refreshError) {
          console.error('Error refreshing token:', refreshError);
          return false;
        }
      }

      // Configure API with token
      const api = require('./api').default;
      if (api && sessionData.serverUrl) {
        console.log('Configuring API with token');
        api.defaults.baseURL = sessionData.serverUrl;
        api.defaults.headers.common['Authorization'] = `Bearer ${parsedToken.accessToken}`;
        if (sessionData.database) {
          api.defaults.headers.common['DATABASE'] = sessionData.database;
        }
        console.log('API configured with:', {
          baseURL: api.defaults.baseURL,
          hasAuthHeader: !!api.defaults.headers.common['Authorization'],
          hasDBHeader: !!api.defaults.headers.common['DATABASE']
        });
      }

      console.log('Authentication check successful');
      return true;
    }

    console.log('Authentication check failed: missing token or session data');
    return false;
  } catch (error) {
    console.error('Error checking authentication:', error);
    return false;
  }
};

/**
 * Logout the current user
 */
export const logout = async () => {
  try {
    // Clear local session data
    await clearSessionData();

    // Also clear OAuth token
    await AsyncStorage.removeItem('odooTokenData');

    return true;
  } catch (error) {
    console.error('Error during logout:', error);
    throw error;
  }
};

/**
 * Clear all session data
 */
export const clearSessionData = async () => {
  try {
    // Clear auth data
    await AsyncStorage.removeItem(STORAGE_KEYS.SESSION_INFO);
    await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    await AsyncStorage.removeItem('odooTokenData');

    // Reset API cache
    resetAllCache();

    // Reset API auth header
    try {
      // Import the API module here to avoid circular dependencies
      const api = require('./api').default;
      if (api && api.defaults && api.defaults.headers) {
        delete api.defaults.headers.common['Authorization'];
        delete api.defaults.headers.common['DATABASE'];
      }
    } catch (error) {
      console.warn('Error resetting API headers:', error);
    }

    return true;
  } catch (error) {
    console.error('Error clearing session data:', error);
    return false;
  }
};

/**
 * Clear all data including configs
 */
export const clearAllData = async () => {
  try {
    // Clear session data
    await clearSessionData();

    // Clear server configs too
    await AsyncStorage.removeItem(STORAGE_KEYS.SERVER_CONFIG);

    return true;
  } catch (error) {
    console.error('Error clearing all data:', error);
    return false;
  }
};

/**
 * Refresh session
 * @returns {Object} Refresh result
 */
export const refreshSession = async () => {
  try {
    // Load current configs
    const config = await loadServerConfig();
    if (!config) {
      return {
        success: false,
        error: 'no_config',
        message: 'No server configuration found'
      };
    }

    // Re-authenticate
    return await authenticateUser(config);
  } catch (error) {
    console.error('Error refreshing session:', error);
    return {
      success: false,
      error: 'refresh_error',
      message: error.message || 'An unknown error occurred'
    };
  }
};