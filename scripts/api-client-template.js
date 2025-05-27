import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { offlineStorage } from './offline';
import { syncService } from './sync';

// Constants for storage keys
const STORAGE_KEYS = {
  SERVER_CONFIG: 'serverConfig',
  SESSION_INFO: 'sessionInfo',
  AUTH_TOKEN: 'authToken',
};

// Create API client instance without auth headers initially
const api = axios.create({
  headers: {
    'Content-Type': 'application/json'
  }
});

// Simple cache implementation with timestamp and force refresh option
const cache = {
  data: {},
  timestamp: {},
  maxAge: 30 * 1000, // 30 seconds cache lifetime - shorter for more frequent updates
  
  // Get data from cache if fresh, otherwise return null
  // Added forceRefresh parameter to bypass cache when needed
  get: function(key, forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && 
        this.data[key] && 
        this.timestamp[key] && 
        now - this.timestamp[key] < this.maxAge) {
      console.log(`Cache hit for ${key}`);
      return this.data[key];
    }
    console.log(`Cache miss for ${key}`);
    return null;
  },
  
  // Store data in cache
  set: function(key, data) {
    this.data[key] = data;
    this.timestamp[key] = Date.now();
  },
  
  // Clear specific cache item
  clear: function(key) {
    delete this.data[key];
    delete this.timestamp[key];
  },
  
  // Clear all cache for a specific model
  clearForModel: function(model) {
    Object.keys(this.data).forEach(key => {
      if (key.startsWith(model)) {
        this.clear(key);
      }
    });
  },
  
  // Clear all cache
  clearAll: function() {
    this.data = {};
    this.timestamp = {};
  }
};

// Handle API errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response || error);
    return Promise.reject(error);
  }
);

// Check if we need to handle offline mode for this request
api.interceptors.request.use(async (request) => {
  const isCurrentlyOffline = !(await isOnline());
  const isWriteOperation = ['post', 'put', 'delete', 'patch'].includes(request.method);
  
  if (isCurrentlyOffline && isWriteOperation) {
    // We're offline and trying to do a write operation
    // This will be handled by the offline queue
    throw new Error('OFFLINE_MODE');
  }
  
  return request;
}, error => Promise.reject(error));

// Add auth token to requests
api.interceptors.request.use(
  async (config) => {
    // Get stored token
    const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Function to clear cache for a model
export const clearModelCache = (model) => {
  cache.clearForModel(model);
};

// Function to completely reset all cache
export const resetAllCache = () => {
  cache.clearAll();
};

export default api;