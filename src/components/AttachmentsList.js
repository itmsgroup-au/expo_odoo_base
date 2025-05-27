import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import odooClient from '../api/odooClient';
import CachedImage from './CachedImage';
import { createFallbackUrl } from '../utils/imageUtils';

// Helper function to get the appropriate icon name based on mimetype
const getFileIconName = (mimetype) => {
  if (!mimetype) return 'file-document-outline';

  if (mimetype.startsWith('image/')) return 'file-image';
  if (mimetype.startsWith('video/')) return 'file-video';
  if (mimetype.startsWith('audio/')) return 'file-music';
  if (mimetype.includes('pdf')) return 'file-pdf-box';
  if (mimetype.includes('word') || mimetype.includes('document')) return 'file-word';
  if (mimetype.includes('excel') || mimetype.includes('sheet')) return 'file-excel';
  if (mimetype.includes('powerpoint') || mimetype.includes('presentation')) return 'file-powerpoint';
  if (mimetype.includes('zip') || mimetype.includes('compressed')) return 'zip-box';
  if (mimetype.includes('text/')) return 'file-document-outline';

  return 'file-document-outline';
};

// Helper function to format file size
const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return 'Unknown size';

  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${Math.round(bytes / Math.pow(1024, i), 2)} ${sizes[i]}`;
};

// Attachment list component
const AttachmentsList = ({ attachments, onPress, loading, style }) => {
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
  if (loading) {
    return (
      <View style={styles.attachmentsLoadingContainer}>
        <ActivityIndicator size="small" color="#0073e6" />
        <Text style={styles.attachmentsLoadingText}>Loading attachments...</Text>
      </View>
    );
  }

  if (!attachments || attachments.length === 0) {
    return (
      <View style={styles.noAttachmentsContainer}>
        <Text style={styles.noAttachmentsText}>No attachments found</Text>
      </View>
    );
  }

  // Log attachments for debugging
  console.log(`Rendering ${attachments.length} attachments`);

  return (
    <View style={[styles.attachmentsContainer, style]}>
      <FlatList
        data={attachments}
        keyExtractor={(item) => `attachment-${item.id}`}
        horizontal={true}
        showsHorizontalScrollIndicator={true}
        renderItem={({ item }) => {
          // Use the fullUrl property if available, otherwise construct it
          const baseUrl = odooClient.client.defaults.baseURL || '';
          let imageUrl = item.fullUrl || `${baseUrl}${item.url}`;

          // For image attachments, try to use a thumbnail URL
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

          // Add error logging for debugging
          console.log(`Rendering attachment: ${item.name} (${item.mimetype}) - URL: ${imageUrl}`);

          return (
            <TouchableOpacity
              style={styles.attachmentItem}
              onPress={() => onPress(item)}
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
                          size={24}
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
                        onError={(e) => {
                          console.log(`Image load error for ${item.name}: ${e || 'Unknown error'}`);
                        }}
                      />
                    </View>
                  );
                })()
              ) : (
                <View style={styles.attachmentIconContainer}>
                  <Icon
                    name={getFileIconName(item.mimetype)}
                    size={24}
                    color="#0073e6"
                  />
                </View>
              )}
              <Text style={styles.attachmentName} numberOfLines={2}>
                {item.name}
              </Text>
              <Text style={styles.attachmentInfo}>
                {formatFileSize(item.fileSize)}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  attachmentsContainer: {
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  attachmentsLoadingContainer: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  attachmentsLoadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  noAttachmentsContainer: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noAttachmentsText: {
    fontSize: 14,
    color: '#999',
  },
  attachmentItem: {
    width: 120,
    marginRight: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    alignItems: 'center',
  },
  attachmentImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
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
    marginBottom: 8,
  },
  attachmentName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
    marginBottom: 4,
  },
  attachmentInfo: {
    fontSize: 10,
    color: '#999',
  },
});

export { AttachmentsList, getFileIconName, formatFileSize };
