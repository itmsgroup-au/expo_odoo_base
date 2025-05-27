// Sync Manager for efficient data synchronization
import AsyncStorage from '@react-native-async-storage/async-storage';

// Keys for storing sync information
const SYNC_KEYS = {
  LAST_SYNC_TIMESTAMP: 'last_sync_timestamp',
  LAST_PARTNER_ID: 'last_partner_id',
  SYNC_IN_PROGRESS: 'sync_in_progress',
};

// Sync manager for handling efficient data synchronization
export const syncManager = {
  /**
   * Get the last sync timestamp
   * @returns {Promise<number>} Timestamp of last sync
   */
  getLastSyncTimestamp: async () => {
    try {
      const timestamp = await AsyncStorage.getItem(SYNC_KEYS.LAST_SYNC_TIMESTAMP);
      return timestamp ? parseInt(timestamp) : 0;
    } catch (error) {
      console.error('Error getting last sync timestamp:', error);
      return 0;
    }
  },

  /**
   * Set the last sync timestamp
   * @param {number} timestamp - Timestamp to set
   * @returns {Promise<boolean>} Success status
   */
  setLastSyncTimestamp: async (timestamp = Date.now()) => {
    try {
      await AsyncStorage.setItem(SYNC_KEYS.LAST_SYNC_TIMESTAMP, timestamp.toString());
      return true;
    } catch (error) {
      console.error('Error setting last sync timestamp:', error);
      return false;
    }
  },

  /**
   * Get the last partner ID that was synced
   * @returns {Promise<number>} Last partner ID
   */
  getLastPartnerId: async () => {
    try {
      const id = await AsyncStorage.getItem(SYNC_KEYS.LAST_PARTNER_ID);
      return id ? parseInt(id) : 0;
    } catch (error) {
      console.error('Error getting last partner ID:', error);
      return 0;
    }
  },

  /**
   * Set the last partner ID that was synced
   * @param {number} id - Partner ID to set
   * @returns {Promise<boolean>} Success status
   */
  setLastPartnerId: async (id) => {
    try {
      await AsyncStorage.setItem(SYNC_KEYS.LAST_PARTNER_ID, id.toString());
      return true;
    } catch (error) {
      console.error('Error setting last partner ID:', error);
      return false;
    }
  },

  /**
   * Check if a sync is in progress
   * @returns {Promise<boolean>} Whether sync is in progress
   */
  isSyncInProgress: async () => {
    try {
      const inProgress = await AsyncStorage.getItem(SYNC_KEYS.SYNC_IN_PROGRESS);
      return inProgress === 'true';
    } catch (error) {
      console.error('Error checking if sync is in progress:', error);
      return false;
    }
  },

  /**
   * Set sync in progress status
   * @param {boolean} inProgress - Whether sync is in progress
   * @returns {Promise<boolean>} Success status
   */
  setSyncInProgress: async (inProgress) => {
    try {
      await AsyncStorage.setItem(SYNC_KEYS.SYNC_IN_PROGRESS, inProgress.toString());
      return true;
    } catch (error) {
      console.error('Error setting sync in progress:', error);
      return false;
    }
  },

  /**
   * Reset all sync information
   * @returns {Promise<boolean>} Success status
   */
  resetSyncInfo: async () => {
    try {
      await AsyncStorage.removeItem(SYNC_KEYS.LAST_SYNC_TIMESTAMP);
      await AsyncStorage.removeItem(SYNC_KEYS.LAST_PARTNER_ID);
      await AsyncStorage.removeItem(SYNC_KEYS.SYNC_IN_PROGRESS);
      return true;
    } catch (error) {
      console.error('Error resetting sync info:', error);
      return false;
    }
  }
};

export default syncManager;
