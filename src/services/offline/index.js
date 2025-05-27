import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Simplified offline storage service
 */
class OfflineStorage {
  constructor() {
    this.cachePrefix = 'offline_cache_';
    this.queueKey = 'offline_queue';
  }

  /**
   * Save data to cache
   * @param {string} key - Cache key
   * @param {any} data - Data to cache
   */
  async saveToCache(key, data) {
    try {
      const cacheKey = `${this.cachePrefix}${key}`;
      await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving to cache:', error);
      throw error;
    }
  }

  /**
   * Get data from cache
   * @param {string} key - Cache key
   * @returns {any} Cached data or null
   */
  async getFromCache(key) {
    try {
      const cacheKey = `${this.cachePrefix}${key}`;
      const data = await AsyncStorage.getItem(cacheKey);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error getting from cache:', error);
      return null;
    }
  }

  /**
   * Clear cache
   */
  async clearCache() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(this.cachePrefix));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      console.error('Error clearing cache:', error);
      throw error;
    }
  }

  /**
   * Add operation to offline queue
   * @param {Object} operation - Operation to queue
   */
  async addToQueue(operation) {
    try {
      let queue = await this.getQueue();
      queue.push({
        ...operation,
        timestamp: new Date().toISOString()
      });
      await AsyncStorage.setItem(this.queueKey, JSON.stringify(queue));
      return queue.length;
    } catch (error) {
      console.error('Error adding to queue:', error);
      throw error;
    }
  }

  /**
   * Get offline operation queue
   * @returns {Array} Queue of operations
   */
  async getQueue() {
    try {
      const queue = await AsyncStorage.getItem(this.queueKey);
      return queue ? JSON.parse(queue) : [];
    } catch (error) {
      console.error('Error getting queue:', error);
      return [];
    }
  }

  /**
   * Clear offline queue
   */
  async clearQueue() {
    try {
      await AsyncStorage.removeItem(this.queueKey);
    } catch (error) {
      console.error('Error clearing queue:', error);
      throw error;
    }
  }
}

// Export instance
export const offlineStorage = new OfflineStorage();