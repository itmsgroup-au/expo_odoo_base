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
  const [filterType, setFilterType] = useState('all'); // 'all', 'companies', 'contacts'

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

  // Clean, simple fetch method using the new API
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

      console.log(`Fetching contacts page ${pageNumber}...`);

      // For related contacts mode
      if (filterMode === 'related' && relatedIds && relatedIds.length > 0) {
        console.log(`Fetching related contacts for parent ID ${relatedTo}`);
        // ... existing related contacts logic ...
        return relatedContacts;
      }

      // For first page, get ALL contacts at once
      if (pageNumber === 0) {
        console.log('Getting ALL contacts at once...');

        const allContacts = await partnersAPI.getAllContacts(forceRefresh);

        if (allContacts && allContacts.length > 0) {
          console.log(`SUCCESS! Got ${allContacts.length} contacts`);

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
        [], // Empty domain uses our working domain automatically
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
      console.error('Error fetching contacts:', err);
      setError(`Failed to load contacts: ${err.message}`);
      return [];
    } finally {
      setInitialLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [isLoggedIn, navigation, filterMode, relatedTo, relatedIds]);



  // Simplified load more function - disabled since we load all contacts at once
  const handleLoadMore = useCallback(() => {
    // With the new approach, all contacts are loaded at once from cache
    // No need for pagination anymore
    if (loadingMore || !hasMore || refreshing || contacts.length > 1000) {
      return;
    }

    // Only load more if we have very few contacts (fallback case)
    if (contacts.length < 100) {
      console.log('Very few contacts loaded, attempting to load more...');
      fetchContacts(Math.floor(contacts.length / PAGE_SIZE), false);
    }
  }, [loadingMore, hasMore, refreshing, contacts.length, fetchContacts]);

  // SIMPLE refresh function like helpdesk/discuss
  const onRefresh = useCallback(async () => {
    console.log('Refreshing contacts - SIMPLE method');
    setRefreshing(true);

    try {
      // Get all contacts with force refresh - FAST like helpdesk/discuss
      const allContacts = await partnersAPI.getAllContacts(true);

      if (allContacts && allContacts.length > 0) {
        console.log(`Refreshed with ${allContacts.length} contacts`);

        const indexedContacts = allContacts.map((contact, index) => ({
          ...contact,
          index: index
        }));

        setContacts(indexedContacts);
        setFilteredContacts(indexedContacts);
        setTotalCount(allContacts.length);
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error refreshing contacts:', error);
      setError('Failed to refresh contacts. Please try again.');
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Simple search handler
  const handleSearch = useCallback((text) => {
    setSearchQuery(text);
  }, []);

  // Apply filters when contacts or filter type changes
  useEffect(() => {
    if (contacts.length > 0) {
      let filtered = contacts;

      // Apply type filter
      if (filterType === 'companies') {
        filtered = contacts.filter(contact => contact.is_company);
      } else if (filterType === 'contacts') {
        filtered = contacts.filter(contact => !contact.is_company);
      }

      // Apply search filter if there's a search query
      if (searchQuery.trim() !== '') {
        const term = searchQuery.toLowerCase().trim();
        filtered = filtered.filter(contact => {
          if (!contact.name || contact.name.trim() === '') return false;

          // Search in name, email, phone, mobile
          return (
            contact.name.toLowerCase().includes(term) ||
            (contact.email && contact.email.toLowerCase().includes(term)) ||
            (contact.phone && contact.phone.includes(term)) ||
            (contact.mobile && contact.mobile.includes(term))
          );
        });
      }

      console.log(`Applied filters: type=${filterType}, search="${searchQuery}", result=${filtered.length}/${contacts.length}`);
      setFilteredContacts(filtered);
    }
  }, [contacts, filterType, searchQuery]);



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



  // SIMPLE useFocusEffect like helpdesk/discuss - just load data directly
  useFocusEffect(
    useCallback(() => {
      const loadContacts = async () => {
        try {
          console.log('Loading contacts using SIMPLE method like helpdesk/discuss');
          setInitialLoading(true);

          // Get all contacts at once - FAST like helpdesk/discuss
          const allContacts = await partnersAPI.getAllContacts(false);

          if (allContacts && Array.isArray(allContacts) && allContacts.length > 0) {
            console.log(`SUCCESS! Got ${allContacts.length} contacts instantly`);

            // Simple processing - just add index and set state
            const indexedContacts = allContacts.map((contact, index) => ({
              ...contact,
              index: index
            }));

            // Update state immediately
            setContacts(indexedContacts);
            setFilteredContacts(indexedContacts);
            setTotalCount(indexedContacts.length);
            setHasMore(false);

            console.log(`Contacts loaded instantly: ${indexedContacts.length} total`);
          } else {
            console.log('No contacts returned, trying force refresh');
            const refreshedContacts = await partnersAPI.getAllContacts(true);

            if (refreshedContacts && refreshedContacts.length > 0) {
              const indexedContacts = refreshedContacts.map((contact, index) => ({
                ...contact,
                index: index
              }));

              setContacts(indexedContacts);
              setFilteredContacts(indexedContacts);
              setTotalCount(indexedContacts.length);
              setHasMore(false);

              console.log(`Force refresh got ${indexedContacts.length} contacts`);
            }
          }
        } catch (error) {
          console.error('Error loading contacts:', error);
          setError('Failed to load contacts. Please try again.');
        } finally {
          setInitialLoading(false);
        }
      };

      loadContacts();
    }, [])
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

      {/* Elegant Filter Boxes */}
      <View style={styles.filterBoxContainer}>
        <TouchableOpacity
          style={[styles.filterBox, filterType === 'companies' && styles.filterBoxActive]}
          onPress={() => setFilterType('companies')}
        >
          <View style={styles.filterBoxIcon}>
            <Icon name="domain" size={24} color={filterType === 'companies' ? '#fff' : '#3498db'} />
          </View>
          <View style={styles.filterBoxContent}>
            <Text style={[styles.filterBoxTitle, filterType === 'companies' && styles.filterBoxTitleActive]}>
              Companies
            </Text>
            <Text style={[styles.filterBoxCount, filterType === 'companies' && styles.filterBoxCountActive]}>
              {contacts.filter(c => c.is_company).length} companies
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterBox, filterType === 'contacts' && styles.filterBoxActive]}
          onPress={() => setFilterType('contacts')}
        >
          <View style={styles.filterBoxIcon}>
            <Icon name="account" size={24} color={filterType === 'contacts' ? '#fff' : '#3498db'} />
          </View>
          <View style={styles.filterBoxContent}>
            <Text style={[styles.filterBoxTitle, filterType === 'contacts' && styles.filterBoxTitleActive]}>
              Contacts
            </Text>
            <Text style={[styles.filterBoxCount, filterType === 'contacts' && styles.filterBoxCountActive]}>
              {contacts.filter(c => !c.is_company).length} contacts
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Show All Button */}
      {filterType !== 'all' && (
        <View style={styles.showAllContainer}>
          <TouchableOpacity
            style={styles.showAllButton}
            onPress={() => setFilterType('all')}
          >
            <Icon name="view-list" size={16} color="#666" />
            <Text style={styles.showAllText}>Show All ({contacts.length})</Text>
          </TouchableOpacity>
        </View>
      )}

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
  filterBoxContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  filterBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#e8f4fd',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  filterBoxActive: {
    backgroundColor: '#3498db',
    borderColor: '#3498db',
  },
  filterBoxIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e8f4fd',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  filterBoxContent: {
    flex: 1,
  },
  filterBoxTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  filterBoxTitleActive: {
    color: '#fff',
  },
  filterBoxCount: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  filterBoxCountActive: {
    color: '#e8f4fd',
  },
  showAllContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    alignItems: 'center',
  },
  showAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  showAllText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
    fontWeight: '500',
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
