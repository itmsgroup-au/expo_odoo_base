import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
  Platform,
  Linking,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../../contexts/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import odooClient from '../../../api/odooClient';
import CachedImage from '../../../components/CachedImage';
import { getFileIconName, formatFileSize } from '../../../components/AttachmentsList';

const HelpdeskInlineAttachments = ({ ticketId, ticketName }) => {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingItems, setDownloadingItems] = useState(new Set());
  const [cachedFiles, setCachedFiles] = useState(new Map());
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

  // Check which files are already cached
  const checkCachedFiles = useCallback(async (attachmentsList) => {
    const cacheMap = new Map();

    for (const attachment of attachmentsList) {
      const filename = `${attachment.id}_${attachment.name}`;
      const fileUri = `${FileSystem.documentDirectory}attachments/${filename}`;

      try {
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        if (fileInfo.exists) {
          cacheMap.set(attachment.id, {
            uri: fileUri,
            size: fileInfo.size,
            modifiedTime: fileInfo.modificationTime
          });
        }
      } catch (error) {
        console.log(`Error checking cache for ${filename}:`, error);
      }
    }

    setCachedFiles(cacheMap);
  }, []);

  // Fetch attachments for the ticket
  const fetchAttachments = useCallback(async () => {
    if (!ticketId) {
      console.log('HelpdeskInlineAttachments: No ticketId provided');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log(`HelpdeskInlineAttachments: Fetching attachments for ticket ${ticketId}`);

      // Step 1: Get messages related to this ticket
      console.log('HelpdeskInlineAttachments: Fetching messages for ticket...');
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
        console.log('HelpdeskInlineAttachments: Messages response:', messagesResponse.status, messagesResponse.statusText);
      } catch (err) {
        console.error('HelpdeskInlineAttachments: Error fetching messages:', err);
        if (err.response) {
          console.error('HelpdeskInlineAttachments: Response status:', err.response.status);
          console.error('HelpdeskInlineAttachments: Response data:', err.response.data);
        }
        throw new Error(`Failed to fetch messages: ${err.message}`);
      }

      // Step 2: Get direct attachments for this ticket
      console.log('HelpdeskInlineAttachments: Fetching direct attachments...');
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
        console.log('HelpdeskInlineAttachments: Direct attachments response:', directAttachmentsResponse.status, directAttachmentsResponse.statusText);
      } catch (err) {
        console.error('HelpdeskInlineAttachments: Error fetching direct attachments:', err);
        if (err.response) {
          console.error('HelpdeskInlineAttachments: Response status:', err.response.status);
          console.error('HelpdeskInlineAttachments: Response data:', err.response.data);
        }
        throw new Error(`Failed to fetch direct attachments: ${err.message}`);
      }

      // Extract attachment IDs from messages
      let messageAttachmentIds = [];
      if (messagesResponse.data && messagesResponse.data.result) {
        console.log(`HelpdeskInlineAttachments: Found ${messagesResponse.data.result.length} messages with potential attachments`);
        console.log('HelpdeskInlineAttachments: First message sample:', messagesResponse.data.result.length > 0 ? JSON.stringify(messagesResponse.data.result[0]) : 'No messages');

        // Extract attachment IDs from messages
        messageAttachmentIds = [];
        messagesResponse.data.result.forEach(message => {
          if (message.attachment_ids && Array.isArray(message.attachment_ids) && message.attachment_ids.length > 0) {
            console.log(`HelpdeskInlineAttachments: Message ${message.id} has ${message.attachment_ids.length} attachments: ${JSON.stringify(message.attachment_ids)}`);
            messageAttachmentIds = [...messageAttachmentIds, ...message.attachment_ids];
          }
        });
        console.log(`HelpdeskInlineAttachments: Found ${messageAttachmentIds.length} attachments from messages`);
      }

      // Extract direct attachment IDs
      let directAttachmentIds = [];
      if (directAttachmentsResponse.data && directAttachmentsResponse.data.result) {
        console.log('HelpdeskInlineAttachments: Direct attachments response data:', JSON.stringify(directAttachmentsResponse.data));
        directAttachmentIds = directAttachmentsResponse.data.result.map(att => att.id);
        console.log(`HelpdeskInlineAttachments: Found ${directAttachmentIds.length} direct attachments: ${JSON.stringify(directAttachmentIds)}`);
      } else if (directAttachmentsResponse.data && Array.isArray(directAttachmentsResponse.data)) {
        // This is the format used in the MessageThread component
        directAttachmentIds = directAttachmentsResponse.data.map(att => att.id);
        console.log(`HelpdeskInlineAttachments: Found ${directAttachmentIds.length} direct attachments (array format): ${JSON.stringify(directAttachmentIds)}`);
      }

      // Combine all attachment IDs and remove duplicates
      const allAttachmentIds = [...new Set([...messageAttachmentIds, ...directAttachmentIds])];
      console.log(`HelpdeskInlineAttachments: Total unique attachments: ${allAttachmentIds.length}`);

      if (allAttachmentIds.length === 0) {
        console.log('HelpdeskInlineAttachments: No attachments found');
        setAttachments([]);
        setLoading(false);
        return;
      }

      // Step 3: Get detailed information for all attachments
      console.log('HelpdeskInlineAttachments: Fetching attachment details...');
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
        console.log('HelpdeskInlineAttachments: Attachment details response:', attachmentsResponse.status, attachmentsResponse.statusText);
      } catch (err) {
        console.error('HelpdeskInlineAttachments: Error fetching attachment details:', err);
        if (err.response) {
          console.error('HelpdeskInlineAttachments: Response status:', err.response.status);
          console.error('HelpdeskInlineAttachments: Response data:', err.response.data);
        }
        throw new Error(`Failed to fetch attachment details: ${err.message}`);
      }

      // Process attachments
      if (attachmentsResponse.data && attachmentsResponse.data.result) {
        const rawAttachments = attachmentsResponse.data.result;
        console.log(`HelpdeskInlineAttachments: Retrieved ${rawAttachments.length} attachment details`);
        console.log('HelpdeskInlineAttachments: First attachment sample:', rawAttachments.length > 0 ? JSON.stringify(rawAttachments[0]) : 'No attachments');

        // Process each attachment to add URLs and other useful properties
        const processedAttachments = rawAttachments.map(att => {
          const baseUrl = odooClient.client.defaults.baseURL || '';
          const processedAttachment = {
            id: att.id,
            name: att.name,
            mimetype: att.mimetype,
            fileSize: att.file_size,
            createDate: att.create_date,
            createUser: att.create_uid?.[1] || 'Unknown',
            url: att.url,
            fullUrl: att.url ? `${baseUrl}${att.url}` : `${baseUrl}/api/v2/download/${att.id}`,
            thumbnailUrl: att.mimetype?.startsWith('image/') ? `${baseUrl}/api/v2/image/${att.id}/128x128` : null
          };

          // Log the processed attachment
          console.log(`HelpdeskInlineAttachments: Created URL for attachment ${att.id}: ${processedAttachment.fullUrl}`);
          console.log(`HelpdeskInlineAttachments: Attachment ${att.id} data:`, JSON.stringify(processedAttachment));

          return processedAttachment;
        });

        // Sort by most recent first
        processedAttachments.sort((a, b) => new Date(b.createDate) - new Date(a.createDate));

        console.log(`HelpdeskInlineAttachments: Setting ${processedAttachments.length} processed attachments`);
        setAttachments(processedAttachments);
        await checkCachedFiles(processedAttachments);
      } else if (attachmentsResponse.data && Array.isArray(attachmentsResponse.data)) {
        // This is the format used in the MessageThread component
        console.log(`HelpdeskInlineAttachments: Retrieved ${attachmentsResponse.data.length} attachment details (array format)`);
        console.log('HelpdeskInlineAttachments: First attachment sample:', attachmentsResponse.data.length > 0 ? JSON.stringify(attachmentsResponse.data[0]) : 'No attachments');

        // Process the attachments
        const processedAttachments = attachmentsResponse.data.map(att => {
          const baseUrl = odooClient.client.defaults.baseURL || '';
          const processedAtt = {
            id: att.id,
            name: att.name,
            mimetype: att.mimetype,
            fileSize: att.file_size,
            createDate: att.create_date,
            createUser: att.create_uid?.[1] || 'Unknown',
            url: att.url,
            fullUrl: att.url ? `${baseUrl}${att.url}` : `${baseUrl}/api/v2/download/${att.id}`,
            thumbnailUrl: att.mimetype?.startsWith('image/') ? `${baseUrl}/api/v2/image/${att.id}/128x128` : null
          };

          // Add additional logging for debugging
          console.log(`HelpdeskInlineAttachments: Processed attachment: ${processedAtt.name} (${processedAtt.mimetype})`);
          console.log(`HelpdeskInlineAttachments:   - URL: ${processedAtt.url}`);
          console.log(`HelpdeskInlineAttachments:   - Full URL: ${processedAtt.fullUrl}`);

          return processedAtt;
        });

        // Sort by most recent first
        processedAttachments.sort((a, b) => new Date(b.createDate) - new Date(a.createDate));

        console.log(`HelpdeskInlineAttachments: Setting ${processedAttachments.length} processed attachments (array format)`);
        setAttachments(processedAttachments);
        await checkCachedFiles(processedAttachments);
      } else {
        console.log('HelpdeskInlineAttachments: No attachment details found in the response');
        setAttachments([]);
      }
    } catch (err) {
      console.error('HelpdeskInlineAttachments: Error in fetchAttachments:', err);

      // Provide more detailed error message
      let errorMessage = 'Failed to load attachments. Please try again.';
      if (err.response) {
        errorMessage += ` (Status: ${err.response.status})`;
        console.error('HelpdeskInlineAttachments: Response data:', JSON.stringify(err.response.data));
      } else if (err.request) {
        errorMessage += ' (No response received)';
      } else {
        errorMessage += ` (${err.message})`;
      }

      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [ticketId, checkCachedFiles]);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  // Create attachments directory if needed
  const ensureAttachmentsDirectory = async () => {
    const attachmentsDir = `${FileSystem.documentDirectory}attachments/`;
    const dirInfo = await FileSystem.getInfoAsync(attachmentsDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(attachmentsDir, { intermediates: true });
    }
    return attachmentsDir;
  };

  // Download and cache file
  const downloadFile = async (attachment) => {
    if (attachment.fileSize > 1024 * 1024) {
      Alert.alert('File Too Large', 'Files larger than 1MB cannot be cached to preserve device storage.');
      return;
    }

    if (downloadingItems.has(attachment.id)) {
      return; // Already downloading
    }

    try {
      setDownloadingItems(prev => new Set([...prev, attachment.id]));

      const attachmentsDir = await ensureAttachmentsDirectory();
      const filename = `${attachment.id}_${attachment.name}`;
      const fileUri = `${attachmentsDir}${filename}`;

      // Build download URL with access token
      let downloadUrl = attachment.fullUrl;
      if (accessToken && !downloadUrl.includes('access_token')) {
        const separator = downloadUrl.includes('?') ? '&' : '?';
        downloadUrl = `${downloadUrl}${separator}access_token=${accessToken}`;
      }

      console.log(`Downloading ${attachment.name} to ${fileUri}`);

      const downloadResult = await FileSystem.downloadAsync(downloadUrl, fileUri);

      if (downloadResult.status === 200) {
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        setCachedFiles(prev => new Map([...prev, [attachment.id, {
          uri: fileUri,
          size: fileInfo.size,
          modifiedTime: fileInfo.modificationTime
        }]]));

        Alert.alert('Success', `${attachment.name} has been downloaded and cached.`);
      } else {
        throw new Error(`Download failed with status ${downloadResult.status}`);
      }
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Download Failed', `Could not download ${attachment.name}. Please try again.`);
    } finally {
      setDownloadingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(attachment.id);
        return newSet;
      });
    }
  };

  // Share file functionality
  const shareFile = async (attachment) => {
    try {
      const cachedFile = cachedFiles.get(attachment.id);

      if (cachedFile && await FileSystem.getInfoAsync(cachedFile.uri).then(info => info.exists)) {
        // Share local cached file
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(cachedFile.uri, {
            mimeType: attachment.mimetype,
            dialogTitle: `Share ${attachment.name}`,
          });
        } else {
          // Fallback to native share
          await Share.share({
            url: cachedFile.uri,
            title: attachment.name,
          });
        }
      } else {
        // Share URL
        let shareUrl = attachment.fullUrl;
        if (accessToken && !shareUrl.includes('access_token')) {
          const separator = shareUrl.includes('?') ? '&' : '?';
          shareUrl = `${shareUrl}${separator}access_token=${accessToken}`;
        }

        await Share.share({
          url: shareUrl,
          title: attachment.name,
          message: `Check out this file: ${attachment.name}`,
        });
      }
    } catch (error) {
      console.error('Share error:', error);
      Alert.alert('Share Failed', 'Could not share the file. Please try again.');
    }
  };

  // Save image to photos
  const saveToPhotos = async (attachment) => {
    if (!attachment.mimetype?.startsWith('image/')) {
      Alert.alert('Invalid File', 'Only images can be saved to photos.');
      return;
    }

    try {
      // Request permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant permission to access your photo library.');
        return;
      }

      let fileUri;
      const cachedFile = cachedFiles.get(attachment.id);

      if (cachedFile && await FileSystem.getInfoAsync(cachedFile.uri).then(info => info.exists)) {
        fileUri = cachedFile.uri;
      } else {
        // Download temporarily
        const tempDir = `${FileSystem.cacheDirectory}temp_photos/`;
        const tempDirInfo = await FileSystem.getInfoAsync(tempDir);
        if (!tempDirInfo.exists) {
          await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });
        }

        const tempUri = `${tempDir}${attachment.id}_${attachment.name}`;
        let downloadUrl = attachment.fullUrl;
        if (accessToken && !downloadUrl.includes('access_token')) {
          const separator = downloadUrl.includes('?') ? '&' : '?';
          downloadUrl = `${downloadUrl}${separator}access_token=${accessToken}`;
        }

        const downloadResult = await FileSystem.downloadAsync(downloadUrl, tempUri);
        if (downloadResult.status !== 200) {
          throw new Error('Download failed');
        }
        fileUri = tempUri;
      }

      // Save to media library
      const asset = await MediaLibrary.createAssetAsync(fileUri);
      await MediaLibrary.createAlbumAsync('ExoMobile', asset, false);

      Alert.alert('Success', `${attachment.name} has been saved to your photos.`);

      // Clean up temp file if it was created
      if (!cachedFiles.has(attachment.id)) {
        await FileSystem.deleteAsync(fileUri, { idempotent: true });
      }
    } catch (error) {
      console.error('Save to photos error:', error);
      Alert.alert('Save Failed', 'Could not save the image to photos. Please try again.');
    }
  };

  // Open attachment handler
  const openAttachment = (attachment) => {
    if (attachment.mimetype?.startsWith('image/')) {
      // Navigate to image viewer
      navigation.navigate('ExpoImageViewer', {
        attachmentId: attachment.id,
        attachmentInfo: attachment,
        title: attachment.name,
      });
    } else {
      // Try to open cached file first, fallback to web URL
      const cachedFile = cachedFiles.get(attachment.id);
      if (cachedFile) {
        Linking.openURL(cachedFile.uri).catch(() => {
          // Fallback to web URL
          let openUrl = attachment.fullUrl;
          if (accessToken && !openUrl.includes('access_token')) {
            const separator = openUrl.includes('?') ? '&' : '?';
            openUrl = `${openUrl}${separator}access_token=${accessToken}`;
          }
          Linking.openURL(openUrl);
        });
      } else {
        let openUrl = attachment.fullUrl;
        if (accessToken && !openUrl.includes('access_token')) {
          const separator = openUrl.includes('?') ? '&' : '?';
          openUrl = `${openUrl}${separator}access_token=${accessToken}`;
        }
        Linking.openURL(openUrl);
      }
    }
  };

  // Show attachment actions context menu
  const showAttachmentActions = (attachment) => {
    const actions = [
      { text: 'Open', onPress: () => openAttachment(attachment) },
      { text: 'Share', onPress: () => shareFile(attachment) }
    ];

    // Add conditional actions based on file size and type
    if (attachment.fileSize <= 1024 * 1024 && !cachedFiles.has(attachment.id)) {
      actions.push({ text: 'Download & Cache', onPress: () => downloadFile(attachment) });
    }

    if (attachment.mimetype?.startsWith('image/')) {
      actions.push({ text: 'Save to Photos', onPress: () => saveToPhotos(attachment) });
    }

    actions.push({ text: 'Cancel', style: 'cancel' });

    Alert.alert(
      attachment.name,
      `${formatFileSize(attachment.fileSize)} • ${attachment.mimetype}`,
      actions
    );
  };

  // Add a refresh function for debugging
  const handleRefresh = () => {
    console.log('HelpdeskInlineAttachments: Manual refresh triggered');
    fetchAttachments();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading attachments...
        </Text>
      </View>
    );
  }

  if (attachments.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Icon name="paperclip-off" size={32} color={colors.textSecondary} />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No attachments found
        </Text>
        <TouchableOpacity
          style={[styles.debugButton, { backgroundColor: colors.primary, marginTop: 16 }]}
          onPress={handleRefresh}
        >
          <Text style={[styles.debugButtonText, { color: colors.onPrimary }]}>
            Refresh / Debug
          </Text>
        </TouchableOpacity>
        <Text style={[styles.debugText, { color: colors.textSecondary, marginTop: 8 }]}>
          Check console logs for debugging info
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Attachments ({attachments.length})
        </Text>
        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
          Tap to view • Long press for options
        </Text>
      </View>

      <FlatList
        data={attachments}
        renderItem={({ item }) => {
          const isImage = item.mimetype?.startsWith('image/');
          const isCached = cachedFiles.has(item.id);
          const isDownloading = downloadingItems.has(item.id);
          const isLargeFile = item.fileSize > 1024 * 1024;

          return (
            <TouchableOpacity
              style={[styles.attachmentItem, { backgroundColor: colors.surface }]}
              onPress={() => openAttachment(item)}
              onLongPress={() => showAttachmentActions(item)}
            >
              <View style={styles.attachmentContent}>
                <View style={styles.attachmentPreview}>
                  {isImage ? (
                    <CachedImage
                      attachmentId={item.id}
                      size="64x64"
                      style={styles.attachmentThumbnail}
                      contentFit="cover"
                      attachmentInfo={item}
                    />
                  ) : (
                    <View style={[styles.attachmentIcon, { backgroundColor: colors.background }]}>
                      <Icon
                        name={getFileIconName(item.mimetype)}
                        size={24}
                        color={colors.primary}
                      />
                    </View>
                  )}

                  {/* Cache indicator */}
                  {isCached && !isLargeFile && (
                    <View style={[styles.cacheIndicator, { backgroundColor: colors.success }]}>
                      <Icon name="check" size={12} color="white" />
                    </View>
                  )}
                </View>

                <View style={styles.attachmentInfo}>
                  <Text style={[styles.attachmentName, { color: colors.text }]} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={[styles.attachmentDetails, { color: colors.textSecondary }]}>
                    {formatFileSize(item.fileSize)}
                    {isLargeFile && ' • Too large to cache'}
                    {isCached && ' • Cached'}
                  </Text>
                  <Text style={[styles.attachmentDate, { color: colors.textSecondary }]}>
                    {new Date(item.createDate).toLocaleDateString()} • {item.createUser}
                  </Text>
                </View>

                <View style={styles.attachmentActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: colors.primary }]}
                    onPress={() => shareFile(item)}
                  >
                    <Icon name="share-variant" size={16} color="white" />
                  </TouchableOpacity>

                  {!isLargeFile && (
                    isDownloading ? (
                      <View style={[styles.actionButton, { backgroundColor: colors.background }]}>
                        <ActivityIndicator size="small" color={colors.primary} />
                      </View>
                    ) : isCached ? (
                      <View style={[styles.actionButton, { backgroundColor: colors.success }]}>
                        <Icon name="check" size={16} color="white" />
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.primary }]}
                        onPress={() => downloadFile(item)}
                      >
                        <Icon name="download" size={16} color={colors.primary} />
                      </TouchableOpacity>
                    )
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        keyExtractor={(item) => `attachment-${item.id}`}
        style={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 12,
  },
  list: {
    flex: 1,
    paddingHorizontal: 16,
  },
  attachmentItem: {
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  attachmentContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  attachmentPreview: {
    position: 'relative',
    marginRight: 12,
  },
  attachmentThumbnail: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  attachmentIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentInfo: {
    flex: 1,
    marginRight: 12,
  },
  attachmentName: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  attachmentDetails: {
    fontSize: 12,
    marginBottom: 2,
  },
  attachmentDate: {
    fontSize: 11,
  },
  attachmentActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cacheIndicator: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    flexDirection: 'row',
  },
  loadingText: {
    fontSize: 14,
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  debugButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  debugButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  debugText: {
    fontSize: 10,
    textAlign: 'center',
  },
});

export default HelpdeskInlineAttachments;