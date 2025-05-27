import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  SafeAreaView,
  FlatList,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { partnersAPI } from '../../../api/models/partnersApi.fixed';
import { useAuth } from '../../../contexts/AuthContext';
import { backgroundSyncService } from '../../../services/backgroundSync';

const ContactsListScreen = () => {
  // Wrap useNavigation in a try-catch to prevent text rendering errors
  let navigation;
  try {
    navigation = useNavigation();
  } catch (e) {
    // Handle navigation error silently
    console.log('Navigation hook error:', e);
    navigation = {
      navigate: () => {},
      goBack: () => {}
    };
  }

  const { isLoggedIn } = useAuth();
  const flashListRef = useRef(null);
  const route = useRoute();

  // Check if we're in related contacts mode
  const { relatedTo, relatedIds, parentName, filterMode } = route.params || {};

  // Debug logging for route params
  useEffect(() => {
    console.log('Route params:', route.params);
    console.log('Related mode:', filterMode);
    console.log('Related to:', relatedTo);
    console.log('Related IDs:', relatedIds);
    console.log('Parent name:', parentName);
  }, [route.params, filterMode, relatedTo, relatedIds, parentName]);

  const [contacts, setContacts] = useState([]);
  const [filteredContacts, setFilteredContacts] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const PAGE_SIZE = 100; // Increased number of contacts to fetch per page

  // Get total count of contacts
  const fetchTotalCount = useCallback(async (forceRefresh = false) => {
    try {
      // First try to get count from cache to show something quickly
      const cachedCount = await partnersAPI.getCount(false);
      if (cachedCount > 0) {
        console.log('Total contacts count from cache:', cachedCount);
        setTotalCount(cachedCount);
      }

      // If we need to force refresh or didn't get a cached count, fetch from server
      if (forceRefresh || cachedCount === 0) {
        console.log('Fetching total count from server...');
        // Use a timeout to prevent UI blocking
        setTimeout(async () => {
          try {
            const serverCount = await partnersAPI.getCount(true);
            console.log('Updated total contacts count from server:', serverCount);
            if (serverCount > 0) {
              setTotalCount(serverCount);
            }
          } catch (countError) {
            console.error('Error fetching contacts count from server:', countError);
          }
        }, 1000);
      }

      return cachedCount;
    } catch (err) {
      console.error('Error fetching contacts count:', err);
      return 0;
    }
  }, []);

  // Fetch contacts from the API with pagination
  const fetchContacts = useCallback(async (pageNumber = 0, forceRefresh = false) => {
    if (!isLoggedIn) {
      navigation.navigate('Login');
      return [];
    }

    try {
      if (pageNumber === 0) {
        setInitialLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      console.log(`Fetching contacts page ${pageNumber} from Odoo API...`);
      const offset = pageNumber * PAGE_SIZE;

      // Debug logging to help diagnose pagination issues
      console.log(`Current state before fetch - page: ${pageNumber}, offset: ${offset}, hasMore: ${hasMore}, contacts: ${contacts.length}`);

      // Check if we're in related contacts mode
      if (filterMode === 'related' && relatedIds && relatedIds.length > 0) {
        console.log(`Fetching related contacts for parent ID ${relatedTo}`);

        // For related contacts, we'll fetch them individually since we have their IDs
        // This is more efficient than using a domain filter for specific IDs
        if (pageNumber === 0) {
          // Only fetch on first page since we have all IDs already
          const relatedContacts = [];
          const batchSize = 10; // Process in small batches

          // Process in batches to avoid overwhelming the API
          for (let i = 0; i < relatedIds.length; i += batchSize) {
            const batch = relatedIds.slice(i, i + batchSize);
            const batchResults = await Promise.all(
              batch.map(id =>
                partnersAPI.getById(
                  id,
                  ['id', 'name', 'email', 'phone', 'mobile', 'image_128', 'street', 'city', 'country_id', 'is_company'],
                  forceRefresh
                )
              )
            );

            // Filter out any null results and add to our collection
            relatedContacts.push(...batchResults.filter(contact => contact !== null));

            // Add a small delay between batches
            if (i + batchSize < relatedIds.length) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }

          // Add index property to each contact for stable keys
          const indexedContacts = relatedContacts.map((contact, index) => ({
            ...contact,
            index: index
          }));
          setContacts(indexedContacts);
          setFilteredContacts(indexedContacts);
          setTotalCount(relatedIds.length);
          setHasMore(false); // No pagination for related contacts

          console.log(`Fetched ${relatedContacts.length} related contacts`);
          return relatedContacts;
        } else {
          // For subsequent pages in related mode, we don't need to fetch anything
          // since we loaded all related contacts on the first page
          setHasMore(false);
          return [];
        }
      }

      // Standard contact fetching for non-related mode
      const response = await partnersAPI.getList(
        [], // Empty domain to get all contacts
        ['id', 'name', 'email', 'phone', 'mobile', 'image_128', 'street', 'city', 'country_id', 'is_company'],
        PAGE_SIZE, // Limit
        offset,  // Offset
        forceRefresh // Force refresh flag
      );

      console.log(`Fetched contacts for page ${pageNumber}:`, response ? response.length : 0);

      if (response && Array.isArray(response)) {
        if (response.length > 0) {
          if (pageNumber === 0) {
            // First page, replace all contacts
            console.log(`Setting initial ${response.length} contacts for page 0`);
            // Add index property to each contact for stable keys
            const indexedContacts = response.map((contact, index) => ({
              ...contact,
              index: index
            }));
            setContacts(indexedContacts);
            setFilteredContacts(indexedContacts);

            // Always assume there are more contacts on first page unless we got fewer than PAGE_SIZE
            const moreAvailable = response.length >= PAGE_SIZE;
            console.log(`Setting hasMore to ${moreAvailable} based on first page response length ${response.length}`);
            setHasMore(moreAvailable);
          } else {
            // Subsequent pages, append to existing contacts
            console.log(`Appending ${response.length} contacts from page ${pageNumber} to existing ${contacts.length} contacts`);

            // For subsequent pages, we'll just append the new contacts
            // Add index property to each contact for stable keys
            const pageContacts = response.map((contact, index) => ({
              ...contact,
              index: (pageNumber * PAGE_SIZE) + index
            }));

            console.log(`Adding ${pageContacts.length} contacts from page ${pageNumber}`);

            // Use the functional update form to access the previous state
            setContacts(prevContacts => {
              const updatedContacts = [...prevContacts, ...pageContacts];

              // Update filtered contacts if no search is active
              if (!searchQuery) {
                console.log(`Updating filtered contacts with all ${updatedContacts.length} contacts`);
                setFilteredContacts(updatedContacts);
              } else {
                // If search is active, apply the filter to the updated contacts
                console.log(`Applying search filter "${searchQuery}" to updated contacts`);
                const filtered = updatedContacts.filter(
                  contact =>
                    (contact.name && contact.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
                    (contact.email && contact.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
                    (contact.phone && contact.phone.includes(searchQuery))
                );
                setFilteredContacts(filtered);
              }

              // Check if we have more contacts to load
              const moreAvailable = response.length >= PAGE_SIZE;
              console.log(`Setting hasMore to ${moreAvailable} based on page ${pageNumber} response length ${response.length}`);
              setHasMore(moreAvailable);

              return updatedContacts;
            });

            return response;
          }

          return response;
        } else if (pageNumber === 0) {
          // No contacts found on first page
          console.log('No contacts found in the response');
          setContacts([]);
          setFilteredContacts([]);
          setHasMore(false);
          return [];
        } else {
          // No more contacts found in cache, but we know there are more based on totalCount
          // Force a refresh to fetch from server
          console.log(`No contacts found for page ${pageNumber} in cache, trying to fetch from server`);

          // Only try to fetch from server if we haven't already
          if (!forceRefresh) {
            console.log(`Retrying page ${pageNumber} with forceRefresh=true`);
            const serverResponse = await partnersAPI.getList(
              [], // Empty domain to get all contacts
              ['id', 'name', 'email', 'phone', 'mobile', 'image_128', 'street', 'city', 'country_id', 'is_company'],
              PAGE_SIZE, // Limit
              offset,  // Offset
              true // Force refresh from server
            );

            if (serverResponse && Array.isArray(serverResponse) && serverResponse.length > 0) {
              console.log(`Successfully fetched ${serverResponse.length} contacts from server for page ${pageNumber}`);

              // Use a function to ensure we're working with the latest state
              setContacts(prevContacts => {
                // Add index property to each contact for stable keys
                const pageContacts = serverResponse.map((contact, index) => ({
                  ...contact,
                  index: (pageNumber * PAGE_SIZE) + index
                }));

                console.log(`Adding ${pageContacts.length} contacts from server for page ${pageNumber}`);
                const updatedContacts = [...prevContacts, ...pageContacts];

                // Update filtered contacts if no search is active
                if (!searchQuery) {
                  console.log(`Updating filtered contacts with all ${updatedContacts.length} contacts`);
                  setFilteredContacts(updatedContacts);
                } else {
                  // If search is active, apply the filter to the updated contacts
                  console.log(`Applying search filter "${searchQuery}" to updated contacts`);
                  const filtered = updatedContacts.filter(
                    contact =>
                      (contact.name && contact.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
                      (contact.email && contact.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
                      (contact.phone && contact.phone.includes(searchQuery))
                  );
                  setFilteredContacts(filtered);
                }

                return updatedContacts;
              });

              // Check if we have more contacts to load
              const moreAvailable = serverResponse.length >= PAGE_SIZE;
              console.log(`Setting hasMore to ${moreAvailable} based on server response for page ${pageNumber}`);
              setHasMore(moreAvailable);

              return serverResponse;
            } else {
              // If we still don't get any contacts, now we can assume there are no more
              console.log(`No more contacts found after server fetch for page ${pageNumber}, setting hasMore to false`);
              setHasMore(false);
              return [];
            }
          } else {
            // We already tried with forceRefresh=true and still got nothing
            console.log(`No more contacts found after page ${pageNumber-1}, setting hasMore to false`);
            setHasMore(false);
            return [];
          }
        }
      } else {
        console.error('Invalid response format:', response);
        setError('Failed to load contacts. Invalid response format.');
        return [];
      }
    } catch (err) {
      console.error('Error fetching contacts:', err);

      // Show more detailed error information
      let errorMessage = 'Failed to load contacts. ';

      if (err.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        errorMessage += `Server error: ${err.response.status}`;
        console.error('Error response data:', err.response.data);
        console.error('Error response status:', err.response.status);
        console.error('Error response headers:', err.response.headers);
      } else if (err.request) {
        // The request was made but no response was received
        errorMessage += 'No response from server.';
        console.error('Error request:', err.request);
      } else {
        // Something happened in setting up the request that triggered an Error
        errorMessage += err.message || 'Unknown error.';
        console.error('Error message:', err.message);
      }

      setError(errorMessage);
      return [];
    } finally {
      setInitialLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
      setLoading(false);
    }
  }, [isLoggedIn, navigation, filterMode, relatedTo, relatedIds, contacts.length, searchQuery, hasMore]);



  // Simplified load more function - not needed with our new approach but kept for compatibility
  const handleLoadMore = useCallback(() => {
    // With the new approach, all contacts should be loaded at once from cache
    // This function is kept for compatibility with the FlatList component
    if (loadingMore || !hasMore || refreshing) {
      return;
    }

    console.log('handleLoadMore called - but should not be needed with new approach');
    // No-op if we're using the efficient loading approach, as all contacts are loaded at once
  }, [loadingMore, hasMore, refreshing]);

  // Super simplified refresh function that directly uses the API
  const onRefresh = useCallback(async () => {
    console.log('Manually refreshing contacts (user-initiated pull-to-refresh)...');
    setRefreshing(true);
    setPage(0);

    try {
      // For related contacts, we need to fetch them when the filter changes
      if (filterMode === 'related' && relatedIds && relatedIds.length > 0) {
        console.log('Refreshing related contacts...');
        await fetchContacts(0, true); // Force refresh from server
        setRefreshing(false);
        return;
      }

      // Get all partner IDs first
      console.log('Fetching partner IDs from API...');
      const allIds = await partnersAPI.getAllPartnerIds(true);
      console.log(`Got ${allIds.length} partner IDs, fetching contacts in batches...`);

      if (!allIds || allIds.length === 0) {
        console.log('No partner IDs found, falling back to pagination');
        await fetchContacts(0, true);
        setRefreshing(false);
        return;
      }

      // Process in batches
      const allContacts = [];
      const batchSize = 100;

      for (let i = 0; i < allIds.length; i += batchSize) {
        try {
          const batchIds = allIds.slice(i, i + batchSize);
          console.log(`Fetching batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allIds.length / batchSize)}: ${batchIds.length} contacts`);

          // Use the getList method with the batch of IDs
          const batchContacts = await partnersAPI.getList(
            [['id', 'in', batchIds]],
            ['id', 'name', 'email', 'phone', 'mobile', 'image_128', 'image_1920', 'street', 'street2',
             'city', 'state_id', 'zip', 'country_id', 'website', 'function', 'title',
             'comment', 'is_company', 'parent_id', 'child_ids', 'category_id', 'user_id'],
            batchIds.length,
            0,
            true // Force refresh
          );

          if (batchContacts && Array.isArray(batchContacts) && batchContacts.length > 0) {
            allContacts.push(...batchContacts);
            console.log(`Fetched ${batchContacts.length} contacts in this batch, total: ${allContacts.length}`);

            // Update UI with progress
            const indexedContacts = allContacts.map((contact, index) => ({
              ...contact,
              index: index
            }));

            setContacts(indexedContacts);
            setFilteredContacts(indexedContacts);
            setTotalCount(allIds.length);

            // Save to cache every 500 contacts
            if (allContacts.length % 500 === 0 || i + batchSize >= allIds.length) {
              await partnersAPI.savePartnersToCache(allContacts);
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

      console.log(`Finished loading all contacts: ${allContacts.length}/${allIds.length}`);

      if (allContacts.length > 0) {
        // Final save to cache
        await partnersAPI.savePartnersToCache(allContacts);
        console.log(`Saved ${allContacts.length} contacts to cache`);

        // Save last refresh time
        saveLastRefreshTime();

        // Set hasMore to false since we have all contacts
        setHasMore(false);
      } else {
        console.log('No contacts fetched, falling back to pagination');
        await fetchContacts(0, true);
      }
    } catch (error) {
      console.error('Error refreshing contacts:', error);
      // Fall back to standard pagination approach
      await fetchContacts(0, true);
    } finally {
      setRefreshing(false);
    }
  }, [fetchContacts, saveLastRefreshTime, filterMode, relatedIds]);

  // Filter contacts based on search query
  const handleSearch = useCallback((text) => {
    setSearchQuery(text);
    if (text.trim() === '') {
      setFilteredContacts(contacts);
    } else {
      const filtered = contacts.filter(
        contact =>
          (contact.name && contact.name.toLowerCase().includes(text.toLowerCase())) ||
          (contact.email && contact.email.toLowerCase().includes(text.toLowerCase())) ||
          (contact.phone && contact.phone.includes(text))
      );
      setFilteredContacts(filtered);
    }
  }, [contacts]);


  // Initialize data on first load
  useEffect(() => {
    fetchTotalCount();
  }, [fetchTotalCount]);

  // Constants for refresh timing
  const REFRESH_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  const LAST_REFRESH_KEY = 'contacts_last_refresh_time';

  // Check if we need to refresh based on time since last refresh
  const shouldRefreshContacts = useCallback(async () => {
    try {
      const lastRefreshTime = await AsyncStorage.getItem(LAST_REFRESH_KEY);
      if (!lastRefreshTime) {
        console.log('No last refresh time found, should refresh');
        return true;
      }

      const now = Date.now();
      const timeSinceLastRefresh = now - parseInt(lastRefreshTime);

      if (timeSinceLastRefresh > REFRESH_INTERVAL) {
        console.log(`Last refresh was ${Math.round(timeSinceLastRefresh / (1000 * 60 * 60))} hours ago, should refresh`);
        return true;
      }

      console.log(`Last refresh was ${Math.round(timeSinceLastRefresh / (1000 * 60))} minutes ago, no need to refresh yet`);
      return false;
    } catch (error) {
      console.error('Error checking last refresh time:', error);
      return true; // Refresh on error to be safe
    }
  }, [REFRESH_INTERVAL]);

  // Save the current time as the last refresh time
  const saveLastRefreshTime = useCallback(async () => {
    try {
      const now = Date.now();
      await AsyncStorage.setItem(LAST_REFRESH_KEY, now.toString());
      console.log('Saved current time as last refresh time');
    } catch (error) {
      console.error('Error saving last refresh time:', error);
    }
  }, [LAST_REFRESH_KEY]);



  // Super simplified useFocusEffect that just loads contacts directly from the API
  useFocusEffect(
    useCallback(() => {
      const loadContacts = async () => {
        try {
          setInitialLoading(true);

          // For related contacts, we need to fetch them when the filter changes
          if (filterMode === 'related' && relatedIds && relatedIds.length > 0) {
            console.log('Loading related contacts...');
            fetchContacts(0, false); // Use cache if available
            return;
          }

          // First, check if we have a valid cache
          const cachedContacts = await partnersAPI.getPartnersFromCache();
          if (cachedContacts && cachedContacts.length > 100) {
            console.log(`Found ${cachedContacts.length} contacts in cache, using them directly`);

            // Add index property to each contact for stable keys
            const indexedContacts = cachedContacts.map((contact, index) => ({
              ...contact,
              index: index
            }));

            // Update state
            setContacts(indexedContacts);
            setFilteredContacts(indexedContacts);
            setTotalCount(cachedContacts.length);
            setHasMore(false);

            // Check if we need to do a background sync based on time
            const needsSync = await shouldRefreshContacts();
            if (needsSync) {
              console.log('Cache is valid but outdated, triggering background sync');
              // Trigger sync in background
              backgroundSyncService.syncContactsIfNeeded()
                .catch(error => {
                  console.error('Background sync error:', error);
                });
            }
          } else {
            // If cache is empty or has too few contacts, use the API's getAllContacts method directly
            console.log('Cache is empty or has too few contacts, fetching all contacts from API');

            // Get all contacts at once - this will continue until all contacts are downloaded
            const allContacts = await partnersAPI.getAllContacts(true);

            if (allContacts && Array.isArray(allContacts) && allContacts.length > 0) {
              console.log(`Successfully fetched ${allContacts.length} contacts from API`);

              // Add index property to each contact for stable keys
              const indexedContacts = allContacts.map((contact, index) => ({
                ...contact,
                index: index
              }));

              // Update state
              setContacts(indexedContacts);
              setFilteredContacts(indexedContacts);
              setTotalCount(indexedContacts.length);
              setHasMore(false);

              // Save last refresh time
              saveLastRefreshTime();
            } else {
              console.log('No contacts returned from API, falling back to pagination');
              fetchContacts(0, true);
            }
          }
        } catch (error) {
          console.error('Error loading contacts:', error);
          // Fall back to standard pagination approach
          fetchContacts(0, true);
        } finally {
          setInitialLoading(false);
        }
      };

      loadContacts();
    }, [fetchContacts, shouldRefreshContacts, saveLastRefreshTime, filterMode, relatedIds])
  );

  // Navigate to contact detail screen
  const handleContactPress = (contact) => {
    navigation.navigate('ContactDetail', { id: contact.id });
  };

  // Navigate to create contact screen
  const handleAddContact = () => {
    navigation.navigate('ContactForm', { mode: 'create' });
  };

  // Get initials for avatar placeholder
  const getInitials = (name) => {
    if (!name) return '??';
    return name
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  // Convert base64 image to URI
  const getImageUri = (base64Image) => {
    if (!base64Image) return null;
    return `data:image/png;base64,${base64Image}`;
  };

  // Generate a color based on the contact name
  const getColorFromName = (name) => {
    if (!name) return '#cccccc';

    const colors = [
      '#1abc9c', '#2ecc71', '#3498db', '#9b59b6', '#34495e',
      '#16a085', '#27ae60', '#2980b9', '#8e44ad', '#2c3e50',
      '#f1c40f', '#e67e22', '#e74c3c', '#ecf0f1', '#95a5a6',
      '#f39c12', '#d35400', '#c0392b', '#bdc3c7', '#7f8c8d'
    ];

    // Simple hash function to get a consistent color for a name
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }

    return colors[Math.abs(hash) % colors.length];
  };

  // Render contact item
  const renderContactItem = useCallback(({ item }) => {
    const imageUri = getImageUri(item.image_128);
    const initials = getInitials(item.name);

    return (
      <TouchableOpacity
        style={styles.contactItem}
        onPress={() => handleContactPress(item)}
      >
        <View style={styles.avatarContainer}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: getColorFromName(item.name) }]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
          {item.is_company && (
            <View style={styles.companyBadge}>
              <Icon name="office-building" size={12} color="#fff" />
            </View>
          )}
        </View>
        <View style={styles.contactInfo}>
          <Text style={styles.contactName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.contactDetail} numberOfLines={1}>
            {item.phone || item.mobile || item.email || 'No contact info'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }, [handleContactPress]);

  // Render footer with loading indicator for infinite scrolling
  const renderFooter = useCallback(() => {
    if (!loadingMore) return null;

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#3498db" />
        <Text style={styles.footerText}>Loading more contacts...</Text>
      </View>
    );
  }, [loadingMore]);

  // Render empty list message
  const renderEmptyList = useCallback(() => (
    <View style={styles.emptyContainer}>
      {initialLoading ? (
        <ActivityIndicator size="large" color="#3498db" />
      ) : error ? (
        <View>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : searchQuery ? (
        <Text style={styles.emptyText}>No contacts found matching "{searchQuery}"</Text>
      ) : (
        <View>
          <Icon name="account-group" size={60} color="#ccc" />
          <Text style={styles.emptyText}>No contacts found</Text>
          <TouchableOpacity style={styles.addFirstButton} onPress={handleAddContact}>
            <Text style={styles.addFirstButtonText}>Add your first contact</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  ), [initialLoading, error, searchQuery, onRefresh, handleAddContact]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.homeButton}
          onPress={() => {
            if (filterMode === 'related' && relatedTo) {
              // If we're in related contacts mode, go back to the contact detail
              // Since we used push to get here, goBack() should work correctly
              console.log('Going back to contact detail');
              navigation.goBack();
            } else {
              // Otherwise go to the home screen
              navigation.navigate('Home');
            }
          }}
        >
          <Icon
            name={filterMode === 'related' ? "arrow-left" : "home"}
            size={24}
            color="#3498db"
          />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>
            {filterMode === 'related' && parentName
              ? `${parentName}'s Contacts`
              : 'Contacts'}
          </Text>
          {totalCount > 0 && (
            <Text style={styles.headerCount}>
              {filteredContacts.length}/{totalCount}
            </Text>
          )}
        </View>
        <View style={{width: 24}} /> {/* Empty view for balance */}
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Icon name="magnify" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search contacts..."
          value={searchQuery}
          onChangeText={handleSearch}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Contacts List */}
      <View style={styles.listContainer}>
        <FlatList
          ref={flashListRef}
          data={filteredContacts}
          renderItem={renderContactItem}
          keyExtractor={(item, index) => `contact-${item.id.toString()}-${item.index !== undefined ? item.index : index}`}
          ListEmptyComponent={renderEmptyList}
          ListFooterComponent={renderFooter}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#3498db']}
            />
          }
          contentContainerStyle={filteredContacts.length === 0 ? { backgroundColor: '#fff', paddingVertical: 20 } : { backgroundColor: '#fff' }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          showsVerticalScrollIndicator={false}
          extraData={[loadingMore, page, filteredContacts.length]}
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={21}
          removeClippedSubviews={true}
          getItemLayout={(_, index) => (
            {length: 74, offset: 74 * index, index}
          )}
        />
      </View>

      {/* Floating Action Button */}
      <TouchableOpacity style={styles.fab} onPress={handleAddContact}>
        <Icon name="plus" size={24} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    height: 60,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitleContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  headerCount: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  homeButton: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    margin: 16,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
    color: '#333',
  },
  listContainer: {
    flex: 1,
    width: '100%',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  companyBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#3498db',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  contactInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  contactName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  contactDetail: {
    fontSize: 14,
    color: '#666',
  },
  separator: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginLeft: 82,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
  },
  errorText: {
    fontSize: 16,
    color: '#e74c3c',
    textAlign: 'center',
    marginBottom: 10,
  },
  retryButton: {
    backgroundColor: '#3498db',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  addFirstButton: {
    backgroundColor: '#3498db',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    marginTop: 15,
  },
  addFirstButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  footerLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  footerText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
});

export default ContactsListScreen;
