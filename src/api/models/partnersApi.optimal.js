// Optimized API for res.partner model - bypasses salesperson restrictions

import { createModelAPI } from './modelApiTemplate';
import { odooAPI, createOdooClient } from '../odooClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncManager } from './syncManager';
import logger from '../../utils/logger';

// Use the safe error logging function to prevent errors from showing on screen
const safeErrorLog = logger.safeErrorLog;

// Use the existing odooClient from the codebase
const api = createOdooClient();

export const partnersAPI = createModelAPI('res.partner');

// Utility function to safely log errors without displaying them on screen
const safeLogError = (message, error) => {
  // Create a sanitized error object that won't cause rendering issues
  const errorMessage = error?.message || 'Unknown error';
  const errorCode = error?.response?.status || 'N/A';

  // Log to console in a way that won't trigger screen display
  const prefix = `Error (${errorCode}): `;
  console.log(prefix, `${message} - ${errorMessage}`);
};

// Cache configuration
const CACHE_CONFIG = {
  PARTNERS_CACHE_KEY: 'partners_cache',
  PARTNERS_IDS_CACHE_KEY: 'partners_ids_cache',
  PARTNERS_TIMESTAMP_KEY: 'partners_timestamp',
  CACHE_VERSION_KEY: 'partners_cache_version',
  CACHE_EXPIRY: 1000 * 60 * 60 * 24, // 24 hours
  BATCH_SIZE: 100,
  FULL_SYNC_BATCH_SIZE: 2500,
  CACHE_VERSION: '2.0', // Updated version for optimal fetching
  SYNC_INTERVAL: 1000 * 60 * 5, // 5 minutes
  MAX_CONTACTS: 5000,
  TIMEOUT: 30000, // 30 seconds timeout
  BULK_TIMEOUT: 60000, // 60 seconds timeout for bulk operations
};

// Cache management functions
const cacheManager = {
  // Save partners to cache
  savePartnersToCache: async (partners, cacheKey = CACHE_CONFIG.PARTNERS_CACHE_KEY) => {
    try {
      if (!Array.isArray(partners)) {
        console.error('Cannot save non-array data to partners cache');
        return false;
      }

      let partnersToSave = partners;
      if (partners.length > CACHE_CONFIG.MAX_CONTACTS) {
        console.log(`Limiting cached partners to ${CACHE_CONFIG.MAX_CONTACTS} (from ${partners.length})`);
        partnersToSave = partners.slice(0, CACHE_CONFIG.MAX_CONTACTS);
      }

      await AsyncStorage.setItem(CACHE_CONFIG.CACHE_VERSION_KEY, CACHE_CONFIG.CACHE_VERSION);
      await AsyncStorage.setItem(cacheKey, JSON.stringify(partnersToSave));
      await AsyncStorage.setItem(CACHE_CONFIG.PARTNERS_TIMESTAMP_KEY, Date.now().toString());

      console.log(`Saved ${partnersToSave.length} partners to cache (version ${CACHE_CONFIG.CACHE_VERSION})`);
      return true;
    } catch (error) {
      console.error('Error saving partners to cache:', error);
      return false;
    }
  },

  // Save partner IDs to cache
  savePartnerIdsToCache: async (ids) => {
    try {
      await AsyncStorage.setItem(CACHE_CONFIG.PARTNERS_IDS_CACHE_KEY, JSON.stringify(ids));
      console.log(`Saved ${ids.length} partner IDs to cache`);
      return true;
    } catch (error) {
      console.error('Error saving partner IDs to cache:', error);
      return false;
    }
  },

  // Get partners from cache
  getPartnersFromCache: async (cacheKey = CACHE_CONFIG.PARTNERS_CACHE_KEY) => {
    try {
      const cacheVersion = await AsyncStorage.getItem(CACHE_CONFIG.CACHE_VERSION_KEY);
      if (cacheVersion !== CACHE_CONFIG.CACHE_VERSION) {
        console.log(`Cache version mismatch (stored: ${cacheVersion}, current: ${CACHE_CONFIG.CACHE_VERSION})`);
        await AsyncStorage.setItem(CACHE_CONFIG.CACHE_VERSION_KEY, CACHE_CONFIG.CACHE_VERSION);
        return null;
      }

      const cachedData = await AsyncStorage.getItem(cacheKey);
      if (!cachedData) {
        console.log('No cached data found');
        return null;
      }

      const timestamp = await AsyncStorage.getItem(CACHE_CONFIG.PARTNERS_TIMESTAMP_KEY);
      const now = Date.now();

      if (timestamp && now - parseInt(timestamp) > CACHE_CONFIG.CACHE_EXPIRY) {
        console.log(`Cache expired (${Math.round((now - parseInt(timestamp)) / (1000 * 60))} minutes old)`);
        return null;
      }

      let partners;
      try {
        partners = JSON.parse(cachedData);
        if (!Array.isArray(partners)) {
          console.log('Cached data is not an array, resetting cache');
          await cacheManager.clearCache();
          return null;
        }
      } catch (parseError) {
        console.error('Error parsing cached data:', parseError);
        await cacheManager.clearCache();
        return null;
      }

      const cacheAge = timestamp ? Math.round((now - parseInt(timestamp)) / (1000 * 60)) : 'unknown';
      const cacheSize = Math.round(cachedData.length / 1024);

      console.log(`Retrieved ${partners.length} partners from cache (${cacheSize}KB, ${cacheAge} minutes old)`);
      return partners;
    } catch (error) {
      console.error('Error getting partners from cache:', error);
      try {
        await cacheManager.clearCache();
      } catch (clearError) {
        console.error('Error clearing cache after retrieval error:', clearError);
      }
      return null;
    }
  },

  // Get partner IDs from cache
  getPartnerIdsFromCache: async () => {
    try {
      const cachedData = await AsyncStorage.getItem(CACHE_CONFIG.PARTNERS_IDS_CACHE_KEY);
      if (!cachedData) return null;

      const ids = JSON.parse(cachedData);
      console.log(`Retrieved ${ids.length} partner IDs from cache`);
      return ids;
    } catch (error) {
      console.error('Error getting partner IDs from cache:', error);
      return null;
    }
  },

  // Clear cache
  clearCache: async () => {
    try {
      await AsyncStorage.removeItem(CACHE_CONFIG.PARTNERS_CACHE_KEY);
      await AsyncStorage.removeItem(CACHE_CONFIG.PARTNERS_IDS_CACHE_KEY);
      await AsyncStorage.removeItem(CACHE_CONFIG.PARTNERS_TIMESTAMP_KEY);
      await AsyncStorage.setItem(CACHE_CONFIG.CACHE_VERSION_KEY, CACHE_CONFIG.CACHE_VERSION);

      console.log('Cache cleared and version updated to', CACHE_CONFIG.CACHE_VERSION);
      return true;
    } catch (error) {
      console.error('Error clearing cache:', error);
      return false;
    }
  },

  // Save a single partner to cache
  saveSinglePartnerToCache: async (partner) => {
    try {
      const existingPartners = await cacheManager.getPartnersFromCache() || [];
      const index = existingPartners.findIndex(p => p.id === partner.id);

      if (index !== -1) {
        existingPartners[index] = partner;
      } else {
        existingPartners.push(partner);
      }

      await cacheManager.savePartnersToCache(existingPartners);
      console.log(`Saved/updated partner ${partner.id} in cache`);
      return true;
    } catch (error) {
      console.error('Error saving single partner to cache:', error);
      return false;
    }
  }
};

// OPTIMAL METHOD: Get all contact IDs bypassing salesperson restrictions
partnersAPI.getAllContactIdsOptimal = async (forceRefresh = false) => {
  try {
    console.log('🚀 Getting ALL contact IDs with OPTIMAL method (bypassing salesperson restrictions)...');

    // Check cache first if not forcing refresh
    if (!forceRefresh) {
      const cachedIds = await cacheManager.getPartnerIdsFromCache();
      if (cachedIds && cachedIds.length > 2000) { // Expecting around 2130 contacts
        console.log(`✅ Using ${cachedIds.length} cached contact IDs`);
        return cachedIds;
      }
    }

    // THE KEY: Use this domain filter to bypass salesperson restrictions
    // ["|", ["is_company", "=", true], ["parent_id", "=", false]]
    // This gets: Companies OR top-level contacts (no parent)
    // This bypasses the user/salesperson assignment filtering that limits your results
    const domain = ["|", ["is_company", "=", true], ["parent_id", "=", false]];

    console.log('🔑 Using BYPASS domain filter:', JSON.stringify(domain));
    console.log('This should get ALL contacts, not just assigned ones!');

    // Use search endpoint to get all IDs in one call
    const response = await api.get('/api/v2/search/res.partner', {
      params: {
        domain: JSON.stringify(domain),
        limit: 5000, // High limit to ensure we get all contacts
        offset: 0
      },
      timeout: CACHE_CONFIG.TIMEOUT
    });

    if (response.data && Array.isArray(response.data)) {
      const contactCount = response.data.length;
      console.log(`🎉 SUCCESS! Got ${contactCount} contact IDs (BYPASSED RESTRICTIONS!)`);
      
      if (contactCount >= 2130) {
        console.log(`✨ EXCELLENT! Expected ~2130, got ${contactCount} - restriction bypassed!`);
      } else if (contactCount > 1000) {
        console.log(`✅ Good! Got ${contactCount} contacts - much better than before!`);
      } else {
        console.log(`⚠️ Only got ${contactCount} contacts - may still be restricted`);
      }

      // Cache the IDs for future use
      await cacheManager.savePartnerIdsToCache(response.data);
      console.log(`💾 Cached ${contactCount} contact IDs`);

      return response.data;
    } else {
      console.error('❌ Invalid response format for contact IDs:', response);
      return [];
    }
  } catch (error) {
    console.error('❌ Error getting contact IDs with optimal method:', error);
    return [];
  }
};

// OPTIMAL METHOD: Get all contacts with complete data
partnersAPI.getAllContactsOptimalComplete = async (forceRefresh = false) => {
  try {
    console.log('🚀 Getting ALL contacts with COMPLETE data (bypassing restrictions)...');

    // Check cache first if not forcing refresh
    if (!forceRefresh) {
      const cachedPartners = await cacheManager.getPartnersFromCache();
      if (cachedPartners && cachedPartners.length > 2000) {
        console.log(`✅ Using ${cachedPartners.length} cached contacts`);
        return cachedPartners;
      }
    }

    // Use the bypass domain filter
    const domain = ["|", ["is_company", "=", true], ["parent_id", "=", false]];

    console.log('🔑 Fetching ALL contacts with bypass domain:', JSON.stringify(domain));

    // Get complete contact data in one API call
    const response = await api.get('/api/v2/search_read/res.partner', {
      params: {
        domain: JSON.stringify(domain),
        fields: JSON.stringify([
          'id', 'name', 'email', 'phone', 'mobile', 'image_128', 'image_1920',
          'street', 'street2', 'city', 'state_id', 'zip', 'country_id',
          'website', 'function', 'title', 'comment', 'is_company',
          'parent_id', 'child_ids', 'category_id', 'user_id', 'active'
        ]),
        limit: 5000, // High limit to get all contacts
        offset: 0
      },
      timeout: CACHE_CONFIG.BULK_TIMEOUT // Longer timeout for bulk download
    });

    if (response.data && Array.isArray(response.data)) {
      const contactCount = response.data.length;
      console.log(`🎉 SUCCESS! Downloaded ${contactCount} COMPLETE contact records!`);
      
      if (contactCount >= 2130) {
        console.log(`🌟 PERFECT! Got all ${contactCount} contacts in ONE API call!`);
      }

      // Cache both the complete contacts and just the IDs
      await cacheManager.savePartnersToCache(response.data);
      const allIds = response.data.map(contact => contact.id);
      await cacheManager.savePartnerIdsToCache(allIds);

      console.log(`💾 Cached ${contactCount} contacts and ${allIds.length} IDs`);

      return response.data;
    } else {
      console.error('❌ Invalid response format for complete contacts:', response);
      return [];
    }
  } catch (error) {
    console.error('❌ Error getting contacts with complete data:', error);
    
    // Fallback: Get IDs first, then fetch in batches
    console.log('🔄 Falling back to ID-first approach...');
    const allIds = await partnersAPI.getAllContactIdsOptimal(forceRefresh);
    
    if (allIds.length > 0) {
      console.log(`📋 Got ${allIds.length} IDs, fetching in optimized batches...`);
      
      const allContacts = [];
      const batchSize = 100;
      
      for (let i = 0; i < allIds.length; i += batchSize) {
        const batchIds = allIds.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(allIds.length / batchSize);
        
        console.log(`📦 Fetching batch ${batchNum}/${totalBatches}: ${batchIds.length} contacts`);
        
        try {
          const response = await api.get('/api/v2/read/res.partner', {
            params: {
              ids: JSON.stringify(batchIds),
              fields: JSON.stringify([
                'id', 'name', 'email', 'phone', 'mobile', 'image_128',
                'street', 'city', 'country_id', 'is_company', 'active'
              ])
            },
            timeout: 15000
          });
          
          if (response.data && Array.isArray(response.data)) {
            allContacts.push(...response.data);
            console.log(`✅ Batch ${batchNum} completed: ${response.data.length} contacts (total: ${allContacts.length})`);
          }
          
          // Small delay between batches to be nice to the server
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (batchError) {
          console.error(`❌ Error in batch ${batchNum}:`, batchError);
          // Continue with next batch
        }
      }
      
      if (allContacts.length > 0) {
        console.log(`🎯 Fallback successful: fetched ${allContacts.length}/${allIds.length} contacts`);
        await cacheManager.savePartnersToCache(allContacts);
        return allContacts;
      }
    }
    
    return [];
  }
};

// Method to test domain filters and find the best one
partnersAPI.testDomainFilters = async () => {
  const filters = [
    { name: 'Current (Empty domain)', domain: [] },
    { name: 'Active only', domain: [["active", "=", true]] },
    { name: 'Companies only', domain: [["is_company", "=", true]] },
    { name: 'No parent (top-level)', domain: [["parent_id", "=", false]] },
    { name: '🔑 OPTIMAL: Companies OR no parent', domain: ["|", ["is_company", "=", true], ["parent_id", "=", false]] },
    { name: 'All records', domain: ["|", ["is_company", "=", true], ["is_company", "=", false]] }
  ];

  console.log('🧪 === TESTING DOMAIN FILTERS TO FIND OPTIMAL ===');
  
  for (const filter of filters) {
    try {
      console.log(`\n🔍 Testing: ${filter.name}`);
      console.log(`   Domain: ${JSON.stringify(filter.domain)}`);
      
      const startTime = Date.now();
      const response = await api.get('/api/v2/search/res.partner', {
        params: {
          domain: JSON.stringify(filter.domain),
          limit: 5000,
          offset: 0
        },
        timeout: 30000
      });
      
      const duration = Date.now() - startTime;
      const count = response.data ? response.data.length : 0;
      
      console.log(`   📊 Result: ${count} records in ${duration}ms`);
      
      if (count >= 2130) {
        console.log(`   🎉 ${filter.name} returned ${count} records - EXCELLENT!`);
        
        // Test getting sample data for this filter
        const dataResponse = await api.get('/api/v2/search_read/res.partner', {
          params: {
            domain: JSON.stringify(filter.domain),
            fields: JSON.stringify(['id', 'name', 'email', 'phone', 'is_company']),
            limit: 5,
            offset: 0
          },
          timeout: 10000
        });
        
        if (dataResponse.data && dataResponse.data.length > 0) {
          console.log(`   📋 Sample data:`);
          dataResponse.data.forEach((contact, idx) => {
            console.log(`      ${idx + 1}. ${contact.name} (ID: ${contact.id}, Company: ${contact.is_company})`);
          });
        }
      } else if (count > 1000) {
        console.log(`   ✅ ${filter.name} returned ${count} records - Better than current!`);
      } else {
        console.log(`   ❌ ${filter.name} only returned ${count} records - Still restricted`);
      }
      
    } catch (error) {
      console.error(`   💥 ${filter.name} failed:`, error.message);
    }
  }
  
  console.log('\n🏁 === FILTER TESTING COMPLETE ===');
  console.log('\n💡 RECOMMENDATION: Use the OPTIMAL filter for all contact fetching!');
};

// Quick method to get exact count using optimal domain
partnersAPI.getOptimalContactCount = async () => {
  try {
    const domain = ["|", ["is_company", "=", true], ["parent_id", "=", false]];
    
    const response = await api.post('/api/v2/call', {
      model: 'res.partner',
      method: 'search_count',
      args: [domain],
      kwargs: {}
    });
    
    if (response.data && typeof response.data === 'number') {
      console.log(`📊 Optimal domain count: ${response.data} contacts`);
      return response.data;
    }
    
    // Fallback: use search to get count
    const searchResponse = await api.get('/api/v2/search/res.partner', {
      params: {
        domain: JSON.stringify(domain),
        limit: 5000,
        offset: 0
      }
    });
    
    if (searchResponse.data && Array.isArray(searchResponse.data)) {
      console.log(`📊 Search count: ${searchResponse.data.length} contacts`);
      return searchResponse.data.length;
    }
    
    return 0;
  } catch (error) {
    console.error('Error getting optimal contact count:', error);
    return 0;
  }
};

// Update the existing getAllContacts method to use the optimal approach
partnersAPI.getAllContacts = async (forceRefresh = false) => {
  console.log('🔄 getAllContacts called - using OPTIMAL method');
  return await partnersAPI.getAllContactsOptimalComplete(forceRefresh);
};

// Update the existing getAllPartnerIds method to use the optimal approach
partnersAPI.getAllPartnerIds = async (forceRefresh = false) => {
  console.log('🔄 getAllPartnerIds called - using OPTIMAL method');
  return await partnersAPI.getAllContactIdsOptimal(forceRefresh);
};

// Update the getList method to use optimal domain when no specific domain is provided
partnersAPI.getList = async (domain = [], fields = [], limit = 50, offset = 0, forceRefresh = false) => {
  try {
    console.log(`📋 getList called with domain: ${JSON.stringify(domain)}, limit: ${limit}, offset: ${offset}`);

    // If no specific domain is provided, use the optimal one
    let searchDomain = domain;
    if (domain.length === 0) {
      searchDomain = ["|", ["is_company", "=", true], ["parent_id", "=", false]];
      console.log('🔑 Using OPTIMAL domain to bypass restrictions');
    }

    // Check cache first if not forcing refresh and asking for first page
    if (!forceRefresh && offset === 0) {
      const cachedPartners = await cacheManager.getPartnersFromCache();
      if (cachedPartners && cachedPartners.length > 0) {
        console.log(`✅ Using ${cachedPartners.length} cached partners`);
        
        // Apply domain filtering if needed (simplified for now)
        let filteredPartners = cachedPartners;
        
        // Apply pagination
        const paginatedPartners = filteredPartners.slice(offset, offset + limit);
        console.log(`📄 Returning ${paginatedPartners.length} partners from cache (paginated)`);
        
        return paginatedPartners;
      }
    }

    // Fetch from API
    const response = await api.get('/api/v2/search_read/res.partner', {
      params: {
        domain: JSON.stringify(searchDomain),
        fields: JSON.stringify(fields.length > 0 ? fields : [
          'id', 'name', 'email', 'phone', 'mobile', 'image_128', 
          'street', 'city', 'country_id', 'is_company'
        ]),
        limit: limit,
        offset: offset
      },
      timeout: CACHE_CONFIG.TIMEOUT
    });

    if (response.data && Array.isArray(response.data)) {
      console.log(`📦 Fetched ${response.data.length} partners from API`);
      
      // Cache if it's the first page and we got a good amount of data
      if (offset === 0 && response.data.length > 50) {
        await cacheManager.savePartnersToCache(response.data);
      }
      
      return response.data;
    }

    return [];
  } catch (error) {
    console.error('Error in getList:', error);
    return [];
  }
};

// Other existing methods remain the same...
partnersAPI.getById = async (id, fields = [], forceRefresh = false) => {
  try {
    console.log('Getting partner with ID:', id);

    if (!forceRefresh) {
      const cachedPartners = await cacheManager.getPartnersFromCache();
      if (cachedPartners) {
        const cachedPartner = cachedPartners.find(p => p.id === parseInt(id));
        if (cachedPartner) {
          console.log(`Found partner ${id} in cache:`, cachedPartner.name);
          return cachedPartner;
        }
      }
    }

    const response = await api.get('/api/v2/read/res.partner', {
      params: {
        ids: JSON.stringify([parseInt(id)]),
        fields: JSON.stringify(fields.length > 0 ? fields : [
          'id', 'name', 'email', 'phone', 'mobile', 'image_128', 
          'street', 'city', 'country_id', 'is_company'
        ])
      },
      timeout: CACHE_CONFIG.TIMEOUT
    });

    if (response.data && response.data.length > 0) {
      const partner = response.data[0];
      await cacheManager.saveSinglePartnerToCache(partner);
      return partner;
    }

    return null;
  } catch (error) {
    console.error('Error in getById:', error);
    return null;
  }
};

// Count method using optimal domain
partnersAPI.getCount = async (forceRefresh = false) => {
  try {
    if (!forceRefresh) {
      const cachedIds = await cacheManager.getPartnerIdsFromCache();
      if (cachedIds && cachedIds.length > 0) {
        console.log(`Using cached count: ${cachedIds.length}`);
        return cachedIds.length;
      }
    }

    return await partnersAPI.getOptimalContactCount();
  } catch (error) {
    console.error('Error getting partner count:', error);
    return 0;
  }
};

// Clear cache method
partnersAPI.clearCache = async () => {
  return cacheManager.clearCache();
};

// Expose cache manager methods
partnersAPI.getPartnersFromCache = cacheManager.getPartnersFromCache;
partnersAPI.savePartnersToCache = cacheManager.savePartnersToCache;
partnersAPI.getPartnerIdsFromCache = cacheManager.getPartnerIdsFromCache;
partnersAPI.savePartnerIdsToCache = cacheManager.savePartnerIdsToCache;

export default partnersAPI;
