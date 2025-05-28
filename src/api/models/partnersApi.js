// Clean, simple API for res.partner model - like the discuss feature

import { createModelAPI } from './modelApiTemplate';
import { createOdooClient } from '../odooClient';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Use the existing odooClient from the codebase
const api = createOdooClient();

export const partnersAPI = createModelAPI('res.partner');

// Cache configuration - simple and clean
const CACHE_CONFIG = {
  CONTACTS_CACHE_KEY: 'contacts_cache',
  CACHE_TIMESTAMP_KEY: 'contacts_cache_timestamp',
  CACHE_EXPIRY: 1000 * 60 * 60 * 24, // 24 hours
  TIMEOUT: 30000, // 30 seconds
};

// Simple cache manager
const cacheManager = {
  // Get contacts from cache
  getContactsFromCache: async () => {
    try {
      const cachedData = await AsyncStorage.getItem(CACHE_CONFIG.CONTACTS_CACHE_KEY);
      if (!cachedData) return null;
      const contacts = JSON.parse(cachedData);
      console.log(`Retrieved ${contacts.length} contacts from cache`);
      return contacts;
    } catch (error) {
      console.error('Error getting contacts from cache:', error);
      return null;
    }
  },

  // Save contacts to cache
  saveContactsToCache: async (contacts) => {
    try {
      if (!contacts || !Array.isArray(contacts)) return false;
      await AsyncStorage.setItem(CACHE_CONFIG.CONTACTS_CACHE_KEY, JSON.stringify(contacts));
      await AsyncStorage.setItem(CACHE_CONFIG.CACHE_TIMESTAMP_KEY, Date.now().toString());
      console.log(`Saved ${contacts.length} contacts to cache`);
      return true;
    } catch (error) {
      console.error('Error saving contacts to cache:', error);
      return false;
    }
  },

  // Clear cache
  clearCache: async () => {
    try {
      await AsyncStorage.removeItem(CACHE_CONFIG.CONTACTS_CACHE_KEY);
      await AsyncStorage.removeItem(CACHE_CONFIG.CACHE_TIMESTAMP_KEY);
      console.log('Cleared contacts cache');
      return true;
    } catch (error) {
      console.error('Error clearing cache:', error);
      return false;
    }
  },

  // Check if cache is expired
  isCacheExpired: async () => {
    try {
      const timestamp = await AsyncStorage.getItem(CACHE_CONFIG.CACHE_TIMESTAMP_KEY);
      if (!timestamp) return true;
      const cacheAge = Date.now() - parseInt(timestamp);
      return cacheAge > CACHE_CONFIG.CACHE_EXPIRY;
    } catch (error) {
      console.error('Error checking cache expiry:', error);
      return true;
    }
  }
};

// Main function to get all contacts - simple and fast like discuss feature
partnersAPI.getAllContacts = async (forceRefresh = false) => {
  try {
    console.log(`Fetching ALL res.partner records with domain: ["|", ["is_company", "=", true], ["parent_id", "=", false]]`);
    console.log(`Using direct search_read endpoint like helpdesk/discuss - expecting ~2130 contacts`);
    console.log(`Fields: ["id","name","email","phone","mobile","image_128","street","city","country_id","is_company","parent_id"]`);

    // Check cache first if not forcing refresh
    if (!forceRefresh) {
      const cachedContacts = await cacheManager.getContactsFromCache();
      if (cachedContacts && cachedContacts.length > 0) {
        const isExpired = await cacheManager.isCacheExpired();
        if (!isExpired) {
          console.log(`Using ${cachedContacts.length} cached contacts`);
          return cachedContacts;
        }
      }
    }

    // Fetch from API using the working domain filter
    const domain = ["|", ["is_company", "=", true], ["parent_id", "=", false]];
    const fields = [
      "id", "name", "email", "phone", "mobile", "image_128",
      "street", "city", "country_id", "is_company", "parent_id"
    ];

    const response = await api.get('/api/v2/search_read/res.partner', {
      params: {
        domain: JSON.stringify(domain),
        fields: JSON.stringify(fields)
        // No limit/offset - get ALL contacts at once like your curl example
      },
      timeout: 60000 // Longer timeout for bulk download
    });

    if (response.data && Array.isArray(response.data)) {
      console.log(`Successfully fetched ${response.data.length} res.partner records (should be ~2130)`);

      // Save to cache
      await cacheManager.saveContactsToCache(response.data);

      return response.data;
    }

    return [];
  } catch (error) {
    console.error('Error fetching contacts:', error);

    // Try to return cached data as fallback
    const cachedContacts = await cacheManager.getContactsFromCache();
    if (cachedContacts && cachedContacts.length > 0) {
      console.log(`API failed, using ${cachedContacts.length} cached contacts as fallback`);
      return cachedContacts;
    }

    return [];
  }
};

// Get contacts from cache only
partnersAPI.getContactsFromCache = cacheManager.getContactsFromCache;

// Save contacts to cache
partnersAPI.saveContactsToCache = cacheManager.saveContactsToCache;

// Clear cache
partnersAPI.clearCache = cacheManager.clearCache;

// Get a single contact by ID
partnersAPI.getById = async (id, fields = [], forceRefresh = false) => {
  try {
    console.log(`Getting contact with ID: ${id}`);

    // Check cache first if not forcing refresh
    if (!forceRefresh) {
      const cachedContacts = await cacheManager.getContactsFromCache();
      if (cachedContacts) {
        const cachedContact = cachedContacts.find(c => c.id === parseInt(id));
        if (cachedContact) {
          console.log(`Found contact ${id} in cache: ${cachedContact.name}`);
          return cachedContact;
        }
      }
    }

    // Fetch from API
    const response = await api.get('/api/v2/read/res.partner', {
      params: {
        ids: JSON.stringify([parseInt(id)]),
        fields: JSON.stringify(fields.length > 0 ? fields : [
          'id', 'name', 'email', 'phone', 'mobile', 'image_128',
          'street', 'city', 'country_id', 'is_company', 'parent_id'
        ])
      },
      timeout: CACHE_CONFIG.TIMEOUT
    });

    if (response.data && response.data.length > 0) {
      const contact = response.data[0];
      console.log(`Fetched contact: ${contact.name}`);
      return contact;
    }

    return null;
  } catch (error) {
    console.error(`Error getting contact ${id}:`, error);
    return null;
  }
};

// Override the default getList method to use our domain filter
partnersAPI.getList = async (domain = [], fields = [], limit = 50, offset = 0, forceRefresh = false) => {
  try {
    console.log(`getList called with domain: ${JSON.stringify(domain)}, limit: ${limit}, offset: ${offset}`);

    // If no specific domain is provided, use our working domain
    let searchDomain = domain;
    if (domain.length === 0) {
      searchDomain = ["|", ["is_company", "=", true], ["parent_id", "=", false]];
      console.log('Using working domain to get ALL contacts');
    }

    // Use default fields if none provided
    const searchFields = fields.length > 0 ? fields : [
      'id', 'name', 'email', 'phone', 'mobile', 'image_128',
      'street', 'city', 'country_id', 'is_company', 'parent_id'
    ];

    const response = await api.get('/api/v2/search_read/res.partner', {
      params: {
        domain: JSON.stringify(searchDomain),
        fields: JSON.stringify(searchFields),
        limit: limit,
        offset: offset
      },
      timeout: CACHE_CONFIG.TIMEOUT
    });

    if (response.data && Array.isArray(response.data)) {
      console.log(`Fetched ${response.data.length} contacts from API`);
      return response.data;
    }

    return [];
  } catch (error) {
    console.error('Error in getList:', error);
    return [];
  }
};

// Add compatibility methods for existing code
partnersAPI.getAllContactsOptimal = partnersAPI.getAllContacts;
partnersAPI.getPartnersFromCache = partnersAPI.getContactsFromCache;
partnersAPI.savePartnersToCache = partnersAPI.saveContactsToCache;

// Get count of contacts
partnersAPI.getCount = async (forceRefresh = false) => {
  try {
    // Try to get count from cache first
    if (!forceRefresh) {
      const cachedContacts = await cacheManager.getContactsFromCache();
      if (cachedContacts && cachedContacts.length > 0) {
        console.log(`Using cached count: ${cachedContacts.length}`);
        return cachedContacts.length;
      }
    }

    // Get count from API
    const domain = ["|", ["is_company", "=", true], ["parent_id", "=", false]];

    const response = await api.post('/api/v2/call', {
      model: 'res.partner',
      method: 'search_count',
      args: [domain],
      kwargs: {}
    });

    if (response.data && typeof response.data === 'number') {
      console.log(`API count: ${response.data} contacts`);
      return response.data;
    }

    return 0;
  } catch (error) {
    console.error('Error getting count:', error);
    return 0;
  }
};

export default partnersAPI;
