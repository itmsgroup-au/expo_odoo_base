// Discuss Chat Screen Component

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Alert,
  Image,
  Dimensions,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import RenderHtml from 'react-native-render-html';

import discussAPI from '../../../api/models/discussApi';
import { mailMessageAPI } from '../../../api/models/mailMessageApi';
import AttachmentPicker from '../../../components/AttachmentPicker';
import { getUser } from '../../../api/odooClient';

const { width: screenWidth } = Dimensions.get('window');

const DiscussChatScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();

  // Get channel info from route params
  const { channelId, channelName, channelType } = route.params || {};

  // State
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [attachmentPickerVisible, setAttachmentPickerVisible] = useState(false);
  const [selectedAttachments, setSelectedAttachments] = useState([]);
  const [error, setError] = useState(null);

  // Refs
  const flatListRef = useRef(null);
  const inputRef = useRef(null);

  // Set screen title and header
  useEffect(() => {
    navigation.setOptions({
      title: channelName || 'Chat',
      headerRight: () => (
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => {
            Alert.alert(
              'Channel Info',
              `Channel: ${channelName}\nType: ${channelType || 'channel'}\nID: ${channelId}`,
              [{ text: 'OK' }]
            );
          }}
        >
          <Icon name="information-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, channelId, channelName, channelType]);

  // Get current user
  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        const user = await getUser();
        setCurrentUser(user);
      } catch (error) {
        console.error('Error getting current user:', error);
      }
    };
    getCurrentUser();
  }, []);

  // Fetch messages
  const fetchMessages = useCallback(async (forceRefresh = false) => {
    if (!channelId) return;

    try {
      setLoading(!forceRefresh);
      setError(null);

      const channelMessages = await discussAPI.getChannelMessages(channelId, forceRefresh);
      setMessages(channelMessages || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
      setError('Failed to load messages. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [channelId]);

  // Initial load and focus refresh
  useFocusEffect(
    useCallback(() => {
      fetchMessages();
    }, [fetchMessages])
  );

  // Handle refresh
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchMessages(true);
  }, [fetchMessages]);

  // Handle send message
  const handleSendMessage = async () => {
    if ((!newMessage.trim() && selectedAttachments.length === 0) || sendingMessage) {
      return;
    }

    try {
      setSendingMessage(true);
      setError(null);

      // Upload attachments first if any
      let attachmentIds = [];
      if (selectedAttachments.length > 0) {
        try {
          setError('Uploading attachments...');

          for (const attachment of selectedAttachments) {
            const attachmentId = await mailMessageAPI.uploadAttachment(
              {
                uri: attachment.uri,
                type: attachment.type || 'image/jpeg',
                name: attachment.name,
                base64: attachment.base64,
                size: attachment.size
              },
              'mail.channel',
              channelId
            );

            if (attachmentId) {
              attachmentIds.push(attachmentId);
            }
          }

          setError(null);
        } catch (uploadError) {
          console.error('Error uploading attachments:', uploadError);
          setError('Failed to upload attachments.');
          setSendingMessage(false);
          return;
        }
      }

      // Send the message
      setError('Sending message...');
      const result = await discussAPI.sendChannelMessage(
        channelId,
        newMessage.trim(),
        attachmentIds
      );

      if (result) {
        // Clear input and attachments
        setNewMessage('');
        setSelectedAttachments([]);
        setError(null);

        // Show success briefly
        setError('Message sent!');
        setTimeout(() => setError(null), 2000);

        // Refresh messages
        fetchMessages(true);

        // Scroll to bottom
        setTimeout(() => {
          if (flatListRef.current) {
            flatListRef.current.scrollToOffset({ offset: 0, animated: true });
          }
        }, 500);
      } else {
        setError('Failed to send message. Please try again.');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message. Please try again.');
    } finally {
      setSendingMessage(false);
    }
  };

  // Handle attachment selection
  const handleAttachmentSelected = (attachment) => {
    setSelectedAttachments(prev => [...prev, attachment]);
  };

  // Remove attachment
  const removeAttachment = (attachmentId) => {
    setSelectedAttachments(prev =>
      prev.filter(attachment => attachment.id !== attachmentId)
    );
  };

  // Render message item
  const renderMessage = ({ item }) => {
    const isOwnMessage = currentUser && item.author_id && item.author_id[0] === currentUser.id;

    return (
      <View style={[
        styles.messageContainer,
        isOwnMessage ? styles.ownMessage : styles.otherMessage
      ]}>
        {!isOwnMessage && (
          <View style={styles.messageHeader}>
            <View style={styles.avatarContainer}>
              <Icon name="account-circle" size={24} color="#666" />
            </View>
            <View style={styles.authorInfo}>
              <Text style={styles.authorName}>{item.authorName}</Text>
              <Text style={styles.messageTime}>{item.displayDate}</Text>
            </View>
          </View>
        )}

        <View style={[
          styles.messageBubble,
          isOwnMessage ? styles.ownMessageBubble : styles.otherMessageBubble
        ]}>
          {item.body && item.body.trim() ? (
            <RenderHtml
              contentWidth={screenWidth * 0.7}
              source={{ html: item.body }}
              tagsStyles={{
                body: { margin: 0, color: isOwnMessage ? '#fff' : '#333' },
                p: { margin: 0, color: isOwnMessage ? '#fff' : '#333' },
              }}
            />
          ) : item.cleanBody ? (
            <Text style={[
              styles.messageText,
              { color: isOwnMessage ? '#fff' : '#333' }
            ]}>
              {item.cleanBody}
            </Text>
          ) : (
            <Text style={[
              styles.messageText,
              { color: isOwnMessage ? '#fff' : '#333', fontStyle: 'italic' }
            ]}>
              No content
            </Text>
          )}

          {/* Show attachments if any */}
          {item.attachmentCount > 0 && (
            <View style={styles.attachmentIndicator}>
              <Icon name="paperclip" size={14} color={isOwnMessage ? '#fff' : '#666'} />
              <Text style={[
                styles.attachmentText,
                { color: isOwnMessage ? '#fff' : '#666' }
              ]}>
                {item.attachmentCount} attachment{item.attachmentCount !== 1 ? 's' : ''}
              </Text>
            </View>
          )}
        </View>

        {isOwnMessage && (
          <Text style={styles.ownMessageTime}>{item.displayDate}</Text>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Error/Status Bar */}
      {error && (
        <View style={[
          styles.statusBar,
          error.includes('sent') || error.includes('Sending') || error.includes('Uploading')
            ? styles.infoBar
            : styles.errorBar
        ]}>
          <Text style={[
            styles.statusText,
            error.includes('sent') || error.includes('Sending') || error.includes('Uploading')
              ? styles.infoText
              : styles.errorText
          ]}>
            {error}
          </Text>
        </View>
      )}

      {/* Messages List */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading messages...</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => `message-${item.id}`}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          inverted={true} // Show newest messages at bottom
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#007AFF']}
              tintColor="#007AFF"
            />
          }
          ListEmptyComponent={
            !loading && (
              <View style={styles.emptyContainer}>
                <Icon name="chat-outline" size={48} color="#ccc" />
                <Text style={styles.emptyText}>No messages yet</Text>
                <Text style={styles.emptySubtext}>Start the conversation!</Text>
              </View>
            )
          }
        />
      )}

      {/* Selected Attachments Preview */}
      {selectedAttachments.length > 0 && (
        <View style={styles.attachmentsPreview}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {selectedAttachments.map((attachment, index) => (
              <View key={`attachment-${index}`} style={styles.attachmentPreviewItem}>
                <Image
                  source={{ uri: attachment.uri }}
                  style={styles.attachmentPreviewImage}
                />
                <TouchableOpacity
                  style={styles.removeAttachmentButton}
                  onPress={() => removeAttachment(attachment.id)}
                >
                  <Icon name="close-circle" size={20} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Input Area */}
      <View style={styles.inputContainer}>
        <TouchableOpacity
          style={styles.attachmentButton}
          onPress={() => setAttachmentPickerVisible(true)}
        >
          <Icon name="plus-circle-outline" size={24} color="#007AFF" />
        </TouchableOpacity>

        <View style={styles.inputWrapper}>
          <TextInput
            ref={inputRef}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder={`Message ${channelName || 'channel'}...`}
            style={styles.textInput}
            multiline={true}
            maxHeight={100}
          />
        </View>

        <TouchableOpacity
          style={[
            styles.sendButton,
            (newMessage.trim() || selectedAttachments.length > 0) && !sendingMessage
              ? styles.sendButtonActive
              : styles.sendButtonInactive
          ]}
          onPress={handleSendMessage}
          disabled={(!newMessage.trim() && selectedAttachments.length === 0) || sendingMessage}
        >
          {sendingMessage ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Icon
              name="send"
              size={20}
              color={(newMessage.trim() || selectedAttachments.length > 0) ? "#fff" : "#999"}
            />
          )}
        </TouchableOpacity>
      </View>

      {/* Attachment Picker Modal */}
      <AttachmentPicker
        visible={attachmentPickerVisible}
        onClose={() => setAttachmentPickerVisible(false)}
        onAttachmentSelected={handleAttachmentSelected}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  headerButton: {
    padding: 8,
  },
  statusBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  errorBar: {
    backgroundColor: '#ffebee',
    borderBottomColor: '#ffcdd2',
  },
  infoBar: {
    backgroundColor: '#e3f2fd',
    borderBottomColor: '#bbdefb',
  },
  statusText: {
    fontSize: 14,
    textAlign: 'center',
  },
  errorText: {
    color: '#d32f2f',
  },
  infoText: {
    color: '#1976d2',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingVertical: 8,
  },
  messageContainer: {
    marginHorizontal: 16,
    marginVertical: 4,
  },
  ownMessage: {
    alignItems: 'flex-end',
  },
  otherMessage: {
    alignItems: 'flex-start',
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  avatarContainer: {
    width: 24,
    height: 24,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  authorInfo: {
    flex: 1,
  },
  authorName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  messageTime: {
    fontSize: 10,
    color: '#999',
  },
  messageBubble: {
    maxWidth: screenWidth * 0.8,
    padding: 12,
    borderRadius: 16,
    marginVertical: 2,
  },
  ownMessageBubble: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: '#e5e5ea',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  attachmentIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  attachmentText: {
    fontSize: 12,
    marginLeft: 4,
  },
  ownMessageTime: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
    marginRight: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    minHeight: 300,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  attachmentsPreview: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  attachmentPreviewItem: {
    width: 60,
    height: 60,
    marginRight: 8,
    position: 'relative',
  },
  attachmentPreviewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  removeAttachmentButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  attachmentButton: {
    padding: 8,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 8,
    maxHeight: 100,
  },
  textInput: {
    fontSize: 16,
    color: '#333',
    minHeight: 20,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonActive: {
    backgroundColor: '#007AFF',
  },
  sendButtonInactive: {
    backgroundColor: '#f0f0f0',
  },
});

export default DiscussChatScreen;
