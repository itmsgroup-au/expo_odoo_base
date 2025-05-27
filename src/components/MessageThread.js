import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Dimensions,
  ScrollView,
  Modal,
  Alert,
  TextInput,
  Linking
} from 'react-native';
import ExpoImageWithAuth from './ExpoImageWithAuth';
import CachedImage from './CachedImage';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { mailMessageAPI } from '../api/models/mailMessageApi';
import { mailActivityAPI } from '../api/models/mailActivityApi';
import defaultAvatar from '../assets/images/default_avatar.png';
import RenderHtml from 'react-native-render-html';
import * as ImagePickerModule from 'expo-image-picker';
import odooClient from '../api/odooClient';
import logger from '../utils/logger';
import { AttachmentsList, getFileIconName, formatFileSize } from './AttachmentsList';
import { processAttachment, createFallbackUrl, createSecondFallbackUrl } from '../utils/imageUtils';
import AttachmentPicker from './AttachmentPicker';

// Use the imported ImagePicker
const ImagePicker = ImagePickerModule;

const { width: screenWidth } = Dimensions.get('window');

const MessageThread = ({ model, recordId, recordName, ...props }) => {
  const navigation = useNavigation();
  const [messages, setMessages] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [messageType, setMessageType] = useState('comment'); // 'comment' for external, 'notification' for internal note
  const [sendingMessage, setSendingMessage] = useState(false);
  const [error, setError] = useState(null);
  const [inputFocused, setInputFocused] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [threadAttachments, setThreadAttachments] = useState([]);
  const [attachmentPickerVisible, setAttachmentPickerVisible] = useState(false);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);

  // Input reference
  const inputRef = useRef(null);

  // Combine messages and activities into a single timeline
  const timelineItems = [...messages, ...activities].sort((a, b) => {
    const dateA = a.date || a.create_date;
    const dateB = b.date || b.create_date;
    return new Date(dateB) - new Date(dateA);
  });

  // Fetch all attachments for the thread
  const fetchThreadAttachments = useCallback(async () => {
    try {
      setLoadingAttachments(true);
      console.log(`Fetching attachments for ${model} ${recordId}`);

      // First, get all messages related to this record
      const messagesResponse = await odooClient.client.post('/api/v2/call', {
        model: 'mail.message',
        method: 'search_read',
        args: [
          [
            ['model', '=', model],
            ['res_id', '=', recordId]
          ]
        ],
        kwargs: {
          fields: ['id', 'attachment_ids', 'date']
        }
      });

      // Extract all attachment IDs from messages
      let messageAttachmentIds = [];
      if (messagesResponse.data && Array.isArray(messagesResponse.data)) {
        // Sort messages by date (newest first) to prioritize recent attachments
        const sortedMessages = [...messagesResponse.data].sort((a, b) =>
          new Date(b.date || '2000-01-01') - new Date(a.date || '2000-01-01')
        );

        console.log(`Found ${sortedMessages.length} messages with potential attachments`);

        sortedMessages.forEach(msg => {
          if (msg.attachment_ids && Array.isArray(msg.attachment_ids) && msg.attachment_ids.length > 0) {
            console.log(`Message ${msg.id} has ${msg.attachment_ids.length} attachments`);
            messageAttachmentIds = [...messageAttachmentIds, ...msg.attachment_ids];
          }
        });
      }

      // Now get direct attachments for this record
      const directAttachmentsResponse = await odooClient.client.post('/api/v2/call', {
        model: 'ir.attachment',
        method: 'search_read',
        args: [
          [
            ['res_model', '=', model],
            ['res_id', '=', recordId]
          ]
        ],
        kwargs: {
          fields: ['id']
        }
      });

      // Extract direct attachment IDs
      let directAttachmentIds = [];
      if (directAttachmentsResponse.data && Array.isArray(directAttachmentsResponse.data)) {
        directAttachmentIds = directAttachmentsResponse.data.map(att => att.id);
      }

      // Combine all attachment IDs and remove duplicates
      const allAttachmentIds = [...new Set([...messageAttachmentIds, ...directAttachmentIds])];

      console.log(`Found ${allAttachmentIds.length} total attachments for ${model} ${recordId}`);

      if (allAttachmentIds.length === 0) {
        setThreadAttachments([]);
        return;
      }

      // Now fetch detailed information for all attachments
      const attachmentsResponse = await odooClient.client.post('/api/v2/call', {
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

      if (attachmentsResponse.data && Array.isArray(attachmentsResponse.data)) {
        console.log(`Retrieved ${attachmentsResponse.data.length} attachment details`);

        // Process the attachments
        const attachments = attachmentsResponse.data.map(att => {
          // Process the attachment using our utility function
          const processedAtt = processAttachment(att);

          // Add additional logging for debugging
          console.log(`Processed attachment: ${processedAtt.name} (${processedAtt.mimetype})`);
          console.log(`  - URL: ${processedAtt.url}`);
          console.log(`  - Full URL: ${processedAtt.fullUrl}`);

          return processedAtt;
        });

        // Sort by most recent first
        attachments.sort((a, b) => new Date(b.createDate) - new Date(a.createDate));

        // Log the first few attachments for debugging
        if (attachments.length > 0) {
          console.log(`First attachment: ${attachments[0].name} (${attachments[0].mimetype})`);
          console.log(`Attachment URLs available: ${attachments[0].url ? 'Yes' : 'No'}`);
        }

        setThreadAttachments(attachments);
      } else {
        console.log(`No attachment details found for ${model} ${recordId}`);
        setThreadAttachments([]);
      }
    } catch (err) {
      logger.safeErrorLog('Error fetching thread attachments:', err);
      // Don't show error to user, just log it
    } finally {
      setLoadingAttachments(false);
    }
  }, [model, recordId]);

  // Fetch messages and activities
  const fetchData = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      // Fetch messages
      const messagesData = await mailMessageAPI.getMessagesForRecord(model, recordId, forceRefresh);
      setMessages(messagesData || []);

      // Fetch activities
      const activitiesData = await mailActivityAPI.getActivitiesForRecord(model, recordId, forceRefresh);
      setActivities(activitiesData || []);

      // Fetch thread attachments after a short delay to ensure messages are processed
      setTimeout(() => {
        fetchThreadAttachments();
      }, 500);
    } catch (err) {
      console.error('Error fetching message thread:', err);
      setError('Failed to load messages. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [model, recordId, fetchThreadAttachments]);

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle refresh
  const handleRefresh = () => {
    setRefreshing(true);
    fetchData(true);
  };

  // Show attachment picker
  const handleShowAttachmentPicker = () => {
    setAttachmentPickerVisible(true);
  };

  // Handle attachment selection from the picker
  const handleAttachmentSelected = (newAttachment) => {
    setAttachments(prev => [...prev, newAttachment]);
    console.log(`Added attachment: ${newAttachment.name} (${Math.round((newAttachment.base64?.length || 0) / 1024)} KB)`);
  };



  // Remove an attachment
  const removeAttachment = (id) => {
    setAttachments(prev => prev.filter(attachment => attachment.id !== id));
  };

  // View an image attachment
  const viewImage = (uri) => {
    // Navigate to the ImageViewer screen
    navigation.navigate('ImageViewer', {
      imageUrl: uri,
      title: 'Image Preview',
      mimetype: 'image/jpeg' // Assume JPEG for local images
    });
  };

  // Open an attachment
  const openAttachment = async (attachment) => {
    try {
      // Use the fullUrl property if available, otherwise construct it
      const fullUrl = attachment.fullUrl || `${odooClient.client.defaults.baseURL || ''}${attachment.url}`;
      console.log(`Opening attachment with URL: ${fullUrl}`);

      console.log(`Opening attachment: ${attachment.name} (${attachment.mimetype}) - URL: ${fullUrl}`);

      // Use the ImageViewer for all file types
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

  // Toggle attachment list visibility
  const toggleAttachmentsList = () => {
    const newValue = !showAttachments;
    setShowAttachments(newValue);

    // Always fetch attachments when toggling to show them
    if (newValue) {
      fetchThreadAttachments();
    }
  };

  // Toggle attachment options
  const toggleAttachmentOptions = () => {
    setShowAttachmentOptions(prev => !prev);
  };

  // Upload attachments to Odoo
  const uploadAttachments = async () => {
    if (attachments.length === 0) return [];

    try {
      const uploadedAttachments = [];
      let failedUploads = 0;

      // Check for large attachments and warn the user
      const largeAttachments = attachments.filter(att => {
        const sizeKB = att.size || Math.round((att.base64?.length || 0) / 1024);
        return sizeKB > 2000; // > 2MB
      });

      if (largeAttachments.length > 0) {
        console.warn(`Found ${largeAttachments.length} large attachments that may cause issues`);
      }

      // Upload each attachment one by one using our API method
      for (const attachment of attachments) {
        try {
          const sizeKB = attachment.size || Math.round((attachment.base64?.length || 0) / 1024);
          console.log(`Uploading attachment: ${attachment.name} (${sizeKB} KB)`);

          // Add a small delay between uploads to prevent overwhelming the server
          if (uploadedAttachments.length > 0) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }

          // For very large attachments, add an extra delay and log a warning
          if (sizeKB > 2000) {
            console.warn(`Large attachment detected: ${attachment.name} (${sizeKB} KB)`);
            await new Promise(resolve => setTimeout(resolve, 500)); // Additional delay
          }

          const attachmentId = await mailMessageAPI.uploadAttachment(
            {
              uri: attachment.uri,
              type: attachment.type || 'image/jpeg',
              name: attachment.name,
              base64: attachment.base64, // Pass base64 data for fallback
              size: sizeKB
            },
            model,
            recordId
          );

          if (attachmentId) {
            uploadedAttachments.push(attachmentId);
            console.log(`Successfully uploaded attachment: ${attachment.name}, ID: ${attachmentId}`);
          } else {
            failedUploads++;
            console.error(`Failed to upload attachment: ${attachment.name}`);
          }
        } catch (uploadError) {
          failedUploads++;
          console.error(`Error uploading individual attachment ${attachment.name}:`, uploadError);
        }
      }

      // If some uploads failed but others succeeded, we can still proceed
      if (failedUploads > 0 && uploadedAttachments.length > 0) {
        console.warn(`${failedUploads} attachment(s) failed to upload, but ${uploadedAttachments.length} succeeded`);
      } else if (failedUploads > 0 && uploadedAttachments.length === 0) {
        // If all uploads failed, throw an error
        throw new Error(`All ${failedUploads} attachment(s) failed to upload`);
      }

      return uploadedAttachments;
    } catch (err) {
      console.error('Error uploading attachments:', err);
      throw err;
    }
  };

  // Send a new message
  const handleSendMessage = async () => {
    if ((!newMessage || !newMessage.trim()) && attachments.length === 0) return;

    try {
      setSendingMessage(true);
      setError(null); // Clear any previous errors
      console.log(`Sending ${messageType === 'comment' ? 'external message' : 'internal note'} with ${attachments.length} attachments`);

      // Upload attachments first if any
      let attachmentIds = [];
      if (attachments.length > 0) {
        try {
          // Show a temporary message that we're uploading attachments
          setError('Uploading attachments...');

          attachmentIds = await uploadAttachments();
          console.log(`Successfully uploaded ${attachmentIds.length} attachments: ${JSON.stringify(attachmentIds)}`);

          // Clear the temporary message
          setError(null);

          // If we didn't get any attachment IDs but had attachments to upload, something went wrong
          if (attachmentIds.length === 0) {
            console.warn('No attachment IDs returned after upload');

            // Ask user if they want to continue without attachments
            if (newMessage && newMessage.trim()) {
              Alert.alert(
                'Attachment Upload Issue',
                'Your attachments may not have uploaded correctly. Do you want to continue sending the message?',
                [
                  {
                    text: 'Cancel',
                    style: 'cancel',
                    onPress: () => {
                      setSendingMessage(false);
                    }
                  },
                  {
                    text: 'Send anyway',
                    onPress: async () => {
                      // Continue with sending the message with whatever attachments were uploaded
                      await sendMessageWithAttachments(attachmentIds);
                    }
                  }
                ]
              );
              return;
            }
          }
        } catch (uploadErr) {
          console.error('Error uploading attachments:', uploadErr);

          // Don't return immediately - we might still be able to send the message without attachments
          if (newMessage && newMessage.trim()) {
            Alert.alert(
              'Attachment Upload Failed',
              'Your message will be sent without attachments. Do you want to continue?',
              [
                {
                  text: 'Cancel',
                  style: 'cancel',
                  onPress: () => {
                    setSendingMessage(false);
                  }
                },
                {
                  text: 'Send without attachments',
                  onPress: async () => {
                    // Continue with sending the message without attachments
                    await sendMessageWithoutAttachments();
                  }
                }
              ]
            );
            return;
          } else {
            setError('Failed to upload attachments. Please try again.');
            setSendingMessage(false);
            return;
          }
        }
      }

      // Show a temporary message that we're sending the message
      setError('Sending message...');

      // Send the message with attachment IDs
      await sendMessageWithAttachments(attachmentIds);

    } catch (err) {
      console.error('Error in handleSendMessage:', err);
      setError('Failed to send message. Please try again.');
      setSendingMessage(false);
    }
  };

  // Helper function to send message with attachments
  const sendMessageWithAttachments = async (attachmentIds) => {
    try {
      // Ensure we have a valid message
      const messageToSend = newMessage || '';

      console.log(`Sending message with ${attachmentIds.length} attachments: ${JSON.stringify(attachmentIds)}`);

      // Show sending status
      setError('Sending message...');

      const result = await mailMessageAPI.postMessage(
        model,
        recordId,
        messageToSend,
        messageType,
        attachmentIds
      );

      if (result) {
        // Clear the input and error message
        setNewMessage('');
        setAttachments([]);
        setError(null);

        // Show success message briefly
        setError('Message sent successfully!');
        setTimeout(() => {
          setError(null);
        }, 2000);

        // Refresh the message thread
        fetchData(true);
      } else {
        console.error('No result returned from postMessage');
        setError('Failed to send message. Please try again.');

        // If we have attachments but the message failed, they might be orphaned
        // Let the user know their attachments were uploaded but not linked to a message
        if (attachmentIds && attachmentIds.length > 0) {
          setTimeout(() => {
            Alert.alert(
              'Message Failed',
              'Your attachments were uploaded but the message failed to send. The attachments may still be available in the Attachments tab.',
              [{ text: 'OK' }]
            );
          }, 500);
        }
      }
    } catch (err) {
      console.error('Error sending message with attachments:', err);
      setError('Failed to send message. Please try again.');

      // If we have attachments but the message failed, they might be orphaned
      if (attachmentIds && attachmentIds.length > 0) {
        setTimeout(() => {
          Alert.alert(
            'Message Failed',
            'Your attachments were uploaded but the message failed to send. The attachments may still be available in the Attachments tab.',
            [{ text: 'OK' }]
          );
        }, 500);
      }
    } finally {
      setSendingMessage(false);
    }
  };

  // Helper function to send message without attachments
  const sendMessageWithoutAttachments = async () => {
    try {
      // Show sending status
      setError('Sending message...');

      const result = await mailMessageAPI.postMessage(
        model,
        recordId,
        newMessage,
        messageType,
        []
      );

      if (result) {
        // Clear the input and error message
        setNewMessage('');
        setAttachments([]);
        setError(null);

        // Show success message briefly
        setError('Message sent successfully!');
        setTimeout(() => {
          setError(null);
        }, 2000);

        // Refresh the message thread
        fetchData(true);
      } else {
        console.error('No result returned from postMessage (without attachments)');
        setError('Failed to send message. Please try again.');
      }
    } catch (err) {
      console.error('Error sending message without attachments:', err);
      setError('Failed to send message. Please try again.');
    } finally {
      setSendingMessage(false);
    }
  };

  // Toggle between message types (internal note vs external message)
  const toggleMessageType = () => {
    setMessageType(prevType => prevType === 'comment' ? 'notification' : 'comment');
  };

  // Handle message type tab selection
  const handleMessageTypeSelect = (type) => {
    setMessageType(type);
    // Focus the text input after a short delay to ensure the UI has updated
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 100);
  };

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      // Today - show time
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      // Yesterday
      return 'Yesterday';
    } else if (diffDays < 7) {
      // Within a week
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return days[date.getDay()];
    } else {
      // Older
      return date.toLocaleDateString();
    }
  };

  // Render a message item
  const renderMessageItem = ({ item }) => {
    // Check if it's a message or activity
    const isMessage = item.message_type !== undefined;

    if (isMessage) {
      // It's a message
      const authorName = item.author_id ? item.author_id[1] : (item.email_from || 'System');
      const date = formatDate(item.date);
      const isInternalNote = item.message_type === 'notification';
      const isAuditNote = item.tracking_value_ids && item.tracking_value_ids.length > 0;

      return (
        <View style={[
          styles.messageContainer,
          isInternalNote ? styles.internalNoteContainer : null,
          isAuditNote ? styles.auditNoteContainer : null
        ]}>
          <View style={styles.messageHeader}>
            <View style={styles.authorContainer}>
              <View style={[
                styles.avatarContainer,
                isInternalNote && !isAuditNote ? styles.internalNoteAvatar : null,
                isAuditNote ? styles.auditNoteAvatar : null
              ]}>
                <Image
                  source={defaultAvatar}
                  style={styles.avatar}
                />
              </View>
              <View style={styles.authorInfo}>
                <Text style={styles.authorName}>{authorName}</Text>
                {isInternalNote && !isAuditNote && (
                  <Text style={styles.internalNoteLabel}>Internal Note</Text>
                )}
                {isAuditNote && (
                  <Text style={styles.auditNoteLabel}>Audit Log</Text>
                )}
              </View>
            </View>
            <Text style={styles.messageDate}>{date}</Text>
          </View>

          <View style={styles.messageBody}>
            {item.body && item.body.trim() ? (
              <View style={styles.htmlContentWrapper}>
                <RenderHtml
                  contentWidth={screenWidth - 64} // Account for padding and margins
                  source={{ html: item.body }}
                  tagsStyles={{
                    body: { margin: 0, padding: 0 },
                    div: { margin: 0, padding: 0 },
                    span: { margin: 0, padding: 0 },
                    p: { margin: 0, padding: 0 },
                    a: { color: '#3498db' }
                  }}
                  defaultTextProps={{
                    style: { fontSize: 16, color: '#333' }
                  }}
                />
                {/* Add an empty space element to ensure minimum height */}
                <View style={{ height: 20 }} />
              </View>
            ) : (
              <Text style={styles.messageText}>No content</Text>
            )}
          </View>

          {item.attachment_ids && item.attachment_ids.length > 0 && (
            <View style={styles.messageAttachmentsContainer}>
              <Text style={styles.messageAttachmentsTitle}>
                {item.attachment_ids.length} Attachment{item.attachment_ids.length !== 1 ? 's' : ''}
              </Text>
              {(() => {
                // Extract attachments for this message
                const messageAttachments = item.attachment_ids
                  .map(attachmentId => {
                    // Convert to number if it's a string
                    const attId = typeof attachmentId === 'number' ? attachmentId : parseInt(attachmentId, 10);
                    return threadAttachments.find(att => att.id === attId);
                  })
                  .filter(attachment => attachment !== undefined);

                if (messageAttachments.length === 0) {
                  return (
                    <Text style={styles.noMessageAttachmentsText}>
                      Attachments are loading...
                    </Text>
                  );
                }

                return (
                  <View style={styles.messageAttachmentsWrapper}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {messageAttachments.map(attachment => (
                        <TouchableOpacity
                          key={`msg-att-${attachment.id}`}
                          style={styles.messageAttachmentItem}
                          onPress={() => openAttachment(attachment)}
                        >
                          {attachment.mimetype && attachment.mimetype.startsWith('image/') ? (
                            (() => {
                              // Skip SVG and other non-standard image types that might cause issues
                              const skipThumbnailTypes = ['image/svg+xml', 'image/svg', 'image/webp', 'image/tiff'];
                              if (skipThumbnailTypes.includes(attachment.mimetype)) {
                                return (
                                  <View style={styles.messageAttachmentIconContainer}>
                                    <Icon
                                      name={getFileIconName(attachment.mimetype)}
                                      size={24}
                                      color="#0073e6"
                                    />
                                  </View>
                                );
                              }

                              // For standard image types, use CachedImage
                              return (
                                <View style={styles.messageAttachmentImageContainer}>
                                  <CachedImage
                                    attachmentId={attachment.id}
                                    size="128x128"
                                    style={styles.messageAttachmentThumbnail}
                                    contentFit="cover"
                                    attachmentInfo={attachment} // Pass the full attachment info
                                    onError={(e) => {
                                      console.log(`Image load error for ${attachment.name}: ${e || 'Unknown error'}`);
                                    }}
                                  />
                                </View>
                              );
                            })()
                          ) : (
                            <View style={styles.messageAttachmentIconContainer}>
                              <Icon
                                name={getFileIconName(attachment.mimetype)}
                                size={24}
                                color="#0073e6"
                              />
                            </View>
                          )}
                          <Text style={styles.messageAttachmentName} numberOfLines={1}>
                            {attachment.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                );
              })()}
            </View>
          )}
        </View>
      );
    } else {
      // It's an activity
      const userName = item.user_id ? item.user_id[1] : 'Someone';
      const activityType = item.activity_type_id ? item.activity_type_id[1] : 'Activity';
      const date = formatDate(item.create_date);
      const deadline = new Date(item.date_deadline).toLocaleDateString();

      return (
        <View style={styles.activityContainer}>
          <View style={styles.activityHeader}>
            <View style={styles.activityIconContainer}>
              <Icon name="calendar-clock" size={16} color="#fff" />
            </View>
            <Text style={styles.activityTitle}>{activityType}</Text>
            <Text style={styles.activityDate}>{date}</Text>
          </View>

          <View style={styles.activityBody}>
            <Text style={styles.activitySummary}>{item.summary || activityType}</Text>
            {item.note && (
              <Text style={styles.activityNote}>{item.note}</Text>
            )}
            <View style={styles.activityMeta}>
              <Text style={styles.activityAssignee}>Assigned to: {userName}</Text>
              <Text style={styles.activityDeadline}>Due: {deadline}</Text>
            </View>
          </View>
        </View>
      );
    }
  };

  // Handle input focus
  const handleInputFocus = () => {
    setInputFocused(true);

    // On iOS, scroll to ensure the input is visible above the keyboard
    if (Platform.OS === 'ios') {
      setTimeout(() => {
        if (flatListRef.current) {
          try {
            // Since the list is inverted, scrollToEnd actually goes to the top
            // where the newest messages are
            flatListRef.current.scrollToOffset({ offset: 0, animated: true });

            // Add extra padding to the bottom of the list when keyboard is shown
            // This helps prevent the keyboard from covering the input
            flatListRef.current.setNativeProps({
              contentContainerStyle: {
                paddingBottom: 120, // Extra padding when keyboard is shown
              },
            });
          } catch (error) {
            console.log('Error adjusting scroll for keyboard:', error);
          }
        }
      }, 300);
    }
  };

  // Handle input blur
  const handleInputBlur = () => {
    setInputFocused(false);

    // Reset padding when keyboard is dismissed
    if (Platform.OS === 'ios' && flatListRef.current) {
      try {
        // Reset to normal padding
        flatListRef.current.setNativeProps({
          contentContainerStyle: {
            paddingBottom: Platform.OS === 'ios' ? 60 : 40,
          },
        });
      } catch (error) {
        console.log('Error resetting padding:', error);
      }
    }
  };

  // Create a ref for the FlatList
  const flatListRef = useRef(null);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    if (flatListRef.current && timelineItems.length > 0) {
      flatListRef.current.scrollToOffset({ offset: 0, animated: true });
    }
  };

  // Scroll to bottom when new messages are loaded
  useEffect(() => {
    if (timelineItems.length > 0 && !loading) {
      // Small delay to ensure the list is rendered
      setTimeout(scrollToBottom, 300);
    }
  }, [timelineItems.length, loading]);

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Messages & Activities</Text>
        </View>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={handleRefresh}
          disabled={refreshing}
        >
          <Icon name="refresh" size={20} color="#3498db" />
        </TouchableOpacity>
      </View>

      {/* Attachments List */}
      {showAttachments && (
        <View style={styles.attachmentsListContainer}>
          <AttachmentsList
            attachments={threadAttachments}
            onPress={openAttachment}
            loading={loadingAttachments}
            style={{ backgroundColor: '#fff' }}
          />
        </View>
      )}

      {error && (
        <View style={[
          styles.errorContainer,
          error.includes('successfully') ? styles.successContainer : null
        ]}>
          <Text style={[
            styles.errorText,
            error.includes('successfully') ? styles.successText : null,
            error.includes('Uploading') || error.includes('Sending') ? styles.infoText : null
          ]}>
            {error}
          </Text>
        </View>
      )}

      {loading && !refreshing && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3498db" />
          <Text style={styles.loadingText}>Loading messages...</Text>
        </View>
      )}

      {/* Main content area with messages */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingContainer}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 160 : 120}
        enabled
      >
        <View style={styles.contentContainer}>
          {/* Use FlatList as the main container to avoid nesting VirtualizedLists */}
          <FlatList
            ref={flatListRef}
            data={timelineItems}
            renderItem={renderMessageItem}
            keyExtractor={(item) => (item.id ? `${item.id}-${item.date || item.create_date}` : `temp-${Date.now()}`)}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: Platform.OS === 'ios' ? 60 : 40 } // Add padding to ensure content isn't hidden behind keyboard
            ]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={['#3498db']}
                tintColor="#3498db"
              />
            }
            ListEmptyComponent={
              !loading && (
                <View style={styles.emptyContainer}>
                  <Icon name="message-text-outline" size={48} color="#ccc" />
                  <Text style={styles.emptyText}>No messages yet</Text>
                  <Text style={styles.emptySubtext}>Start the conversation by sending a message</Text>
                </View>
              )
            }
            // Prevent nesting VirtualizedList warning
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            windowSize={10}
            initialNumToRender={10}
            updateCellsBatchingPeriod={50}
            inverted={true} // Invert the list so newest messages are at the bottom
            ItemSeparatorComponent={() => <View style={{ height: 4 }} />} // Add small separator between items
          />
        </View>

        {/* Bottom Input Area - Google Chat Style */}
        <View style={styles.bottomInputArea}>
          {/* Message Type Toggle Bar - Above the input */}
          <View style={styles.messageTypeBar}>
            <TouchableOpacity
              style={[
                styles.messageTypeTab,
                messageType === 'comment' && styles.activeMessageTypeTab,
                { flex: 1 }
              ]}
              onPress={() => handleMessageTypeSelect('comment')}
            >
              <Icon name="email-outline" size={16} color={messageType === 'comment' ? '#4285F4' : '#5F6368'} />
              <Text style={[
                styles.messageTypeText,
                messageType === 'comment' && styles.activeMessageTypeText
              ]}>
                Message
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.messageTypeTab,
                messageType === 'notification' && styles.activeNoteTypeTab,
                { flex: 1 }
              ]}
              onPress={() => handleMessageTypeSelect('notification')}
            >
              <Icon name="note-text-outline" size={16} color={messageType === 'notification' ? '#4285F4' : '#5F6368'} />
              <Text style={[
                styles.messageTypeText,
                messageType === 'notification' && styles.activeNoteTypeText
              ]}>
                Note
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.messageTypeTab,
                styles.attachmentsTab
              ]}
              onPress={() => {
                // Use custom navigation handler if provided, otherwise use default
                if (props.onNavigateToAttachments) {
                  props.onNavigateToAttachments();
                } else {
                  // Default navigation for contacts
                  console.log('Navigating to Attachments with:', { recordId, recordName });
                  navigation.navigate('Attachments', {
                    partnerId: parseInt(recordId, 10),
                    partnerName: recordName || 'Contact'
                  });
                }
              }}
            >
              <Icon name="paperclip" size={16} color="#5F6368" />
              <Text style={styles.messageTypeText}>
                Attachments
              </Text>
            </TouchableOpacity>
          </View>

          {/* Selected Attachments Preview */}
          {attachments.length > 0 && (
            <View style={styles.selectedAttachmentsContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {attachments.map(attachment => (
                  <View key={attachment.id} style={styles.attachmentPreview}>
                    <TouchableOpacity onPress={() => viewImage(attachment.uri)}>
                      <Image
                        source={{ uri: attachment.uri }}
                        style={styles.attachmentImage}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.removeAttachmentButton}
                      onPress={() => removeAttachment(attachment.id)}
                    >
                      <Icon name="close-circle" size={20} color="#E54545" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Input Container - Google Chat Style */}
          <View style={styles.googleInputContainer}>
            {/* Left side buttons */}
            <TouchableOpacity
              style={styles.googleInputButton}
              onPress={handleShowAttachmentPicker}
            >
              <Icon name="plus-circle-outline" size={24} color="#5F6368" />
            </TouchableOpacity>

            {/* Input wrapper */}
            <View style={styles.googleInputWrapper}>
              <TextInput
                ref={inputRef}
                value={newMessage}
                onChangeText={setNewMessage}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
                placeholder={`${messageType === 'comment' ? 'Message' : 'Note'} ${recordName || ''}...`}
                placeholderTextColor="#5F6368"
                multiline={true}
                style={styles.googleTextInput}
              />
            </View>

            {/* Right side buttons */}
            <TouchableOpacity
              style={styles.googleInputButton}
              onPress={handleShowAttachmentPicker}
            >
              <Icon name="paperclip" size={24} color="#5F6368" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.googleSendButton,
                (newMessage.trim() || attachments.length > 0) && styles.googleSendButtonActive
              ]}
              onPress={handleSendMessage}
              disabled={(!newMessage.trim() && attachments.length === 0) || sendingMessage}
            >
              {sendingMessage ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Icon name="send" size={20} color={(newMessage.trim() || attachments.length > 0) ? "#fff" : "#5F6368"} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Attachment Picker Modal */}
      <AttachmentPicker
        visible={attachmentPickerVisible}
        onClose={() => setAttachmentPickerVisible(false)}
        onAttachmentSelected={handleAttachmentSelected}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  keyboardAvoidingContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  },
  bottomInputArea: {
    backgroundColor: '#fff', // White background like Google Chat
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    width: '100%',
    position: 'relative',
    zIndex: 10, // Ensure it stays above content
    elevation: 3, // Android elevation
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  headerTitleContainer: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  refreshButton: {
    padding: 4,
  },
  attachmentsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  attachmentsButtonText: {
    fontSize: 12,
    color: '#3498db',
    marginLeft: 4,
  },
  attachmentsListContainer: {
    backgroundColor: '#f9f9f9',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    maxHeight: 250,
    paddingVertical: 8,
  },
  attachmentsList: {
    padding: 8,
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
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 6,
    marginHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  attachmentIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 4,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  attachmentDetails: {
    flex: 1,
  },
  attachmentName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  attachmentInfo: {
    fontSize: 12,
    color: '#999',
  },
  noAttachmentsText: {
    padding: 16,
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 0, // Remove bottom padding to fix the large blank space
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 14,
  },
  errorContainer: {
    padding: 12,
    backgroundColor: '#ffebee',
    borderRadius: 4,
    margin: 16,
  },
  successContainer: {
    backgroundColor: '#e8f5e9',
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 14,
    textAlign: 'center',
  },
  successText: {
    color: '#2e7d32',
  },
  infoText: {
    color: '#0277bd',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  messageContainer: {
    backgroundColor: '#e8f5e9', // Light green background for messages (Odoo style)
    borderRadius: 12,
    padding: 16,
    paddingBottom: 12, // Slightly less padding at bottom
    marginBottom: 8, // Reduced margin between messages
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minHeight: 80, // Ensure minimum height for the container
  },
  internalNoteContainer: {
    backgroundColor: '#e3f2fd', // Light blue background like iMessage
    borderWidth: 1,
    borderColor: '#bbdefb',
  },
  auditNoteContainer: {
    backgroundColor: '#f3e5f5', // Light purple background for audit messages
    borderWidth: 1,
    borderColor: '#e1bee7',
  },
  auditNoteAvatar: {
    backgroundColor: '#9c27b0', // Purple color for audit notes
  },
  auditNoteLabel: {
    fontSize: 11,
    color: '#7b1fa2', // Darker purple for audit label
    fontWeight: '500',
    marginTop: 1,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  authorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  authorInfo: {
    flexDirection: 'column',
    flex: 1,
  },
  avatarContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    marginRight: 10,
    backgroundColor: '#00a09d', // Odoo green-blue color
  },
  internalNoteAvatar: {
    backgroundColor: '#2196f3', // Blue color for notes to match iMessage
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  authorName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 2,
  },
  internalNoteLabel: {
    fontSize: 11,
    color: '#1976d2', // Darker blue for note label
    fontWeight: '500',
    marginTop: 1,
  },
  messageDate: {
    fontSize: 12,
    color: '#9e9e9e',
    marginLeft: 8,
    marginTop: 2,
  },
  messageBody: {
    marginBottom: 0,
    marginLeft: 0,
    minHeight: 20, // Ensure there's always some height
  },
  htmlContentWrapper: {
    minHeight: 40,
    width: '100%',
    paddingBottom: 10,
  },
  messageText: {
    fontSize: 15,
    color: '#424242',
    lineHeight: 22,
  },
  messageAttachmentsContainer: {
    backgroundColor: '#f5f5f5',
    padding: 8,
    borderRadius: 4,
    marginTop: 8,
  },
  messageAttachmentsTitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  messageAttachmentsWrapper: {
    marginTop: 4,
  },
  noMessageAttachmentsText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 8,
  },
  messageAttachmentsScroll: {
    flexDirection: 'row',
  },
  messageAttachmentItem: {
    width: 100,
    marginRight: 8,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    alignItems: 'center',
  },
  messageAttachmentImageContainer: {
    width: 70,
    height: 70,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
    backgroundColor: '#f0f0f0',
  },
  messageAttachmentThumbnail: {
    width: '100%',
    height: '100%',
  },
  messageAttachmentIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 4,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  messageAttachmentName: {
    fontSize: 11,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
  },
  activityContainer: {
    backgroundColor: '#f1f8e9', // Light green background for activities
    borderRadius: 12,
    padding: 16,
    marginBottom: 8, // Reduced margin between activities
    borderLeftWidth: 3,
    borderLeftColor: '#7cb342', // Odoo activity green
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  activityIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#7cb342', // Odoo activity green
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  activityDate: {
    fontSize: 12,
    color: '#999',
  },
  activityBody: {
    marginLeft: 32,
  },
  activitySummary: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  activityNote: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  activityMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  activityAssignee: {
    fontSize: 12,
    color: '#666',
  },
  activityDeadline: {
    fontSize: 12,
    color: '#e74c3c',
  },
  contentContainer: {
    flex: 1,
    position: 'relative',
    paddingBottom: Platform.OS === 'ios' ? 20 : 10, // Add a small padding to help with keyboard
  },
  inputContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    // Ensure the input container is always on top
    zIndex: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    // Position at the bottom but not absolute to work with KeyboardAvoidingView
    width: '100%',
  },
  messageTypeBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  messageTypeTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    borderRadius: 4,
  },
  activeMessageTypeTab: {
    borderBottomColor: '#4285F4', // Google blue for messages
    backgroundColor: '#F1F3F4',
  },
  activeNoteTypeTab: {
    borderBottomColor: '#4285F4', // Google blue for notes
    backgroundColor: '#F1F3F4',
  },
  messageTypeText: {
    fontSize: 14,
    color: '#5F6368', // Google gray text
    marginLeft: 6,
    fontWeight: '500',
  },
  activeMessageTypeText: {
    color: '#4285F4', // Google blue for messages
  },
  activeNoteTypeText: {
    color: '#4285F4', // Google blue for notes
  },
  attachmentsTab: {
    backgroundColor: '#F1F3F4',
  },
  // Google Chat style input container
  googleInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  googleInputButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2,
    borderRadius: 20,
  },
  googleInputWrapper: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: '#F1F3F4', // Light gray background
    borderRadius: 24,
    paddingHorizontal: 4,
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  googleTextInput: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
    color: '#202124', // Google dark text color
    fontSize: 16,
    padding: 10,
    minHeight: 40,
    maxHeight: 120,
    textAlignVertical: 'center',
  },
  googleSendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F3F4', // Light gray when inactive
  },
  googleSendButtonActive: {
    backgroundColor: '#4285F4', // Google blue for active send button
  },
  selectedAttachmentsContainer: {
    backgroundColor: '#fff',
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    marginBottom: 8,
  },
  attachmentPreview: {
    width: 70,
    height: 70,
    borderRadius: 8,
    marginRight: 8,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#f5f5f5',
  },
  attachmentImage: {
    width: '100%',
    height: '100%',
  },
  removeAttachmentButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    padding: 2,
  },

  formattingToolbar: {
    backgroundColor: '#f0f0f0',
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    flexDirection: 'row',
  },
  formattingButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
});

export default MessageThread;
