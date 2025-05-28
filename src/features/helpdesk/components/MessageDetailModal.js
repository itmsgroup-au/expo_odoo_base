import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  SafeAreaView,
  Platform,
} from 'react-native';
import BottomSheet, { BottomSheetView, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../../contexts/ThemeContext';
import RenderHtml from 'react-native-render-html';

const { height: screenHeight, width: screenWidth } = Dimensions.get('window');

const MessageDetailModal = ({ visible, message, onClose }) => {
  const { colors } = useTheme();

  // Bottom sheet ref
  const bottomSheetRef = useRef(null);

  // Snap points for the bottom sheet (20%, 50%, 90% of screen height)
  const snapPoints = useMemo(() => ['20%', '50%', '90%'], []);

  // Track current snap index for haptic feedback
  const [currentSnapIndex, setCurrentSnapIndex] = useState(1); // Start at 50%

  // Handle bottom sheet changes with haptic feedback
  const handleSheetChanges = useCallback((index) => {
    console.log('Bottom sheet changed to index:', index);

    // Provide haptic feedback on snap
    if (index !== currentSnapIndex) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCurrentSnapIndex(index);
    }

    // Close modal if swiped down past the first snap point
    if (index === -1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onClose();
    }
  }, [currentSnapIndex, onClose]);

  // Handle bottom sheet close
  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    bottomSheetRef.current?.close();
  }, []);

  // Handle snap to specific index
  const snapToIndex = useCallback((index) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    bottomSheetRef.current?.snapToIndex(index);
  }, []);

  // Handle tap on handle bar to cycle through snap points
  const handleTap = useCallback(() => {
    const nextIndex = currentSnapIndex === 2 ? 1 : currentSnapIndex + 1;
    snapToIndex(nextIndex);
  }, [currentSnapIndex, snapToIndex]);

  // Open/close bottom sheet based on visible prop
  useEffect(() => {
    if (visible && message) {
      // Open to middle snap point (50%)
      bottomSheetRef.current?.snapToIndex(1);
      setCurrentSnapIndex(1);
    } else {
      // Close the bottom sheet
      bottomSheetRef.current?.close();
    }
  }, [visible, message]);

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

  // Memoized content to prevent re-renders during animations
  const messageContent = useMemo(() => {
    if (!message) return null;

    return (
      <BottomSheetScrollView
        style={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.messageDetails}>
          <Text style={[styles.dateText, { color: colors.textSecondary }]}>
            {formatDate(message.date || message.create_date)}
          </Text>

          {message.subject && (
            <Text style={[styles.subjectText, { color: colors.text }]}>
              {message.subject}
            </Text>
          )}

          {message.email_from && currentSnapIndex === 2 && (
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

          {/* Show body content based on snap index */}
          {message.body && message.body.trim() ? (
            <View style={styles.bodyContainer}>
              {currentSnapIndex < 2 ? (
                // Show preview when not fully expanded
                <Text style={[styles.bodyPreview, { color: colors.text }]} numberOfLines={currentSnapIndex === 0 ? 1 : 3}>
                  {message.body.replace(/<[^>]*>/g, '').trim()}
                </Text>
              ) : (
                // Show full content when fully expanded
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
      </BottomSheetScrollView>
    );
  }, [message, colors, currentSnapIndex, screenWidth]);

  if (!visible || !message) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <GestureHandlerRootView style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleClose}
        />

        <BottomSheet
          ref={bottomSheetRef}
          index={1}
          snapPoints={snapPoints}
          onChange={handleSheetChanges}
          enablePanDownToClose={true}
          backgroundStyle={[styles.bottomSheetBackground, { backgroundColor: colors.surface }]}
          handleIndicatorStyle={[styles.handleIndicator, { backgroundColor: colors.textSecondary }]}
        >
          <BottomSheetView style={styles.bottomSheetContent}>
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
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <Icon name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Snap indicator */}
            <TouchableOpacity style={styles.snapIndicator} onPress={handleTap} activeOpacity={0.7}>
              <Text style={[styles.snapText, { color: colors.textSecondary }]}>
                {currentSnapIndex === 0 ? 'Tap to expand' : currentSnapIndex === 1 ? 'Tap for full view' : 'Tap to collapse'}
              </Text>
            </TouchableOpacity>
          </BottomSheetView>

          {/* Content */}
          {messageContent}
        </BottomSheet>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  backdrop: {
    flex: 1,
  },
  bottomSheetBackground: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  handleIndicator: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  bottomSheetContent: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  snapIndicator: {
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 8,
  },
  snapText: {
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
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
