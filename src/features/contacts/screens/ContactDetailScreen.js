import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  SafeAreaView,
  StatusBar,
  Dimensions,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { partnersAPI } from '../../../api/models/partnersApi.fixed';

// Import MessageThread component
import MessageThread from '../../../components/MessageThread';

// Default avatar image
import defaultAvatar from '../../../assets/images/default_avatar.png';

const { width: screenWidth } = Dimensions.get('window');

const ContactDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { id } = route.params;

  const [contact, setContact] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('details'); // 'details' or 'messages'

  // State for related contacts
  const [relatedContacts, setRelatedContacts] = useState([]);
  const [loadingRelated, setLoadingRelated] = useState(false);

  // Fetch contact details
  const fetchContactDetails = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      const response = await partnersAPI.getById(
        id,
        [
          'id', 'name', 'email', 'phone', 'mobile', 'image_1920', 'street', 'street2',
          'city', 'state_id', 'zip', 'country_id', 'website', 'function', 'title',
          'comment', 'is_company', 'parent_id', 'child_ids', 'category_id', 'user_id'
        ],
        forceRefresh
      );

      console.log('Fetched contact details:', response);

      if (response) {
        setContact(response);

        // If there are child_ids, fetch the related contacts
        if (response.child_ids && response.child_ids.length > 0) {
          fetchRelatedContacts(response.child_ids);
        }
      } else {
        setError('Failed to load contact details. Please try again.');
      }
    } catch (err) {
      console.error('Error fetching contact details:', err);
      setError('Failed to load contact details. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Fetch related contacts
  const fetchRelatedContacts = useCallback(async (childIds) => {
    if (!childIds || childIds.length === 0) return;

    try {
      setLoadingRelated(true);

      // Fetch up to 10 related contacts for preview
      const relatedIds = childIds.slice(0, 10);
      const relatedData = [];

      for (const relatedId of relatedIds) {
        const contact = await partnersAPI.getById(
          relatedId,
          ['id', 'name', 'email', 'phone', 'mobile', 'image_128', 'function', 'is_company']
        );

        if (contact) {
          relatedData.push(contact);
        }
      }

      console.log('Fetched related contacts:', relatedData.length);
      setRelatedContacts(relatedData);
    } catch (err) {
      console.error('Error fetching related contacts:', err);
    } finally {
      setLoadingRelated(false);
    }
  }, []);

  // Load contact details when the screen is focused
  useFocusEffect(
    useCallback(() => {
      fetchContactDetails();
    }, [fetchContactDetails])
  );

  // Navigate to edit contact screen
  const handleEditContact = () => {
    navigation.navigate('ContactForm', { mode: 'edit', id: id, contact: contact });
  };

  // Navigate to related contact detail
  const handleRelatedContactPress = (relatedContact) => {
    navigation.push('ContactDetail', { id: relatedContact.id });
  };

  // Handle view all related contacts
  const handleViewAllRelatedContacts = () => {
    // Navigate directly to the ContactsListScreen with related contacts filter
    // Using direct navigation within the same navigator
    console.log('Navigating to related contacts view with:', {
      relatedTo: id,
      relatedIds: contact.child_ids,
      parentName: contact.name,
      filterMode: 'related'
    });

    // Use push instead of navigate to create a new screen in the stack
    // This ensures we can go back to this contact detail screen
    navigation.push('ContactsListScreen', {
      relatedTo: id,
      relatedIds: contact.child_ids,
      parentName: contact.name,
      filterMode: 'related'
    });
  };

  // Delete contact
  const handleDeleteContact = () => {
    Alert.alert(
      'Delete Contact',
      'Are you sure you want to delete this contact? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await partnersAPI.delete(id);
              if (result) {
                Alert.alert('Success', 'Contact deleted successfully');
                navigation.goBack();
              } else {
                Alert.alert('Error', 'Failed to delete contact');
              }
            } catch (err) {
              console.error('Error deleting contact:', err);
              Alert.alert('Error', 'Failed to delete contact');
            }
          }
        }
      ]
    );
  };

  // Handle action buttons
  const handleCall = (number) => {
    if (!number) return;
    Linking.openURL(`tel:${number}`);
  };

  const handleEmail = (email) => {
    if (!email) return;
    Linking.openURL(`mailto:${email}`);
  };

  const handleMessage = (number) => {
    if (!number) return;
    Linking.openURL(`sms:${number}`);
  };

  const handleWebsite = (website) => {
    if (!website) return;

    // Add http:// if not present
    let url = website;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `http://${url}`;
    }

    Linking.openURL(url);
  };

  // Convert base64 image to URI
  const getImageUri = (base64Image) => {
    if (!base64Image) return null;
    return `data:image/png;base64,${base64Image}`;
  };

  // Get initials for avatar placeholder
  const getInitials = (name) => {
    if (!name) return '';
    return name
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  // Generate a color based on the contact name
  const getColorFromName = (name) => {
    if (!name) return '#3498db';

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

  // Format address
  const formatAddress = () => {
    if (!contact) return '';

    const parts = [];
    if (contact.street) parts.push(contact.street);
    if (contact.street2) parts.push(contact.street2);

    const cityParts = [];
    if (contact.city) cityParts.push(contact.city);
    if (contact.state_id && contact.state_id[1]) cityParts.push(contact.state_id[1]);
    if (contact.zip) cityParts.push(contact.zip);
    if (cityParts.length > 0) parts.push(cityParts.join(', '));

    if (contact.country_id && contact.country_id[1]) parts.push(contact.country_id[1]);

    return parts.join('\n');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => fetchContactDetails(true)}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!contact) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Contact not found</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const imageUri = getImageUri(contact.image_1920 || contact.image_128);
  const initials = getInitials(contact.name);
  const avatarColor = getColorFromName(contact.name);
  const address = formatAddress();

  // Render contact details tab
  const renderDetailsTab = () => {
    return (
      <ScrollView style={styles.tabContent}>
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: avatarColor }]}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            )}
            {contact.is_company && (
              <View style={styles.companyBadge}>
                <Icon name="office-building" size={16} color="#fff" />
              </View>
            )}
          </View>
          <Text style={styles.name}>{contact.name}</Text>
          {contact.function && <Text style={styles.jobTitle}>{contact.function}</Text>}
          {contact.parent_id && (
            <Text style={styles.company}>{contact.parent_id[1]}</Text>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          {(contact.phone || contact.mobile) && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleCall(contact.mobile || contact.phone)}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#2ecc71' }]}>
                <Icon name="phone" size={20} color="#fff" />
              </View>
              <Text style={styles.actionText}>Call</Text>
            </TouchableOpacity>
          )}

          {(contact.phone || contact.mobile) && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleMessage(contact.mobile || contact.phone)}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#3498db' }]}>
                <Icon name="message-text" size={20} color="#fff" />
              </View>
              <Text style={styles.actionText}>Message</Text>
            </TouchableOpacity>
          )}

          {contact.email && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleEmail(contact.email)}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#e74c3c' }]}>
                <Icon name="email" size={20} color="#fff" />
              </View>
              <Text style={styles.actionText}>Email</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Contact Info */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Contact Information</Text>

          {contact.phone && (
            <TouchableOpacity
              style={styles.infoItem}
              onPress={() => handleCall(contact.phone)}
            >
              <Icon name="phone" size={20} color="#3498db" style={styles.infoIcon} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Phone</Text>
                <Text style={styles.infoValue}>{contact.phone}</Text>
              </View>
            </TouchableOpacity>
          )}

          {contact.mobile && (
            <TouchableOpacity
              style={styles.infoItem}
              onPress={() => handleCall(contact.mobile)}
            >
              <Icon name="cellphone" size={20} color="#3498db" style={styles.infoIcon} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Mobile</Text>
                <Text style={styles.infoValue}>{contact.mobile}</Text>
              </View>
            </TouchableOpacity>
          )}

          {contact.email && (
            <TouchableOpacity
              style={styles.infoItem}
              onPress={() => handleEmail(contact.email)}
            >
              <Icon name="email" size={20} color="#3498db" style={styles.infoIcon} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{contact.email}</Text>
              </View>
            </TouchableOpacity>
          )}

          {contact.website && (
            <TouchableOpacity
              style={styles.infoItem}
              onPress={() => handleWebsite(contact.website)}
            >
              <Icon name="web" size={20} color="#3498db" style={styles.infoIcon} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Website</Text>
                <Text style={styles.infoValue}>{contact.website}</Text>
              </View>
            </TouchableOpacity>
          )}

          {address && (
            <View style={styles.infoItem}>
              <Icon name="map-marker" size={20} color="#3498db" style={styles.infoIcon} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Address</Text>
                <Text style={styles.infoValue}>{address}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Notes */}
        {contact.comment && (
          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notesText}>{contact.comment}</Text>
          </View>
        )}

        {/* Related Contacts */}
        {contact.child_ids && contact.child_ids.length > 0 && (
          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>Related Contacts</Text>
            <Text style={styles.relatedContactsCount}>
              {contact.child_ids.length} {contact.child_ids.length === 1 ? 'contact' : 'contacts'}
            </Text>

            {loadingRelated ? (
              <ActivityIndicator size="small" color="#3498db" style={styles.relatedLoader} />
            ) : (
              <View style={styles.relatedCardsContainer}>
                {relatedContacts.map((relatedContact) => (
                  <TouchableOpacity
                    key={relatedContact.id}
                    style={styles.relatedCard}
                    onPress={() => handleRelatedContactPress(relatedContact)}
                  >
                    <View style={styles.relatedAvatarContainer}>
                      {relatedContact.image_128 ? (
                        <Image
                          source={{ uri: `data:image/png;base64,${relatedContact.image_128}` }}
                          style={styles.relatedAvatar}
                        />
                      ) : (
                        <View style={[
                          styles.relatedAvatarPlaceholder,
                          { backgroundColor: getColorFromName(relatedContact.name) }
                        ]}>
                          <Text style={styles.relatedAvatarText}>
                            {getInitials(relatedContact.name)}
                          </Text>
                        </View>
                      )}
                      {relatedContact.is_company && (
                        <View style={styles.relatedCompanyBadge}>
                          <Icon name="office-building" size={8} color="#fff" />
                        </View>
                      )}
                    </View>

                    <View style={styles.relatedInfo}>
                      <Text style={styles.relatedName} numberOfLines={1}>
                        {relatedContact.name}
                      </Text>
                      <Text style={styles.relatedDetail} numberOfLines={1}>
                        {relatedContact.function ||
                         relatedContact.email ||
                         relatedContact.phone ||
                         relatedContact.mobile || ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}

                {contact.child_ids.length > 10 && (
                  <TouchableOpacity
                    style={styles.viewMoreButton}
                    onPress={handleViewAllRelatedContacts}
                  >
                    <Text style={styles.viewMoreText}>
                      View All {contact.child_ids.length} Contacts
                    </Text>
                    <Icon name="chevron-right" size={16} color="#3498db" />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    );
  };

  // Render messages tab
  const renderMessagesTab = () => {
    return (
      <View style={styles.tabContent}>
        <MessageThread
          model="res.partner"
          recordId={id}
          recordName={contact.name}
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleEditContact} style={styles.headerButton}>
            <Icon name="pencil" size={24} color="#333" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDeleteContact} style={styles.headerButton}>
            <Icon name="delete" size={24} color="#e74c3c" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'details' && styles.activeTabButton]}
          onPress={() => setActiveTab('details')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'details' && styles.activeTabButtonText]}>
            Details
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'messages' && styles.activeTabButton]}
          onPress={() => setActiveTab('messages')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'messages' && styles.activeTabButtonText]}>
            Messages
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      <View style={styles.contentContainer}>
        {activeTab === 'details' ? renderDetailsTab() : renderMessagesTab()}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentContainer: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 8,
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerButton: {
    padding: 8,
    marginLeft: 16,
  },
  // Tab Navigation
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTabButton: {
    borderBottomWidth: 2,
    borderBottomColor: '#3498db',
  },
  tabButtonText: {
    fontSize: 16,
    color: '#666',
  },
  activeTabButtonText: {
    color: '#3498db',
    fontWeight: '500',
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 36,
    fontWeight: 'bold',
  },
  companyBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#3498db',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  jobTitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  company: {
    fontSize: 16,
    color: '#3498db',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  actionButton: {
    alignItems: 'center',
  },
  actionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionText: {
    fontSize: 14,
    color: '#333',
  },
  infoSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  infoIcon: {
    marginRight: 16,
    marginTop: 2,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: '#333',
  },
  notesText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
  },
  relatedContactsCount: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  relatedLoader: {
    marginVertical: 20,
  },
  relatedCardsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    marginHorizontal: -4, // Compensate for card margin
  },
  relatedCard: {
    width: '47%', // Almost half width with some margin
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 4,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  relatedAvatarContainer: {
    position: 'relative',
    marginRight: 10,
  },
  relatedAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  relatedAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  relatedAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  relatedCompanyBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#3498db',
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fff',
  },
  relatedInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  relatedName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  relatedDetail: {
    fontSize: 12,
    color: '#666',
  },
  viewMoreButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#d4e6f7',
  },
  viewMoreText: {
    fontSize: 14,
    color: '#3498db',
    fontWeight: '500',
    marginRight: 8,
  },
});

export default ContactDetailScreen;
