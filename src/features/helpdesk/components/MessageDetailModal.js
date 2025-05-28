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
  const [expanded, setExpanded] = useState(false);
  
  // Initial position (partially visible)
  const initialHeight = screenHeight * 0.3;
  const expandedHeight = screenHeight * 0.9;
  
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dy) > 10;
      },
      onPanResponderMove: (evt, gestureState) => {
        if (gestureState.dy > 0) {
          // Dragging down
          dragPosition.setValue(gestureState.dy);
        } else if (expanded) {
          // Dragging up when expanded
          dragPosition.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dy > 100) {
          // Close modal if dragged down significantly
          onClose();
        } else if (gestureState.dy < -50 && !expanded) {
          // Expand if dragged up
          expandModal();
        } else if (gestureState.dy > 50 && expanded) {
          // Collapse if dragged down when expanded
          collapseModal();
        } else {
          // Snap back to current state
          Animated.spring(dragPosition, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const expandModal = () => {
    setExpanded(true);
    Animated.spring(dragPosition, {
      toValue: 0,
      useNativeDriver: true,
    }).start();
  };

  const collapseModal = () => {
    setExpanded(false);
    Animated.spring(dragPosition, {
      toValue: 0,
      useNativeDriver: true,
    }).start();
  };

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
              height: expanded ? expandedHeight : initialHeight,
              transform: [{ translateY: dragPosition }],
            },
          ]}
          {...panResponder.panHandlers}
        >
          {/* Handle bar */}
          <View style={styles.handleContainer}>
            <View style={[styles.handle, { backgroundColor: colors.textSecondary }]} />
          </View>

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

          {/* Compact info when collapsed */}
          {!expanded && (
            <View style={styles.compactInfo}>
              <Text style={[styles.dateText, { color: colors.textSecondary }]}>
                {formatDate(message.date || message.create_date)}
              </Text>
              <TouchableOpacity onPress={expandModal} style={styles.expandButton}>
                <Text style={[styles.expandButtonText, { color: colors.primary }]}>
                  Tap to expand
                </Text>
                <Icon name="chevron-up" size={16} color={colors.primary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Full content when expanded */}
          {expanded && (
            <ScrollView style={styles.contentContainer} showsVerticalScrollIndicator={false}>
              <View style={styles.messageDetails}>
                <Text style={[styles.dateText, { color: colors.textSecondary }]}>
                  {formatDate(message.date || message.create_date)}
                </Text>
                
                {message.subject && (
                  <Text style={[styles.subjectText, { color: colors.text }]}>
                    {message.subject}
                  </Text>
                )}

                {message.email_from && (
                  <Text style={[styles.emailText, { color: colors.textSecondary }]}>
                    From: {message.email_from}
                  </Text>
                )}

                {message.body && message.body.trim() ? (
                  <View style={styles.bodyContainer}>
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
                  </View>
                ) : (
                  <Text style={[styles.noContentText, { color: colors.textSecondary }]}>
                    No content
                  </Text>
                )}

                {message.attachment_ids && message.attachment_ids.length > 0 && (
                  <View style={styles.attachmentsInfo}>
                    <Text style={[styles.attachmentsLabel, { color: colors.text }]}>
                      Attachments ({message.attachment_ids.length})
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>
          )}
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
  noContentText: {
    fontSize: 14,
    fontStyle: 'italic',
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
