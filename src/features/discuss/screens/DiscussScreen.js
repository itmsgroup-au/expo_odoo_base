// Main Discuss Screen - Channel List

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
  Image,
  TextInput,
  Modal,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import discussAPI from '../../../api/models/discussApi';
import { getUser } from '../../../api/odooClient';

const DiscussScreen = () => {
  const navigation = useNavigation();

  // State
  const [channels, setChannels] = useState([]);
  const [directMessages, setDirectMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedTab, setSelectedTab] = useState('channels'); // 'channels' or 'direct'
  const [createChannelModalVisible, setCreateChannelModalVisible] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDescription, setNewChannelDescription] = useState('');
  const [creatingChannel, setCreatingChannel] = useState(false);

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

  // Fetch data
  const fetchData = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(!forceRefresh);

      // Fetch channels and direct messages in parallel
      const [channelsData, directMessagesData] = await Promise.all([
        discussAPI.getChannels(forceRefresh),
        discussAPI.getDirectMessages(forceRefresh)
      ]);

      setChannels(channelsData || []);
      setDirectMessages(directMessagesData || []);
    } catch (error) {
      console.error('Error fetching discuss data:', error);
      Alert.alert('Error', 'Failed to load channels. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load and focus refresh
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  // Handle refresh
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData(true);
  }, [fetchData]);

  // Navigate to chat screen
  const navigateToChat = (channel) => {
    navigation.navigate('DiscussChat', {
      channelId: channel.id,
      channelName: channel.displayName || channel.name,
      channelType: channel.channel_type || 'channel',
    });
  };

  // Handle create channel
  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) {
      Alert.alert('Error', 'Please enter a channel name.');
      return;
    }

    try {
      setCreatingChannel(true);

      const channelId = await discussAPI.createChannel(
        newChannelName.trim(),
        newChannelDescription.trim(),
        'channel',
        [],
        true
      );

      if (channelId) {
        setCreateChannelModalVisible(false);
        setNewChannelName('');
        setNewChannelDescription('');

        // Refresh data
        fetchData(true);

        // Navigate to the new channel
        setTimeout(() => {
          navigation.navigate('DiscussChat', {
            channelId: channelId,
            channelName: newChannelName.trim(),
            channelType: 'channel',
          });
        }, 500);
      } else {
        Alert.alert('Error', 'Failed to create channel. Please try again.');
      }
    } catch (error) {
      console.error('Error creating channel:', error);
      Alert.alert('Error', 'Failed to create channel. Please try again.');
    } finally {
      setCreatingChannel(false);
    }
  };

  // Render channel item
  const renderChannelItem = ({ item }) => {
    const isDirectMessage = item.channel_type === 'chat' || item.isDirectMessage;

    return (
      <TouchableOpacity
        style={styles.channelItem}
        onPress={() => navigateToChat(item)}
      >
        <View style={styles.channelIcon}>
          {isDirectMessage ? (
            <View style={[styles.channelIconContainer, styles.directMessageIcon]}>
              <Icon name="account" size={20} color="#fff" />
            </View>
          ) : (
            <View style={[styles.channelIconContainer,
              item.public === 'public' ? styles.publicChannel : styles.privateChannel
            ]}>
              <Icon
                name={item.public === 'public' ? 'pound' : 'lock'}
                size={20}
                color="#fff"
              />
            </View>
          )}
        </View>

        <View style={styles.channelInfo}>
          <View style={styles.channelHeader}>
            <Text style={styles.channelName} numberOfLines={1}>
              {item.displayName || item.name || `Channel ${item.id}`}
            </Text>
            {item.hasUnread && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>•</Text>
              </View>
            )}
          </View>

          <Text style={styles.channelSubtitle} numberOfLines={1}>
            {item.subtitle || item.description || `${item.memberCount || 0} members`}
          </Text>

          {item.lastActivity && (
            <Text style={styles.lastActivity}>
              {formatLastActivity(item.lastActivity)}
            </Text>
          )}
        </View>

        <Icon name="chevron-right" size={20} color="#ccc" />
      </TouchableOpacity>
    );
  };

  // Format last activity time
  const formatLastActivity = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) {
      return 'now';
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  // Get current data based on selected tab
  const getCurrentData = () => {
    return selectedTab === 'channels' ? channels : directMessages;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Discuss</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setCreateChannelModalVisible(true)}
          >
            <Icon name="plus" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[
            styles.tab,
            selectedTab === 'channels' && styles.activeTab
          ]}
          onPress={() => setSelectedTab('channels')}
        >
          <Icon
            name="pound"
            size={20}
            color={selectedTab === 'channels' ? '#007AFF' : '#666'}
          />
          <Text style={[
            styles.tabText,
            selectedTab === 'channels' && styles.activeTabText
          ]}>
            Channels
          </Text>
          {channels.length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{channels.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            selectedTab === 'direct' && styles.activeTab
          ]}
          onPress={() => setSelectedTab('direct')}
        >
          <Icon
            name="message-text"
            size={20}
            color={selectedTab === 'direct' ? '#007AFF' : '#666'}
          />
          <Text style={[
            styles.tabText,
            selectedTab === 'direct' && styles.activeTabText
          ]}>
            Direct Messages
          </Text>
          {directMessages.length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{directMessages.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : (
        <FlatList
          data={getCurrentData()}
          renderItem={renderChannelItem}
          keyExtractor={(item) => `${selectedTab}-${item.id}`}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#007AFF']}
              tintColor="#007AFF"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon
                name={selectedTab === 'channels' ? 'pound' : 'message-text'}
                size={48}
                color="#ccc"
              />
              <Text style={styles.emptyText}>
                {selectedTab === 'channels' ? 'No channels found' : 'No direct messages'}
              </Text>
              <Text style={styles.emptySubtext}>
                {selectedTab === 'channels'
                  ? 'Create a channel to start collaborating'
                  : 'Start a conversation with someone'
                }
              </Text>
            </View>
          }
        />
      )}

      {/* Create Channel Modal */}
      <Modal
        visible={createChannelModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCreateChannelModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setCreateChannelModalVisible(false)}
            >
              <Text style={styles.modalCancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>New Channel</Text>
            <TouchableOpacity
              onPress={handleCreateChannel}
              disabled={!newChannelName.trim() || creatingChannel}
            >
              {creatingChannel ? (
                <ActivityIndicator size="small" color="#007AFF" />
              ) : (
                <Text style={[
                  styles.modalCreateButton,
                  !newChannelName.trim() && styles.modalCreateButtonDisabled
                ]}>
                  Create
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Channel Name</Text>
              <TextInput
                style={styles.textInput}
                value={newChannelName}
                onChangeText={setNewChannelName}
                placeholder="e.g. general, marketing, development"
                autoFocus={true}
                maxLength={50}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description (Optional)</Text>
              <TextInput
                style={[styles.textInput, styles.multilineInput]}
                value={newChannelDescription}
                onChangeText={setNewChannelDescription}
                placeholder="What's this channel about?"
                multiline={true}
                maxLength={200}
              />
            </View>

            <View style={styles.infoBox}>
              <Icon name="information-outline" size={16} color="#666" />
              <Text style={styles.infoText}>
                Channels are open to everyone in your organization by default.
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerButton: {
    padding: 8,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 16,
    color: '#666',
    marginLeft: 8,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  tabBadge: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
    minWidth: 20,
    alignItems: 'center',
  },
  tabBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
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
  list: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 8,
  },
  channelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  channelIcon: {
    marginRight: 12,
  },
  directMessageIcon: {
    backgroundColor: '#28a745',
  },
  channelIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  publicChannel: {
    backgroundColor: '#007AFF',
  },
  privateChannel: {
    backgroundColor: '#666',
  },
  channelInfo: {
    flex: 1,
  },
  channelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  channelName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  unreadBadge: {
    marginLeft: 8,
  },
  unreadText: {
    fontSize: 20,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  channelSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  lastActivity: {
    fontSize: 12,
    color: '#999',
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
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalCancelButton: {
    fontSize: 16,
    color: '#007AFF',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalCreateButton: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  modalCreateButtonDisabled: {
    color: '#ccc',
  },
  modalContent: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
  },
  multilineInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginTop: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    flex: 1,
    lineHeight: 20,
  },
});

export default DiscussScreen;
