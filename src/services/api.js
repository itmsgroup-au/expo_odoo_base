import axios from 'axios';

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
    
    // Add more specific error handling based on response code
    if (error.response && error.response.status === 404) {
      console.warn('Endpoint not found, using fallback data');
      // We could potentially return a custom response here for certain endpoints
    }
    
    return Promise.reject(error);
  }
);

// Add cache-busting parameter to get requests
api.interceptors.request.use(request => {
  if (request.method === 'get') {
    // Add a timestamp parameter to bypass cache
    const separator = request.url.includes('?') ? '&' : '?';
    request.url = `${request.url}${separator}_t=${Date.now()}`;
  }
  return request;
});

// Generic function to search related models with pagination
export const searchRelated = async (model, domain = [], fields = ['id', 'name'], limit = 10, offset = 0, forceRefresh = false) => {
  // Create cache key based on parameters
  const cacheKey = `${model}_${JSON.stringify(domain)}_${JSON.stringify(fields)}_${limit}_${offset}`;
  
  // Try to get from cache first, respecting forceRefresh flag
  const cachedData = cache.get(cacheKey, forceRefresh);
  if (cachedData) {
    return cachedData;
  }
  
  try {
    const response = await api.get(`/api/v2/search_read/${model}`, {
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
    console.error(`Failed to search related model ${model}:`, error);
    throw error;
  }
};

// Function to clear cache for a model
export const clearModelCache = (model) => {
  cache.clearForModel(model);
};

// Function to completely reset all cache
export const resetAllCache = () => {
  cache.clearAll();
};

// Export cache utilities
export const invalidateCache = () => {
  cache.clearAll();
};

export default api;