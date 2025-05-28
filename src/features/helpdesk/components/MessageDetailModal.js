import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Animated,
  PanResponder,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../../contexts/ThemeContext';
import RenderHtml from 'react-native-render-html';

const { height: screenHeight, width: screenWidth } = Dimensions.get('window');

const MessageDetailModal = ({ visible, message, onClose }) => {
  const { colors } = useTheme();
  const [dragPosition] = useState(new Animated.Value(0));
  const [modalState, setModalState] = useState('collapsed'); // 'collapsed', 'partial', 'expanded'

  // Three-stage heights
  const collapsedHeight = screenHeight * 0.15; // Peek view
  const partialHeight = screenHeight * 0.4;    // Partial view
  const expandedHeight = screenHeight * 0.85;  // Full view

  const getCurrentHeight = () => {
    switch (modalState) {
      case 'collapsed': return collapsedHeight;
      case 'partial': return partialHeight;
      case 'expanded': return expandedHeight;
      default: return partialHeight;
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dy) > 10;
      },
      onPanResponderMove: (evt, gestureState) => {
        // Allow dragging in both directions
        dragPosition.setValue(gestureState.dy);
      },
      onPanResponderRelease: (evt, gestureState) => {
        const threshold = 50;

        if (gestureState.dy > threshold) {
          // Dragging down - go to previous state or close
          if (modalState === 'expanded') {
            setModalState('partial');
          } else if (modalState === 'partial') {
            setModalState('collapsed');
          } else {
            onClose();
          }
        } else if (gestureState.dy < -threshold) {
          // Dragging up - go to next state
          if (modalState === 'collapsed') {
            setModalState('partial');
          } else if (modalState === 'partial') {
            setModalState('expanded');
          }
        }

        // Snap back to position
        Animated.spring(dragPosition, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  // Handle tap on handle bar to cycle through states
  const handleTap = () => {
    if (modalState === 'collapsed') {
      setModalState('partial');
    } else if (modalState === 'partial') {
      setModalState('expanded');
    } else {
      setModalState('partial');
    }
  };

  // Reset modal state when opening
  useEffect(() => {
    if (visible) {
      setModalState('partial'); // Start in partial state
    }
  }, [visible]);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getAuthorName = (message) => {
    if (message.author_id && Array.isArray(message.author_id)) {
      return message.author_id[1] || 'Unknown';
    }
    return message.email_from || 'Unknown';
  };

  const isInternalNote = message?.message_type === 'notification';
  const isAuditNote = message?.tracking_value_ids && message.tracking_value_ids.length > 0;

  if (!visible || !message) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        <Animated.View
          style={[
            styles.modalContainer,
            {
              backgroundColor: colors.surface,
              height: getCurrentHeight(),
              transform: [{ translateY: dragPosition }],
            },
          ]}
          {...panResponder.panHandlers}
        >
          {/* Handle bar - tappable */}
          <TouchableOpacity style={styles.handleContainer} onPress={handleTap} activeOpacity={0.7}>
            <View style={[styles.handle, { backgroundColor: colors.textSecondary }]} />
            <Text style={[styles.handleHint, { color: colors.textSecondary }]}>
              {modalState === 'collapsed' ? 'Tap to expand' : modalState === 'partial' ? 'Tap for full view' : 'Tap to collapse'}
            </Text>
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={[styles.authorName, { color: colors.text }]}>
                {getAuthorName(message)}
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
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Content based on modal state */}
          <ScrollView style={styles.contentContainer} showsVerticalScrollIndicator={false}>
            <View style={styles.messageDetails}>
              <Text style={[styles.dateText, { color: colors.textSecondary }]}>
                {formatDate(message.date || message.create_date)}
              </Text>

              {message.subject && modalState !== 'collapsed' && (
                <Text style={[styles.subjectText, { color: colors.text }]}>
                  {message.subject}
                </Text>
              )}

              {message.email_from && modalState === 'expanded' && (
                <Text style={[styles.emailText, { color: colors.textSecondary }]}>
                  From: {message.email_from}
                </Text>
              )}

              {/* Show tracking changes if available */}
              {message.tracking_value_ids && message.tracking_value_ids.length > 0 && (
                <View style={styles.trackingContainer}>
                  {message.tracking_value_ids.map((tracking, index) => {
                    const fieldName = tracking.field_desc || tracking.field;
                    const oldValue = tracking.old_value_text || tracking.old_value || '';
                    const newValue = tracking.new_value_text || tracking.new_value || '';

                    return (
                      <View key={index} style={styles.trackingItem}>
                        <Text style={[styles.trackingLabel, { color: colors.text }]}>
                          {fieldName}:
                        </Text>
                        <Text style={[styles.trackingChange, { color: colors.textSecondary }]}>
                          {oldValue && newValue ? `${oldValue} → ${newValue}` : newValue || oldValue}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Show body content based on state */}
              {message.body && message.body.trim() && modalState !== 'collapsed' ? (
                <View style={styles.bodyContainer}>
                  {modalState === 'partial' ? (
                    // Show preview in partial state
                    <Text style={[styles.bodyPreview, { color: colors.text }]} numberOfLines={3}>
                      {message.body.replace(/<[^>]*>/g, '').trim()}
                    </Text>
                  ) : (
                    // Show full content in expanded state
                    <RenderHtml
                      contentWidth={screenWidth - 64}
                      source={{
                        html: message.body
                          .replace(/<img[^>]*src="cid:[^"]*"[^>]*>/gi, '<p style="color: #666; font-style: italic;">[Image attachment]</p>')
                          .replace(/<img[^>]*src="[^"]*cid:[^"]*"[^>]*>/gi, '<p style="color: #666; font-style: italic;">[Image attachment]</p>')
                      }}
                      tagsStyles={{
                        body: { margin: 0, padding: 0, color: colors.text },
                        div: { margin: 0, padding: 0 },
                        p: { marginBottom: 8, color: colors.text },
                        a: { color: colors.primary },
                        img: { maxWidth: '100%', height: 'auto' }
                      }}
                      defaultTextProps={{
                        style: { fontSize: 16, color: colors.text }
                      }}
                    />
                  )}
                </View>
              ) : modalState !== 'collapsed' && (
                <Text style={[styles.noContentText, { color: colors.textSecondary }]}>
                  No content
                </Text>
              )}

              {message.attachment_ids && message.attachment_ids.length > 0 && modalState !== 'collapsed' && (
                <View style={styles.attachmentsInfo}>
                  <Text style={[styles.attachmentsLabel, { color: colors.text }]}>
                    Attachments ({message.attachment_ids.length})
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  modalContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 4,
  },
  handleHint: {
    fontSize: 12,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerLeft: {
    flex: 1,
  },
  authorName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  messageTypeLabel: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  closeButton: {
    padding: 4,
  },
  compactInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  expandButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  contentContainer: {
    flex: 1,
  },
  messageDetails: {
    gap: 12,
  },
  dateText: {
    fontSize: 14,
  },
  subjectText: {
    fontSize: 16,
    fontWeight: '500',
  },
  emailText: {
    fontSize: 14,
  },
  bodyContainer: {
    marginTop: 8,
  },
  bodyPreview: {
    fontSize: 14,
    lineHeight: 20,
  },
  noContentText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  trackingContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#007bff',
  },
  trackingItem: {
    marginBottom: 4,
  },
  trackingLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  trackingChange: {
    fontSize: 14,
    fontWeight: '500',
  },
  attachmentsInfo: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  attachmentsLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
});

export default MessageDetailModal;
