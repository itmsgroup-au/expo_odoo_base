// API for res.partner model

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

// Simple mock data for fallback
const mockPartners = [
  {
    id: 1,
    name: 'Stairmaster',
    email: 'info@stairmaster.com',
    phone: '+1 555-123-4567',
    mobile: '+1 555-987-6543',
    image_128: null,
    street: '123 Main St',
    city: 'Anytown',
    country_id: [1, 'United States'],
    is_company: true
  },
  {
    id: 2,
    name: 'OdooBot',
    email: 'odoobot@example.com',
    phone: null,
    mobile: null,
    image_128: null,
    street: null,
    city: null,
    country_id: false,
    is_company: false
  },
  {
    id: 3,
    name: 'Administrator',
    email: 'admin@example.com',
    phone: '+1 555-345-6789',
    mobile: null,
    image_128: null,
    street: '789 Admin Blvd',
    city: 'Adminville',
    country_id: [1, 'United States'],
    is_company: false
  }
];

// Cache configuration
const CACHE_CONFIG = {
  PARTNERS_CACHE_KEY: 'partners_cache',
  PARTNERS_IDS_CACHE_KEY: 'partners_ids_cache',
  PARTNERS_TIMESTAMP_KEY: 'partners_timestamp',
  CACHE_VERSION_KEY: 'partners_cache_version',
  CACHE_EXPIRY: 1000 * 60 * 60 * 24, // 24 hours - increased from 30 minutes
  BATCH_SIZE: 100, // Increased batch size for better performance
  FULL_SYNC_BATCH_SIZE: 2500, // Large batch size for full sync operations
  CACHE_VERSION: '1.4', // Version to invalidate cache on app updates
  SYNC_INTERVAL: 1000 * 60 * 5, // 5 minutes - how often to check for new contacts
  MAX_CONTACTS: 5000, // Maximum number of contacts to cache (increased to handle larger datasets)
  TIMEOUT: 30000, // 30 seconds timeout for API requests
  BULK_TIMEOUT: 60000, // 60 seconds timeout for bulk operations
};

// Cache management functions
const cacheManager = {
  // Save partners to cache
  savePartnersToCache: async (partners, cacheKey = CACHE_CONFIG.PARTNERS_CACHE_KEY) => {
    try {
      // Validate partners is an array
      if (!Array.isArray(partners)) {
        console.error('Cannot save non-array data to partners cache');
        return false;
      }

      // Limit the number of partners to prevent memory issues
      let partnersToSave = partners;
      if (partners.length > CACHE_CONFIG.MAX_CONTACTS) {
        console.log(`Limiting cached partners to ${CACHE_CONFIG.MAX_CONTACTS} (from ${partners.length})`);
        partnersToSave = partners.slice(0, CACHE_CONFIG.MAX_CONTACTS);
      }

      // Save the cache version
      await AsyncStorage.setItem(CACHE_CONFIG.CACHE_VERSION_KEY, CACHE_CONFIG.CACHE_VERSION);

      // Save the partners data
      await AsyncStorage.setItem(cacheKey, JSON.stringify(partnersToSave));

      // Save the timestamp
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
      // Check cache version first
      const cacheVersion = await AsyncStorage.getItem(CACHE_CONFIG.CACHE_VERSION_KEY);
      if (cacheVersion !== CACHE_CONFIG.CACHE_VERSION) {
        console.log(`Cache version mismatch (stored: ${cacheVersion}, current: ${CACHE_CONFIG.CACHE_VERSION})`);
        // Update the cache version for next time
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

      // Check if cache is expired
      if (timestamp && now - parseInt(timestamp) > CACHE_CONFIG.CACHE_EXPIRY) {
        console.log(`Cache expired (${Math.round((now - parseInt(timestamp)) / (1000 * 60))} minutes old)`);
        return null;
      }

      let partners;
      try {
        partners = JSON.parse(cachedData);

        // Validate that partners is an array
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

      // Calculate cache age in minutes
      const cacheAge = timestamp ? Math.round((now - parseInt(timestamp)) / (1000 * 60)) : 'unknown';

      // Calculate cache size in KB
      const cacheSize = Math.round(cachedData.length / 1024);

      console.log(`Retrieved ${partners.length} partners from cache (${cacheSize}KB, ${cacheAge} minutes old)`);
      return partners;
    } catch (error) {
      console.error('Error getting partners from cache:', error);
      // Clear cache on error to prevent future issues
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

      // Don't remove the version key, just update it
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
      // Get existing partners
      const existingPartners = await cacheManager.getPartnersFromCache() || [];

      // Find if partner already exists in cache
      const index = existingPartners.findIndex(p => p.id === partner.id);

      if (index !== -1) {
        // Update existing partner
        existingPartners[index] = partner;
      } else {
        // Add new partner
        existingPartners.push(partner);
      }

      // Save updated partners
      await cacheManager.savePartnersToCache(existingPartners);
      console.log(`Saved/updated partner ${partner.id} in cache`);
      return true;
    } catch (error) {
      console.error('Error saving single partner to cache:', error);
      return false;
    }
  }
};

// Add any custom methods for this specific model
export const getCustomerPartners = (limit = 20, offset = 0, forceRefresh = false) => {
  return partnersAPI.getList(
    [['customer_rank', '>', 0]], // Domain to filter customers
    ['id', 'name', 'email', 'phone', 'street', 'city', 'country_id'], // Fields
    limit,
    offset,
    forceRefresh
  );
};

// Efficient method to get all partner IDs with pagination
partnersAPI.getAllPartnerIds = async (forceRefresh = false, maxIds = CACHE_CONFIG.MAX_CONTACTS) => {
  try {
    // Check cache first if not forcing refresh
    if (!forceRefresh) {
      const cachedIds = await cacheManager.getPartnerIdsFromCache();
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

          // Reduce batch size on retry to improve chances of success
          if (batchSize > 100) {
            const newBatchSize = Math.floor(batchSize / 2);
            console.log(`Reducing batch size from ${batchSize} to ${newBatchSize}`);
            batchSize = newBatchSize;
          }
        } else {
          console.log(`Max retries (${maxRetries}) reached, stopping ID fetch`);
          hasMore = false;
        }
      }
    }

    console.log(`Got a total of ${allPartnerIds.length} partner IDs from API`);

    // Cache the IDs even if we didn't get all of them
    if (allPartnerIds.length > 0) {
      await cacheManager.savePartnerIdsToCache(allPartnerIds);
    }

    return allPartnerIds;
  } catch (error) {
    console.error('Error getting all partner IDs:', error);
    return [];
  }
};

// Efficiently fetch a single partner
const fetchSinglePartner = async (id, fields = []) => {
  try {
    console.log(`Fetching individual partner with ID ${id}`);
    const response = await api.get('/api/v2/read/res.partner', {
      params: {
        ids: JSON.stringify([id]),
        fields: JSON.stringify(fields.length > 0 ? fields : ['name', 'id', 'email', 'phone', 'mobile', 'image_128', 'street', 'city', 'country_id', 'is_company'])
      },
      timeout: CACHE_CONFIG.TIMEOUT // Use longer timeout to prevent errors
    });

    if (response.data && response.data.length > 0) {
      return response.data[0];
    }
    return null;
  } catch (error) {
    // Use safe error logging to prevent screen display
    safeLogError(`Error fetching individual partner ${id}`, error);
    return null;
  }
};

// Fetch partners with individual requests (most reliable but slower)
const fetchPartnersIndividually = async (ids, fields = []) => {
  if (!ids || ids.length === 0) return [];

  console.log(`Fetching ${ids.length} partners individually...`);
  const partners = [];
  let successCount = 0;

  // Process each partner individually
  for (const id of ids) {
    try {
      const partner = await fetchSinglePartner(id, fields);
      if (partner) {
        partners.push(partner);
        successCount++;
      }
      // Add a small delay between requests to reduce server load (10ms)
      await new Promise(resolve => setTimeout(resolve, 10));
    } catch (err) {
      // Use safe error logging to prevent screen display
      safeLogError(`Error fetching partner ${id}`, err);
    }
  }

  console.log(`Successfully fetched ${successCount}/${ids.length} partners individually`);
  return partners;
};



// Efficient method to fetch partners in batches
const fetchPartnersBatch = async (ids, fields = []) => {
  try {
    if (!ids || ids.length === 0) {
      return [];
    }

    console.log(`Fetching ${ids.length} partners...`);

    // Use a very small batch size to avoid 500 errors
    const batchSize = CACHE_CONFIG.BATCH_SIZE;
    const allPartners = [];

    // Process partners in smaller batches
    for (let i = 0; i < ids.length; i += batchSize) {
      const batchIds = ids.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;

      try {
        console.log(`Processing batch ${batchNumber} (${batchIds.length} partners)`);

        // For small batches (<=3), use individual fetches for reliability
        if (batchIds.length <= 3) {
          const individualPartners = await fetchPartnersIndividually(batchIds, fields);
          allPartners.push(...individualPartners);
          continue;
        }

        // For larger batches, try using search_read with ['id', 'in', ids] domain
        try {
          const response = await api.get('/api/v2/search_read/res.partner', {
            params: {
              domain: JSON.stringify([['id', 'in', batchIds]]),
              fields: JSON.stringify(fields.length > 0 ? fields : ['name', 'id', 'email', 'phone', 'mobile', 'image_128', 'street', 'city', 'country_id', 'is_company']),
              limit: batchIds.length,
              offset: 0
            },
            timeout: CACHE_CONFIG.TIMEOUT // Use longer timeout to prevent errors
          });

          if (response.data && Array.isArray(response.data)) {
            console.log(`Successfully fetched batch ${batchNumber} with ${response.data.length} partners`);
            allPartners.push(...response.data);
          } else {
            throw new Error('Invalid response format');
          }
        } catch (batchError) {
          // Use safe error logging to prevent screen display
          safeLogError(`Error fetching batch ${batchNumber}`, batchError);

          // If batch request fails, fall back to individual requests
          console.log(`Falling back to individual fetches for batch ${batchNumber}`);
          const individualPartners = await fetchPartnersIndividually(batchIds, fields);
          allPartners.push(...individualPartners);
        }
      } catch (err) {
        // Use safe error logging to prevent screen display
        safeLogError(`Error processing batch ${batchNumber}`, err);
      }

      // Add a small delay between batches to reduce server load (50ms)
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    console.log(`Total partners fetched: ${allPartners.length}/${ids.length}`);
    return allPartners;
  } catch (error) {
    // Use safe error logging to prevent screen display
    safeLogError('Error in fetchPartnersBatch', error);
    // If all batch attempts fail, try the individual approach
    return fetchPartnersIndividually(ids, fields);
  }
};

// Method that lists records efficiently with pagination and caching
partnersAPI.getList = async (domain = [], fields = [], limit = 50, offset = 0, forceRefresh = false) => {
  try {
    console.log(`Getting partners list with limit ${limit}, offset ${offset}, forceRefresh ${forceRefresh}`);

    // Check cache first if not forcing refresh
    if (!forceRefresh) {
      const cachedPartners = await cacheManager.getPartnersFromCache();
      if (cachedPartners && cachedPartners.length > 0) {
        console.log(`Using ${cachedPartners.length} cached partners (no server request needed)`);

        // Apply domain filtering if needed (simplified for now)
        let filteredPartners = cachedPartners;

        // If we have a domain filter for specific IDs, apply it
        if (domain.length > 0 && domain[0][0] === 'id' && domain[0][1] === 'in') {
          const specificIds = domain[0][2];
          filteredPartners = cachedPartners.filter(p => specificIds.includes(p.id));
          console.log(`Filtered to ${filteredPartners.length} partners by ID from cache`);
        } else if (domain.length > 0) {
          // For other domain filters, we need to fetch from server
          console.log('Domain filter requires server fetch:', domain);
          return null; // Signal that we need to fetch from server
        }

        // Apply pagination
        const paginatedPartners = filteredPartners.slice(offset, offset + limit);
        console.log(`Returning ${paginatedPartners.length} partners from cache (paginated)`);

        return paginatedPartners;
      } else {
        console.log('Cache empty or invalid, fetching from server');
      }
    } else {
      console.log('Force refresh requested, bypassing cache');
    }

    // If we're here, we need to fetch from the API
    try {
      // For large datasets, we'll use a progressive loading approach
      // First, check if we're requesting the first page (offset 0)
      if (offset === 0) {
        // For the first page, we'll get a larger set of IDs to ensure we can paginate properly
        // This ensures the user sees data quickly but also has enough for pagination
        const initialMaxIds = Math.max(1000, limit * 10); // Get at least 10 pages worth of IDs
        console.log(`Initial load: fetching first ${initialMaxIds} partner IDs`);

        const allPartnerIds = await getAllPartnerIds(forceRefresh, initialMaxIds);

        if (allPartnerIds.length === 0) {
          console.log('No partner IDs found, using mock data');
          return mockPartners;
        }

        // Start a background task to fetch more IDs if needed
        // This won't block the UI and will populate the cache for future requests
        setTimeout(async () => {
          try {
            console.log('Starting background fetch of additional partner IDs');
            // Get all IDs without a limit to ensure we have all contacts for pagination
            const fullIdList = await getAllPartnerIds(true, 5000); // Force refresh to get all IDs, with a higher limit
            console.log(`Background fetch completed, got ${fullIdList.length} total partner IDs`);

            // Also prefetch the next few pages of contacts to improve pagination performance
            if (fullIdList.length > limit) {
              console.log('Prefetching next page of contacts for smoother pagination');
              const nextPageIds = fullIdList.slice(limit, limit * 2);
              if (nextPageIds.length > 0) {
                const nextPageContacts = await fetchPartnersBatch(nextPageIds, fields);
                console.log(`Prefetched ${nextPageContacts.length} contacts for next page`);

                // Add to cache
                const existingCache = await cacheManager.getPartnersFromCache() || [];
                const combinedPartners = [...existingCache];

                // Add new partners or update existing ones
                nextPageContacts.forEach(partner => {
                  const index = combinedPartners.findIndex(p => p.id === partner.id);
                  if (index !== -1) {
                    combinedPartners[index] = partner;
                  } else {
                    combinedPartners.push(partner);
                  }
                });

                await cacheManager.savePartnersToCache(combinedPartners);
              }
            }
          } catch (bgError) {
            console.error('Background ID fetch error:', bgError);
          }
        }, 3000); // Wait 3 seconds before starting background fetch

        // Determine which IDs to fetch based on pagination
        const paginatedIds = allPartnerIds.slice(0, limit);
        console.log(`Fetching ${paginatedIds.length} partners for first page`);

        // Fetch the partners for the current page
        const partners = await fetchPartnersBatch(paginatedIds, fields);

        if (partners.length > 0) {
          console.log(`Successfully fetched ${partners.length} partners for first page`);

          // Cache the partners
          await cacheManager.savePartnersToCache(partners);

          return partners;
        }
      } else {
        // For subsequent pages, use the cached IDs if available
        const cachedIds = await cacheManager.getPartnerIdsFromCache();

        if (cachedIds && cachedIds.length > offset) {
          // We have enough cached IDs for this page
          const paginatedIds = cachedIds.slice(offset, offset + limit);
          console.log(`Fetching ${paginatedIds.length} partners for page at offset ${offset}`);

          // Fetch the partners for the current page
          const partners = await fetchPartnersBatch(paginatedIds, fields);

          if (partners.length > 0) {
            console.log(`Successfully fetched ${partners.length} partners for page at offset ${offset}`);

            // Cache the partners (append to existing cache)
            const existingCache = await cacheManager.getPartnersFromCache() || [];
            const combinedPartners = [...existingCache];

            // Add new partners or update existing ones
            partners.forEach(partner => {
              const index = combinedPartners.findIndex(p => p.id === partner.id);
              if (index !== -1) {
                combinedPartners[index] = partner;
              } else {
                combinedPartners.push(partner);
              }
            });

            await cacheManager.savePartnersToCache(combinedPartners);

            return partners;
          }
        } else {
          // We don't have enough cached IDs, try to fetch more
          console.log(`Not enough cached IDs for offset ${offset}, fetching more`);
          const allPartnerIds = await getAllPartnerIds(true); // Force refresh

          if (allPartnerIds.length > offset) {
            const paginatedIds = allPartnerIds.slice(offset, offset + limit);
            console.log(`Fetching ${paginatedIds.length} partners for page at offset ${offset}`);

            // Fetch the partners for the current page
            const partners = await fetchPartnersBatch(paginatedIds, fields);

            if (partners.length > 0) {
              console.log(`Successfully fetched ${partners.length} partners`);

              // Cache the partners (append to existing cache)
              const existingCache = await cacheManager.getPartnersFromCache() || [];
              const combinedPartners = [...existingCache];

              // Add new partners or update existing ones
              partners.forEach(partner => {
                const index = combinedPartners.findIndex(p => p.id === partner.id);
                if (index !== -1) {
                  combinedPartners[index] = partner;
                } else {
                  combinedPartners.push(partner);
                }
              });

              await cacheManager.savePartnersToCache(combinedPartners);

              return partners;
            }
          } else {
            console.log(`Not enough partner IDs available for offset ${offset}`);
            return []; // Return empty array to indicate end of list
          }
        }
      }
    } catch (apiError) {
      console.error('Error fetching partners from API:', apiError);
    }

    // Fall back to mock data only for first page, otherwise return empty array
    if (offset === 0) {
      console.log('Using mock data for first page');
      return mockPartners;
    } else {
      console.log('Returning empty array for pagination beyond available data');
      return [];
    }
  } catch (error) {
    console.error('Error in getList:', error);
    // Return mock data only for first page, otherwise return empty array
    return offset === 0 ? mockPartners : [];
  }
};

// Optimized method to get a single partner by ID
partnersAPI.getById = async (id, fields = [], forceRefresh = false) => {
  try {
    console.log('Getting partner with ID:', id);

    // Check cache first if not forcing refresh
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

    // Fetch the single partner
    const partner = await fetchSinglePartner(id, fields);

    if (partner) {
      // Cache the partner
      await cacheManager.saveSinglePartnerToCache(partner);
      return partner;
    }

    // Fall back to mock data
    const mockPartner = mockPartners.find(p => p.id === parseInt(id));
    if (mockPartner) {
      console.log('Using mock partner:', mockPartner);
      return mockPartner;
    }

    console.log('Partner not found');
    return null;
  } catch (error) {
    console.error('Error in getById:', error);

    // Find the partner with the matching ID in mock data
    const mockPartner = mockPartners.find(p => p.id === parseInt(id));
    if (mockPartner) {
      return mockPartner;
    }

    return null;
  }
};

// Create a new partner and update cache
partnersAPI.create = async (values) => {
  try {
    console.log('Creating partner with values:', values);

    // Use the create method from the odooAPI
    const response = await odooAPI.create(
      'res.partner',
      values
    );

    console.log('Created partner with ID:', response);

    if (response) {
      // Fetch the newly created partner to get all fields
      const newPartner = await partnersAPI.getById(response, [], true);

      if (newPartner) {
        // Update cache
        await cacheManager.saveSinglePartnerToCache(newPartner);

        // Update IDs cache
        const cachedIds = await cacheManager.getPartnerIdsFromCache() || [];
        if (!cachedIds.includes(response)) {
          cachedIds.push(response);
          await cacheManager.savePartnerIdsToCache(cachedIds);
        }
      }
    }

    return response;
  } catch (error) {
    console.error('Error creating partner:', error);
    return null;
  }
};

// Update a partner and update cache
partnersAPI.update = async (id, values) => {
  try {
    console.log('Updating partner with ID:', id);
    console.log('Update values:', values);

    // Use the update method from the odooAPI
    const response = await odooAPI.update(
      'res.partner',
      id,
      values
    );

    console.log('Updated partner:', response);

    if (response) {
      // Fetch the updated partner to get all fields
      const updatedPartner = await partnersAPI.getById(id, [], true);

      if (updatedPartner) {
        // Update cache
        await cacheManager.saveSinglePartnerToCache(updatedPartner);
      }
    }

    return response;
  } catch (error) {
    console.error('Error updating partner:', error);
    return null;
  }
};

// Delete a partner and update cache
partnersAPI.delete = async (id) => {
  try {
    console.log('Deleting partner with ID:', id);

    // Use the delete method from the odooAPI
    const response = await odooAPI.delete(
      'res.partner',
      id
    );

    console.log('Deleted partner:', response);

    if (response) {
      // Update cache
      const cachedPartners = await cacheManager.getPartnersFromCache() || [];
      const updatedPartners = cachedPartners.filter(p => p.id !== parseInt(id));
      await cacheManager.savePartnersToCache(updatedPartners);

      // Update IDs cache
      const cachedIds = await cacheManager.getPartnerIdsFromCache() || [];
      const updatedIds = cachedIds.filter(cachedId => cachedId !== parseInt(id));
      await cacheManager.savePartnerIdsToCache(updatedIds);
    }

    return response;
  } catch (error) {
    console.error('Error deleting partner:', error);
    return null;
  }
};

// Get the count of contacts
partnersAPI.getCount = async (forceRefresh = false) => {
  try {
    // If we have cached IDs, use their length
    if (!forceRefresh) {
      const cachedIds = await cacheManager.getPartnerIdsFromCache();
      if (cachedIds && cachedIds.length > 0) {
        console.log(`Using cached count: ${cachedIds.length}`);
        return cachedIds.length;
      }
    }

    // For a more efficient count, try using the search_count endpoint first
    try {
      console.log('Fetching count using search_count endpoint');
      const response = await api.get('/api/v2/call', {
        params: {
          model: 'res.partner',
          method: 'search_count',
          args: JSON.stringify([[]]), // Empty domain to count all partners
          kwargs: JSON.stringify({})
        },
        timeout: CACHE_CONFIG.TIMEOUT
      });

      if (response.data && typeof response.data === 'number') {
        console.log(`Got count from search_count: ${response.data}`);
        return response.data;
      }
    } catch (countError) {
      console.error('Error using search_count:', countError);
      // Fall back to getAllPartnerIds
    }

    // If search_count fails, fall back to getting all IDs
    // But limit the number to avoid timeouts
    console.log('Falling back to partnersAPI.getAllPartnerIds for count');
    const allIds = await partnersAPI.getAllPartnerIds(forceRefresh, 2500); // Limit to 2500 IDs

    // If we got the maximum number, add a note that there might be more
    if (allIds.length >= 2500) {
      console.log('Warning: Partner count may be higher than returned value');
    }

    return allIds.length;
  } catch (error) {
    console.error('Error getting partner count:', error);

    // Try to get a cached count as a last resort
    try {
      const cachedPartners = await cacheManager.getPartnersFromCache();
      if (cachedPartners && cachedPartners.length > 0) {
        console.log(`Using cached partners length as count: ${cachedPartners.length}`);
        return cachedPartners.length;
      }
    } catch (cacheError) {
      console.error('Error getting cached partners:', cacheError);
    }

    return 10; // Fallback count
  }
};

// Clear the partners cache
partnersAPI.clearCache = async () => {
  return cacheManager.clearCache();
};

// Expose cache manager methods for background sync
partnersAPI.getPartnersFromCache = cacheManager.getPartnersFromCache;
partnersAPI.savePartnersToCache = cacheManager.savePartnersToCache;
partnersAPI.getPartnerIdsFromCache = cacheManager.getPartnerIdsFromCache;
partnersAPI.savePartnerIdsToCache = cacheManager.savePartnerIdsToCache;

// Method to get all contacts at once efficiently
partnersAPI.getAllContacts = async (forceRefresh = false) => {
  try {
    console.log('Getting all contacts at once...');

    // Check cache first if not forcing refresh
    if (!forceRefresh) {
      const cachedPartners = await cacheManager.getPartnersFromCache();
      if (cachedPartners && cachedPartners.length > 0) {
        console.log(`Using ${cachedPartners.length} cached contacts`);
        return cachedPartners;
      }
    }

    // Get the total count of contacts
    const totalCount = await partnersAPI.getCount(true);
    console.log(`Total contacts to fetch: ${totalCount}`);

    if (totalCount === 0) {
      return [];
    }

    // Get all contacts in multiple batches
    const allContacts = [];
    let currentOffset = 0;
    let hasMore = true;
    let batchSize = 500; // Start with a reasonable batch size
    const maxBatchSize = 2500; // Maximum batch size to try
    let retryCount = 0;
    const maxRetries = 3;

    // Try with progressively larger batch sizes first
    for (let size = batchSize; size <= maxBatchSize; size *= 2) {
      try {
        console.log(`Attempting bulk download with batch size ${size}...`);

        // Use a longer timeout for bulk operations
        const response = await api.get('/api/v2/search_read/res.partner', {
          params: {
            domain: JSON.stringify([]),
            fields: JSON.stringify(['id', 'name', 'email', 'phone', 'mobile', 'image_128', 'street', 'city', 'country_id', 'is_company']),
            limit: size,
            offset: 0
          },
          timeout: CACHE_CONFIG.BULK_TIMEOUT * 2 // Double the timeout for larger batches
        });

        if (response.data && Array.isArray(response.data) && response.data.length > 0) {
          console.log(`Bulk download successful! Got ${response.data.length} contacts`);

          // If we got all or most of the contacts, we're done
          if (response.data.length >= totalCount * 0.9) {
            console.log(`Got ${response.data.length}/${totalCount} contacts (>90%), using this batch`);

            // Cache the contacts
            await cacheManager.savePartnersToCache(response.data);

            return response.data;
          }

          // Otherwise, save what we got and continue with paged download
          allContacts.push(...response.data);
          currentOffset = response.data.length;
          batchSize = size; // Use this successful batch size
          console.log(`Got ${response.data.length} contacts, continuing with paged download from offset ${currentOffset}`);
          break;
        }
      } catch (bulkError) {
        console.log(`Bulk download with size ${size} failed:`, bulkError.message);
        // Continue to the next size or fall back to paged download
      }
    }

    // If we didn't get any contacts yet, start from the beginning with paged download
    console.log(`Using paged download for contacts, starting from offset ${currentOffset}`);

    // Continue with paged download
    while (hasMore && allContacts.length < CACHE_CONFIG.MAX_CONTACTS) {
      console.log(`Fetching batch at offset ${currentOffset}, fetched so far: ${allContacts.length}`);

      try {
        // Calculate remaining contacts to fetch
        const remainingToFetch = Math.min(totalCount - allContacts.length, CACHE_CONFIG.MAX_CONTACTS - allContacts.length);
        const currentBatchSize = Math.min(batchSize, remainingToFetch);

        if (currentBatchSize <= 0) {
          console.log('No more contacts to fetch');
          break;
        }

        console.log(`Fetching batch of ${currentBatchSize} contacts at offset ${currentOffset}`);

        const response = await api.get('/api/v2/search_read/res.partner', {
          params: {
            domain: JSON.stringify([]),
            fields: JSON.stringify(['id', 'name', 'email', 'phone', 'mobile', 'image_128', 'street', 'city', 'country_id', 'is_company']),
            limit: currentBatchSize,
            offset: currentOffset
          },
          timeout: CACHE_CONFIG.TIMEOUT
        });

        if (response.data && Array.isArray(response.data) && response.data.length > 0) {
          allContacts.push(...response.data);
          console.log(`Fetched ${response.data.length} contacts in this batch, total: ${allContacts.length}`);

          // Check if we have more to fetch
          if (response.data.length < currentBatchSize) {
            console.log(`Got fewer contacts than requested (${response.data.length} < ${currentBatchSize}), must be the last batch`);
            hasMore = false;
          } else {
            currentOffset += response.data.length;
          }

          // Reset retry count on success
          retryCount = 0;

          // Small delay to prevent overwhelming the server
          await new Promise(resolve => setTimeout(resolve, 200));

          // Save what we have so far to cache periodically (every 500 contacts)
          if (allContacts.length % 500 === 0) {
            console.log(`Saving intermediate batch of ${allContacts.length} contacts to cache`);
            await cacheManager.savePartnersToCache(allContacts);
          }
        } else {
          console.log('No contacts returned in this batch');
          hasMore = false;
        }
      } catch (batchError) {
        console.error(`Error fetching batch at offset ${currentOffset}:`, batchError);
        retryCount++;

        if (retryCount >= maxRetries) {
          console.log(`Max retries (${maxRetries}) reached for this batch, continuing with next batch`);
          // Instead of stopping, just move to the next batch
          currentOffset += currentBatchSize;
          retryCount = 0;

          // Add a longer delay before continuing
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          // Reduce batch size on error
          if (batchSize > 100) {
            const newBatchSize = Math.floor(batchSize / 2);
            console.log(`Reducing batch size from ${batchSize} to ${newBatchSize}`);
            batchSize = newBatchSize;
          }

          // Add a delay before retrying
          console.log(`Retry ${retryCount}/${maxRetries}, waiting 1000ms`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    console.log(`Fetched a total of ${allContacts.length}/${totalCount} contacts`);

    // Cache the contacts even if we didn't get all of them
    if (allContacts.length > 0) {
      await cacheManager.savePartnersToCache(allContacts);
    }

    return allContacts;
  } catch (error) {
    console.error('Error getting all contacts:', error);
    return [];
  }
};

// Method to update the contacts cache with new/modified contacts
partnersAPI.updateContactsInCache = async (newContacts) => {
  try {
    if (!Array.isArray(newContacts) || newContacts.length === 0) {
      console.log('No contacts to update in cache');
      return false;
    }

    console.log(`Updating cache with ${newContacts.length} contacts`);

    // Get existing cached partners
    const existingPartners = await cacheManager.getPartnersFromCache() || [];

    // Create a map of existing partners by ID for fast lookup
    const existingPartnersMap = new Map();
    existingPartners.forEach(partner => {
      existingPartnersMap.set(partner.id, partner);
    });

    // Update existing partners and add new ones
    newContacts.forEach(contact => {
      existingPartnersMap.set(contact.id, contact);
    });

    // Convert map back to array
    const updatedPartners = Array.from(existingPartnersMap.values());

    // Save to cache
    await cacheManager.savePartnersToCache(updatedPartners);

    // Update IDs cache as well
    const allIds = updatedPartners.map(partner => partner.id);
    await cacheManager.savePartnerIdsToCache(allIds);

    console.log(`Updated cache with ${newContacts.length} contacts, total: ${updatedPartners.length}`);
    return true;
  } catch (error) {
    console.error('Error updating contacts in cache:', error);
    return false;
  }
};

// Method to check for modified contacts since a specific date
partnersAPI.getModifiedContactsSince = async (lastSyncDate) => {
  try {
    if (!lastSyncDate) {
      console.log('No last sync date provided, returning empty array');
      return [];
    }

    // Convert to date format Odoo can understand (YYYY-MM-DD HH:MM:SS)
    const formattedDate = new Date(lastSyncDate)
      .toISOString()
      .replace('T', ' ')
      .slice(0, 19);

    console.log(`Fetching contacts modified since ${formattedDate}`);

    // Create domain filter for modified contacts only
    const domain = [['write_date', '>=', formattedDate]];

    // Get modified contacts
    const modifiedContacts = [];
    let currentOffset = 0;
    let hasMore = true;
    const batchSize = CACHE_CONFIG.BATCH_SIZE;

    while (hasMore) {
      console.log(`Fetching modified contacts batch at offset ${currentOffset}`);

      try {
        const response = await api.get('/api/v2/search_read/res.partner', {
          params: {
            domain: JSON.stringify(domain),
            fields: JSON.stringify(['id', 'name', 'email', 'phone', 'mobile', 'image_128', 'street', 'city', 'country_id', 'is_company', 'write_date']),
            limit: batchSize,
            offset: currentOffset
          },
          timeout: CACHE_CONFIG.TIMEOUT
        });

        if (response.data && Array.isArray(response.data) && response.data.length > 0) {
          modifiedContacts.push(...response.data);
          console.log(`Fetched ${response.data.length} modified contacts in this batch, total: ${modifiedContacts.length}`);

          // Check if we have more to fetch
          if (response.data.length < batchSize) {
            hasMore = false;
          } else {
            currentOffset += response.data.length;
          }
        } else {
          hasMore = false;
        }
      } catch (error) {
        console.error(`Error fetching modified contacts at offset ${currentOffset}:`, error);
        hasMore = false;
      }
    }

    console.log(`Found ${modifiedContacts.length} contacts modified since ${formattedDate}`);
    return modifiedContacts;
  } catch (error) {
    console.error('Error getting modified contacts:', error);
    return [];
  }
};

// Method to get all contacts from cache (without pagination)
partnersAPI.getAllContactsFromCache = async () => {
  try {
    const cachedPartners = await cacheManager.getPartnersFromCache();
    if (cachedPartners && cachedPartners.length > 0) {
      console.log(`Retrieved ${cachedPartners.length} partners from cache (all at once)`);
      return cachedPartners;
    }
    return null;
  } catch (error) {
    console.error('Error getting all contacts from cache:', error);
    return null;
  }
};

// Search for partners with a specific domain
partnersAPI.searchRead = async (model, domain, fields, limit, offset, forceRefresh) => {
  // Maximum number of retries
  const MAX_RETRIES = 3;
  // Smaller batch size for retries
  const SMALLER_BATCH_SIZE = 5;

  // Helper function to delay execution
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Try with progressively smaller batch sizes
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      console.log(`Searching ${model} with domain (attempt ${attempt + 1}/${MAX_RETRIES}):`, domain);

      // Reduce batch size on retry
      const currentLimit = attempt === 0 ? limit : Math.min(SMALLER_BATCH_SIZE, limit);

      // Add exponential backoff delay between retries
      if (attempt > 0) {
        const delayTime = Math.pow(2, attempt) * 500; // 1s, 2s, 4s...
        console.log(`Retry attempt ${attempt + 1} after ${delayTime}ms delay`);
        await delay(delayTime);
      }

      const response = await api.get(`/api/v2/search_read/${model}`, {
        params: {
          domain: JSON.stringify(domain),
          fields: JSON.stringify(fields),
          limit: currentLimit,
          offset: offset
        },
        // Add timeout to prevent hanging requests
        timeout: 10000
      });

      if (response.data && Array.isArray(response.data)) {
        console.log(`Found ${response.data.length} records`);
        return response.data;
      }

      // Use console.log instead of console.warn to prevent screen display
      console.log(`[WARNING] Invalid response format from ${model} search`);

    } catch (error) {
      // Use safe error logging to prevent screen display
      safeErrorLog(`Error searching ${model} (attempt ${attempt + 1}/${MAX_RETRIES})`, error);

      // If it's the last attempt, try the fallback method
      if (attempt === MAX_RETRIES - 1) {
        try {
          console.log(`Trying fallback method for ${model}`);
          // Try using the /api/v2/call endpoint instead
          const fallbackResponse = await api.post('/api/v2/call', {
            model,
            method: 'search_read',
            args: [domain, fields],
            kwargs: { limit: Math.min(SMALLER_BATCH_SIZE, limit), offset }
          });

          if (fallbackResponse.data && Array.isArray(fallbackResponse.data)) {
            console.log(`Fallback method succeeded with ${fallbackResponse.data.length} records`);
            return fallbackResponse.data;
          }
        } catch (fallbackError) {
          // Use safe error logging for fallback errors too
          safeErrorLog(`Fallback method failed for ${model}`, fallbackError);
        }
      }
    }
  }

  // Use console.log instead of console.warn to prevent screen display
  console.log(`[WARNING] All attempts to search ${model} failed, returning empty array`);
  return [];
};

export default partnersAPI;
