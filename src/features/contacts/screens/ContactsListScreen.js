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
import { partnersAPI } from '../../../api/models/partnersApi';
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

  // Simplified fetch method using the optimal API
  const fetchContacts = useCallback(async (pageNumber = 0, forceRefresh = false) => {
    if (!isLoggedIn) {
      navigation.navigate('Login');
      return [];
    }

    try {
      if (pageNumber === 0) {
        setInitialLoading(true);
      }
      setError(null);

      console.log(`🚀 Fetching contacts page ${pageNumber} with OPTIMAL method...`);

      // For related contacts mode
      if (filterMode === 'related' && relatedIds && relatedIds.length > 0) {
        console.log(`Fetching related contacts for parent ID ${relatedTo}`);
        // ... existing related contacts logic ...
        return relatedContacts;
      }

      // For first page, use the optimal method that gets ALL contacts
      if (pageNumber === 0) {
        console.log('🎯 Using getAllContactsOptimal to get ALL contacts at once...');
        
        const allContacts = await partnersAPI.getAllContactsOptimal(forceRefresh);
        
        if (allContacts && allContacts.length > 0) {
          console.log(`🎉 SUCCESS! Got ${allContacts.length} contacts with optimal method`);
          
          // Add index property for stable keys
          const indexedContacts = allContacts.map((contact, index) => ({
            ...contact,
            index: index
          }));
          
          setContacts(indexedContacts);
          setFilteredContacts(indexedContacts);
          setTotalCount(allContacts.length);
          setHasMore(false); // No pagination needed - we have all contacts
          
          return indexedContacts;
        }
      }

      // Fallback for subsequent pages (shouldn't be needed)
      console.log('Using fallback pagination method');
      const response = await partnersAPI.getList(
        [], // Empty domain uses bypass automatically
        ['id', 'name', 'email', 'phone', 'mobile', 'image_128', 'street', 'city', 'country_id', 'is_company'],
        PAGE_SIZE,
        pageNumber * PAGE_SIZE,
        forceRefresh
      );

      if (response && Array.isArray(response) && response.length > 0) {
        const indexedContacts = response.map((contact, index) => ({
          ...contact,
          index: (pageNumber * PAGE_SIZE) + index
        }));
        
        if (pageNumber === 0) {
          setContacts(indexedContacts);
          setFilteredContacts(indexedContacts);
        } else {
          setContacts(prev => [...prev, ...indexedContacts]);
          setFilteredContacts(prev => [...prev, ...indexedContacts]);
        }
        
        setHasMore(response.length >= PAGE_SIZE);
        return response;
      }

      return [];
    } catch (err) {
      console.error('❌ Error fetching contacts:', err);
      setError(`Failed to load contacts: ${err.message}`);
      return [];
    } finally {
      setInitialLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [isLoggedIn, navigation, filterMode, relatedTo, relatedIds]);



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

  // Simplified refresh function using optimal method
  const onRefresh = useCallback(async () => {
    console.log('🔄 Refreshing contacts with optimal method...');
    setRefreshing(true);
    setPage(0);

    try {
      // For related contacts
      if (filterMode === 'related' && relatedIds && relatedIds.length > 0) {
        await fetchContacts(0, true);
        return;
      }

      // Use the optimal method to get all contacts
      console.log('🎯 Using getAllContactsOptimal for refresh...');
      const allContacts = await partnersAPI.getAllContactsOptimal(true); // Force refresh
      
      if (allContacts && allContacts.length > 0) {
        console.log(`🎉 Refreshed with ${allContacts.length} contacts`);
        
        const indexedContacts = allContacts.map((contact, index) => ({
          ...contact,
          index: index
        }));
        
        setContacts(indexedContacts);
        setFilteredContacts(indexedContacts);
        setTotalCount(allContacts.length);
        setHasMore(false); // No pagination needed
        
        // Save last refresh time
        await AsyncStorage.setItem('contacts_last_refresh_time', Date.now().toString());
      } else {
        console.log('No contacts from optimal method, falling back');
        await fetchContacts(0, true);
      }
    } catch (error) {
      console.error('Error refreshing contacts:', error);
      await fetchContacts(0, true);
    } finally {
      setRefreshing(false);
    }
  }, [fetchContacts, filterMode, relatedIds]);

  // Fast, debounced search with better filtering
  const [searchTimeout, setSearchTimeout] = useState(null);

  const performSearch = useCallback((searchTerm) => {
    console.log(`=== SEARCH DEBUG START ===`);
    console.log(`Search term: "${searchTerm}"`);
    console.log(`Total contacts available: ${contacts.length}`);

    if (searchTerm.trim() === '') {
      console.log(`Empty search, showing all ${contacts.length} contacts`);
      setFilteredContacts(contacts);
      return;
    }

    const term = searchTerm.toLowerCase().trim();
    const startTime = Date.now();

    // Debug: Show some sample contact names to verify data
    if (contacts.length > 0) {
      const sampleNames = contacts.slice(0, 10).map(c => c.name || 'NO_NAME').join(', ');
      console.log(`Sample contact names: ${sampleNames}`);

      // Show last 10 contacts too (to see if we have Z names)
      const lastSampleNames = contacts.slice(-10).map(c => c.name || 'NO_NAME').join(', ');
      console.log(`Last 10 contact names: ${lastSampleNames}`);

      // Check if we have contacts starting with the search term
      const contactsStartingWith = contacts.filter(c => c.name && c.name.toLowerCase().startsWith(term.toLowerCase()));
      console.log(`Contacts starting with "${term}": ${contactsStartingWith.length}`);

      // Check for exact matches
      const exactMatches = contacts.filter(c => c.name && c.name.toLowerCase() === term.toLowerCase());
      console.log(`Exact matches for "${term}": ${exactMatches.length}`);

      // Check for partial matches (contains)
      const partialMatches = contacts.filter(c => c.name && c.name.toLowerCase().includes(term.toLowerCase()));
      console.log(`Partial matches for "${term}": ${partialMatches.length}`);
      if (partialMatches.length > 0) {
        console.log(`First few partial matches:`, partialMatches.slice(0, 5).map(c => c.name));
      }
    } else {
      console.log(`NO CONTACTS AVAILABLE FOR SEARCH!`);
    }

    const filtered = contacts.filter(contact => {
      // Only skip contacts with truly invalid names (be much less aggressive)
      if (!contact.name || 
          contact.name.trim() === '' ||
          contact.name.includes('geztamjqga4dombtgeztamjqgbp7sfe4o5f2skpzlekrpzq2kackh3wrwafd26o4waultzowjcmlw')) {
        return false;
      }

      // Fast name search (most common)
      if (contact.name.toLowerCase().includes(term)) {
        return true;
      }

      // Email search
      if (contact.email && contact.email.toLowerCase().includes(term)) {
        return true;
      }

      // Phone search (simplified)
      if (contact.phone && contact.phone.includes(term)) {
        return true;
      }

      // Mobile search (simplified)
      if (contact.mobile && contact.mobile.includes(term)) {
        return true;
      }

      return false;
    });

    const searchTime = Date.now() - startTime;
    console.log(`Search "${searchTerm}" found ${filtered.length} results in ${searchTime}ms`);

    // Debug: Show first few results
    if (filtered.length > 0) {
      const resultNames = filtered.slice(0, 5).map(c => c.name).join(', ');
      console.log(`First few results: ${resultNames}`);
    } else {
      console.log(`NO RESULTS FOUND for "${searchTerm}"`);
    }

    console.log(`=== SEARCH DEBUG END ===`);
    setFilteredContacts(filtered);
  }, [contacts]);

  const handleSearch = useCallback((text) => {
    setSearchQuery(text);

    // Clear existing timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // Debounce search for better performance
    const timeout = setTimeout(() => {
      performSearch(text);
    }, 150); // 150ms debounce

    setSearchTimeout(timeout);
  }, [searchTimeout, performSearch]);

  // Ensure filteredContacts is updated when contacts change
  useEffect(() => {
    if (contacts.length > 0 && filteredContacts.length === 0 && !searchQuery) {
      console.log(`Updating filteredContacts with ${contacts.length} contacts (was empty)`);
      setFilteredContacts(contacts);
    }
  }, [contacts, filteredContacts.length, searchQuery]);

  // Cleanup search timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [searchTimeout]);

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
          // For related contacts, we need to fetch them when the filter changes
          if (filterMode === 'related' && relatedIds && relatedIds.length > 0) {
            console.log('Loading related contacts...');
            setInitialLoading(true);
            fetchContacts(0, false); // Use cache if available
            return;
          }

          // Debug: Check user access and permissions
          try {
            const userInfo = await partnersAPI.default.getCurrentUserInfo();
            console.log('Current user info:', userInfo);

            // Check access rights for res.partner model
            const accessRights = await partnersAPI.default.checkAccessRights('res.partner', 'read');
            console.log('User access rights for res.partner:', accessRights);
          } catch (error) {
            console.log('Could not check user permissions:', error.message);
          }

          // First, check if we have a valid cache - NO LOADING SPINNER
          const cachedContacts = await partnersAPI.getPartnersFromCache();
          if (cachedContacts && cachedContacts.length > 100) {
            console.log(`Found ${cachedContacts.length} contacts in cache, using them directly`);

            // Remove duplicates and filter out only truly garbage contacts (be much less aggressive)
            const uniqueContacts = cachedContacts.filter((contact, index, array) => {
              // Only remove contacts with truly invalid names (be less aggressive)
              if (!contact.name || 
                  contact.name.trim() === '' ||
                  contact.name.includes('geztamjqga4dombtgeztamjqgbp7sfe4o5f2skpzlekrpzq2kackh3wrwafd26o4waultzowjcmlw')) {
                return false;
              }

              // Remove duplicates by ID (keep first occurrence)
              return array.findIndex(c => c.id === contact.id) === index;
            });

            // Separate companies and contacts, then sort each group
            const companies = uniqueContacts.filter(contact => contact.is_company);
            const individuals = uniqueContacts.filter(contact => !contact.is_company);

            // Sort each group alphabetically
            const sortedCompanies = companies.sort((a, b) => {
              const nameA = (a.name || '').toLowerCase();
              const nameB = (b.name || '').toLowerCase();
              return nameA.localeCompare(nameB);
            });

            const sortedIndividuals = individuals.sort((a, b) => {
              const nameA = (a.name || '').toLowerCase();
              const nameB = (b.name || '').toLowerCase();
              return nameA.localeCompare(nameB);
            });

            // Combine with companies first, then individuals
            const sortedContacts = [...sortedCompanies, ...sortedIndividuals];

            console.log(`Filtered ${cachedContacts.length} contacts down to ${sortedContacts.length} unique, clean contacts`);
            console.log(`Companies: ${sortedCompanies.length}, Individuals: ${sortedIndividuals.length}`);

            // Add index property to each contact for stable keys
            const indexedContacts = sortedContacts.map((contact, index) => ({
              ...contact,
              index: index
            }));

            // Update state immediately - no loading spinner
            console.log(`Setting contacts state with ${indexedContacts.length} contacts (sorted alphabetically)`);

            // Debug: Show contact name distribution
            const namesByLetter = {};
            indexedContacts.forEach(contact => {
              if (contact.name) {
                const firstLetter = contact.name.charAt(0).toUpperCase();
                namesByLetter[firstLetter] = (namesByLetter[firstLetter] || 0) + 1;
              }
            });
            console.log('Contact distribution by first letter:', JSON.stringify(namesByLetter, null, 2));

            // Check for specific names
            const zulContacts = indexedContacts.filter(c => c.name && c.name.toLowerCase().includes('zul'));
            console.log(`Contacts containing "zul": ${zulContacts.length}`, zulContacts.map(c => c.name));

            setContacts(indexedContacts);
            setFilteredContacts(indexedContacts);
            setTotalCount(cachedContacts.length);
            setHasMore(false);
            console.log(`State updated: contacts=${indexedContacts.length}, filteredContacts=${indexedContacts.length}, totalCount=${cachedContacts.length}`);

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
            setInitialLoading(true);

            // Get all contacts at once - this will continue until all contacts are downloaded
            const allContacts = await partnersAPI.getAllContacts(true);

            if (allContacts && Array.isArray(allContacts) && allContacts.length > 0) {
              console.log(`Successfully fetched ${allContacts.length} contacts from API`);

              // Remove duplicates and filter out only truly garbage contacts (be much less aggressive)
              const uniqueContacts = allContacts.filter((contact, index, array) => {
                // Only remove contacts with truly invalid names (be less aggressive)
                if (!contact.name || 
                    contact.name.trim() === '' ||
                    contact.name.includes('geztamjqga4dombtgeztamjqgbp7sfe4o5f2skpzlekrpzq2kackh3wrwafd26o4waultzowjcmlw')) {
                  return false;
                }

                // Remove duplicates by ID (keep first occurrence)
                return array.findIndex(c => c.id === contact.id) === index;
              });

              // Sort contacts alphabetically by name
              const sortedContacts = uniqueContacts.sort((a, b) => {
                const nameA = (a.name || '').toLowerCase();
                const nameB = (b.name || '').toLowerCase();
                return nameA.localeCompare(nameB);
              });

              console.log(`Filtered ${allContacts.length} contacts down to ${sortedContacts.length} unique, clean contacts`);

              // Add index property to each contact for stable keys
              const indexedContacts = sortedContacts.map((contact, index) => ({
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

            setInitialLoading(false);
          }
        } catch (error) {
          console.error('Error loading contacts:', error);
          setInitialLoading(false);
          // Fall back to standard pagination approach
          fetchContacts(0, true);
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
  const renderContactItem = useCallback(({ item, index }) => {
    const imageUri = getImageUri(item.image_128);
    const initials = getInitials(item.name);
    const isCompany = item.is_company;

    // Check if this is the first individual after companies
    const isFirstIndividual = !isCompany && index > 0 && filteredContacts[index - 1]?.is_company;

    return (
      <>
        {/* Section header for first individual */}
        {isFirstIndividual && (
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLine} />
            <Text style={styles.sectionHeaderText}>CONTACTS</Text>
            <View style={styles.sectionHeaderLine} />
          </View>
        )}

        {/* Section header for first company */}
        {isCompany && index === 0 && (
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLine} />
            <Text style={styles.sectionHeaderText}>COMPANIES</Text>
            <View style={styles.sectionHeaderLine} />
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.contactItem,
            isCompany ? styles.companyItem : styles.individualItem
          ]}
          onPress={() => handleContactPress(item)}
          activeOpacity={0.7}
        >
          <View style={styles.avatarContainer}>
            {imageUri ? (
              <Image
                source={{ uri: imageUri }}
                style={[
                  styles.avatar,
                  isCompany && styles.companyAvatar
                ]}
              />
            ) : (
              <View style={[
                styles.avatarPlaceholder,
                { backgroundColor: getColorFromName(item.name) },
                isCompany && styles.companyAvatarPlaceholder
              ]}>
                <Text style={[
                  styles.avatarText,
                  isCompany && styles.companyAvatarText
                ]}>{initials}</Text>
              </View>
            )}
            {isCompany && (
              <View style={styles.companyBadge}>
                <Icon name="office-building" size={12} color="#fff" />
              </View>
            )}
          </View>

          <View style={styles.contactInfo}>
            <Text style={[
              styles.contactName,
              isCompany && styles.companyName
            ]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[
              styles.contactDetail,
              isCompany && styles.companyDetail
            ]} numberOfLines={1}>
              {item.phone || item.mobile || item.email || 'No contact info'}
            </Text>
          </View>

          {/* Company indicator */}
          {isCompany && (
            <View style={styles.companyIndicator}>
              <Icon name="office-building" size={16} color="#3498db" />
            </View>
          )}
        </TouchableOpacity>
      </>
    );
  }, [handleContactPress, filteredContacts]);

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
              {(() => {
                const companies = filteredContacts.filter(c => c.is_company).length;
                const individuals = filteredContacts.filter(c => !c.is_company).length;
                return `${companies} companies • ${individuals} contacts`;
              })()}
            </Text>
          )}
        </View>
        {filterMode === 'related' ? (
          <TouchableOpacity
            style={styles.viewAllButton}
            onPress={() => {
              // Navigate to all contacts view (replace current screen)
              navigation.replace('ContactsListScreen');
            }}
          >
            <Text style={styles.viewAllButtonText}>All</Text>
          </TouchableOpacity>
        ) : (
          <View style={{width: 24}} /> /* Empty view for balance */
        )}
      </View>

      {/* Related Contacts Banner */}
      {filterMode === 'related' && (
        <View style={styles.relatedBanner}>
          <Icon name="link" size={16} color="#3498db" />
          <Text style={styles.relatedBannerText}>
            Showing contacts related to {parentName}
          </Text>
          <TouchableOpacity
            onPress={() => navigation.replace('ContactsListScreen')}
            style={styles.relatedBannerButton}
          >
            <Text style={styles.relatedBannerButtonText}>View All</Text>
          </TouchableOpacity>
        </View>
      )}

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
          initialNumToRender={50}
          maxToRenderPerBatch={50}
          windowSize={10}
          removeClippedSubviews={false}
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
  viewAllButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  viewAllButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  relatedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#bbdefb',
  },
  relatedBannerText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#1976d2',
  },
  relatedBannerButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  relatedBannerButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    marginTop: 8,
  },
  sectionHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#dee2e6',
  },
  sectionHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6c757d',
    letterSpacing: 1,
    marginHorizontal: 16,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
  },
  companyItem: {
    backgroundColor: '#fff',
  },
  individualItem: {
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
  companyAvatar: {
    borderWidth: 2,
    borderColor: '#3498db',
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  companyAvatarPlaceholder: {
    borderWidth: 2,
    borderColor: '#3498db',
    backgroundColor: '#3498db',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  companyAvatarText: {
    fontSize: 16,
    fontWeight: '900',
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
  companyName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#2c3e50',
  },
  contactDetail: {
    fontSize: 14,
    color: '#666',
  },
  companyDetail: {
    fontSize: 14,
    color: '#3498db',
    fontWeight: '500',
  },
  companyIndicator: {
    marginLeft: 8,
    padding: 4,
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
