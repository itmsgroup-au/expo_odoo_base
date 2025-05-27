import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Simplified document service for managing document files
 */
class DocumentService {
  constructor() {
    this.cachePrefix = 'doc_cache_';
    this.metadataKey = 'doc_metadata';
  }

  /**
   * Get cache information
   * @returns {Promise<Object>} Cache information
   */
  async getCacheInfo() {
    try {
      // Try to get metadata
      const metadataStr = await AsyncStorage.getItem(this.metadataKey);
      const metadata = metadataStr ? JSON.parse(metadataStr) : { documents: [], totalSize: 0 };
      
      // Get all storage keys
      const keys = await AsyncStorage.getAllKeys();
      const docKeys = keys.filter(key => key.startsWith(this.cachePrefix));
      
      // If we need to regenerate metadata (shouldn't happen in a real app)
      if (metadata.documents.length !== docKeys.length) {
        let totalSize = 0;
        const documents = [];
        
        for (const key of docKeys) {
          const value = await AsyncStorage.getItem(key);
          if (value) {
            totalSize += value.length;
            documents.push({
              id: key.replace(this.cachePrefix, ''),
              size: value.length,
              cached: true
            });
          }
        }
        
        // Update metadata
        const newMetadata = { documents, totalSize };
        await AsyncStorage.setItem(this.metadataKey, JSON.stringify(newMetadata));
        return newMetadata;
      }
      
      return metadata;
    } catch (error) {
      console.error('Error getting cache info:', error);
      return { documents: [], totalSize: 0 };
    }
  }

  /**
   * Clear document cache
   */
  async clearCache() {
    try {
      // Get all cache keys
      const keys = await AsyncStorage.getAllKeys();
      const docKeys = keys.filter(key => key.startsWith(this.cachePrefix));
      
      // Remove all document cache entries
      if (docKeys.length > 0) {
        await AsyncStorage.multiRemove(docKeys);
      }
      
      // Reset metadata
      await AsyncStorage.setItem(this.metadataKey, JSON.stringify({ documents: [], totalSize: 0 }));
    } catch (error) {
      console.error('Error clearing document cache:', error);
      throw error;
    }
  }
}

// Export instance
export const documentService = new DocumentService();