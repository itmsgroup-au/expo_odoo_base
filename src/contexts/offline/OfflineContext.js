import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { offlineStorage } from '../../services/offline';

// Create the context
const OfflineContext = createContext({
  isOffline: false,
  offlineMode: false,
  toggleOfflineMode: () => {},
  pendingOperations: 0,
  hasPendingChanges: false
});

// Provider component
export const OfflineProvider = ({ children }) => {
  const [isOffline, setIsOffline] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);
  const [pendingOperations, setPendingOperations] = useState(0);
  
  // Check network status on mount and subscribe to changes
  useEffect(() => {
    // Initial check
    NetInfo.fetch().then(state => {
      setIsOffline(!state.isConnected);
    });
    
    // Subscribe to network changes
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(!state.isConnected);
    });
    
    return () => {
      unsubscribe();
    };
  }, []);
  
  // Load offline mode preference
  useEffect(() => {
    const loadOfflineMode = async () => {
      try {
        const value = await AsyncStorage.getItem('offlineMode');
        setOfflineMode(value === 'true');
      } catch (error) {
        console.error('Error loading offline mode:', error);
      }
    };
    
    loadOfflineMode();
  }, []);
  
  // Check pending operations periodically
  useEffect(() => {
    const checkPendingOperations = async () => {
      try {
        const queue = await offlineStorage.getQueue();
        setPendingOperations(queue.length);
      } catch (error) {
        console.error('Error checking pending operations:', error);
      }
    };
    
    // Check immediately
    checkPendingOperations();
    
    // Set up interval
    const interval = setInterval(checkPendingOperations, 5000);
    
    return () => {
      clearInterval(interval);
    };
  }, []);
  
  // Toggle offline mode
  const toggleOfflineMode = async (value) => {
    try {
      setOfflineMode(value);
      await AsyncStorage.setItem('offlineMode', value ? 'true' : 'false');
    } catch (error) {
      console.error('Error saving offline mode:', error);
    }
  };
  
  return (
    <OfflineContext.Provider
      value={{
        isOffline,
        offlineMode,
        toggleOfflineMode,
        pendingOperations,
        hasPendingChanges: pendingOperations > 0
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
};

// Custom hook for using the offline context
export const useOffline = () => useContext(OfflineContext);