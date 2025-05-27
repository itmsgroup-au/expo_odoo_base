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
import { processAttachment } from '../../../utils/imageUtils';
import { useTheme } from '../../../contexts/ThemeContext';

const HelpdeskAttachmentsScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { user } = useAuth();

  const { ticketId, ticketName } = route.params || {};

  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [accessToken, setAccessToken] = useState(null);

  // Get access token on component mount
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

  // Set navigation title
  useEffect(() => {
    navigation.setOptions({
      title: ticketName ? `${ticketName} - Attachments` : 'Ticket Attachments',
    });
  }, [navigation, ticketName]);

  // Fetch attachments
  const fetchAttachments = useCallback(async (forceRefresh = false) => {
    if (!ticketId) {
      setError('No ticket ID provided');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log(`Fetching attachments for helpdesk.ticket ${ticketId}`);

      // Log the Odoo API configuration
      console.log('Odoo API config:', {
        baseURL: odooClient.client.defaults.baseURL,
        hasAuthHeader: !!odooClient.client.defaults.headers.Authorization,
        hasDatabaseHeader: !!odooClient.client.defaults.headers.DATABASE
      });

      // Step 1: Get messages related to this ticket
      console.log('Fetching messages for ticket...');
      let messagesResponse;
      try {
        messagesResponse = await odooClient.client.post('/api/v2/call', {
          model: 'mail.message',
          method: 'search_read',
          args: [
            [
              ['model', '=', 'helpdesk.ticket'],
              ['res_id', '=', ticketId]
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
      if (messagesResponse.data && messagesResponse.data.result) {
        console.log(`Found ${messagesResponse.data.result.length} messages with potential attachments`);
        console.log('First message sample:', messagesResponse.data.result.length > 0 ? JSON.stringify(messagesResponse.data.result[0]) : 'No messages');

        // Extract attachment IDs from messages
        messageAttachmentIds = [];
        messagesResponse.data.result.forEach(message => {
          if (message.attachment_ids && Array.isArray(message.attachment_ids) && message.attachment_ids.length > 0) {
            console.log(`Message ${message.id} has ${message.attachment_ids.length} attachments: ${JSON.stringify(message.attachment_ids)}`);
            messageAttachmentIds = [...messageAttachmentIds, ...message.attachment_ids];
          }
        });

        console.log(`Found ${messageAttachmentIds.length} attachments from messages`);
      }

      // Step 2: Get direct attachments for this ticket
      console.log('Fetching direct attachments...');
      let directAttachmentsResponse;
      try {
        directAttachmentsResponse = await odooClient.client.post('/api/v2/call', {
          model: 'ir.attachment',
          method: 'search_read',
          args: [
            [
              ['res_model', '=', 'helpdesk.ticket'],
              ['res_id', '=', ticketId]
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
      if (directAttachmentsResponse.data && directAttachmentsResponse.data.result) {
        console.log('Direct attachments response data:', JSON.stringify(directAttachmentsResponse.data));
        directAttachmentIds = directAttachmentsResponse.data.result.map(att => att.id);
        console.log(`Found ${directAttachmentIds.length} direct attachments: ${JSON.stringify(directAttachmentIds)}`);
      } else if (directAttachmentsResponse.data && Array.isArray(directAttachmentsResponse.data)) {
        // This is the format used in the MessageThread component
        directAttachmentIds = directAttachmentsResponse.data.map(att => att.id);
        console.log(`Found ${directAttachmentIds.length} direct attachments (array format): ${JSON.stringify(directAttachmentIds)}`);
      }

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

      // Process attachments
      if (attachmentsResponse.data && attachmentsResponse.data.result) {
        const rawAttachments = attachmentsResponse.data.result;
        console.log(`Retrieved ${rawAttachments.length} attachment details`);
        console.log('First attachment sample:', rawAttachments.length > 0 ? JSON.stringify(rawAttachments[0]) : 'No attachments');

        // Process each attachment to add URLs and other useful properties
        const { processAttachment } = require('../../../utils/imageUtils');
        const processedAttachments = rawAttachments.map(att => {
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
      } else if (attachmentsResponse.data && Array.isArray(attachmentsResponse.data)) {
        // This is the format used in the MessageThread component
        console.log(`Retrieved ${attachmentsResponse.data.length} attachment details (array format)`);
        console.log('First attachment sample:', attachmentsResponse.data.length > 0 ? JSON.stringify(attachmentsResponse.data[0]) : 'No attachments');

        // Process the attachments
        const { processAttachment } = require('../../../utils/imageUtils');
        const processedAttachments = attachmentsResponse.data.map(att => {
          // Process the attachment using our utility function
          const processedAtt = processAttachment(att);

          // Add additional logging for debugging
          console.log(`Processed attachment: ${processedAtt.name} (${processedAtt.mimetype})`);
          console.log(`  - URL: ${processedAtt.url}`);
          console.log(`  - Full URL: ${processedAtt.fullUrl}`);

          return processedAtt;
        });

        // Sort by most recent first
        processedAttachments.sort((a, b) => new Date(b.createDate) - new Date(a.createDate));

        // Log the first few attachments for debugging
        if (processedAttachments.length > 0) {
          console.log(`First attachment: ${processedAttachments[0].name} (${processedAttachments[0].mimetype})`);
          console.log(`Attachment URLs available: ${processedAttachments[0].url ? 'Yes' : 'No'}`);
        }

        setAttachments(processedAttachments);
      } else {
        console.log('No attachment details found in the response');
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
  }, [ticketId]);

  // Load attachments on component mount
  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  // Handle refresh
  const handleRefresh = () => {
    setRefreshing(true);
    fetchAttachments();
  };

  // Create a thumbnail URL using the API v2 image endpoint format
  const getThumbnailUrl = (attachmentId) => {
    if (!attachmentId) return null;

    const baseUrl = odooClient.client.defaults.baseURL || '';
    // Use the API v2 image endpoint with size parameter
    // Format: /api/v2/image/{attachmentId}/{size}
    // This format is proven to work in the test script
    return `${baseUrl}/api/v2/image/${attachmentId}/128x128`;
  };

  // Handle attachment press
  const handleAttachmentPress = (attachment) => {
    if (!attachment) return;

    // For images and other file types that can be viewed in the app,
    // navigate to the ExpoImageViewerScreen
    if (attachment.mimetype) {
      navigation.navigate('ExpoImageViewer', {
        attachmentId: attachment.id,
        title: attachment.name,
        mimetype: attachment.mimetype
      });
      return;
    }

    // For other files, try to open them
    openAttachment(attachment);
  };

  // Open attachment
  const openAttachment = (attachment) => {
    if (!attachment || !attachment.fullUrl) {
      Alert.alert('Error', 'Cannot open this attachment');
      return;
    }

    // Add access token to URL if available
    let url = attachment.fullUrl;
    if (accessToken && !url.includes('access_token=')) {
      const separator = url.includes('?') ? '&' : '?';
      url = `${url}${separator}access_token=${encodeURIComponent(accessToken)}`;
    }

    // Open the URL
    Linking.openURL(url).catch(err => {
      console.error('Error opening attachment:', err);
      Alert.alert('Error', 'Cannot open this attachment');
    });
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
            Attachments for {ticketName || 'Ticket'}
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
              onPress={() => fetchAttachments(true)}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
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
              <Text style={styles.emptySubtext}>This ticket has no attachments</Text>
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
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginVertical: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  retryButton: {
    backgroundColor: '#0073e6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 4,
    marginHorizontal: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
});

export default HelpdeskAttachmentsScreen;
