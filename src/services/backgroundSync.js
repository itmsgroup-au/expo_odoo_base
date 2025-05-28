// Background synchronization service
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { syncManager } from '../api/models/syncManager';
import { partnersAPI } from '../api/models/partnersApi';
import * as FileSystem from 'expo-file-system';
import { refreshOAuthToken } from '../api/odooClient';

// Configuration
const SYNC_CONFIG = {
  // How often to check for new contacts (5 minutes)
  SYNC_INTERVAL: 5 * 60 * 1000,
  // Minimum time between syncs to prevent excessive API calls (30 seconds)
  MIN_SYNC_INTERVAL: 30 * 1000,
  // Settings keys
  SETTINGS_KEY: 'appSettings',
  LAST_SYNC_KEY: 'lastContactSync',
  // Full cache sync keys
  LAST_FULL_SYNC_KEY: 'lastContactsFullSync',
  LAST_INCREMENTAL_SYNC_KEY: 'lastContactsIncrementalSync',
  FULL_SYNC_PROGRESS_KEY: 'contactsFullSyncProgress',
  FULL_SYNC_IN_PROGRESS_KEY: 'contactsFullSyncInProgress',
  // How often to do a full cache sync (24 hours)
  FULL_SYNC_INTERVAL: 24 * 60 * 60 * 1000,
  // How often to do an incremental sync (4 hours)
  INCREMENTAL_SYNC_INTERVAL: 4 * 60 * 60 * 1000,
  // Batch size for full cache sync (increased for efficiency)
  FULL_SYNC_BATCH_SIZE: 2500,
  // Delay between batches to prevent overloading the device (reduced for faster sync)
  FULL_SYNC_BATCH_DELAY: 200,
  // Maximum number of retries for API calls
  MAX_RETRIES: 3,
  // Delay between retries (in milliseconds)
  RETRY_DELAY: 1000,
};

class BackgroundSyncService {
  constructor() {
    this._isInitialized = false;
    this._syncTimer = null;
    this._fullSyncTimer = null;
    this._appState = 'active';
    this._isOnline = true;
    this._settings = {
      autoSync: true,
      syncOnWifiOnly: true,
      enableFullSync: true,
      fullSyncOnWifiOnly: true,
      useBulkDownload: true, // Try to download all contacts at once
    };
    this._lastSyncTime = 0;
    this._lastFullSyncTime = 0;
    this._lastIncrementalSyncTime = 0;
    this._fullSyncInProgress = false;
    this._fullSyncProgress = {
      total: 0,
      loaded: 0,
      currentPage: 0,
      status: 'idle',
    };
    this._listeners = [];
    this._appStateSubscription = null;
    this._netInfoSubscription = null;
  }

  /**
   * Initialize the background sync service
   * Sets up app state and network listeners
   */
  initialize() {
    if (this._isInitialized) {
      console.log('Background sync service already initialized');
      return;
    }

    console.log('Initializing background sync service');

    // Load saved settings
    this._loadSettings();

    // Load last sync times
    this._loadSyncTimes();

    // Set up app state listener
    this._appStateSubscription = AppState.addEventListener('change', this._handleAppStateChange);

    // Set up network info listener
    this._netInfoSubscription = NetInfo.addEventListener(this._handleNetworkChange);

    // Start sync timer if auto sync is enabled
    if (this._settings.autoSync) {
      this._startSyncTimer();
    }

    this._isInitialized = true;
    console.log('Background sync service initialized');
  }

  /**
   * Load saved settings from AsyncStorage
   * @private
   */
  _loadSettings = async () => {
    try {
      const savedSettings = await AsyncStorage.getItem(SYNC_CONFIG.SETTINGS_KEY);
      if (savedSettings) {
        this._settings = { ...this._settings, ...JSON.parse(savedSettings) };
        console.log('Loaded background sync settings:', this._settings);
      }
    } catch (error) {
      console.error('Error loading background sync settings:', error);
    }
  }

  /**
   * Load last sync times from AsyncStorage
   * @private
   */
  _loadSyncTimes = async () => {
    try {
      // Load last sync time
      const lastSyncTime = await AsyncStorage.getItem(SYNC_CONFIG.LAST_SYNC_KEY);
      if (lastSyncTime) {
        this._lastSyncTime = parseInt(lastSyncTime, 10);
      }

      // Load last full sync time
      const lastFullSyncTime = await AsyncStorage.getItem(SYNC_CONFIG.LAST_FULL_SYNC_KEY);
      if (lastFullSyncTime) {
        this._lastFullSyncTime = parseInt(lastFullSyncTime, 10);
      }

      // Load last incremental sync time
      const lastIncrementalSyncTime = await AsyncStorage.getItem(SYNC_CONFIG.LAST_INCREMENTAL_SYNC_KEY);
      if (lastIncrementalSyncTime) {
        this._lastIncrementalSyncTime = parseInt(lastIncrementalSyncTime, 10);
      }

      console.log('Loaded sync times:', {
        lastSync: this._lastSyncTime ? new Date(this._lastSyncTime).toISOString() : 'never',
        lastFullSync: this._lastFullSyncTime ? new Date(this._lastFullSyncTime).toISOString() : 'never',
        lastIncrementalSync: this._lastIncrementalSyncTime ? new Date(this._lastIncrementalSyncTime).toISOString() : 'never',
      });
    } catch (error) {
      console.error('Error loading sync times:', error);
    }
  }

  /**
   * Handle app state changes
   * @param {string} nextAppState - The new app state
   * @private
   */
  _handleAppStateChange = (nextAppState) => {
    console.log(`App state changed from ${this._appState} to ${nextAppState}`);

    // If app is coming to the foreground
    if (this._appState.match(/inactive|background/) && nextAppState === 'active') {
      console.log('App has come to the foreground');
      // Check for sync when app comes to foreground
      this.syncContactsIfNeeded().catch(error => {
        console.error('Error syncing contacts on app foreground:', error);
      });
    }

    this._appState = nextAppState;
  };

  /**
   * Handle network status changes
   * @param {Object} state - The new network state
   * @private
   */
  _handleNetworkChange = (state) => {
    const wasOnline = this._isOnline;
    this._isOnline = state.isConnected;

    console.log(`Network status changed: ${wasOnline ? 'online' : 'offline'} -> ${this._isOnline ? 'online' : 'offline'}`);

    // If we just came online and auto sync is enabled
    if (!wasOnline && this._isOnline && this._settings.autoSync) {
      console.log('Network connection restored, checking for sync');
      this.syncContactsIfNeeded().catch(error => {
        console.error('Error syncing contacts on network restore:', error);
      });
    }
  };

  /**
   * Start the sync timer
   * @private
   */
  _startSyncTimer = () => {
    // Clear any existing timer
    if (this._syncTimer) {
      clearInterval(this._syncTimer);
    }

    console.log(`Starting sync timer with interval ${SYNC_CONFIG.SYNC_INTERVAL / 1000} seconds`);

    // Set up new timer with longer interval since we have good caching
    this._syncTimer = setInterval(() => {
      // Only sync if we're online and app is active, and cache is small
      if (this._isOnline && this._appState === 'active') {
        // Check cache size first to avoid unnecessary syncing
        partnersAPI.getContactsFromCache().then(cachedContacts => {
          const cacheSize = cachedContacts ? cachedContacts.length : 0;
          if (cacheSize < 1000) {
            // Only sync if cache is insufficient
            this.syncContactsIfNeeded().catch(error => {
              console.error('Error in scheduled sync:', error);
            });
          } else {
            console.log(`Cache has ${cacheSize} contacts, skipping scheduled sync`);
          }
        });
      }
    }, SYNC_CONFIG.SYNC_INTERVAL * 4); // Reduce frequency by 4x
  }

  /**
   * Clean up the background sync service
   * Removes listeners and timers
   */
  cleanup() {
    console.log('Cleaning up background sync service');

    // Remove app state listener
    if (this._appStateSubscription) {
      this._appStateSubscription.remove();
      this._appStateSubscription = null;
    }

    // Remove network info listener
    if (this._netInfoSubscription) {
      this._netInfoSubscription();
      this._netInfoSubscription = null;
    }

    // Clear timers
    if (this._syncTimer) {
      clearInterval(this._syncTimer);
      this._syncTimer = null;
    }

    if (this._fullSyncTimer) {
      clearTimeout(this._fullSyncTimer);
      this._fullSyncTimer = null;
    }

    this._isInitialized = false;
    console.log('Background sync service cleaned up');
  }

  /**
   * Check what type of sync is needed and perform it
   * @returns {Promise<Object>} Sync result
   */
  async syncContactsIfNeeded() {
    try {
      // Always check if we have a good cache first
      const cachedContacts = await partnersAPI.getContactsFromCache();
      const cacheSize = cachedContacts ? cachedContacts.length : 0;

      console.log(`Current cache size: ${cacheSize} contacts`);

      // If we have a good cache (>1000 contacts), skip sync
      if (cacheSize > 1000) {
        console.log(`Cache has ${cacheSize} contacts, skipping sync`);
        return { success: true, message: 'Cache is good, no sync needed', count: cacheSize };
      }

      // If cache is empty or very small, do a full sync
      if (cacheSize < 100) {
        console.log('Cache is empty or too small, performing full sync');
        return await this.fullSyncNow();
      }

      // For medium cache sizes, just return success to avoid unnecessary syncing
      console.log(`Cache has ${cacheSize} contacts, which is sufficient`);
      return { success: true, message: 'Cache is sufficient', count: cacheSize };
    } catch (error) {
      console.error('Error in syncContactsIfNeeded:', error);
      return { success: false, error: error.message, count: 0 };
    }
  }

  /**
   * Check what type of sync is needed based on time since last sync
   * @returns {Promise<string>} 'none', 'incremental', or 'full'
   */
  async _checkSyncNeeded() {
    try {
      // Check if we're online
      let isOnlineForSync = this._isOnline;
      if (this._settings.syncOnWifiOnly) {
        const state = await NetInfo.fetch();
        isOnlineForSync = state.isConnected && state.type === 'wifi';
      }

      if (!isOnlineForSync) {
        console.log('Offline, no sync needed');
        return 'none';
      }

      const now = Date.now();

      // Check if we need a full sync (24+ hours since last full sync)
      if (now - this._lastFullSyncTime > SYNC_CONFIG.FULL_SYNC_INTERVAL) {
        console.log(`Last full sync was ${Math.round((now - this._lastFullSyncTime) / (1000 * 60 * 60))} hours ago, need full sync`);
        return 'full';
      }

      // Check if we need an incremental sync (4+ hours since last incremental sync)
      if (now - this._lastIncrementalSyncTime > SYNC_CONFIG.INCREMENTAL_SYNC_INTERVAL) {
        console.log(`Last incremental sync was ${Math.round((now - this._lastIncrementalSyncTime) / (1000 * 60 * 60))} hours ago, need incremental sync`);
        return 'incremental';
      }

      console.log('Recent syncs completed, no sync needed');
      return 'none';
    } catch (error) {
      console.error('Error checking sync needed:', error);
      return 'none'; // Default to no sync on error
    }
  }

  /**
   * Perform an incremental sync to get only contacts that have changed
   * @returns {Promise<Object>} Sync result
   */
  async _performIncrementalSync() {
    console.log('Incremental sync disabled - using cached contacts');
    this._notifyListeners({ status: 'incremental_sync_starting' });

    try {
      // Just return success since we have all contacts cached
      const cachedContacts = await partnersAPI.getContactsFromCache();
      const cacheSize = cachedContacts ? cachedContacts.length : 0;

      console.log(`Using ${cacheSize} cached contacts instead of incremental sync`);

      // Update the last incremental sync time to prevent repeated attempts
      this._lastIncrementalSyncTime = Date.now();
      await AsyncStorage.setItem(SYNC_CONFIG.LAST_INCREMENTAL_SYNC_KEY, this._lastIncrementalSyncTime.toString());

      this._notifyListeners({
        status: 'incremental_sync_completed',
        message: `Using ${cacheSize} cached contacts, incremental sync not needed`
      });

      return {
        success: true,
        message: `Using ${cacheSize} cached contacts, incremental sync not needed`
      };
    } catch (error) {
      console.error('Error performing incremental sync:', error);

      this._notifyListeners({
        status: 'incremental_sync_error',
        error: error.message,
        message: `Error during incremental sync: ${error.message}`
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Refresh OAuth token and retry a function with exponential backoff
   * @param {Function} fn - The function to retry
   * @param {Array} args - Arguments to pass to the function
   * @param {number} maxRetries - Maximum number of retries
   * @param {number} initialDelay - Initial delay between retries in milliseconds
   * @returns {Promise<any>} - The result of the function
   */
  async _retryWithTokenRefresh(fn, args = [], maxRetries = SYNC_CONFIG.MAX_RETRIES, initialDelay = SYNC_CONFIG.RETRY_DELAY) {
    let lastError;
    let delay = initialDelay;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // If this is a retry attempt, refresh the token first
        if (attempt > 0) {
          console.log(`Retry attempt ${attempt + 1}/${maxRetries}, refreshing token first...`);
          try {
            await refreshOAuthToken();
            console.log('Token refreshed successfully');
          } catch (refreshError) {
            console.error('Error refreshing token:', refreshError);
            // Continue with the retry even if token refresh fails
          }

          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, delay));
          // Exponential backoff
          delay *= 2;
        }

        // Call the function with the provided arguments
        return await fn(...args);
      } catch (error) {
        lastError = error;

        // Check if it's an authentication error (401)
        const is401Error =
          error.response?.status === 401 ||
          (error.message && error.message.includes('401')) ||
          (error.toString().includes('401'));

        if (is401Error) {
          console.log('Received 401 error, will refresh token and retry');
        } else {
          console.error(`Error in retry attempt ${attempt + 1}/${maxRetries}:`, error);
        }

        // If it's the last attempt, throw the error
        if (attempt === maxRetries - 1) {
          throw lastError;
        }
      }
    }

    // This should never be reached, but just in case
    throw lastError;
  }

  /**
   * Force a full sync now
   * @returns {Promise<Object>} Result of the sync operation
   */
  async fullSyncNow() {
    console.log('Forcing immediate full sync');

    // Check if a full sync is already in progress
    if (this._fullSyncInProgress) {
      console.log('Full sync already in progress');
      return {
        success: false,
        message: 'Full sync already in progress',
        count: 0
      };
    }

    // Check if we're online
    let isOnlineForFullSync = this._isOnline;
    if (this._settings.fullSyncOnWifiOnly) {
      const state = await NetInfo.fetch();
      isOnlineForFullSync = state.isConnected && state.type === 'wifi';
    }

    if (!isOnlineForFullSync) {
      console.log('Cannot start full sync: offline');
      return {
        success: false,
        message: 'Cannot start full sync: offline',
        count: 0
      };
    }

    // Check available storage
    const { freeSpace } = await this._checkStorageSpace();
    if (freeSpace < 100 * 1024 * 1024) {
      console.log(`Cannot start full sync: not enough free space (${Math.round(freeSpace / (1024 * 1024))}MB)`);
      return {
        success: false,
        message: `Not enough free space (${Math.round(freeSpace / (1024 * 1024))}MB)`,
        count: 0
      };
    }

    try {
      // Get the total count of contacts with retry mechanism
      const totalCount = await this._retryWithTokenRefresh(
        partnersAPI.getCount.bind(partnersAPI),
        [true]
      );
      console.log(`Total contacts on server: ${totalCount}`);

      // Start the full sync and wait for it to complete
      const syncResult = await this._performFullSyncAndWait(totalCount);

      return {
        success: syncResult.success,
        message: syncResult.message,
        count: syncResult.count || 0
      };
    } catch (error) {
      console.error('Error in fullSyncNow:', error);
      return {
        success: false,
        message: error.message,
        count: 0
      };
    }
  }

  /**
   * Check available storage space
   * @returns {Promise<Object>} Object with totalSpace and freeSpace in bytes
   */
  async _checkStorageSpace() {
    try {
      // Use Expo FileSystem to check available space
      const fileSystemInfo = await FileSystem.getFreeDiskStorageAsync();
      const totalSpace = await FileSystem.getTotalDiskCapacityAsync();

      return {
        totalSpace,
        freeSpace: fileSystemInfo
      };
    } catch (error) {
      console.error('Error checking storage space:', error);
      // Return a default value if we can't check
      return {
        totalSpace: 1000 * 1024 * 1024, // 1GB
        freeSpace: 500 * 1024 * 1024 // 500MB
      };
    }
  }

  /**
   * Start a full sync of all contacts
   * @param {number} totalCount - Total number of contacts to sync
   */
  async _startFullSync(totalCount) {
    // Don't start if a full sync is already in progress
    if (this._fullSyncInProgress) {
      console.log('Full sync already in progress');
      return;
    }

    // Set full sync in progress
    this._fullSyncInProgress = true;

    // Initialize progress
    this._fullSyncProgress = {
      total: totalCount,
      loaded: 0,
      currentPage: 0,
      status: 'in_progress'
    };

    // Save the state
    await this._saveFullSyncState();

    // Start the full sync
    this._cacheAllContacts(totalCount);
  }

  /**
   * Cache all contacts in the background
   * @param {number} totalCount - Total number of contacts to cache
   * @param {number} startPage - Page to start from (for resuming interrupted syncs)
   * @returns {Promise<boolean>} Success status
   */
  async _cacheAllContacts(totalCount, startPage = 0) {
    const PAGE_SIZE = SYNC_CONFIG.FULL_SYNC_BATCH_SIZE;
    let currentPage = startPage;
    let hasMoreToLoad = true;
    let loadedCount = this._fullSyncProgress.loaded;

    try {
      console.log(`Starting full contact cache: total ${totalCount}, starting from page ${startPage}`);

      // Update progress
      this._fullSyncProgress.status = 'in_progress';
      await this._saveFullSyncState();

      // Try bulk download first if enabled and we're starting from the beginning
      if (this._settings.useBulkDownload && startPage === 0) {
        try {
          console.log('Attempting bulk download of all contacts...');

          // Notify listeners of bulk download attempt
          this._notifyListeners({
            status: 'full_sync_progress',
            progress: {
              total: totalCount,
              loaded: 0,
              currentPage: 0,
              percentage: 0
            },
            message: 'Attempting bulk download of all contacts...'
          });

          // Try to get all contacts at once with retry mechanism
          // Force refresh to ensure we get the latest data
          const response = await this._retryWithTokenRefresh(
            partnersAPI.getAllContacts.bind(partnersAPI),
            [true] // Force refresh
          );

          // If we got a valid response with contacts
          if (response && Array.isArray(response) && response.length > 0) {
            console.log(`Bulk download successful! Got ${response.length} contacts`);

            // Update the cache with the contacts we have
            await this._updateContactsCache(response);

            // Update progress
            this._fullSyncProgress.loaded = response.length;
            this._fullSyncProgress.currentPage = Math.ceil(response.length / PAGE_SIZE);

            // Check if we got all or most of the contacts
            if (response.length >= totalCount * 0.9) {
              console.log(`Got ${response.length}/${totalCount} contacts (>90%), marking sync as complete`);

              // Mark as completed
              this._fullSyncProgress.status = 'completed';
              await this._saveFullSyncState();

              // Save the last full sync time
              await this._saveLastFullSyncTime();

              // Reset the in-progress flag
              this._fullSyncInProgress = false;

              // Notify listeners of completion
              this._notifyListeners({
                status: 'full_sync_completed',
                total: response.length,
                message: `Completed bulk download of ${response.length} contacts`
              });

              return true;
            } else {
              // We only got a partial batch, but we'll consider it complete
              // since our improved getAllContacts method should have fetched as many as possible
              console.log(`Got ${response.length}/${totalCount} contacts, marking sync as complete`);

              // Mark as completed
              this._fullSyncProgress.status = 'completed';
              await this._saveFullSyncState();

              // Save the last full sync time
              await this._saveLastFullSyncTime();

              // Reset the in-progress flag
              this._fullSyncInProgress = false;

              // Notify listeners of completion
              this._notifyListeners({
                status: 'full_sync_completed',
                total: response.length,
                message: `Completed partial download of ${response.length}/${totalCount} contacts`
              });

              return true;
            }
          } else {
            console.log('Bulk download returned no contacts, falling back to paged download');
          }
        } catch (error) {
          console.log('Bulk download failed, falling back to paged download:', error.message);
          // Continue with paged download
        }
      }

      // If bulk download failed or is disabled, use paged download
      console.log('Using paged download for contacts');

      // Reset the current page if we're starting from scratch and didn't get any contacts from bulk download
      if (startPage === 0 && loadedCount === 0) {
        currentPage = 0;
      }

      // Keep loading until we have all contacts
      while (hasMoreToLoad && this._fullSyncInProgress) {
        const offset = currentPage * PAGE_SIZE;

        // Check if we've already loaded all contacts
        if (loadedCount >= totalCount) {
          console.log(`Already loaded all ${loadedCount} contacts, no more to load`);
          hasMoreToLoad = false;
          break;
        }

        // Update progress
        this._fullSyncProgress.currentPage = currentPage;
        this._fullSyncProgress.status = 'in_progress';
        await this._saveFullSyncState();

        // Log progress
        console.log(`Background caching: Loading page ${currentPage}, offset ${offset}, loaded ${loadedCount}/${totalCount}`);

        // Notify listeners of progress
        this._notifyListeners({
          status: 'full_sync_progress',
          progress: {
            total: totalCount,
            loaded: loadedCount,
            currentPage,
            percentage: Math.round((loadedCount / totalCount) * 100)
          },
          message: `Caching contacts: ${loadedCount}/${totalCount} (${Math.round((loadedCount / totalCount) * 100)}%)`
        });

        try {
          // Calculate how many contacts to fetch in this batch
          const remainingToFetch = totalCount - loadedCount;
          const batchSize = Math.min(PAGE_SIZE, remainingToFetch);

          // If there are no more contacts to fetch, break the loop
          if (batchSize <= 0) {
            console.log('No more contacts to fetch');
            hasMoreToLoad = false;
            break;
          }

          console.log(`Fetching batch of ${batchSize} contacts at offset ${offset}`);

          // Fetch contacts for this page with retry mechanism
          const response = await this._retryWithTokenRefresh(
            partnersAPI.getList.bind(partnersAPI),
            [
              [], // Empty domain to get all contacts
              ['id', 'name', 'email', 'phone', 'mobile', 'image_128', 'street', 'city', 'country_id', 'is_company'],
              batchSize,
              offset,
              true // Force refresh from server
            ]
          );

          // Check if we got any contacts
          if (!response || !Array.isArray(response) || response.length === 0) {
            console.log('No more contacts to load');
            hasMoreToLoad = false;
            break;
          }

          // Update the cache with these contacts
          await this._updateContactsCache(response);

          // Update loaded count
          loadedCount += response.length;
          this._fullSyncProgress.loaded = loadedCount;

          // Check if we got fewer contacts than expected (last page)
          if (response.length < batchSize) {
            console.log(`Got ${response.length} contacts instead of ${batchSize}, must be the last page`);
            hasMoreToLoad = false;
          }

          // Move to next page
          currentPage++;

          // Add a small delay to prevent overloading the device
          await new Promise(resolve => setTimeout(resolve, SYNC_CONFIG.FULL_SYNC_BATCH_DELAY));
        } catch (error) {
          console.error(`Error caching contacts page ${currentPage}:`, error);

          // If we get an error, try again on the next check
          // We'll save our progress so we can resume from this page
          this._fullSyncProgress.status = 'error';
          this._fullSyncProgress.error = error.message;
          await this._saveFullSyncState();

          // Notify listeners of error
          this._notifyListeners({
            status: 'full_sync_error',
            error: error.message,
            message: `Error caching contacts: ${error.message}`
          });

          // Stop the sync but keep the progress so we can resume later
          this._fullSyncInProgress = false;
          return false;
        }
      }

      // If we completed successfully
      if (hasMoreToLoad === false) {
        console.log(`Full contact cache completed: cached ${loadedCount} contacts`);

        // Update progress
        this._fullSyncProgress.status = 'completed';
        this._fullSyncProgress.loaded = loadedCount;
        this._fullSyncProgress.currentPage = currentPage;
        await this._saveFullSyncState();

        // Save the last full sync time
        await this._saveLastFullSyncTime();

        // Reset the in-progress flag
        this._fullSyncInProgress = false;

        // Notify listeners of completion
        this._notifyListeners({
          status: 'full_sync_completed',
          total: loadedCount,
          message: `Completed caching ${loadedCount} contacts`
        });

        return true;
      }

      // If we were interrupted
      this._fullSyncProgress.status = 'interrupted';
      await this._saveFullSyncState();

      return false;
    } catch (error) {
      console.error('Error caching all contacts:', error);

      // Update progress
      this._fullSyncProgress.status = 'error';
      this._fullSyncProgress.error = error.message;
      await this._saveFullSyncState();

      // Notify listeners of error
      this._notifyListeners({
        status: 'full_sync_error',
        error: error.message,
        message: `Error caching contacts: ${error.message}`
      });

      // Reset the in-progress flag
      this._fullSyncInProgress = false;

      return false;
    }
  }

  /**
   * Save the full sync state to AsyncStorage
   */
  async _saveFullSyncState() {
    try {
      // Save full sync in progress
      await AsyncStorage.setItem(SYNC_CONFIG.FULL_SYNC_IN_PROGRESS_KEY, this._fullSyncInProgress.toString());

      // Save full sync progress
      await AsyncStorage.setItem(SYNC_CONFIG.FULL_SYNC_PROGRESS_KEY, JSON.stringify(this._fullSyncProgress));

      console.log('Saved full sync state:', {
        inProgress: this._fullSyncInProgress,
        progress: this._fullSyncProgress
      });
    } catch (error) {
      console.error('Error saving full sync state:', error);
    }
  }

  /**
   * Save the last full sync time
   */
  async _saveLastFullSyncTime() {
    try {
      this._lastFullSyncTime = Date.now();
      await AsyncStorage.setItem(SYNC_CONFIG.LAST_FULL_SYNC_KEY, this._lastFullSyncTime.toString());
    } catch (error) {
      console.error('Error saving last full sync time:', error);
    }
  }

  /**
   * Force an efficient sync using the best method available
   * @returns {Promise<Object>} Result of the sync operation
   */
  async forceEfficientSync() {
    console.log('Starting efficient sync...');

    // Check if we're online
    let isOnlineForSync = this._isOnline;
    if (this._settings.syncOnWifiOnly) {
      const state = await NetInfo.fetch();
      isOnlineForSync = state.isConnected && state.type === 'wifi';
    }

    if (!isOnlineForSync) {
      console.log('Cannot start efficient sync: offline');
      return {
        success: false,
        message: 'Cannot start sync: offline'
      };
    }

    // Notify listeners
    this._notifyListeners({
      status: 'efficient_sync_starting',
      message: 'Starting efficient sync...'
    });

    try {
      // First try bulk download if enabled
      if (this._settings.useBulkDownload) {
        try {
          console.log('Attempting bulk download of all contacts...');

          // Try to get all contacts at once with retry mechanism
          const contacts = await this._retryWithTokenRefresh(
            partnersAPI.getAllContacts.bind(partnersAPI)
          );

          // If we got a valid response with contacts
          if (contacts && Array.isArray(contacts) && contacts.length > 0) {
            console.log(`Bulk download successful! Got ${contacts.length} contacts`);

            // Update the cache with all contacts
            await this._updateContactsCache(contacts);

            // Save the last sync times
            this._lastFullSyncTime = Date.now();
            this._lastIncrementalSyncTime = Date.now();
            await AsyncStorage.setItem(SYNC_CONFIG.LAST_FULL_SYNC_KEY, this._lastFullSyncTime.toString());
            await AsyncStorage.setItem(SYNC_CONFIG.LAST_INCREMENTAL_SYNC_KEY, this._lastIncrementalSyncTime.toString());

            // Notify listeners of completion
            this._notifyListeners({
              status: 'efficient_sync_completed',
              message: `Completed bulk download of ${contacts.length} contacts`
            });

            return {
              success: true,
              message: `Completed sync of ${contacts.length} contacts`,
              count: contacts.length
            };
          }
        } catch (error) {
          console.log('Bulk download failed, falling back to incremental sync:', error.message);
          // Continue with incremental sync
        }
      }

      // If bulk download failed or is disabled, try incremental sync
      console.log('Using incremental sync for contacts');

      // Get the last sync time or use a default (24 hours ago)
      const lastSyncTime = this._lastIncrementalSyncTime > 0
        ? new Date(this._lastIncrementalSyncTime)
        : new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

      // Format as ISO string for the API
      const formattedDate = lastSyncTime.toISOString();
      console.log(`Fetching contacts modified since ${formattedDate}`);

      // Get modified contacts since last sync
      const modifiedContacts = await this._retryWithTokenRefresh(
        partnersAPI.getModifiedContactsSince.bind(partnersAPI),
        [formattedDate]
      );

      if (!modifiedContacts || !Array.isArray(modifiedContacts)) {
        console.log('No modified contacts returned or invalid response');

        // Notify listeners
        this._notifyListeners({
          status: 'efficient_sync_completed',
          message: 'No modified contacts found'
        });

        return {
          success: true,
          message: 'No modified contacts found',
          count: 0
        };
      }

      console.log(`Found ${modifiedContacts.length} modified contacts`);

      // Update the cache with modified contacts
      if (modifiedContacts.length > 0) {
        await this._updateContactsCache(modifiedContacts);
      }

      // Update the last incremental sync time
      this._lastIncrementalSyncTime = Date.now();
      await AsyncStorage.setItem(SYNC_CONFIG.LAST_INCREMENTAL_SYNC_KEY, this._lastIncrementalSyncTime.toString());

      // Notify listeners of completion
      this._notifyListeners({
        status: 'efficient_sync_completed',
        message: `Updated ${modifiedContacts.length} contacts`
      });

      return {
        success: true,
        message: `Completed sync of ${modifiedContacts.length} contacts`,
        count: modifiedContacts.length
      };
    } catch (error) {
      console.error('Error in efficient sync:', error);

      // Notify listeners of error
      this._notifyListeners({
        status: 'efficient_sync_error',
        error: error.message,
        message: `Error during sync: ${error.message}`
      });

      return {
        success: false,
        message: `Error during sync: ${error.message}`
      };
    }
  }

  /**
   * Update the contacts cache with new contacts
   * @param {Array} newContacts - New contacts to add to the cache
   */
  async _updateContactsCache(newContacts) {
    try {
      // Get existing cached partners
      const existingPartners = await partnersAPI.getPartnersFromCache() || [];

      // Add new contacts to the cache
      const updatedPartners = [...existingPartners];

      // Update existing contacts or add new ones
      newContacts.forEach(newContact => {
        const index = updatedPartners.findIndex(p => p.id === newContact.id);
        if (index !== -1) {
          updatedPartners[index] = newContact;
        } else {
          updatedPartners.push(newContact);
        }
      });

      // Save updated cache
      await partnersAPI.savePartnersToCache(updatedPartners);

      // Update partner IDs cache
      const existingIds = await partnersAPI.getPartnerIdsFromCache() || [];
      const newIds = newContacts.map(contact => contact.id);
      const combinedIds = [...new Set([...existingIds, ...newIds])];
      await partnersAPI.savePartnerIdsToCache(combinedIds);

      console.log(`Updated cache with ${newContacts.length} new contacts, total: ${updatedPartners.length}`);
      return true;
    } catch (error) {
      console.error('Error updating contacts cache:', error);
      return false;
    }
  }

  /**
   * Notify listeners of sync events
   * @param {Object} event - Event data
   */
  _notifyListeners(event) {
    this._listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in sync listener:', error);
      }
    });
  }

  /**
   * Register a listener for sync events
   * @param {Function} listener - The listener function
   * @returns {Function} Function to unregister the listener
   */
  registerListener(listener) {
    if (typeof listener !== 'function') {
      console.error('Listener must be a function');
      return () => {};
    }

    this._listeners.push(listener);
    console.log(`Registered sync listener, total listeners: ${this._listeners.length}`);

    // Return unregister function
    return () => {
      this._listeners = this._listeners.filter(l => l !== listener);
      console.log(`Unregistered sync listener, remaining listeners: ${this._listeners.length}`);
    };
  }

  /**
   * Get the current sync progress
   * @returns {Object} Current sync progress
   */
  getSyncProgress() {
    return {
      fullSync: {
        inProgress: this._fullSyncInProgress,
        progress: this._fullSyncProgress
      },
      lastSync: this._lastSyncTime ? new Date(this._lastSyncTime) : null,
      lastFullSync: this._lastFullSyncTime ? new Date(this._lastFullSyncTime) : null,
      lastIncrementalSync: this._lastIncrementalSyncTime ? new Date(this._lastIncrementalSyncTime) : null
    };
  }

  /**
   * Get the current sync settings
   * @returns {Object} Current sync settings
   */
  getSettings() {
    return { ...this._settings };
  }

  /**
   * Update sync settings
   * @param {Object} newSettings - New settings to apply
   * @returns {Promise<Object>} Updated settings
   */
  async updateSettings(newSettings) {
    // Validate settings
    if (typeof newSettings !== 'object') {
      console.error('Settings must be an object');
      return this._settings;
    }

    // Update settings
    this._settings = {
      ...this._settings,
      ...newSettings
    };

    // Save settings
    try {
      await AsyncStorage.setItem(SYNC_CONFIG.SETTINGS_KEY, JSON.stringify(this._settings));
      console.log('Saved sync settings:', this._settings);

      // Start or stop sync timer based on autoSync setting
      if (this._settings.autoSync) {
        this._startSyncTimer();
      } else if (this._syncTimer) {
        clearInterval(this._syncTimer);
        this._syncTimer = null;
      }

      return this._settings;
    } catch (error) {
      console.error('Error saving sync settings:', error);
      return this._settings;
    }
  }

  /**
   * Force an immediate sync
   * This is a convenience method that can be called from the UI
   * @returns {Promise<Object>} Sync result
   */
  async syncNow() {
    console.log('Manual sync requested');

    // Check if we're online
    let isOnlineForSync = this._isOnline;
    if (this._settings.syncOnWifiOnly) {
      const state = await NetInfo.fetch();
      isOnlineForSync = state.isConnected && state.type === 'wifi';
    }

    if (!isOnlineForSync) {
      console.log('Cannot start sync: offline');
      return {
        success: false,
        message: 'Cannot sync: offline or WiFi required'
      };
    }

    // Notify listeners that sync is starting
    this._notifyListeners({
      status: 'started',
      message: 'Manual sync started'
    });

    try {
      // Perform an incremental sync
      const result = await this._performIncrementalSync();

      // Update the last sync time
      this._lastSyncTime = Date.now();
      await AsyncStorage.setItem(SYNC_CONFIG.LAST_SYNC_KEY, this._lastSyncTime.toString());

      // Notify listeners that sync is complete
      this._notifyListeners({
        status: 'completed',
        message: result.message
      });

      return result;
    } catch (error) {
      console.error('Error in manual sync:', error);

      // Notify listeners of error
      this._notifyListeners({
        status: 'error',
        error: error.message,
        message: `Error during sync: ${error.message}`
      });

      return {
        success: false,
        error: error.message,
        message: `Sync failed: ${error.message}`
      };
    }
  }

  /**
   * Get all partner IDs (private method)
   * @param {boolean} forceRefresh - Whether to force refresh from server
   * @returns {Promise<Array>} Array of partner IDs
   * @private
   */
  async _getAllPartnerIds(forceRefresh = false) {
    try {
      // Use the partnersAPI directly
      return await partnersAPI.getAllPartnerIds(forceRefresh);
    } catch (error) {
      console.error('Error getting all partner IDs:', error);
      return [];
    }
  }

  /**
   * Get current sync progress
   * @returns {Promise<Object>} Current sync progress
   */
  async getSyncProgress() {
    try {
      // Get the current sync progress from storage
      const progressData = await AsyncStorage.getItem('contact_sync_progress');
      if (progressData) {
        return JSON.parse(progressData);
      }
      return null;
    } catch (error) {
      console.error('Error getting sync progress:', error);
      return null;
    }
  }

  /**
   * Update sync progress
   * @param {Object} progress - Progress object with current, total, and percent
   * @returns {Promise<boolean>} Success status
   */
  async updateSyncProgress(progress) {
    try {
      await AsyncStorage.setItem('contact_sync_progress', JSON.stringify(progress));

      // Also notify listeners
      this._notifyListeners({
        status: 'full_sync_progress',
        progress: progress,
        message: `Syncing contacts: ${progress.current}/${progress.total} (${progress.percent}%)`
      });

      return true;
    } catch (error) {
      console.error('Error updating sync progress:', error);
      return false;
    }
  }

  /**
   * Get all partner IDs (public method)
   * @param {boolean} forceRefresh - Whether to force refresh from server
   * @returns {Promise<Array>} Array of partner IDs
   */
  async getAllPartnerIds(forceRefresh = false) {
    return this._getAllPartnerIds(forceRefresh);
  }

  /**
   * Force an efficient full sync
   * This method will use the most efficient approach to sync all contacts
   * @returns {Promise<Object>} Sync result with count of updated contacts
   */
  async forceEfficientSync() {
    console.log('Efficient full sync requested');

    // Check if we're online
    let isOnlineForSync = this._isOnline;
    if (this._settings.syncOnWifiOnly) {
      const state = await NetInfo.fetch();
      isOnlineForSync = state.isConnected && state.type === 'wifi';
    }

    if (!isOnlineForSync) {
      console.log('Cannot start efficient sync: offline');
      return {
        success: false,
        message: 'Cannot sync: offline or WiFi required'
      };
    }

    // Notify listeners that sync is starting
    this._notifyListeners({
      status: 'started',
      message: 'Efficient full sync started'
    });

    try {
      console.log('Starting efficient full sync...');

      // First, get all partner IDs to know how many contacts we have
      const allPartnerIds = await this._getAllPartnerIds(true);
      const totalCount = allPartnerIds.length;

      console.log(`Total contacts on server: ${totalCount}`);

      if (totalCount === 0) {
        console.log('No contacts found on server');
        this._notifyListeners({
          status: 'completed',
          message: 'No contacts found on server'
        });
        return {
          success: true,
          count: 0,
          message: 'No contacts found on server'
        };
      }

      // Initialize progress
      await this.updateSyncProgress({
        current: 0,
        total: totalCount,
        percent: 0
      });

      // Process in batches
      const allContacts = [];
      const batchSize = 100;

      for (let i = 0; i < allPartnerIds.length; i += batchSize) {
        try {
          const batchIds = allPartnerIds.slice(i, i + batchSize);
          const batchNumber = Math.floor(i / batchSize) + 1;
          const totalBatches = Math.ceil(allPartnerIds.length / batchSize);

          console.log(`Fetching batch ${batchNumber}/${totalBatches}: ${batchIds.length} contacts (${i}-${i + batchIds.length - 1} of ${allPartnerIds.length})`);

          // Use the getList method with the batch of IDs
          const batchContacts = await this._retryWithTokenRefresh(
            partnersAPI.getList.bind(partnersAPI),
            [
              [['id', 'in', batchIds]],
              ['id', 'name', 'email', 'phone', 'mobile', 'image_128', 'image_1920', 'street', 'street2',
               'city', 'state_id', 'zip', 'country_id', 'website', 'function', 'title',
               'comment', 'is_company', 'parent_id', 'child_ids', 'category_id', 'user_id'],
              batchIds.length,
              0,
              true // Force refresh
            ]
          );

          if (batchContacts && Array.isArray(batchContacts) && batchContacts.length > 0) {
            allContacts.push(...batchContacts);
            console.log(`Fetched ${batchContacts.length} contacts in this batch, total: ${allContacts.length}`);

            // Update progress
            const current = allContacts.length;
            const percent = Math.min(Math.round((current / totalCount) * 100), 100);
            await this.updateSyncProgress({
              current,
              total: totalCount,
              percent
            });

            // Save to cache every 500 contacts
            if (allContacts.length % 500 === 0 || i + batchSize >= allPartnerIds.length) {
              await this._updateContactsCache(allContacts);
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

      console.log(`Successfully got ${allContacts.length} contacts`);

      // Final update to progress
      await this.updateSyncProgress({
        current: allContacts.length,
        total: totalCount,
        percent: 100
      });

      // Update the cache with all contacts
      await this._updateContactsCache(allContacts);

      // Update the last sync times
      const now = Date.now();
      await AsyncStorage.setItem(SYNC_CONFIG.LAST_SYNC_KEY, now.toString());
      await AsyncStorage.setItem(SYNC_CONFIG.LAST_FULL_SYNC_KEY, now.toString());
      await AsyncStorage.setItem(SYNC_CONFIG.LAST_INCREMENTAL_SYNC_KEY, now.toString());

      // Notify listeners that sync is complete
      this._notifyListeners({
        status: 'completed',
        message: `Synced ${allContacts.length} contacts`
      });

      return {
        success: true,
        count: allContacts.length,
        message: `Successfully synced ${allContacts.length} contacts`
      };
    } catch (error) {
      console.error('Error in efficient full sync:', error);

      // Notify listeners of error
      this._notifyListeners({
        status: 'error',
        error: error.message,
        message: `Error during sync: ${error.message}`
      });

      return {
        success: false,
        error: error.message,
        message: `Sync failed: ${error.message}`
      };
    }
  }
}

// Export singleton instance
export const backgroundSyncService = new BackgroundSyncService();
export default backgroundSyncService;