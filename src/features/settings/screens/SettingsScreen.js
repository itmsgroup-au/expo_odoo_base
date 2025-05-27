import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

// Contexts
import { useAuth } from '../../../contexts/AuthContext';
import { useOffline } from '../../../contexts/offline/OfflineContext';
import { useNotifications } from '../../../contexts/notification/NotificationContext';
import { useTheme } from '../../../contexts/ThemeContext';

// Services
import { syncService } from '../../../services/sync';
import { backgroundSyncService } from '../../../services/backgroundSync';
import { offlineStorage } from '../../../services/offline';
import { documentService } from '../../../services/documents';
import { getSessionInfo, logout, clearSessionData } from '../../../services/auth';

// API
import { getCurrentUser } from '../../../api/models/usersApi';
import { getCompanyInfo } from '../../../api/odooClient';
import helpdeskService from '../../../api/helpdeskServiceV2';

// Utils
import { formatDate } from '../../../utils/dateUtils';
import { formatFileSize } from '../../../utils/fileUtils';
import { confirmAndClearAllCaches } from '../../../utils/clearContactCache';

const SettingsScreen = () => {
  // Wrap useNavigation in a try/catch to prevent text rendering errors
  let navigation;
  try {
    navigation = useNavigation();
  } catch (e) {
    // Handle navigation error silently
    navigation = { navigate: () => {}, goBack: () => {} };
  }

  const { user, logout: authLogout } = useAuth();
  const { isOffline, offlineMode, toggleOfflineMode, pendingOperations } = useOffline();
  const { notificationsEnabled, requestPermissions } = useNotifications();
  const { colors } = useTheme();

  const [sessionInfo, setSessionInfo] = useState(null);
  const [userData, setUserData] = useState(null);
  const [companyInfo, setCompanyInfo] = useState(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isLoadingCompany, setIsLoadingCompany] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [storageStats, setStorageStats] = useState({
    cacheSize: 0,
    documentsSize: 0,
    contactsSize: 0,
    imagesSize: 0,
    otherCacheSize: 0,
    helpdesk: {
      cacheSize: 0,
      attachmentsSize: 0,
      ticketsSize: 0
    },
    totalAvailable: 0,
    totalUsed: 0
  });
  const [syncStats, setSyncStats] = useState({
    lastSync: null,
    pendingOperations: 0,
    isSyncing: false,
    syncProgress: null
  });

  // Settings state
  const [settings, setSettings] = useState({
    enableNotifications: false,
    enableOfflineMode: false,
    autoSync: true,
    syncOnWifiOnly: true,
    enableFullSync: true,
    fullSyncOnWifiOnly: true,
    useBulkDownload: true,
    compressImages: true,
    debugMode: false,
    cacheTimeout: 24, // hours
    darkMode: false
  });

  // Load session info and settings on component mount
  useEffect(() => {
    loadData();
    loadSettings();
    loadStorageStats();
    loadUserData();
    loadCompanyData();

    // Subscribe to sync events
    const unsubscribe = syncService.registerListener(handleSyncEvent);

    return () => {
      unsubscribe();
    };
  }, []);

  // Update sync stats when pendingOperations changes
  useEffect(() => {
    setSyncStats(prev => ({
      ...prev,
      pendingOperations
    }));
  }, [pendingOperations]);

  // Track offline mode changes
  useEffect(() => {
    setSettings(prev => ({
      ...prev,
      enableOfflineMode: offlineMode
    }));
  }, [offlineMode]);

  // Handle sync events from the sync service
  const handleSyncEvent = (event) => {
    if (event.status === 'started' || event.status === 'in_progress' || event.status === 'full_sync_progress') {
      setSyncStats(prev => ({
        ...prev,
        isSyncing: true,
        syncProgress: event.progress || prev.syncProgress
      }));
    } else if (event.status === 'completed' || event.status === 'full_sync_completed') {
      setSyncStats(prev => ({
        ...prev,
        isSyncing: false,
        syncProgress: null,
        lastSync: new Date()
      }));
    } else if (event.status === 'error') {
      setSyncStats(prev => ({
        ...prev,
        isSyncing: false,
        syncProgress: null
      }));
    }
  };

  // Load session info
  const loadData = async () => {
    try {
      setIsLoadingSession(true);
      const info = await getSessionInfo();
      setSessionInfo(info);
    } catch (error) {
      console.error('Error loading session info:', error);
    } finally {
      setIsLoadingSession(false);
      setRefreshing(false);
    }
  };

  // Load user data from Odoo API
  const loadUserData = async () => {
    try {
      setIsLoadingUser(true);
      const user = await getCurrentUser(true);
      console.log('User data loaded:', {
        id: user?.id,
        name: user?.name,
        login: user?.login,
        hasImage: !!user?.image_256,
        hasPicture: !!user?.picture,
        pictureType: user?.picture ? typeof user.picture : 'none'
      });

      // If we have a picture field that's binary data, convert it to a data URL
      if (user?.picture && typeof user.picture === 'string' && !user.picture.startsWith('data:')) {
        user.picture = `data:image/png;base64,${user.picture}`;
        console.log('Converted picture to data URL');
      }

      setUserData(user);
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setIsLoadingUser(false);
    }
  };

  // Load company data from Odoo API
  const loadCompanyData = async () => {
    try {
      setIsLoadingCompany(true);
      console.log('Fetching company information...');
      const company = await getCompanyInfo();
      console.log('Company info fetched:', company);
      setCompanyInfo(company);
    } catch (error) {
      console.error('Error loading company data:', error);
    } finally {
      setIsLoadingCompany(false);
    }
  };

  // Load app settings
  const loadSettings = async () => {
    try {
      const storedSettings = await AsyncStorage.getItem('appSettings');
      if (storedSettings) {
        const parsedSettings = JSON.parse(storedSettings);
        setSettings(prev => ({ ...prev, ...parsedSettings }));

        // Update background sync service with loaded settings
        backgroundSyncService.updateSettings({
          autoSync: parsedSettings.autoSync !== undefined ? parsedSettings.autoSync : true,
          syncOnWifiOnly: parsedSettings.syncOnWifiOnly !== undefined ? parsedSettings.syncOnWifiOnly : true,
          enableFullSync: parsedSettings.enableFullSync !== undefined ? parsedSettings.enableFullSync : true,
          fullSyncOnWifiOnly: parsedSettings.fullSyncOnWifiOnly !== undefined ? parsedSettings.fullSyncOnWifiOnly : true,
          useBulkDownload: parsedSettings.useBulkDownload !== undefined ? parsedSettings.useBulkDownload : true
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  // Load storage statistics
  const loadStorageStats = async () => {
    try {
      // Get all AsyncStorage keys
      const keys = await AsyncStorage.getAllKeys();

      // Categorize keys
      const contactKeys = keys.filter(key => key.includes('partners') || key.includes('contact'));
      const imageKeys = keys.filter(key => key.includes('image') || key.includes('avatar'));
      const cacheKeys = keys.filter(key => key.includes('_cache_'));
      const helpdeskKeys = keys.filter(key =>
        key.includes('helpdesk_ticket_') ||
        key.includes('helpdesk_attachments_') ||
        key.includes('helpdesk_tickets_cache'));
      const otherCacheKeys = cacheKeys.filter(key =>
        !contactKeys.includes(key) && !imageKeys.includes(key) && !helpdeskKeys.includes(key)
      );

      // Initialize size counters
      let contactsSize = 0;
      let imagesSize = 0;
      let otherCacheSize = 0;
      let helpdeskTicketsSize = 0;
      let helpdeskAttachmentsSize = 0;
      let helpdeskCacheSize = 0;

      // Calculate contacts size
      for (const key of contactKeys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          contactsSize += value.length;
        }
      }

      // Calculate images size
      for (const key of imageKeys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          imagesSize += value.length;
        }
      }

      // Calculate helpdesk size
      for (const key of helpdeskKeys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          helpdeskCacheSize += value.length;

          // Categorize by type
          if (key.includes('helpdesk_ticket_')) {
            helpdeskTicketsSize += value.length;
          } else if (key.includes('helpdesk_attachments_')) {
            helpdeskAttachmentsSize += value.length;
          }
        }
      }

      // Calculate other cache size
      for (const key of otherCacheKeys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          otherCacheSize += value.length;
        }
      }

      // Get document cache info from document service
      const docCacheInfo = await documentService.getCacheInfo();
      const documentsSize = docCacheInfo?.totalSize || 0;

      // Calculate total cache size
      const totalCacheSize = contactsSize + imagesSize + otherCacheSize + helpdeskCacheSize;

      // Get device storage info
      let totalAvailable = 0;
      let totalUsed = 0;

      try {
        // Try to get storage info using Expo FileSystem
        if (FileSystem) {
          totalAvailable = await FileSystem.getFreeDiskStorageAsync();
          const totalCapacity = await FileSystem.getTotalDiskCapacityAsync();
          totalUsed = totalCapacity - totalAvailable;
        }
      } catch (storageError) {
        console.log('Could not get device storage info:', storageError);
      }

      // Update storage stats
      setStorageStats({
        cacheSize: totalCacheSize,
        documentsSize,
        contactsSize,
        imagesSize,
        otherCacheSize,
        helpdesk: {
          cacheSize: helpdeskCacheSize,
          ticketsSize: helpdeskTicketsSize,
          attachmentsSize: helpdeskAttachmentsSize
        },
        totalAvailable,
        totalUsed
      });

      console.log('Storage stats:', {
        cacheSize: formatFileSize(totalCacheSize),
        documentsSize: formatFileSize(documentsSize),
        contactsSize: formatFileSize(contactsSize),
        imagesSize: formatFileSize(imagesSize),
        otherCacheSize: formatFileSize(otherCacheSize),
        helpdesk: {
          cacheSize: formatFileSize(helpdeskCacheSize),
          ticketsSize: formatFileSize(helpdeskTicketsSize),
          attachmentsSize: formatFileSize(helpdeskAttachmentsSize)
        },
        totalAvailable: formatFileSize(totalAvailable),
        totalUsed: formatFileSize(totalUsed)
      });
    } catch (error) {
      console.error('Error loading storage stats:', error);
    }
  };

  // Save settings
  const saveSettings = async (newSettings) => {
    try {
      await AsyncStorage.setItem('appSettings', JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  // Handle setting toggle
  const handleToggleSetting = (key) => {
    const newSettings = {
      ...settings,
      [key]: !settings[key]
    };

    // Handle special cases
    if (key === 'enableOfflineMode') {
      toggleOfflineMode(!settings[key]);
    } else if (key === 'enableNotifications' && !settings[key]) {
      requestPermissions();
    } else if (key === 'autoSync' || key === 'syncOnWifiOnly' || key === 'enableFullSync' || key === 'fullSyncOnWifiOnly' || key === 'useBulkDownload') {
      // Update background sync service settings
      backgroundSyncService.updateSettings({
        autoSync: key === 'autoSync' ? !settings[key] : settings.autoSync,
        syncOnWifiOnly: key === 'syncOnWifiOnly' ? !settings[key] : settings.syncOnWifiOnly,
        enableFullSync: key === 'enableFullSync' ? !settings[key] : settings.enableFullSync,
        fullSyncOnWifiOnly: key === 'fullSyncOnWifiOnly' ? !settings[key] : settings.fullSyncOnWifiOnly,
        useBulkDownload: key === 'useBulkDownload' ? !settings[key] : settings.useBulkDownload
      });

      // If turning on auto sync, trigger an immediate sync
      if (key === 'autoSync' && !settings[key]) {
        backgroundSyncService.syncNow();
      }

      // If turning on full sync, trigger an immediate full sync
      if (key === 'enableFullSync' && !settings[key]) {
        backgroundSyncService.fullSyncNow();
      }
    }

    saveSettings(newSettings);
  };

  // Handle refresh
  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
    loadUserData();
    loadCompanyData();
    loadStorageStats();
  };

  // Handle logout
  const handleLogout = () => {
    Alert.alert(
      'Confirm Logout',
      'Are you sure you want to log out? Any unsynchronized changes will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await authLogout();
              // Navigation is handled by the auth state change
            } catch (error) {
              console.error('Error during logout:', error);
              Alert.alert(
                'Logout Error',
                'An error occurred during logout. Please try again.'
              );
            }
          }
        }
      ]
    );
  };

  // Handle sync now
  const handleSyncNow = () => {
    // Sync offline changes
    syncService.syncOfflineChanges();

    // Also trigger background sync for contacts
    backgroundSyncService.syncNow();
  };

  // Handle full sync now
  const handleFullSyncNow = async () => {
    // Show confirmation dialog
    Alert.alert(
      'Full Contact Sync',
      'This will download all contacts from the server and may use significant data and battery. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sync All Contacts',
          onPress: async () => {
            try {
              // Set initial sync state
              setSyncStats(prev => ({
                ...prev,
                isSyncing: true,
                syncProgress: { current: 0, total: 100, percent: 0 }
              }));

              // Start tracking progress
              const progressTracker = setInterval(async () => {
                try {
                  // Get current sync progress from background sync service
                  const progress = await backgroundSyncService.getSyncProgress();
                  if (progress) {
                    setSyncStats(prev => ({
                      ...prev,
                      syncProgress: progress
                    }));

                    // If sync is complete, clear the interval
                    if (progress.percent >= 100) {
                      clearInterval(progressTracker);
                      setSyncStats(prev => ({
                        ...prev,
                        isSyncing: false,
                        lastSync: new Date()
                      }));
                    }
                  }
                } catch (progressError) {
                  console.error('Error getting sync progress:', progressError);
                }
              }, 1000); // Check progress every second

              // Start the efficient full sync
              const result = await backgroundSyncService.forceEfficientSync();

              // Clear the progress tracker
              clearInterval(progressTracker);

              // Update sync stats
              setSyncStats(prev => ({
                ...prev,
                isSyncing: false,
                syncProgress: null,
                lastSync: new Date()
              }));

              if (result.success) {
                Alert.alert('Success', `Sync completed. ${result.count || 0} contacts updated.`);
              } else {
                Alert.alert('Error', result.message || 'Failed to complete sync');
              }
            } catch (error) {
              console.error('Error starting full sync:', error);
              Alert.alert('Error', 'Failed to start full sync: ' + error.message);

              setSyncStats(prev => ({
                ...prev,
                isSyncing: false,
                syncProgress: null
              }));
            }
          }
        }
      ]
    );
  };



  // Handle clear cache
  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'Are you sure you want to clear the cache? This will clear stored data but not your account settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Cache',
          onPress: async () => {
            try {
              await offlineStorage.clearCache();
              await documentService.clearCache();
              await loadStorageStats();
              Alert.alert('Success', 'Cache cleared successfully');
            } catch (error) {
              console.error('Error clearing cache:', error);
              Alert.alert('Error', 'Failed to clear cache');
            }
          }
        }
      ]
    );
  };

  // Handle clear helpdesk cache
  const handleClearHelpdeskCache = () => {
    Alert.alert(
      'Clear Helpdesk Cache',
      'Are you sure you want to clear the helpdesk cache? This will remove all cached tickets and attachments, but not affect any pending changes.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Cache',
          onPress: async () => {
            try {
              // Call the helpdesk service to clear cache
              const result = await helpdeskService.clearHelpdeskCache();

              if (result) {
                // Reload storage stats to show updated values
                await loadStorageStats();
                Alert.alert('Success', 'Helpdesk cache cleared successfully');
              } else {
                Alert.alert('Error', 'Failed to clear helpdesk cache');
              }
            } catch (error) {
              console.error('Error clearing helpdesk cache:', error);
              Alert.alert('Error', `Failed to clear helpdesk cache: ${error.message}`);
            }
          }
        }
      ]
    );
  };

  // Render session info section
  const renderSessionInfo = () => {
    if (isLoadingSession || isLoadingUser || isLoadingCompany) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Loading account info...</Text>
        </View>
      );
    }

    if (!sessionInfo && !userData) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={24} color="#999" />
          <Text style={styles.emptyStateText}>No account information available</Text>
        </View>
      );
    }

    return (
      <View style={styles.infoContainer}>

        <View style={styles.longInfoRow}>
          <Text style={styles.longInfoLabel}>Username</Text>
          <Text style={styles.longInfoValue} selectable={true}>
            {userData?.login || sessionInfo?.username}
          </Text>
        </View>

        <View style={styles.longInfoRow}>
          <Text style={styles.longInfoLabel}>Server</Text>
          <Text style={styles.longInfoValue} selectable={true}>
            {sessionInfo?.serverUrl}
          </Text>
        </View>

        <View style={styles.longInfoRow}>
          <Text style={styles.longInfoLabel}>User ID</Text>
          <Text style={styles.longInfoValue} selectable={true}>
            {userData?.id || sessionInfo?.userId}
          </Text>
        </View>

        <View style={styles.longInfoRow}>
          <Text style={styles.longInfoLabel}>Company</Text>
          <Text style={styles.longInfoValue} selectable={true}>
            {companyInfo?.current_company ? companyInfo.current_company[1] :
             userData?.company_id ? userData.company_id[1] : 'N/A'}
          </Text>
        </View>

        {/* Move long fields to the bottom */}
        <View style={styles.longInfoRow}>
          <Text style={styles.longInfoLabel}>Database</Text>
          <Text style={styles.longInfoValue} selectable={true}>
            {sessionInfo?.database}
          </Text>
        </View>

        {companyInfo?.allowed_companies && companyInfo.allowed_companies.length > 0 && (
          <View style={styles.longInfoRow}>
            <Text style={styles.longInfoLabel}>Available Companies</Text>
            <View style={styles.companiesList}>
              {companyInfo.allowed_companies.map((company, index) => (
                <Text key={index} style={styles.companyItem}>
                  • {company[1]}
                </Text>
              ))}
            </View>
          </View>
        )}

        <View style={styles.longInfoRow}>
          <Text style={styles.longInfoLabel}>Last Login</Text>
          <Text style={styles.longInfoValue} selectable={true}>
            {sessionInfo?.lastLogin
              ? formatDate(sessionInfo.lastLogin, 'yyyy-MM-dd HH:mm')
              : 'N/A'
            }
          </Text>
        </View>

        <View style={styles.longInfoRow}>
          <Text style={styles.longInfoLabel}>Session Expires</Text>
          <Text style={styles.longInfoValue} selectable={true}>
            {sessionInfo?.sessionExpiry
              ? formatDate(sessionInfo.sessionExpiry, 'yyyy-MM-dd HH:mm')
              : 'N/A'
            }
          </Text>
        </View>

        {sessionInfo?.userContext && (
          <View style={styles.longInfoRow}>
            <Text style={styles.longInfoLabel}>Language</Text>
            <Text style={styles.longInfoValue} selectable={true}>
              {sessionInfo.userContext.lang || 'en_US'}
            </Text>
          </View>
        )}

        <View style={styles.longInfoRow}>
          <Text style={styles.longInfoLabel}>Connection</Text>
          <Text style={[
            styles.longInfoValue,
            { color: isOffline ? colors.error : colors.success }
          ]} selectable={true}>
            {isOffline ? 'Offline' : 'Online'}
          </Text>
        </View>
      </View>
    );
  };

  // Back button handler
  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} /> {/* Empty space to balance the header */}
      </View>

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={["#3B82F6"]}
          />
        }
      >
        {/* User Profile Section (Apple-style) */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.profileRow}
            onPress={() => navigation.navigate('Profile')}
          >
            <View style={styles.profileImageContainer}>
              {userData?.image_256 || userData?.picture ? (
                <Image
                  source={{
                    uri: userData.picture ?
                      (userData.picture.startsWith('data:') ? userData.picture : `data:image/png;base64,${userData.picture}`) :
                      `data:image/png;base64,${userData.image_256}`
                  }}
                  style={styles.profileImage}
                  defaultSource={require('../../../assets/images/default_avatar.png')}
                />
              ) : (
                <View style={[styles.profileImagePlaceholder, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.profileImagePlaceholderText, { color: colors.onPrimary }]}>
                    {userData?.name ? userData.name.charAt(0).toUpperCase() : '?'}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{userData?.name || 'User'}</Text>
              <Text style={styles.profileSubtitle}>My Profile</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Account Information Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Account Information</Text>
          </View>
          {renderSessionInfo()}
        </View>

        {/* Sync Status Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Synchronization</Text>
          </View>
          <View style={styles.syncStatusContainer}>
            <View style={styles.syncInfoRow}>
              <Text style={styles.syncInfoLabel}>Last Sync</Text>
              <Text style={styles.syncInfoValue}>
                {syncStats.lastSync
                  ? formatDate(syncStats.lastSync, 'yyyy-MM-dd HH:mm:ss')
                  : 'Never'
                }
              </Text>
            </View>

            <View style={styles.syncInfoRow}>
              <Text style={styles.syncInfoLabel}>Pending Operations</Text>
              <Text style={[
                styles.syncInfoValue,
                syncStats.pendingOperations > 0 ? styles.syncInfoHighlight : null
              ]}>
                {syncStats.pendingOperations}
              </Text>
            </View>

            <View style={styles.syncInfoRow}>
              <Text style={styles.syncInfoLabel}>Status</Text>
              <Text style={[
                styles.syncInfoValue,
                syncStats.isSyncing ? styles.syncInfoHighlight : null
              ]}>
                {syncStats.isSyncing ? 'Syncing...' : 'Idle'}
              </Text>
            </View>

            {syncStats.isSyncing ? (
              <View style={styles.syncProgressContainer}>
                <Text style={styles.syncProgressText}>
                  Syncing contacts... {syncStats.syncProgress ? `${syncStats.syncProgress.loaded}/${syncStats.syncProgress.total} (${Math.round((syncStats.syncProgress.loaded / syncStats.syncProgress.total) * 100)}%)` : ''}
                </Text>
                <View style={styles.syncProgressBarContainer}>
                  <View
                    style={[
                      styles.syncProgressBar,
                      {
                        width: syncStats.syncProgress ?
                          `${Math.round((syncStats.syncProgress.loaded / syncStats.syncProgress.total) * 100)}%` :
                          '5%'
                      }
                    ]}
                  />
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={[
                  styles.fullSyncButton,
                  isOffline ? styles.disabledButton : null
                ]}
                onPress={handleFullSyncNow}
                disabled={isOffline || syncStats.isSyncing}
              >
                <Ionicons name="cloud-download" size={18} color="white" style={styles.buttonIcon} />
                <Text style={styles.buttonText}>Sync All Contacts</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Storage Information Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Storage</Text>
          </View>
          <View style={styles.storageInfoContainer}>
            {/* Device Storage */}
            <View style={styles.storageSection}>
              <Text style={styles.storageSectionTitle}>Device Storage</Text>

              {storageStats.totalAvailable > 0 && (
                <>
                  <View style={styles.storageBarContainer}>
                    <View
                      style={[
                        styles.storageBarFill,
                        {
                          width: `${Math.min(100, (storageStats.totalUsed / (storageStats.totalUsed + storageStats.totalAvailable)) * 100)}%`,
                          backgroundColor: storageStats.totalAvailable < 1024 * 1024 * 1024 ? '#EF4444' : '#3B82F6'
                        }
                      ]}
                    />
                  </View>

                  <View style={styles.storageBarLabels}>
                    <Text style={styles.storageBarLabel}>
                      Used: {formatFileSize(storageStats.totalUsed)}
                    </Text>
                    <Text style={styles.storageBarLabel}>
                      Free: {formatFileSize(storageStats.totalAvailable)}
                    </Text>
                  </View>
                </>
              )}
            </View>

            {/* App Storage Breakdown */}
            <View style={styles.storageSection}>
              <Text style={styles.storageSectionTitle}>App Storage Breakdown</Text>

              <View style={styles.storageInfoRow}>
                <Text style={styles.storageInfoLabel}>Contacts Data</Text>
                <Text style={styles.storageInfoValue}>
                  {formatFileSize(storageStats.contactsSize)}
                </Text>
              </View>

              <View style={styles.storageInfoRow}>
                <Text style={styles.storageInfoLabel}>Images Cache</Text>
                <Text style={styles.storageInfoValue}>
                  {formatFileSize(storageStats.imagesSize)}
                </Text>
              </View>

              <View style={styles.storageInfoRow}>
                <Text style={styles.storageInfoLabel}>Documents Cache</Text>
                <Text style={styles.storageInfoValue}>
                  {formatFileSize(storageStats.documentsSize)}
                </Text>
              </View>

              <View style={styles.storageInfoRow}>
                <Text style={styles.storageInfoLabel}>Other Cache Data</Text>
                <Text style={styles.storageInfoValue}>
                  {formatFileSize(storageStats.otherCacheSize)}
                </Text>
              </View>

              <View style={styles.storageInfoRow}>
                <Text style={[styles.storageInfoLabel, styles.storageTotalLabel]}>Total App Storage</Text>
                <Text style={[styles.storageInfoValue, styles.storageTotalValue]}>
                  {formatFileSize(
                    storageStats.contactsSize +
                    storageStats.imagesSize +
                    storageStats.documentsSize +
                    storageStats.otherCacheSize
                  )}
                </Text>
              </View>

              {/* Storage visualization */}
              {(storageStats.contactsSize + storageStats.imagesSize + storageStats.documentsSize + storageStats.otherCacheSize) > 0 && (
                <View style={styles.storageVisualization}>
                  <View
                    style={[
                      styles.storageVisBar,
                      {
                        width: `${(storageStats.contactsSize / (storageStats.contactsSize + storageStats.imagesSize + storageStats.documentsSize + storageStats.otherCacheSize)) * 100}%`,
                        backgroundColor: '#3B82F6' // Blue for contacts
                      }
                    ]}
                  />
                  <View
                    style={[
                      styles.storageVisBar,
                      {
                        width: `${(storageStats.imagesSize / (storageStats.contactsSize + storageStats.imagesSize + storageStats.documentsSize + storageStats.otherCacheSize)) * 100}%`,
                        backgroundColor: '#10B981' // Green for images
                      }
                    ]}
                  />
                  <View
                    style={[
                      styles.storageVisBar,
                      {
                        width: `${(storageStats.documentsSize / (storageStats.contactsSize + storageStats.imagesSize + storageStats.documentsSize + storageStats.otherCacheSize)) * 100}%`,
                        backgroundColor: '#F59E0B' // Yellow for documents
                      }
                    ]}
                  />
                  <View
                    style={[
                      styles.storageVisBar,
                      {
                        width: `${(storageStats.otherCacheSize / (storageStats.contactsSize + storageStats.imagesSize + storageStats.documentsSize + storageStats.otherCacheSize)) * 100}%`,
                        backgroundColor: '#8B5CF6' // Purple for other
                      }
                    ]}
                  />
                </View>
              )}

              <View style={styles.storageVisLabels}>
                <View style={styles.storageVisLabelItem}>
                  <View style={[styles.storageVisLabelColor, { backgroundColor: '#3B82F6' }]} />
                  <Text style={styles.storageVisLabelText}>Contacts</Text>
                </View>
                <View style={styles.storageVisLabelItem}>
                  <View style={[styles.storageVisLabelColor, { backgroundColor: '#10B981' }]} />
                  <Text style={styles.storageVisLabelText}>Images</Text>
                </View>
                <View style={styles.storageVisLabelItem}>
                  <View style={[styles.storageVisLabelColor, { backgroundColor: '#F59E0B' }]} />
                  <Text style={styles.storageVisLabelText}>Documents</Text>
                </View>
                <View style={styles.storageVisLabelItem}>
                  <View style={[styles.storageVisLabelColor, { backgroundColor: '#8B5CF6' }]} />
                  <Text style={styles.storageVisLabelText}>Other</Text>
                </View>
              </View>
            </View>

            {/* Cache Management */}
            <View style={styles.storageSection}>
              <Text style={styles.storageSectionTitle}>Cache Management</Text>

              <TouchableOpacity
                style={styles.clearCacheButton}
                onPress={handleClearCache}
              >
                <Ionicons name="trash-outline" size={18} color="white" style={styles.buttonIcon} />
                <Text style={styles.buttonText}>Clear Cache</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.clearHelpdeskButton}
                onPress={handleClearHelpdeskCache}
              >
                <Ionicons name="trash-outline" size={18} color="white" style={styles.buttonIcon} />
                <Text style={styles.buttonText}>Clear Helpdesk Cache</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.clearAllButton}
                onPress={confirmAndClearAllCaches}
              >
                <Ionicons name="refresh-circle-outline" size={18} color="white" style={styles.buttonIcon} />
                <Text style={styles.buttonText}>Clear All Data & Reset</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Application Settings Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Application Settings</Text>
          </View>

          <View style={styles.settingsContainer}>
            {/* Notifications */}
            <View style={styles.settingRow}>
              <View style={styles.settingLabelContainer}>
                <Ionicons name="notifications-outline" size={22} color="#333" style={styles.settingIcon} />
                <Text style={styles.settingLabel}>Enable Notifications</Text>
              </View>
              <Switch
                value={settings.enableNotifications}
                onValueChange={() => handleToggleSetting('enableNotifications')}
                trackColor={{ false: '#dedede', true: '#90caf9' }}
                thumbColor={settings.enableNotifications ? '#3B82F6' : '#f4f3f4'}
              />
            </View>

            {/* Offline Mode */}
            <View style={styles.settingRow}>
              <View style={styles.settingLabelContainer}>
                <Ionicons name="cloud-offline-outline" size={22} color="#333" style={styles.settingIcon} />
                <Text style={styles.settingLabel}>Enable Offline Mode</Text>
              </View>
              <Switch
                value={settings.enableOfflineMode}
                onValueChange={() => handleToggleSetting('enableOfflineMode')}
                trackColor={{ false: '#dedede', true: '#90caf9' }}
                thumbColor={settings.enableOfflineMode ? '#3B82F6' : '#f4f3f4'}
              />
            </View>

            {/* Auto Sync */}
            <View style={styles.settingRow}>
              <View style={styles.settingLabelContainer}>
                <Ionicons name="sync-outline" size={22} color="#333" style={styles.settingIcon} />
                <Text style={styles.settingLabel}>Auto Synchronize</Text>
              </View>
              <Switch
                value={settings.autoSync}
                onValueChange={() => handleToggleSetting('autoSync')}
                trackColor={{ false: '#dedede', true: '#90caf9' }}
                thumbColor={settings.autoSync ? '#3B82F6' : '#f4f3f4'}
              />
            </View>

            {/* Sync on WiFi Only */}
            <View style={styles.settingRow}>
              <View style={styles.settingLabelContainer}>
                <Ionicons name="wifi-outline" size={22} color="#333" style={styles.settingIcon} />
                <Text style={styles.settingLabel}>Sync on WiFi Only</Text>
              </View>
              <Switch
                value={settings.syncOnWifiOnly}
                onValueChange={() => handleToggleSetting('syncOnWifiOnly')}
                trackColor={{ false: '#dedede', true: '#90caf9' }}
                thumbColor={settings.syncOnWifiOnly ? '#3B82F6' : '#f4f3f4'}
                disabled={!settings.autoSync}
              />
            </View>

            {/* Full Sync */}
            <View style={styles.settingRow}>
              <View style={styles.settingLabelContainer}>
                <Ionicons name="cloud-download-outline" size={22} color="#333" style={styles.settingIcon} />
                <Text style={styles.settingLabel}>Enable Full Contact Sync</Text>
              </View>
              <Switch
                value={settings.enableFullSync}
                onValueChange={() => handleToggleSetting('enableFullSync')}
                trackColor={{ false: '#dedede', true: '#90caf9' }}
                thumbColor={settings.enableFullSync ? '#3B82F6' : '#f4f3f4'}
              />
            </View>

            {/* Full Sync on WiFi Only */}
            <View style={styles.settingRow}>
              <View style={styles.settingLabelContainer}>
                <Ionicons name="wifi-outline" size={22} color="#333" style={styles.settingIcon} />
                <Text style={styles.settingLabel}>Full Sync on WiFi Only</Text>
              </View>
              <Switch
                value={settings.fullSyncOnWifiOnly}
                onValueChange={() => handleToggleSetting('fullSyncOnWifiOnly')}
                trackColor={{ false: '#dedede', true: '#90caf9' }}
                thumbColor={settings.fullSyncOnWifiOnly ? '#3B82F6' : '#f4f3f4'}
                disabled={!settings.enableFullSync}
              />
            </View>

            {/* Use Bulk Download */}
            <View style={styles.settingRow}>
              <View style={styles.settingLabelContainer}>
                <Ionicons name="flash-outline" size={22} color="#333" style={styles.settingIcon} />
                <Text style={styles.settingLabel}>Use Bulk Download</Text>
                <TouchableOpacity
                  onPress={() => Alert.alert(
                    'Bulk Download',
                    'When enabled, the app will try to download all contacts at once for faster syncing. If this fails, it will fall back to downloading in batches.'
                  )}
                  style={{ marginLeft: 6 }}
                >
                  <Ionicons name="information-circle-outline" size={16} color="#666" />
                </TouchableOpacity>
              </View>
              <Switch
                value={settings.useBulkDownload}
                onValueChange={() => handleToggleSetting('useBulkDownload')}
                trackColor={{ false: '#dedede', true: '#90caf9' }}
                thumbColor={settings.useBulkDownload ? '#3B82F6' : '#f4f3f4'}
                disabled={!settings.enableFullSync}
              />
            </View>

            {/* Compress Images */}
            <View style={styles.settingRow}>
              <View style={styles.settingLabelContainer}>
                <Ionicons name="image-outline" size={22} color="#333" style={styles.settingIcon} />
                <Text style={styles.settingLabel}>Compress Images</Text>
              </View>
              <Switch
                value={settings.compressImages}
                onValueChange={() => handleToggleSetting('compressImages')}
                trackColor={{ false: '#dedede', true: '#90caf9' }}
                thumbColor={settings.compressImages ? '#3B82F6' : '#f4f3f4'}
              />
            </View>

            {/* Dark Mode */}
            <View style={styles.settingRow}>
              <View style={styles.settingLabelContainer}>
                <Ionicons name="moon-outline" size={22} color="#333" style={styles.settingIcon} />
                <Text style={styles.settingLabel}>Dark Mode</Text>
              </View>
              <Switch
                value={settings.darkMode}
                onValueChange={() => handleToggleSetting('darkMode')}
                trackColor={{ false: '#dedede', true: '#90caf9' }}
                thumbColor={settings.darkMode ? '#3B82F6' : '#f4f3f4'}
              />
            </View>

            {/* Debug Mode */}
            <View style={styles.settingRow}>
              <View style={styles.settingLabelContainer}>
                <Ionicons name="bug-outline" size={22} color="#333" style={styles.settingIcon} />
                <Text style={styles.settingLabel}>Debug Mode</Text>
              </View>
              <Switch
                value={settings.debugMode}
                onValueChange={() => handleToggleSetting('debugMode')}
                trackColor={{ false: '#dedede', true: '#90caf9' }}
                thumbColor={settings.debugMode ? '#3B82F6' : '#f4f3f4'}
              />
            </View>
          </View>
        </View>

        {/* App Info */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>About</Text>
          </View>
          <View style={styles.aboutContainer}>
            <Text style={styles.appVersion}>ExoMobile v1.0.0</Text>
            <Text style={styles.appDescription}>
              A mobile application for accessing your Odoo ERP system on the go.
            </Text>
            <Text style={styles.copyright}>© 2025 ExoMobile</Text>
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={20} color="white" style={styles.buttonIcon} />
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </TouchableOpacity>

        {/* Debug section - only visible in debug mode */}
        {settings.debugMode && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Debug Information</Text>
            </View>
            <View style={styles.debugContainer}>
              <Text style={styles.debugText}>Session ID: {sessionInfo?.sessionId || 'N/A'}</Text>
              <Text style={styles.debugText}>API Version: {sessionInfo?.apiVersion || 'N/A'}</Text>
              <Text style={styles.debugText}>Odoo Version: {sessionInfo?.serverVersion || 'N/A'}</Text>
              <Text style={styles.debugText}>Offline Queue Size: {syncStats.pendingOperations}</Text>

              <TouchableOpacity
                style={styles.debugButton}
                onPress={async () => {
                  await clearSessionData();
                  Alert.alert('Debug', 'Session data cleared. You will need to log in again.');
                  handleLogout();
                }}
              >
                <Text style={styles.debugButtonText}>Clear Session Data</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Bottom padding */}
        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  backButton: {
    padding: 8,
  },
  scrollContainer: {
    flex: 1,
  },
  contentContainer: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 10,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  loadingText: {
    marginLeft: 10,
    color: '#6B7280',
    fontSize: 14,
  },
  emptyState: {
    padding: 20,
    alignItems: 'center',
  },
  emptyStateText: {
    color: '#9CA3AF',
    marginTop: 8,
  },
  infoContainer: {
    padding: 16,
  },
  userProfileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  profileImageContainer: {
    marginRight: 16,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  profileImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  profileImagePlaceholderText: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  userInfoContainer: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  viewProfileButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#EBF5FF',
    borderRadius: 4,
  },
  viewProfileButtonText: {
    color: '#3B82F6',
    fontSize: 12,
    fontWeight: '500',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  profileSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    alignItems: 'center',
  },
  infoLabel: {
    color: '#6B7280',
    fontSize: 14,
    flex: 0.4,
    fontWeight: '400',
  },
  infoValue: {
    color: '#1F2937',
    fontSize: 14,
    fontWeight: '500',
    flex: 0.6,
    textAlign: 'right',
  },
  // Styles for long fields that need special handling
  longInfoRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  longInfoLabel: {
    color: '#6B7280',
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '400',
  },
  longInfoValue: {
    color: '#1F2937',
    fontSize: 14,
    fontWeight: '500',
    paddingLeft: 10,
    paddingRight: 10,
    paddingVertical: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  companiesList: {
    paddingLeft: 10,
    paddingRight: 10,
    paddingVertical: 6,
    backgroundColor: '#F9FAFB',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  companyItem: {
    fontSize: 14,
    color: '#1F2937',
    paddingVertical: 4,
  },
  syncStatusContainer: {
    padding: 16,
  },
  syncInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  syncInfoLabel: {
    color: '#6B7280',
    fontSize: 14,
  },
  syncInfoValue: {
    color: '#1F2937',
    fontSize: 14,
    fontWeight: '500',
  },
  syncInfoHighlight: {
    color: '#3B82F6',
  },
  syncButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  fullSyncButton: {
    backgroundColor: '#10B981', // Green color for distinction
    borderRadius: 8,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  efficientSyncButton: {
    backgroundColor: '#8B5CF6', // Purple color for smart sync
    borderRadius: 8,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonIcon: {
    marginRight: 8,
  },
  disabledButton: {
    backgroundColor: '#9CA3AF',
  },
  syncProgressContainer: {
    marginTop: 16,
    width: '100%',
  },
  syncProgressText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  syncProgressBarContainer: {
    height: 10,
    backgroundColor: '#e0e0e0',
    borderRadius: 5,
    overflow: 'hidden',
  },
  syncProgressBar: {
    height: '100%',
    backgroundColor: '#3B82F6',
  },
  storageInfoContainer: {
    padding: 16,
  },
  storageSection: {
    marginBottom: 20,
  },
  storageSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: 12,
  },
  storageInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  storageInfoLabel: {
    color: '#6B7280',
    fontSize: 14,
  },
  storageInfoValue: {
    color: '#1F2937',
    fontSize: 14,
    fontWeight: '500',
  },
  storageTotalLabel: {
    fontWeight: '600',
    color: '#4B5563',
  },
  storageTotalValue: {
    fontWeight: '600',
    color: '#3B82F6',
  },
  storageBarContainer: {
    height: 12,
    backgroundColor: '#E5E7EB',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  storageBarFill: {
    height: '100%',
    borderRadius: 6,
  },
  storageBarLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  storageBarLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  storageVisualization: {
    height: 16,
    flexDirection: 'row',
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 16,
    marginBottom: 8,
  },
  storageVisBar: {
    height: '100%',
  },
  storageVisLabels: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  storageVisLabelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    marginBottom: 8,
  },
  storageVisLabelColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 4,
  },
  storageVisLabelText: {
    fontSize: 12,
    color: '#6B7280',
  },
  clearCacheButton: {
    backgroundColor: '#EF4444',
    borderRadius: 8,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  clearAllButton: {
    backgroundColor: '#7C3AED', // Purple color for distinction
    borderRadius: 8,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  settingsContainer: {
    padding: 16,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  settingLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIcon: {
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 16,
    color: '#1F2937',
  },
  aboutContainer: {
    padding: 20,
    alignItems: 'center',
  },
  appVersion: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  appDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 8,
  },
  copyright: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  logoutButton: {
    backgroundColor: '#EF4444',
    borderRadius: 8,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  logoutButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  debugContainer: {
    padding: 16,
  },
  debugText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  debugButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 16,
    alignSelf: 'center',
  },
  debugButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  bottomPadding: {
    height: 30,
  },
  clearHelpdeskButton: {
    backgroundColor: '#8B5CF6', // Purple for helpdesk
    borderRadius: 8,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
});

export default SettingsScreen;