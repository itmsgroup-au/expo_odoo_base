import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncManager } from '../api/models/syncManager';
import { partnersAPI } from '../api/models/partnersApi';
import { Alert } from 'react-native';

/**
 * Clear all contact-related caches and reset sync information
 * This is useful when switching to a new Odoo instance
 */
export const clearContactCache = async () => {
  try {
    console.log('Clearing all contact-related caches...');
    
    // Clear partner cache
    await partnersAPI.clearCache();
    
    // Reset sync information
    await syncManager.resetSyncInfo();
    
    // Clear any other contact-related keys
    const allKeys = await AsyncStorage.getAllKeys();
    const contactKeys = allKeys.filter(key => 
      key.includes('partner') || 
      key.includes('contact') ||
      key.includes('sync') ||
      key.includes('last_partner_id')
    );
    
    if (contactKeys.length > 0) {
      await AsyncStorage.multiRemove(contactKeys);
    }
    
    console.log(`Cleared ${contactKeys.length} contact-related cache keys`);
    return true;
  } catch (error) {
    console.error('Error clearing contact cache:', error);
    return false;
  }
};

/**
 * Clear all caches including authentication, contacts, and other data
 * This is useful when completely resetting the app
 */
export const clearAllCaches = async () => {
  try {
    console.log('Clearing all caches...');
    
    // Clear authentication data
    await AsyncStorage.removeItem('serverConfig');
    await AsyncStorage.removeItem('sessionInfo');
    await AsyncStorage.removeItem('authToken');
    await AsyncStorage.removeItem('odooTokenData');
    
    // Clear contact cache
    await clearContactCache();
    
    // Clear any other app-specific caches
    const allKeys = await AsyncStorage.getAllKeys();
    const cacheKeys = allKeys.filter(key => 
      key.includes('cache') || 
      key.includes('timestamp')
    );
    
    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys);
    }
    
    console.log(`Cleared ${cacheKeys.length} additional cache keys`);
    return true;
  } catch (error) {
    console.error('Error clearing all caches:', error);
    return false;
  }
};

/**
 * Show a confirmation dialog and clear all caches if confirmed
 */
export const confirmAndClearAllCaches = () => {
  Alert.alert(
    'Clear All Caches',
    'This will clear all cached data including contacts and login information. You will need to log in again. Continue?',
    [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Clear All', 
        style: 'destructive',
        onPress: async () => {
          const success = await clearAllCaches();
          if (success) {
            Alert.alert('Success', 'All caches cleared successfully. Please restart the app.');
          } else {
            Alert.alert('Error', 'Failed to clear all caches. Please try again.');
          }
        }
      }
    ]
  );
};

export default {
  clearContactCache,
  clearAllCaches,
  confirmAndClearAllCaches
};
