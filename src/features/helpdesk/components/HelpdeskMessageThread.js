import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../../contexts/ThemeContext';
import { mailMessageAPI } from '../../../api/models/mailMessageApi';
import { mailActivityAPI } from '../../../api/models/mailActivityApi';
import MessageDetailModal from './MessageDetailModal';
import defaultAvatar from '../../../assets/images/default_avatar.png';

/**
 * A simplified message thread component for helpdesk tickets that avoids complex rendering issues.
 *
 * @param {Object} props - Component props
 * @param {string} props.model - The model name (e.g., 'helpdesk.ticket')
 * @param {number|string} props.recordId - The record ID
 * @param {string} props.recordName - The record name
 */
const HelpdeskMessageThread = ({ model, recordId, recordName, ...props }) => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const [messages, setMessages] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('activity'); // 'activity' or 'audit'

  // Separate messages into activity and audit log
  const getActivityMessages = () => {
    return [...messages, ...activities]
      .filter(item => {
        // Activity includes: regular messages, stage changes, assignments, etc.
        if (item.message_type === 'comment' || item.message_type === 'email') return true;
        if (item.activity_type_id) return true;
        if (item.tracking_value_ids && item.tracking_value_ids.length > 0) return true;
        return false;
      })
      .sort((a, b) => {
        const dateA = a.date || a.create_date;
        const dateB = b.date || b.create_date;
        return new Date(dateB) - new Date(dateA);
      });
  };

  const getAuditLogMessages = () => {
    return [...messages, ...activities]
      .filter(item => {
        // Audit log includes: system notifications, internal notes, automated actions
        if (item.message_type === 'notification') return true;
        if (item.subtype_id && item.subtype_id[1] && item.subtype_id[1].includes('note')) return true;
        if (item.is_internal) return true;
        return false;
      })
      .sort((a, b) => {
        const dateA = a.date || a.create_date;
        const dateB = b.date || b.create_date;
        return new Date(dateB) - new Date(dateA);
      });
  };

  // Get current tab's messages
  const getCurrentMessages = () => {
    return activeTab === 'activity' ? getActivityMessages() : getAuditLogMessages();
  };

  // Format tracking value changes like Odoo
  const formatTrackingChanges = (trackingValues) => {
    if (!trackingValues || trackingValues.length === 0) return null;

    return trackingValues.map(tracking => {
      const fieldName = tracking.field_desc || tracking.field;
      const oldValue = tracking.old_value_text || tracking.old_value || '';
      const newValue = tracking.new_value_text || tracking.new_value || '';

      if (oldValue && newValue) {
        return `${fieldName}: ${oldValue} → ${newValue}`;
      } else if (newValue) {
        return `${fieldName}: ${newValue}`;
      } else if (oldValue) {
        return `${fieldName}: ${oldValue} (removed)`;
      }
      return `${fieldName} changed`;
    }).join('\n');
  };

  // Fetch messages and activities
  const fetchData = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);

      // Fetch messages
      const messagesData = await mailMessageAPI.getMessagesForRecord(model, recordId, forceRefresh);
      setMessages(messagesData || []);

      // Fetch activities
      const activitiesData = await mailActivityAPI.getActivitiesForRecord(model, recordId, forceRefresh);
      setActivities(activitiesData || []);
    } catch (err) {
      console.error('Error fetching message thread:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [model, recordId]);

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle refresh
  const handleRefresh = () => {
    setRefreshing(true);
    fetchData(true);
  };

  // Handle message press
  const handleMessagePress = (message) => {
    setSelectedMessage(message);
    setModalVisible(true);
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Get author name
  const getAuthorName = (item) => {
    if (item.author_id && Array.isArray(item.author_id)) {
      return item.author_id[1] || 'Unknown';
    }
    return item.email_from || item.create_uid?.[1] || 'Unknown';
  };

  // Get preview text
  const getPreviewText = (item) => {
    // Check for tracking changes first
    if (item.tracking_value_ids && item.tracking_value_ids.length > 0) {
      const trackingText = formatTrackingChanges(item.tracking_value_ids);
      if (trackingText) return trackingText;
    }

    if (item.body) {
      // Strip HTML tags and get first 100 characters
      const text = item.body.replace(/<[^>]*>/g, '').trim();
      return text.length > 100 ? text.substring(0, 100) + '...' : text;
    }
    if (item.summary) {
      return item.summary;
    }
    return 'No content';
  };

  // Render message item
  const renderMessageItem = ({ item }) => {
    const isInternalNote = item.message_type === 'notification';
    const isAuditNote = item.tracking_value_ids && item.tracking_value_ids.length > 0;
    const isActivity = !item.message_type; // Activities don't have message_type

    return (
      <TouchableOpacity
        style={[
          styles.messageItem,
          { backgroundColor: colors.surface },
          isInternalNote && styles.internalNoteItem,
          isAuditNote && styles.auditNoteItem,
        ]}
        onPress={() => handleMessagePress(item)}
      >
        <View style={styles.messageHeader}>
          <View style={styles.authorContainer}>
            <Image source={defaultAvatar} style={styles.avatar} />
            <View style={styles.authorInfo}>
              <Text style={[styles.authorName, { color: colors.text }]}>
                {getAuthorName(item)}
              </Text>
              {isInternalNote && (
                <Text style={[styles.messageTypeLabel, { color: colors.warning }]}>
                  Internal Note
                </Text>
              )}
              {isAuditNote && (
                <Text style={[styles.messageTypeLabel, { color: colors.info }]}>
                  Audit Log
                </Text>
              )}
              {isActivity && (
                <Text style={[styles.messageTypeLabel, { color: colors.success }]}>
                  Activity
                </Text>
              )}
            </View>
          </View>
          <Text style={[styles.dateText, { color: colors.textSecondary }]}>
            {formatDate(item.date || item.create_date)}
          </Text>
        </View>

        <Text style={[styles.previewText, { color: colors.textSecondary }]}>
          {getPreviewText(item)}
        </Text>

        {item.attachment_ids && item.attachment_ids.length > 0 && (
          <View style={styles.attachmentIndicator}>
            <Icon name="paperclip" size={14} color={colors.textSecondary} />
            <Text style={[styles.attachmentCount, { color: colors.textSecondary }]}>
              {item.attachment_ids.length}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading messages...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Messages & Activities
        </Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={handleRefresh}
          disabled={refreshing}
        >
          <Icon name="refresh" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'activity' && styles.activeTab,
            { borderBottomColor: activeTab === 'activity' ? colors.primary : 'transparent' }
          ]}
          onPress={() => setActiveTab('activity')}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'activity' ? colors.primary : colors.textSecondary }
          ]}>
            Activity
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'audit' && styles.activeTab,
            { borderBottomColor: activeTab === 'audit' ? colors.primary : 'transparent' }
          ]}
          onPress={() => setActiveTab('audit')}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'audit' ? colors.primary : colors.textSecondary }
          ]}>
            Audit Log
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={getCurrentMessages()}
        renderItem={renderMessageItem}
        keyExtractor={(item) => `${item.id}-${item.date || item.create_date}`}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="message-text-outline" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No {activeTab === 'activity' ? 'activity' : 'audit log entries'} yet
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: '#f0f0f0' }} />}
      />

      <MessageDetailModal
        visible={modalVisible}
        message={selectedMessage}
        onClose={() => {
          setModalVisible(false);
          setSelectedMessage(null);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  refreshButton: {
    padding: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
  },
  activeTab: {
    backgroundColor: '#fff',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    paddingVertical: 8,
  },
  messageItem: {
    padding: 12,
    borderRadius: 4,
    marginHorizontal: 16,
    marginVertical: 2,
    backgroundColor: '#fff',
    borderLeftWidth: 3,
    borderLeftColor: '#e0e0e0',
  },
  internalNoteItem: {
    borderLeftWidth: 4,
    borderLeftColor: '#f39c12',
  },
  auditNoteItem: {
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  authorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  authorInfo: {
    flex: 1,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  messageTypeLabel: {
    fontSize: 10,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  dateText: {
    fontSize: 12,
    marginLeft: 8,
  },
  previewText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  attachmentIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  attachmentCount: {
    fontSize: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
});

export default HelpdeskMessageThread;
