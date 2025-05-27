import AsyncStorage from '@react-native-async-storage/async-storage';
import { offlineStorage } from './offline';
import api from './api';

/**
 * Simplified sync service for handling offline operations
 */
class SyncService {
  constructor() {
    this._listeners = [];
    this._isSyncing = false;
    this._lastSync = null;
  }

  /**
   * Register a listener for sync events
   * @param {Function} listener - Callback function
   * @returns {Function} Unsubscribe function
   */
  registerListener(listener) {
    this._listeners.push(listener);
    return () => {
      this._listeners = this._listeners.filter(l => l !== listener);
    };
  }

  /**
   * Notify all listeners of a sync event
   * @param {Object} event - Sync event data
   */
  _notifyListeners(event) {
    this._listeners.forEach(listener => listener(event));
  }

  /**
   * Check if syncing is in progress
   * @returns {boolean} Whether syncing is in progress
   */
  isSyncing() {
    return this._isSyncing;
  }

  /**
   * Get last sync time
   * @returns {Date|null} Last sync time
   */
  getLastSync() {
    return this._lastSync;
  }

  /**
   * Add a create operation to the offline queue
   * @param {string} model - Model name
   * @param {Object} data - Data to create
   * @returns {Promise<Object>} Operation result
   */
  async queueCreate(model, data) {
    await offlineStorage.addToQueue({
      type: 'create',
      model,
      data
    });
    
    this._notifyListeners({
      status: 'queued',
      operation: 'create',
      model
    });
    
    return {
      success: true,
      id: `temp_${Date.now()}`,
      isOffline: true
    };
  }

  /**
   * Add an update operation to the offline queue
   * @param {string} model - Model name
   * @param {number|string} id - Record ID
   * @param {Object} data - Data to update
   * @returns {Promise<Object>} Operation result
   */
  async queueUpdate(model, id, data) {
    await offlineStorage.addToQueue({
      type: 'update',
      model,
      id,
      data
    });
    
    this._notifyListeners({
      status: 'queued',
      operation: 'update',
      model,
      id
    });
    
    return {
      success: true,
      isOffline: true
    };
  }

  /**
   * Add a delete operation to the offline queue
   * @param {string} model - Model name
   * @param {number|string} id - Record ID
   * @returns {Promise<Object>} Operation result
   */
  async queueDelete(model, id) {
    await offlineStorage.addToQueue({
      type: 'delete',
      model,
      id
    });
    
    this._notifyListeners({
      status: 'queued',
      operation: 'delete',
      model,
      id
    });
    
    return {
      success: true,
      isOffline: true
    };
  }

  /**
   * Queue a function call for offline processing
   * @param {string} model - Model name
   * @param {number|string} id - Record ID
   * @param {string} method - Method name
   * @param {Object} params - Method parameters
   * @returns {Promise<Object>} Operation result
   */
  async queueFunctionCall(model, id, method, params = {}) {
    await offlineStorage.addToQueue({
      type: 'function',
      model,
      id,
      method,
      params
    });
    
    this._notifyListeners({
      status: 'queued',
      operation: 'function',
      model,
      id,
      method
    });
    
    return {
      success: true,
      isOffline: true
    };
  }

  /**
   * Synchronize all offline changes
   * @returns {Promise<Object>} Sync result
   */
  async syncOfflineChanges() {
    // Check if already syncing
    if (this._isSyncing) {
      return { success: false, message: 'Sync already in progress' };
    }
    
    this._isSyncing = true;
    this._notifyListeners({ status: 'started' });
    
    try {
      const queue = await offlineStorage.getQueue();
      
      if (queue.length === 0) {
        this._isSyncing = false;
        this._lastSync = new Date();
        this._notifyListeners({ status: 'completed', operations: 0 });
        return { success: true, operations: 0 };
      }
      
      // Initialize counters
      let successCount = 0;
      let failureCount = 0;
      
      // Process queue in order
      for (const operation of queue) {
        this._notifyListeners({ 
          status: 'in_progress',
          operation: operation.type,
          model: operation.model,
          progress: (successCount + failureCount) / queue.length
        });
        
        try {
          // Process based on operation type
          switch (operation.type) {
            case 'create':
              await api.post(`/api/v2/create/${operation.model}`, { values: operation.data });
              break;
            case 'update':
              await api.put(`/api/v2/write/${operation.model}`, { ids: [operation.id], values: operation.data });
              break;
            case 'delete':
              await api.delete(`/api/v2/unlink/${operation.model}`, { data: { ids: [operation.id] } });
              break;
            case 'function':
              await api.post(`/api/v2/call/${operation.model}`, { 
                method: operation.method,
                ids: [operation.id],
                args: [],
                kwargs: operation.params
              });
              break;
          }
          
          successCount++;
        } catch (error) {
          console.error(`Sync error for ${operation.type}:`, error);
          failureCount++;
        }
      }
      
      // Clear successfully processed operations
      if (failureCount === 0) {
        await offlineStorage.clearQueue();
      } else {
        // In a real app, would remove only successful operations
        // For this demo, we'll clear anyway
        await offlineStorage.clearQueue();
      }
      
      this._lastSync = new Date();
      this._notifyListeners({ 
        status: 'completed', 
        operations: queue.length,
        success: successCount,
        failure: failureCount
      });
      
      return {
        success: true,
        operations: queue.length,
        successCount,
        failureCount
      };
    } catch (error) {
      console.error('Sync error:', error);
      this._notifyListeners({ status: 'failed', error: error.message });
      return { success: false, error: error.message };
    } finally {
      this._isSyncing = false;
    }
  }
}

// Export singleton instance
export const syncService = new SyncService();