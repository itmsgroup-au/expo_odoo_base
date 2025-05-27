import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Import our custom providers
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { AppProvider } from './src/contexts/app/AppContext';
import { ThemeProvider } from './src/contexts/ThemeContext';
import { OfflineProvider } from './src/contexts/offline/OfflineContext';
import { NotificationProvider } from './src/contexts/notification/NotificationContext';

// Import the main navigator
import AppNavigator from './src/navigation/AppNavigator';

// Import background sync service
import { backgroundSyncService } from './src/services/backgroundSync';

// Import error boundary
import ErrorBoundary from './src/components/ErrorBoundary';

// Ignore specific warnings that might be related to navigation
LogBox.ignoreLogs([
  'Sending `onAnimatedValueUpdate`',
  'Non-serializable values were found in the navigation state',
  'FlashList only supports',
  'Text strings must be rendered',
]);

// Main App Component with Auth Provider and App Provider
export default function App() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <AppProvider>
            <ThemeProvider>
              <OfflineProvider>
                <NotificationProvider>
                  <AuthProvider>
                    <AppContent />
                  </AuthProvider>
                </NotificationProvider>
              </OfflineProvider>
            </ThemeProvider>
          </AppProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

// Import the contact cache clearing utility
import { clearContactCache } from './src/utils/clearContactCache';

// App Content Component with Auth Context usage
function AppContent() {
  const { loading, isLoggedIn } = useAuth();

  // Clear contact cache on app start
  useEffect(() => {
    const clearCacheOnStart = async () => {
      try {
        console.log('Clearing contact cache on app start...');
        await clearContactCache();
        console.log('Contact cache cleared successfully');
      } catch (error) {
        console.error('Error clearing contact cache:', error);
      }
    };

    clearCacheOnStart();
  }, []);

  // Preload contacts cache when logged in
  useEffect(() => {
    if (isLoggedIn) {
      const preloadContactsCache = async () => {
        try {
          console.log('Preloading contacts cache...');
          // Import the partnersAPI dynamically to avoid circular dependencies
          const { partnersAPI } = await import('./src/api/models/partnersApi');

          // Check if cache exists
          const cachedPartners = await partnersAPI.getPartnersFromCache();
          if (!cachedPartners || cachedPartners.length === 0) {
            console.log('No contacts in cache, preloading first page...');
            // Fetch first page of contacts to populate cache
            await partnersAPI.getList([], [], 100, 0, false);
          } else {
            console.log(`Found ${cachedPartners.length} contacts in cache`);
          }
        } catch (error) {
          console.error('Error preloading contacts cache:', error);
        }
      };

      // Preload contacts cache
      preloadContactsCache();
    }
  }, [isLoggedIn]);

  // Initialize background sync service when logged in
  useEffect(() => {
    if (isLoggedIn) {
      // Initialize background sync service
      backgroundSyncService.initialize();

      // Clean up on unmount
      return () => {
        backgroundSyncService.cleanup();
      };
    }
  }, [isLoggedIn]);

  // Loading screen
  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  // Main App Navigation - handled by AppNavigator
  return <AppNavigator />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#4B5563',
  }
});