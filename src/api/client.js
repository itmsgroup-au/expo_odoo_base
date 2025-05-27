import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const API_URL = 'http://localhost:8069/api/v2';
const TOKEN_KEY = 'auth_token';

/**
 * API client for making requests to the Odoo REST API
 */
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Add auth token to requests
 */
apiClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    
    if (token) {
      config.headers.Authorization = ;
    }
    
    // Check for internet connection
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected && ['post', 'put', 'delete', 'patch'].includes(config.method)) {
      // Throw a custom error to be caught by the caller for offline handling
      throw new Error('OFFLINE_MODE');
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Handle response errors
 */
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Handle token expiration (401)
    if (error.response && error.response.status === 401) {
      // Clear token
      await AsyncStorage.removeItem(TOKEN_KEY);
      // Redirect to login (handled by auth context)
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;
