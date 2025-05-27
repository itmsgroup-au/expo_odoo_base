import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Linking,
  SafeAreaView,
  StatusBar
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import odooClient from '../../../api/odooClient';
import { getFileIconName, formatFileSize } from '../../../components/AttachmentsList';
import logger from '../../../utils/logger';
import { useAuth } from '../../../contexts/AuthContext';
import CachedImage from '../../../components/CachedImage';
import { processAttachment, createFallbackUrl, createSecondFallbackUrl } from '../../../utils/imageUtils';

const AttachmentsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { isLoggedIn, user } = useAuth();
  const { partnerId: rawPartnerId, partnerName } = route.params || {};

  // Ensure partnerId is a number
  const partnerId = rawPartnerId ? parseInt(rawPartnerId, 10) : null;

  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Log route params and auth status for debugging
  useEffect(() => {
    console.log('AttachmentsScreen route params:', route.params);
    console.log('Parsed partnerId:', partnerId);
    console.log('Auth status:', { isLoggedIn, hasUser: !!user });
    console.log('Odoo API config:', {
      baseURL: odooClient.client.defaults.baseURL,
      hasAuthHeader: !!odooClient.client.defaults.headers.Authorization,
      hasDatabaseHeader: !!odooClient.client.defaults.headers.DATABASE
    });
  }, [route.params, partnerId, isLoggedIn, user]);

  // Fetch attachments for the partner
  const fetchAttachments = useCallback(async (forceRefresh = false) => {
    if (!partnerId) {
      setError('No partner ID provided');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log(`Fetching attachments for partner ID: ${partnerId}`);

      // Log the Odoo API configuration
      console.log('Odoo API config:', {
        baseURL: odooClient.client.defaults.baseURL,
        hasAuthHeader: !!odooClient.client.defaults.headers.Authorization,
        hasDatabaseHeader: !!odooClient.client.defaults.headers.DATABASE
      });

      // Step 1: Get messages related to this partner
      console.log('Fetching messages for partner...');
      let messagesResponse;
      try {
        messagesResponse = await odooClient.client.post('/api/v2/call', {
          model: 'mail.message',
          method: 'search_read',
          args: [
            [
              ['model', '=', 'res.partner'],
              ['res_id', '=', partnerId]
            ]
          ],
          kwargs: {
            fields: ['id', 'attachment_ids']
          }
        });
        console.log('Messages response:', messagesResponse.status, messagesResponse.statusText);
      } catch (err) {
        console.error('Error fetching messages:', err);
        if (err.response) {
          console.error('Response status:', err.response.status);
          console.error('Response data:', err.response.data);
        }
        throw new Error(`Failed to fetch messages: ${err.message}`);
      }

      // Extract attachment IDs from messages
      let messageAttachmentIds = [];
      if (messagesResponse.data && Array.isArray(messagesResponse.data)) {
        console.log(`Found ${messagesResponse.data.length} messages`);
        messagesResponse.data.forEach(msg => {
          if (msg.attachment_ids && Array.isArray(msg.attachment_ids) && msg.attachment_ids.length > 0) {
            messageAttachmentIds = [...messageAttachmentIds, ...msg.attachment_ids];
          }
        });
      } else {
        console.log('No messages found or invalid response format:', messagesResponse.data);
      }

      console.log(`Found ${messageAttachmentIds.length} attachment IDs in messages`);

      // Step 2: Get direct attachments for this partner
      console.log('Fetching direct attachments...');
      let directAttachmentsResponse;
      try {
        directAttachmentsResponse = await odooClient.client.post('/api/v2/call', {
          model: 'ir.attachment',
          method: 'search_read',
          args: [
            [
              ['res_model', '=', 'res.partner'],
              ['res_id', '=', partnerId]
            ]
          ],
          kwargs: {
            fields: ['id']
          }
        });
        console.log('Direct attachments response:', directAttachmentsResponse.status, directAttachmentsResponse.statusText);
      } catch (err) {
        console.error('Error fetching direct attachments:', err);
        if (err.response) {
          console.error('Response status:', err.response.status);
          console.error('Response data:', err.response.data);
        }
        throw new Error(`Failed to fetch direct attachments: ${err.message}`);
      }

      // Extract direct attachment IDs
      let directAttachmentIds = [];
      if (directAttachmentsResponse.data && Array.isArray(directAttachmentsResponse.data)) {
        console.log(`Found ${directAttachmentsResponse.data.length} direct attachment records`);
        directAttachmentIds = directAttachmentsResponse.data.map(att => att.id);
      } else {
        console.log('No direct attachments found or invalid response format:', directAttachmentsResponse.data);
      }

      console.log(`Found ${directAttachmentIds.length} direct attachments for partner ID ${partnerId}`);

      // Combine all attachment IDs and remove duplicates
      const allAttachmentIds = [...new Set([...messageAttachmentIds, ...directAttachmentIds])];
      console.log(`Total unique attachments: ${allAttachmentIds.length}`);

      if (allAttachmentIds.length === 0) {
        setAttachments([]);
        setLoading(false);
        return;
      }

      // Step 3: Get detailed information for all attachments
      console.log('Fetching attachment details...');
      let attachmentsResponse;
      try {
        attachmentsResponse = await odooClient.client.post('/api/v2/call', {
          model: 'ir.attachment',
          method: 'search_read',
          args: [
            [
              ['id', 'in', allAttachmentIds]
            ]
          ],
          kwargs: {
            fields: ['id', 'name', 'mimetype', 'file_size', 'create_date', 'create_uid', 'res_model', 'res_id', 'type', 'url']
          }
        });
        console.log('Attachment details response:', attachmentsResponse.status, attachmentsResponse.statusText);
      } catch (err) {
        console.error('Error fetching attachment details:', err);
        if (err.response) {
          console.error('Response status:', err.response.status);
          console.error('Response data:', err.response.data);
        }
        throw new Error(`Failed to fetch attachment details: ${err.message}`);
      }

      if (attachmentsResponse.data && Array.isArray(attachmentsResponse.data)) {
        console.log(`Retrieved ${attachmentsResponse.data.length} attachment details`);
        console.log('First attachment sample:', attachmentsResponse.data.length > 0 ? JSON.stringify(attachmentsResponse.data[0]) : 'No attachments');

        // Process the attachments
        const processedAttachments = attachmentsResponse.data.map(att => {
          // Process the attachment using our utility function
          const processedAttachment = processAttachment(att);

          // Log the processed attachment
          console.log(`Created URL for attachment ${att.id}: ${processedAttachment.fullUrl}`);
          console.log(`Attachment ${att.id} data:`, JSON.stringify(att));

          return processedAttachment;
        });

        // Sort by most recent first
        processedAttachments.sort((a, b) => new Date(b.createDate) - new Date(a.createDate));

        setAttachments(processedAttachments);
      } else {
        setAttachments([]);
      }
    } catch (err) {
      console.error('Error in fetchAttachments:', err);
      logger.safeErrorLog('Error fetching attachments:', err);

      // Provide more detailed error message
      let errorMessage = 'Failed to load attachments. Please try again.';
      if (err.response) {
        errorMessage += ` (Status: ${err.response.status})`;
        console.error('Response data:', JSON.stringify(err.response.data));
      } else if (err.request) {
        errorMessage += ' (No response received)';
      } else {
        errorMessage += ` (${err.message})`;
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [partnerId]);

  // Check if the API client is authenticated
  const checkAuthentication = useCallback(async () => {
    // First check if we're logged in according to the auth context
    if (!isLoggedIn) {
      console.log('Not logged in according to auth context');
      setError('Not logged in. Please log in first.');
      return false;
    }

    try {
      // Try to get user info to check authentication
      const response = await odooClient.client.get('/api/v2/user');
      console.log('Authentication check successful:', response.status);
      return true;
    } catch (err) {
      console.error('Authentication check failed:', err);
      if (err.response && err.response.status === 401) {
        setError('Authentication failed. Please log in again.');
      } else {
        setError(`API error: ${err.message || 'Unknown error'}`);
      }
      return false;
    }
  }, [isLoggedIn]);

  // Initial data fetch
  useEffect(() => {
    const initFetch = async () => {
      const isAuthenticated = await checkAuthentication();
      if (isAuthenticated) {
        fetchAttachments();
      }
    };

    initFetch();
  }, [fetchAttachments, checkAuthentication]);

  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    // Check authentication first
    const isAuthenticated = await checkAuthentication();
    if (isAuthenticated) {
      fetchAttachments(true);
    } else {
      setRefreshing(false);
    }
  };

  // Retry loading
  const handleRetry = async () => {
    setLoading(true);
    setError(null);
    // Check authentication first
    const isAuthenticated = await checkAuthentication();
    if (isAuthenticated) {
      fetchAttachments(true);
    } else {
      setLoading(false);
    }
  };

  // Open an attachment
  const openAttachment = async (attachment) => {
    try {
      // Use the fullUrl property that includes the base URL
      const fullUrl = attachment.fullUrl;

      console.log(`Opening attachment: ${attachment.name} (${attachment.mimetype}) - URL: ${fullUrl}`);
      console.log('Attachment data:', JSON.stringify(attachment));
      console.log('API config:', {
        baseURL: odooClient.client.defaults.baseURL,
        hasAuthHeader: !!odooClient.client.defaults.headers.Authorization,
        hasDatabaseHeader: !!odooClient.client.defaults.headers.DATABASE
      });

      // Use the ImageViewer for all file types
      console.log(`Navigating to ImageViewer with URL: ${fullUrl}, mimetype: ${attachment.mimetype}`);
      navigation.navigate('ImageViewer', {
        imageUrl: fullUrl,
        title: attachment.name,
        mimetype: attachment.mimetype
      });
    } catch (err) {
      logger.safeErrorLog('Error opening attachment:', err);
      Alert.alert(
        'Error',
        'Failed to open the attachment. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  // Get access token from AsyncStorage
  const [accessToken, setAccessToken] = useState(null);

  useEffect(() => {
    const getAccessToken = async () => {
      try {
        const tokenData = await AsyncStorage.getItem('odooTokenData');
        if (tokenData) {
          const parsedToken = JSON.parse(tokenData);
          setAccessToken(parsedToken.accessToken);
        }
      } catch (err) {
        console.error('Error getting token data:', err);
      }
    };

    getAccessToken();
  }, []);

  // Create a thumbnail URL using the API v2 image endpoint format
  const getThumbnailUrl = (attachmentId) => {
    if (!attachmentId) return null;

    const baseUrl = odooClient.client.defaults.baseURL || '';
    // Use the API v2 image endpoint with size parameter
    // Format: /api/v2/image/{attachmentId}/{size}
    // This format is proven to work in the test script
    return `${baseUrl}/api/v2/image/${attachmentId}/128x128`;
  };

  // Render an attachment item
  const renderAttachmentItem = ({ item }) => {
    // Use the fullUrl property that includes the base URL
    let imageUrl = item.fullUrl;

    // For image attachments, try to use a thumbnail URL for better performance
    if (item.mimetype && item.mimetype.startsWith('image/')) {
      // First try to use the thumbnailUrl property if it exists
      if (item.thumbnailUrl) {
        console.log(`Using attachment thumbnailUrl for ${item.name}: ${item.thumbnailUrl}`);
        // Add the access token to the URL if it doesn't already have one
        if (accessToken && !item.thumbnailUrl.includes('access_token=')) {
          const separator = item.thumbnailUrl.includes('?') ? '&' : '?';
          imageUrl = `${item.thumbnailUrl}${separator}access_token=${encodeURIComponent(accessToken)}`;
        } else {
          imageUrl = item.thumbnailUrl;
        }
      } else {
        // Fallback to the API v2 image endpoint
        const thumbnailUrl = getThumbnailUrl(item.id);
        if (thumbnailUrl) {
          console.log(`Using generated thumbnail URL for ${item.name}: ${thumbnailUrl}`);
          // Add the access token to the URL if it doesn't already have one
          if (accessToken && !thumbnailUrl.includes('access_token=')) {
            const separator = thumbnailUrl.includes('?') ? '&' : '?';
            imageUrl = `${thumbnailUrl}${separator}access_token=${encodeURIComponent(accessToken)}`;
          } else {
            imageUrl = thumbnailUrl;
          }
        }
      }
    }

    console.log(`Rendering attachment: ${item.id} - ${item.name} (${item.mimetype})`);
    console.log(`Using image URL: ${imageUrl}`);

    return (
      <TouchableOpacity
        style={styles.attachmentItem}
        onPress={() => openAttachment(item)}
      >
        {item.mimetype && item.mimetype.startsWith('image/') ? (
          (() => {
            // Skip SVG and other non-standard image types that might cause issues
            const skipThumbnailTypes = ['image/svg+xml', 'image/svg', 'image/webp', 'image/tiff'];
            if (skipThumbnailTypes.includes(item.mimetype)) {
              console.log(`Using icon for non-standard image type: ${item.mimetype}`);
              return (
                <View style={styles.attachmentIconContainer}>
                  <Icon
                    name={getFileIconName(item.mimetype)}
                    size={40}
                    color="#0073e6"
                  />
                </View>
              );
            }

            // For standard image types, use CachedImage
            return (
              <View style={styles.attachmentImageContainer}>
                <CachedImage
                  attachmentId={item.id}
                  size="128x128"
                  style={styles.attachmentThumbnail}
                  contentFit="cover"
                  attachmentInfo={item} // Pass the full attachment info
                  onLoad={() => console.log(`Successfully loaded image: ${item.name}`)}
                  onError={(e) => {
                    console.log(`Image load error for ${item.name}: ${e || 'Unknown error'}`);
                    // We'll just show the icon if the image fails to load
                  }}
                />
              </View>
            );
          })()
        ) : (
          <View style={styles.attachmentIconContainer}>
            <Icon
              name={getFileIconName(item.mimetype)}
              size={40}
              color="#0073e6"
            />
          </View>
        )}
        <View style={styles.attachmentDetails}>
          <Text style={styles.attachmentName} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={styles.attachmentInfo}>
            {formatFileSize(item.fileSize)} • {new Date(item.createDate).toLocaleDateString()}
          </Text>
          <Text style={styles.attachmentUser}>
            Added by: {item.createUser}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-left" size={24} color="#333" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>
            Attachments for {partnerName || 'Contact'}
          </Text>
        </View>

        <Text style={styles.headerSubtitle}>
          {attachments.length} {attachments.length === 1 ? 'attachment' : 'attachments'} found
        </Text>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={handleRetry}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: '#4CAF50' }]}
              onPress={() => {
                // Navigate to the login screen to refresh authentication
                navigation.navigate('Login');
              }}
            >
              <Text style={styles.retryButtonText}>Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0073e6" />
          <Text style={styles.loadingText}>Loading attachments...</Text>
        </View>
      ) : (
        <FlatList
          data={attachments}
          renderItem={renderAttachmentItem}
          keyExtractor={(item) => `attachment-${item.id}`}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#0073e6']}
              tintColor="#0073e6"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="file-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No attachments found</Text>
              <Text style={styles.emptySubtext}>This contact has no attachments</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  listContent: {
    padding: 12,
  },
  attachmentItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  attachmentImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  attachmentThumbnail: {
    width: '100%',
    height: '100%',
  },
  attachmentIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 4,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentDetails: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  attachmentName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  attachmentInfo: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  attachmentUser: {
    fontSize: 12,
    color: '#999',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    padding: 16,
    backgroundColor: '#ffebee',
    margin: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
  },
  retryButton: {
    backgroundColor: '#0073e6',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
    marginHorizontal: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
});

export default AttachmentsScreen;
