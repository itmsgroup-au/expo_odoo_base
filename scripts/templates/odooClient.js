import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Odoo API configuration - these will be set during initialization
const ODOO_CONFIG = {
  baseURL: 'http://localhost:8018',
  db: 'OCR',
  username: 'admin',
  password: 'admin',
};

// Storage keys
const AUTH_TOKEN_KEY = 'auth_token';
const USER_INFO_KEY = 'user_info';
const SERVER_CONFIG_KEY = 'server_config';

// Create API client
const odooClient = axios.create({
  baseURL: ODOO_CONFIG.baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Simple cache implementation
const cache = {
  data: {},
  timestamp: {},
  maxAge: 30 * 1000, // 30 seconds cache lifetime
  
  get: function(key, forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && 
        this.data[key] && 
        this.timestamp[key] && 
        now - this.timestamp[key] < this.maxAge) {
      console.log("Cache hit for " + key);
      return this.data[key];
    }
    console.log("Cache miss for " + key);
    return null;
  },
  
  set: function(key, data) {
    this.data[key] = data;
    this.timestamp[key] = Date.now();
  },
  
  clear: function(key) {
    delete this.data[key];
    delete this.timestamp[key];
  },
  
  clearForModel: function(model) {
    Object.keys(this.data).forEach(key => {
      if (key.startsWith(model)) {
        this.clear(key);
      }
    });
  },
  
  clearAll: function() {
    this.data = {};
    this.timestamp = {};
  }
};

// Add request interceptor for authentication
odooClient.interceptors.request.use(
  async (config) => {
    // Get stored token
    const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    
    if (token) {
      config.headers.Authorization = "Bearer " + token;
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor to handle token expiration
odooClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && error.response.status === 401) {
      // Token expired or invalid, clear stored credentials
      await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
      await AsyncStorage.removeItem(USER_INFO_KEY);
    }
    
    return Promise.reject(error);
  }
);

// Authentication methods
export const odooAuth = {
  /**
   * Login to Odoo and get session info
   * @param {Object} serverConfig - Server configuration object with serverUrl, database, username, password
   * @returns {Promise<Object>} The authentication result with success flag
   */
  async login(serverConfig = null) {
    try {
      const config = serverConfig || ODOO_CONFIG;
      
      // First, get the session info
      const sessionResponse = await odooClient.post('/web/session/authenticate', {
        jsonrpc: '2.0',
        params: {
          db: config.db || config.database,
          login: config.username,
          password: config.password,
        },
      });
      
      if (sessionResponse.data.error || !sessionResponse.data.result) {
        throw new Error(sessionResponse.data.error?.message || 'Authentication failed');
      }
      
      const userInfo = sessionResponse.data.result;
      
      // Get session_id from cookies or response
      const cookies = sessionResponse.headers['set-cookie'];
      let sessionId = '';
      
      if (cookies) {
        // Extract session_id from cookies
        const sessionCookie = cookies.find(cookie => cookie.includes('session_id'));
        if (sessionCookie) {
          sessionId = sessionCookie.split(';')[0].split('=')[1];
        }
      }
      
      // Store user info and session token
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, sessionId);
      await AsyncStorage.setItem(USER_INFO_KEY, JSON.stringify(userInfo));
      
      // Set base URL and auth header for future API calls
      odooClient.defaults.baseURL = config.serverUrl;
      odooClient.defaults.headers.common.Authorization = "Bearer " + sessionId;
      
      // Save server config if successful
      if (serverConfig) {
        await AsyncStorage.setItem(SERVER_CONFIG_KEY, JSON.stringify(serverConfig));
      }
      
      return { 
        success: true,
        userId: userInfo.uid || userInfo.user_id?.[0],
        sessionInfo: userInfo
      };
    } catch (error) {
      console.error('Login error:', error);
      
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
  },
  
  /**
   * Check if user is logged in
   * @returns {Promise<Boolean>}
   */
  async isLoggedIn() {
    try {
      const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      if (!token) return false;
      
      // Verify the token by making a test request
      const response = await odooClient.post('/web/session/get_session_info', {
        jsonrpc: '2.0',
      });
      
      return !response.data.error && response.data.result;
    } catch (error) {
      return false;
    }
  },
  
  /**
   * Logout from Odoo
   * @returns {Promise<void>}
   */
  async logout() {
    try {
      await odooClient.post('/web/session/destroy', {
        jsonrpc: '2.0',
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear stored credentials
      await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
      await AsyncStorage.removeItem(USER_INFO_KEY);
      cache.clearAll();
    }
  },
  
  /**
   * Get stored user info
   * @returns {Promise<Object|null>}
   */
  async getUserInfo() {
    try {
      const userInfoStr = await AsyncStorage.getItem(USER_INFO_KEY);
      return userInfoStr ? JSON.parse(userInfoStr) : null;
    } catch (error) {
      console.error('Get user info error:', error);
      return null;
    }
  },
  
  /**
   * Get stored server config
   * @returns {Promise<Object|null>}
   */
  async getServerConfig() {
    try {
      const configStr = await AsyncStorage.getItem(SERVER_CONFIG_KEY);
      return configStr ? JSON.parse(configStr) : null;
    } catch (error) {
      console.error('Get server config error:', error);
      return null;
    }
  },
  
  /**
   * Save server config
   * @param {Object} config - Server configuration object
   * @returns {Promise<boolean>} Success flag
   */
  async saveServerConfig(config) {
    try {
      await AsyncStorage.setItem(SERVER_CONFIG_KEY, JSON.stringify(config));
      return true;
    } catch (error) {
      console.error('Save server config error:', error);
      return false;
    }
  }
};

// API methods for models
export const odooAPI = {
  /**
   * Search and read records
   * @param {string} model - Model name (e.g., 'res.partner')
   * @param {Array} domain - Search domain
   * @param {Array} fields - Fields to fetch
   * @param {number} limit - Maximum number of records
   * @param {number} offset - Offset for pagination
   * @param {boolean} forceRefresh - Force refresh from server
   * @returns {Promise<Array>} List of records
   */
  async searchRead(model, domain = [], fields = ['id', 'name'], limit = 80, offset = 0, forceRefresh = false) {
    const cacheKey = model + "_searchRead_" + JSON.stringify(domain) + "_" + JSON.stringify(fields) + "_" + limit + "_" + offset;
    
    // Try to get from cache
    const cachedData = cache.get(cacheKey, forceRefresh);
    if (cachedData) {
      return cachedData;
    }
    
    try {
      const response = await odooClient.get("/api/v2/search_read/" + model, {
        params: {
          domain: JSON.stringify(domain),
          fields: JSON.stringify(fields),
          limit,
          offset
        }
      });
      
      // Store in cache
      cache.set(cacheKey, response.data);
      return response.data;
    } catch (error) {
      console.error("Failed to search read model " + model + ":", error);
      throw error;
    }
  },
  
  /**
   * Read record details
   * @param {string} model - Model name
   * @param {number|Array<number>} ids - Record ID or array of IDs
   * @param {Array} fields - Fields to fetch
   * @param {boolean} forceRefresh - Force refresh from server
   * @returns {Promise<Object|Array>} Record or array of records
   */
  async read(model, ids, fields = [], forceRefresh = false) {
    const idsArray = Array.isArray(ids) ? ids : [ids];
    const cacheKey = model + "_read_" + idsArray.join(',') + "_" + JSON.stringify(fields);
    
    // Try to get from cache
    const cachedData = cache.get(cacheKey, forceRefresh);
    if (cachedData) {
      return cachedData;
    }
    
    try {
      const response = await odooClient.get("/api/v2/read/" + model, {
        params: {
          ids: JSON.stringify(idsArray),
          fields: JSON.stringify(fields)
        }
      });
      
      const result = response.data;
      
      // Store in cache
      cache.set(cacheKey, result);
      
      // Return single object if a single ID was requested
      return Array.isArray(ids) ? result : result[0];
    } catch (error) {
      console.error("Failed to read model " + model + " with ids " + ids + ":", error);
      throw error;
    }
  },
  
  /**
   * Create record
   * @param {string} model - Model name
   * @param {Object} data - Record data
   * @returns {Promise<number>} Created record ID
   */
  async create(model, data) {
    try {
      const response = await odooClient.post("/api/v2/create/" + model, {
        values: data
      });
      
      // Clear cache for this model
      cache.clearForModel(model);
      
      return response.data;
    } catch (error) {
      console.error("Failed to create record for model " + model + ":", error);
      throw error;
    }
  },
  
  /**
   * Update record
   * @param {string} model - Model name
   * @param {number|Array<number>} ids - Record ID or array of IDs
   * @param {Object} data - Update data
   * @returns {Promise<boolean>} Success flag
   */
  async update(model, ids, data) {
    try {
      const idsArray = Array.isArray(ids) ? ids : [ids];
      
      const response = await odooClient.put("/api/v2/write/" + model, {
        ids: idsArray,
        values: data
      });
      
      // Clear cache for this model
      idsArray.forEach(id => {
        cache.clear(model + "_read_" + id);
      });
      cache.clearForModel(model);
      
      return response.data;
    } catch (error) {
      console.error("Failed to update record for model " + model + " with ids " + ids + ":", error);
      throw error;
    }
  },
  
  /**
   * Delete record
   * @param {string} model - Model name
   * @param {number|Array<number>} ids - Record ID or array of IDs
   * @returns {Promise<boolean>} Success flag
   */
  async delete(model, ids) {
    try {
      const idsArray = Array.isArray(ids) ? ids : [ids];
      
      const response = await odooClient.delete("/api/v2/unlink/" + model, {
        data: {
          ids: idsArray
        }
      });
      
      // Clear cache for this model
      idsArray.forEach(id => {
        cache.clear(model + "_read_" + id);
      });
      cache.clearForModel(model);
      
      return response.data;
    } catch (error) {
      console.error("Failed to delete record for model " + model + " with ids " + ids + ":", error);
      throw error;
    }
  },
  
  /**
   * Call model method
   * @param {string} model - Model name
   * @param {string} method - Method name
   * @param {Array<number>} ids - Record IDs
   * @param {Array} args - Positional arguments
   * @param {Object} kwargs - Keyword arguments
   * @returns {Promise<any>} Method result
   */
  async callMethod(model, method, ids, args = [], kwargs = {}) {
    try {
      const response = await odooClient.post("/api/v2/call/" + model, {
        method,
        ids: Array.isArray(ids) ? ids : [ids],
        args,
        kwargs
      });
      
      // Clear cache for this model
      if (Array.isArray(ids)) {
        ids.forEach(id => {
          cache.clear(model + "_read_" + id);
        });
      } else {
        cache.clear(model + "_read_" + ids);
      }
      cache.clearForModel(model);
      
      return response.data;
    } catch (error) {
      console.error("Failed to call method " + method + " for model " + model + ":", error);
      throw error;
    }
  },
  
  /**
   * Get model fields
   * @param {string} model - Model name
   * @param {Array} attributes - Field attributes to fetch
   * @param {boolean} forceRefresh - Force refresh from server
   * @returns {Promise<Object>} Model fields
   */
  async getFields(model, attributes = ["type", "string", "required", "selection", "relation"], forceRefresh = false) {
    const cacheKey = model + "_fields_" + JSON.stringify(attributes);
    
    // Try to get from cache
    const cachedData = cache.get(cacheKey, forceRefresh);
    if (cachedData) {
      return cachedData;
    }
    
    try {
      const response = await odooClient.get("/api/v2/fields/" + model, {
        params: {
          attributes: JSON.stringify(attributes)
        }
      });
      
      // Store in cache
      cache.set(cacheKey, response.data);
      return response.data;
    } catch (error) {
      console.error("Failed to get fields for model " + model + ":", error);
      throw error;
    }
  },
  
  /**
   * Clear cache for all models
   */
  clearCache() {
    cache.clearAll();
  },
  
  /**
   * Clear cache for specific model
   * @param {string} model - Model name
   */
  clearModelCache(model) {
    cache.clearForModel(model);
  }
};

export default odooClient;