// API for res.partner model - Fixed version

import { createModelAPI } from './modelApiTemplate';
import { odooAPI, createOdooClient } from '../odooClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import logger from '../../utils/logger';

// Use the safe error logging function to prevent errors from showing on screen
const safeErrorLog = logger.safeErrorLog;

// Use the existing odooClient from the codebase
const api = createOdooClient();

// Create the base API object
const partnersAPI = createModelAPI('res.partner');

// Cache configuration
const CACHE_CONFIG = {
  PARTNERS_CACHE_KEY: 'partners_cache',
  PARTNERS_IDS_CACHE_KEY: 'partners_ids_cache',
  PARTNERS_TIMESTAMP_KEY: 'partners_timestamp',
  CACHE_VERSION_KEY: 'partners_cache_version',
  CACHE_EXPIRY: 1000 * 60 * 60 * 24, // 24 hours
  BATCH_SIZE: 100, // Batch size for better performance
  CACHE_VERSION: '1.4', // Version to invalidate cache on app updates
  MAX_CONTACTS: 5000, // Maximum number of contacts to cache
  TIMEOUT: 30000, // 30 seconds timeout for API requests
};

// Get all partner IDs with pagination
partnersAPI.getAllPartnerIds = async (forceRefresh = false, maxIds = CACHE_CONFIG.MAX_CONTACTS) => {
  try {
    // Check cache first if not forcing refresh
    if (!forceRefresh) {
      const cachedIds = await partnersAPI.getPartnerIdsFromCache();
      if (cachedIds && cachedIds.length > 0) {
        console.log(`Using ${cachedIds.length} cached partner IDs`);
        return cachedIds.slice(0, maxIds); // Limit to maxIds
      }
    }

    console.log(`Fetching partner IDs from API (limit: ${maxIds})`);

    // Use search endpoint to get IDs with pagination
    const batchSize = 500; // Smaller batch size to avoid timeouts
    let allPartnerIds = [];
    let hasMore = true;
    let currentOffset = 0;
    let retryCount = 0;
    const maxRetries = 3;

    // Only fetch up to maxIds to prevent excessive loading
    while (hasMore && allPartnerIds.length < maxIds && retryCount < maxRetries) {
      console.log(`Fetching partner IDs batch with offset ${currentOffset}`);

      try {
        // Calculate remaining IDs to fetch
        const remainingToFetch = maxIds - allPartnerIds.length;
        const currentBatchSize = Math.min(batchSize, remainingToFetch);

        const response = await api.get('/api/v2/search/res.partner', {
          params: {
            domain: JSON.stringify([]), // Empty domain to get all partners
            limit: currentBatchSize,
            offset: currentOffset
          },
          timeout: CACHE_CONFIG.TIMEOUT // Use longer timeout to prevent errors
        });

        if (response.data && Array.isArray(response.data) && response.data.length > 0) {
          allPartnerIds.push(...response.data);
          console.log(`Got ${response.data.length} partner IDs in this batch, total: ${allPartnerIds.length}`);

          // Check if we need to fetch more
          if (response.data.length < currentBatchSize || allPartnerIds.length >= maxIds) {
            hasMore = false;
          } else {
            currentOffset += response.data.length;
            // Add a small delay to avoid overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 500));
          }

          // Reset retry count on success
          retryCount = 0;
        } else {
          hasMore = false;
        }
      } catch (batchError) {
        console.error(`Error fetching partner IDs batch at offset ${currentOffset}:`, batchError);
        retryCount++;

        if (retryCount < maxRetries) {
          console.log(`Retry ${retryCount}/${maxRetries} after error, waiting 1000ms`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          console.log(`Max retries (${maxRetries}) reached, stopping ID fetch`);
          hasMore = false;
        }
      }
    }

    console.log(`Got a total of ${allPartnerIds.length} partner IDs from API`);

    // Cache the IDs even if we didn't get all of them
    if (allPartnerIds.length > 0) {
      await partnersAPI.savePartnerIdsToCache(allPartnerIds);
    }

    return allPartnerIds;
  } catch (error) {
    console.error('Error getting all partner IDs:', error);
    return [];
  }
};

// Get all contacts at once efficiently
partnersAPI.getAllContacts = async (forceRefresh = false) => {
  try {
    console.log('Getting all contacts at once...');

    // Check cache first if not forcing refresh
    if (!forceRefresh) {
      const cachedPartners = await partnersAPI.getPartnersFromCache();
      if (cachedPartners && cachedPartners.length > 0) {
        console.log(`Using ${cachedPartners.length} cached contacts`);
        return cachedPartners;
      }
    }

    // Get all contacts in batches
    const allContacts = [];
    const batchSize = 100; // Use a reasonable batch size

    // Get all partner IDs first
    const allIds = await partnersAPI.getAllPartnerIds(forceRefresh);
    console.log(`Got ${allIds.length} partner IDs, fetching contacts in batches...`);

    // Process in batches
    for (let i = 0; i < allIds.length; i += batchSize) {
      try {
        const batchIds = allIds.slice(i, i + batchSize);
        console.log(`Fetching batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allIds.length / batchSize)}: ${batchIds.length} contacts`);

        const response = await api.get('/api/v2/search_read/res.partner', {
          params: {
            domain: JSON.stringify([['id', 'in', batchIds]]),
            fields: JSON.stringify(['id', 'name', 'email', 'phone', 'mobile', 'image_128', 'street', 'city', 'country_id', 'is_company']),
            limit: batchIds.length,
            offset: 0
          },
          timeout: CACHE_CONFIG.TIMEOUT
        });

        if (response.data && Array.isArray(response.data) && response.data.length > 0) {
          allContacts.push(...response.data);
          console.log(`Fetched ${response.data.length} contacts in this batch, total: ${allContacts.length}`);

          // Save intermediate results to cache every 500 contacts
          if (allContacts.length % 500 === 0 || i + batchSize >= allIds.length) {
            await partnersAPI.savePartnersToCache(allContacts);
            console.log(`Saved ${allContacts.length} contacts to cache`);
          }
        }

        // Add a small delay between batches
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`Error fetching batch at offset ${i}:`, error);
        // Continue with next batch
      }
    }

    console.log(`Fetched a total of ${allContacts.length}/${allIds.length} contacts`);
    return allContacts;
  } catch (error) {
    console.error('Error getting all contacts:', error);
    return [];
  }
};

// Cache functions
partnersAPI.getPartnersFromCache = async () => {
  try {
    const cachedData = await AsyncStorage.getItem(CACHE_CONFIG.PARTNERS_CACHE_KEY);
    if (!cachedData) return null;

    const partners = JSON.parse(cachedData);
    console.log(`Retrieved ${partners.length} partners from cache`);
    return partners;
  } catch (error) {
    console.error('Error getting partners from cache:', error);
    return null;
  }
};

partnersAPI.savePartnersToCache = async (partners) => {
  try {
    await AsyncStorage.setItem(CACHE_CONFIG.PARTNERS_CACHE_KEY, JSON.stringify(partners));
    console.log(`Saved ${partners.length} partners to cache`);
    return true;
  } catch (error) {
    console.error('Error saving partners to cache:', error);
    return false;
  }
};

partnersAPI.getPartnerIdsFromCache = async () => {
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
};

partnersAPI.savePartnerIdsToCache = async (ids) => {
  try {
    await AsyncStorage.setItem(CACHE_CONFIG.PARTNERS_IDS_CACHE_KEY, JSON.stringify(ids));
    console.log(`Saved ${ids.length} partner IDs to cache`);
    return true;
  } catch (error) {
    console.error('Error saving partner IDs from cache:', error);
    return false;
  }
};

// Get the total count of partners
partnersAPI.getCount = async (forceRefresh = false) => {
  try {
    console.log('Getting total count of partners...');

    // Try to use cached IDs first if not forcing refresh
    if (!forceRefresh) {
      const cachedIds = await partnersAPI.getPartnerIdsFromCache();
      if (cachedIds && cachedIds.length > 0) {
        console.log(`Using cached partner IDs count: ${cachedIds.length}`);
        return cachedIds.length;
      }
    }

    // If no cached IDs or forcing refresh, get all IDs
    const allIds = await partnersAPI.getAllPartnerIds(forceRefresh);
    return allIds.length;
  } catch (error) {
    console.error('Error getting partner count:', error);
    return 0;
  }
};

// Get all contacts from cache (alias for getPartnersFromCache for compatibility)
partnersAPI.getAllContactsFromCache = async () => {
  return await partnersAPI.getPartnersFromCache();
};

// Get a single partner by ID
partnersAPI.getById = async (id, fields = [], forceRefresh = false) => {
  try {
    console.log(`Getting partner ${id} details...`);

    // Check cache first if not forcing refresh
    if (!forceRefresh) {
      const cachedPartners = await partnersAPI.getPartnersFromCache();
      if (cachedPartners && cachedPartners.length > 0) {
        const cachedPartner = cachedPartners.find(partner => partner.id === id);
        if (cachedPartner) {
          console.log(`Found partner ${id} in cache: ${cachedPartner.name}`);
          return cachedPartner;
        }
      }
    }

    // If not in cache or forcing refresh, fetch from server
    console.log(`Fetching partner ${id} from server...`);

    // Default fields if none provided
    if (!fields || fields.length === 0) {
      fields = [
        'id', 'name', 'email', 'phone', 'mobile', 'image_1920', 'street', 'street2',
        'city', 'state_id', 'zip', 'country_id', 'website', 'function', 'title',
        'comment', 'is_company', 'parent_id', 'child_ids', 'category_id', 'user_id'
      ];
    }

    // Use the API to get the partner
    const response = await api.get(`/api/v2/read/res.partner/${id}`, {
      params: {
        fields: JSON.stringify(fields)
      },
      timeout: CACHE_CONFIG.TIMEOUT
    });

    if (response.data) {
      console.log(`Fetched contact details: ${response.data.name}`);

      // Update the cache with this partner
      const cachedPartners = await partnersAPI.getPartnersFromCache() || [];
      const existingIndex = cachedPartners.findIndex(p => p.id === response.data.id);

      if (existingIndex >= 0) {
        cachedPartners[existingIndex] = response.data;
      } else {
        cachedPartners.push(response.data);
      }

      await partnersAPI.savePartnersToCache(cachedPartners);

      return response.data;
    }

    return null;
  } catch (error) {
    console.error(`Error getting partner ${id}:`, error);
    return null;
  }
};

// Export the API
export { partnersAPI };
export default partnersAPI;
