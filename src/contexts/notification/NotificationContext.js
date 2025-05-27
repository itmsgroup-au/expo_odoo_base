import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Create context
const NotificationContext = createContext({
  notificationsEnabled: false,
  requestPermissions: () => {},
  notifications: [],
  addNotification: () => {},
  clearNotifications: () => {},
  markAsRead: () => {}
});

// Provider component
export const NotificationProvider = ({ children }) => {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notifications, setNotifications] = useState([]);
  
  // Load notification settings and history on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load settings
        const enabled = await AsyncStorage.getItem('notificationsEnabled');
        setNotificationsEnabled(enabled === 'true');
        
        // Load notification history
        const notificationData = await AsyncStorage.getItem('notifications');
        if (notificationData) {
          setNotifications(JSON.parse(notificationData));
        }
      } catch (error) {
        console.error('Error loading notification data:', error);
      }
    };
    
    loadData();
  }, []);
  
  // Save notifications whenever they change
  useEffect(() => {
    const saveNotifications = async () => {
      try {
        await AsyncStorage.setItem('notifications', JSON.stringify(notifications));
      } catch (error) {
        console.error('Error saving notifications:', error);
      }
    };
    
    if (notifications.length > 0) {
      saveNotifications();
    }
  }, [notifications]);
  
  // Request notification permissions
  const requestPermissions = async () => {
    try {
      // In a real app, we would use Expo's Notifications API:
      // const { status } = await Notifications.requestPermissionsAsync();
      // const enabled = status === 'granted';
      
      // For this demo, we'll just set it to true
      const enabled = true;
      
      setNotificationsEnabled(enabled);
      await AsyncStorage.setItem('notificationsEnabled', enabled ? 'true' : 'false');
      
      return enabled;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  };
  
  // Add a notification
  const addNotification = async (notification) => {
    // Only add if notifications are enabled
    if (!notificationsEnabled) return;
    
    const newNotification = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      read: false,
      ...notification
    };
    
    setNotifications(prev => [newNotification, ...prev].slice(0, 50)); // Keep only the latest 50
  };
  
  // Clear all notifications
  const clearNotifications = async () => {
    setNotifications([]);
    await AsyncStorage.setItem('notifications', JSON.stringify([]));
  };
  
  // Mark a notification as read
  const markAsRead = async (id) => {
    setNotifications(prev => prev.map(note => 
      note.id === id ? { ...note, read: true } : note
    ));
  };
  
  return (
    <NotificationContext.Provider
      value={{
        notificationsEnabled,
        requestPermissions,
        notifications,
        addNotification,
        clearNotifications,
        markAsRead
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

// Custom hook for using the notification context
export const useNotifications = () => useContext(NotificationContext);