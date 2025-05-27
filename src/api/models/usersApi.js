// API for res.users model

import { createModelAPI } from './modelApiTemplate';
import api from '../../services/api';
import { getUser, getSession } from '../odooClient';

export const usersAPI = createModelAPI('res.users');

// Add custom methods for user-specific operations
export const getCurrentUser = async (forceRefresh = false) => {
  try {
    console.log('Getting current user, forceRefresh:', forceRefresh);

    // Ensure we have a valid OAuth token
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const tokenData = await AsyncStorage.getItem('odooTokenData');
    console.log('Token data exists:', !!tokenData);

    if (!tokenData) {
      console.log('No token found, attempting to get one');
      // If no token, try to get one
      try {
        const { getOAuthToken } = require('../odooClient');
        await getOAuthToken();
        console.log('Successfully obtained new OAuth token');
      } catch (tokenError) {
        console.error('Error getting OAuth token:', tokenError);
      }
    } else {
      // Check if token is expired
      const parsedToken = JSON.parse(tokenData);
      const now = Date.now();

      console.log('Token data:', {
        expiresAt: parsedToken.expiresAt ? new Date(parsedToken.expiresAt).toISOString() : 'none',
        serverConfig: parsedToken.serverConfig ? {
          baseURL: parsedToken.serverConfig.baseURL,
          db: parsedToken.serverConfig.db,
          username: parsedToken.serverConfig.username
        } : 'none'
      });

      if (parsedToken.expiresAt && now >= parsedToken.expiresAt) {
        console.log('Token is expired, attempting to refresh');
        try {
          const { refreshOAuthToken } = require('../odooClient');
          await refreshOAuthToken();
          console.log('Successfully refreshed OAuth token');
        } catch (refreshError) {
          console.error('Error refreshing OAuth token:', refreshError);
        }
      } else {
        console.log('Token is still valid');
      }
    }

    // First try the /api/v2/user endpoint
    console.log('Attempting to get user data from /api/v2/user endpoint');
    try {
      const userData = await getUser();
      if (userData) {
        console.log('Successfully got user data from /api/v2/user endpoint:', userData);
        return userData;
      } else {
        console.log('No user data returned from /api/v2/user endpoint');
      }
    } catch (userEndpointError) {
      console.error('Error getting user from /api/v2/user endpoint:', userEndpointError);
    }

    // Fallback to getting the current user ID from session
    console.log('Falling back to session endpoint');
    try {
      const session = await getSession();
      console.log('Session data:', session);

      if (session && session.uid) {
        console.log('Got session data, fetching user with ID:', session.uid);
        try {
          const fields = [
            'id',
            'name',
            'login',
            'email',
            'phone',
            'image_256',
            'partner_id',
            'company_id',
            'signature',
            'notification_type',
            'tz'
          ];
          console.log('Fetching user record with fields:', fields);

          const userRecord = await usersAPI.getById(session.uid, fields, forceRefresh);

          if (userRecord) {
            console.log('Successfully got user record:', userRecord);
            return userRecord;
          } else {
            console.log('No user record returned');
          }
        } catch (userError) {
          console.error('Error fetching user by ID:', userError);
        }
      } else {
        console.log('No valid session data or missing user ID');
      }
    } catch (sessionError) {
      console.error('Error getting session:', sessionError);
    }

    // Get config for fallback
    console.log('All methods failed, using fallback user object');
    const { ODOO_CONFIG } = require('../../config/odoo');
    console.log('ODOO_CONFIG:', {
      username: ODOO_CONFIG.username,
      baseURL: ODOO_CONFIG.baseURL,
      db: ODOO_CONFIG.db
    });

    // Last resort fallback - create a minimal user object from config
    const fallbackUser = {
      id: session?.uid || 1,
      name: ODOO_CONFIG.username || 'Admin User',
      login: ODOO_CONFIG.username || 'admin',
      email: '',
      company_id: [1, 'My Company']
    };

    console.log('Created fallback user:', fallbackUser);
    return fallbackUser;
  } catch (error) {
    console.error('Error fetching current user:', error);

    // Get config for fallback
    console.log('Error occurred, using emergency fallback user object');
    const { ODOO_CONFIG } = require('../../config/odoo');

    // Return minimal user object instead of null to prevent UI errors
    const emergencyUser = {
      id: 1,
      name: ODOO_CONFIG.username || 'Admin User',
      login: ODOO_CONFIG.username || 'admin',
      email: '',
      company_id: [1, 'My Company']
    };

    console.log('Created emergency fallback user:', emergencyUser);
    return emergencyUser;
  }
};

// Get user preferences
export const getUserPreferences = async (userId, forceRefresh = false) => {
  try {
    return usersAPI.callMethod(userId, 'read_preferences', [], {});
  } catch (error) {
    console.error('Error fetching user preferences:', error);
    return null;
  }
};

// Update user preferences
export const updateUserPreferences = async (userId, preferences) => {
  try {
    return usersAPI.callMethod(userId, 'write_preferences', [], preferences);
  } catch (error) {
    console.error('Error updating user preferences:', error);
    return false;
  }
};

export default usersAPI;
