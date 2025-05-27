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
 * Authenticate user with Odoo server
 * @param {Object} serverConfig - Server configuration object
 * @returns {Object} Authentication result
 */
export const authenticateUser = async (serverConfig) => {
  try {
    // Create API URL with protocol and port
    const apiUrl = serverConfig.serverUrl;
    
    // Create a new axios instance for authentication
    const authClient = axios.create({
      baseURL: apiUrl,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // Attempt to authenticate by calling the session endpoint
    const response = await authClient.get('/api/v2/session', {
      auth: {
        username: serverConfig.username,
        password: serverConfig.password
      }
    });
    
    // If we get here, authentication was successful
    if (response.status === 200) {
      const sessionData = response.data;
      
      // Create and store session info
      const sessionInfo = {
        userId: sessionData.uid || sessionData.user_id?.[0],
        username: serverConfig.username,
        serverUrl: apiUrl,
        database: serverConfig.database,
        userContext: sessionData.user_context || {},
        apiVersion: sessionData.server_version_info?.join('.') || 'unknown',
        serverVersion: sessionData.server_version || 'unknown',
        lastLogin: new Date().toISOString(),
        sessionId: response.headers['set-cookie']?.join(';') || null,
        sessionExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours from now
      };
      
      // Save session info
      await AsyncStorage.setItem(STORAGE_KEYS.SESSION_INFO, JSON.stringify(sessionInfo));
      
      // Create auth token for future API calls (basic auth)
      const authToken = btoa(`${serverConfig.username}:${serverConfig.password}`);
      await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, authToken);
      
      // Import the API module here to avoid circular dependencies
      const api = require('./api').default;
      
      // Configure API with auth token
      if (api) {
        api.defaults.baseURL = apiUrl;
        api.defaults.headers.common['Authorization'] = `Basic ${authToken}`;
      }
      
      return {
        success: true,
        userId: sessionInfo.userId,
        sessionInfo
      };
    }
    
    return {
      success: false,
      error: 'auth_error',
      message: 'Authentication failed'
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
    // First check if we have a local session
    const sessionInfo = await AsyncStorage.getItem(STORAGE_KEYS.SESSION_INFO);
    if (!sessionInfo) {
      return null;
    }
    
    const parsedSession = JSON.parse(sessionInfo);
    
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
    const sessionInfo = await AsyncStorage.getItem(STORAGE_KEYS.SESSION_INFO);
    const authToken = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    
    if (sessionInfo && authToken) {
      // If we have session info and auth token, configure the API
      const sessionData = JSON.parse(sessionInfo);
      const api = require('./api').default;
      
      if (api && sessionData.serverUrl) {
        api.defaults.baseURL = sessionData.serverUrl;
        api.defaults.headers.common['Authorization'] = `Basic ${authToken}`;
      }
      
      return true;
    }
    
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
    // Try to logout of the server
    try {
      // Import the API module here to avoid circular dependencies
      const api = require('./api').default;
      if (api) {
        await api.get('/web/session/logout');
      }
    } catch (error) {
      // Ignore server-side logout errors
      console.warn('Server logout error (continuing with local logout):', error);
    }
    
    // Clear local session data
    await clearSessionData();
    
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
    // Only clear auth data, not configs
    await AsyncStorage.removeItem(STORAGE_KEYS.SESSION_INFO);
    await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    
    // Reset API cache
    resetAllCache();
    
    // Reset API auth header
    try {
      // Import the API module here to avoid circular dependencies
      const api = require('./api').default;
      if (api && api.defaults && api.defaults.headers) {
        delete api.defaults.headers.common['Authorization'];
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