import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Dimensions,
  Linking,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../../contexts/ThemeContext';
import { getHelpdeskTicket, getHelpdeskStages, updateHelpdeskTicket } from '../../../api/helpdeskServiceV2';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import HTML from 'react-native-render-html';
import HelpdeskMessageThread from '../components/HelpdeskMessageThread';

// Move the renderSafeHTML function outside the component to prevent re-creation
const renderSafeHTML = (htmlContent, colors, contentWidth) => {
  if (!htmlContent || typeof htmlContent !== 'string') {
    return (
      <Text style={[styles.description, { color: colors.text }]}>
        No content available
      </Text>
    );
  }

  try {
    // Clean and sanitize HTML content
    let cleanHTML = htmlContent
      // Remove problematic cid: image references
      .replace(/<img[^>]*src="cid:[^"]*"[^>]*>/gi, '<p style="color: #666; font-style: italic; margin: 8px 0;">[📎 Image attachment - view in attachments tab]</p>')
      // Remove other problematic image sources
      .replace(/<img[^>]*src="[^"]*cid:[^"]*"[^>]*>/gi, '<p style="color: #666; font-style: italic; margin: 8px 0;">[📎 Image attachment - view in attachments tab]</p>')
      // Handle signature images that might cause issues
      .replace(/<img[^>]*signature[^>]*>/gi, '<p style="color: #666; font-style: italic; margin: 4px 0;">[📷 Signature image]</p>')
      // Clean up excessive whitespace and line breaks
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      // Ensure URLs are properly formatted
      .replace(/(https?:\/\/[^\s<>"]+)/gi, '<a href="$1" style="color: #007AFF; text-decoration: underline;">$1</a>')
      // Clean up any malformed tags that might cause issues
      .replace(/<([^>]+)>/g, (match, tag) => {
        // Only allow safe tags
        const safeTags = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li'];
        const tagName = tag.split(' ')[0].toLowerCase();
        if (safeTags.includes(tagName)) {
          return match;
        }
        return ''; // Remove unsafe tags
      });

    // Limit content length to prevent memory issues
    if (cleanHTML.length > 10000) {
      cleanHTML = cleanHTML.substring(0, 10000) + '... [Content truncated for performance]';
    }

    return (
      <HTML
        source={{ html: cleanHTML }}
        contentWidth={contentWidth - 64}
        tagsStyles={{
          body: {
            color: colors.text,
            fontSize: 14,
            lineHeight: 20,
            margin: 0,
            padding: 0
          },
          p: {
            marginBottom: 8,
            color: colors.text
          },
          a: {
            color: colors.primary,
            textDecorationLine: 'underline'
          },
          div: {
            marginBottom: 4
          },
          strong: {
            fontWeight: 'bold',
            color: colors.text
          },
          b: {
            fontWeight: 'bold',
            color: colors.text
          }
        }}
        renderersProps={{
          a: {
            onPress: (event, href) => {
              if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
                Linking.openURL(href).catch(err => {
                  console.error('Failed to open URL:', err);
                  Alert.alert('Error', 'Could not open link');
                });
              }
            }
          }
        }}
        ignoredStyles={['font-family', 'letter-spacing', 'font-size']}
        baseFontStyle={{
          color: colors.text,
          fontSize: 14,
          lineHeight: 20
        }}
        defaultTextProps={{
          style: { color: colors.text }
        }}
      />
    );
  } catch (error) {
    console.error('HTML rendering error:', error);
    // Fallback to plain text if HTML rendering fails
    const plainText = htmlContent
      .replace(/<[^>]*>/g, '') // Strip all HTML tags
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();

    return (
      <Text style={[styles.description, { color: colors.text }]}>
        {plainText.length > 1000 ? plainText.substring(0, 1000) + '...' : plainText}
      </Text>
    );
  }
};

const HelpdeskTicketDetailScreen = ({ route }) => {
  const { ticketId } = route.params;
  const [ticket, setTicket] = useState(null);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('details'); // 'details', 'messages', or 'attachments'

  const navigation = useNavigation();
  const { colors } = useTheme();
  const screenWidth = Dimensions.get('window').width;

  // Load data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [ticketId])
  );

  const loadData = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      // Fetch ticket details with proper fields parameter
      const ticketData = await getHelpdeskTicket(ticketId);
      setTicket(ticketData);

      // Fetch stages for this ticket's team
      if (ticketData && ticketData.team_id) {
        const stagesData = await getHelpdeskStages(ticketData.team_id[0]);
        setStages(stagesData || []);
      }
    } catch (error) {
      console.error(`Error loading helpdesk ticket ${ticketId}:`, error);
      setError('Failed to load ticket details. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [ticketId]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData(true);
  }, [loadData]);

  const handleEditTicket = useCallback(() => {
    navigation.navigate('HelpdeskTicketForm', { ticketId: ticketId });
  }, [navigation, ticketId]);

  const handleChangeStage = useCallback(async (stageId) => {
    try {
      setLoading(true);
      await updateHelpdeskTicket(ticketId, { stage_id: stageId });
      await loadData(true);
      Alert.alert('Success', 'Ticket stage updated successfully');
    } catch (error) {
      console.error('Error updating ticket stage:', error);
      Alert.alert('Error', 'Failed to update ticket stage');
    } finally {
      setLoading(false);
    }
  }, [ticketId, loadData]);

  const handleChangePriority = useCallback(async (priority) => {
    try {
      setLoading(true);
      await updateHelpdeskTicket(ticketId, { priority });
      await loadData(true);
      Alert.alert('Success', 'Ticket priority updated successfully');
    } catch (error) {
      console.error('Error updating ticket priority:', error);
      Alert.alert('Error', 'Failed to update ticket priority');
    } finally {
      setLoading(false);
    }
  }, [ticketId, loadData]);

  // Memoize the priority badge to prevent re-renders
  const priorityBadge = useMemo(() => {
    if (!ticket) return null;
    
    const priorityLabels = ['Low', 'Medium', 'High', 'Urgent'];
    const priorityColors = ['#6B7280', '#3B82F6', '#F59E0B', '#EF4444'];
    const level = ticket.priority || 0;

    return (
      <View style={[styles.priorityBadge, { backgroundColor: priorityColors[level] }]}>
        <Text style={styles.priorityText}>{priorityLabels[level]}</Text>
      </View>
    );
  }, [ticket?.priority]);

  // Memoize rendered HTML content to prevent re-renders
  const renderedDescription = useMemo(() => {
    if (!ticket?.description) return null;
    return renderSafeHTML(ticket.description, colors, screenWidth);
  }, [ticket?.description, colors, screenWidth]);

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: colors.primary }]}
          onPress={() => loadData(true)}
        >
          <Text style={[styles.retryButtonText, { color: colors.onPrimary }]}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!ticket) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>Ticket not found</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Tab Buttons */}
      <View style={[styles.tabButtonsContainer, { backgroundColor: colors.surface }]}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'details' && [styles.activeTabButton, { borderBottomColor: colors.primary }]
          ]}
          onPress={() => setActiveTab('details')}
        >
          <Text
            style={[
              styles.tabButtonText,
              { color: activeTab === 'details' ? colors.primary : colors.textSecondary }
            ]}
          >
            Details
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'messages' && [styles.activeTabButton, { borderBottomColor: colors.primary }]
          ]}
          onPress={() => setActiveTab('messages')}
        >
          <Text
            style={[
              styles.tabButtonText,
              { color: activeTab === 'messages' ? colors.primary : colors.textSecondary }
            ]}
          >
            Messages
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'attachments' && [styles.activeTabButton, { borderBottomColor: colors.primary }]
          ]}
          onPress={() => setActiveTab('attachments')}
        >
          <Text
            style={[
              styles.tabButtonText,
              { color: activeTab === 'attachments' ? colors.primary : colors.textSecondary }
            ]}
          >
            Attachments
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      <View style={styles.tabContentContainer}>
        {activeTab === 'details' && (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[colors.primary]}
                tintColor={colors.primary}
              />
            }
          >
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.surface }]}>
              <View style={styles.headerTop}>
                <Text style={[styles.ticketNumber, { color: colors.textSecondary }]}>
                  Ticket #{ticket.id}
                </Text>
                {priorityBadge}
              </View>

              <Text style={[styles.ticketTitle, { color: colors.text }]}>
                {ticket.name}
              </Text>

              <View style={styles.metaRow}>
                <Icon name="account-outline" size={16} color={colors.textSecondary} style={styles.metaIcon} />
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                  {ticket.partner_name || (ticket.partner_id ? ticket.partner_id[1] : 'No customer')}
                </Text>
              </View>

              {ticket.partner_email && (
                <View style={styles.metaRow}>
                  <Icon name="email-outline" size={16} color={colors.textSecondary} style={styles.metaIcon} />
                  <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                    {ticket.partner_email}
                  </Text>
                </View>
              )}

              {ticket.partner_phone && (
                <View style={styles.metaRow}>
                  <Icon name="phone-outline" size={16} color={colors.textSecondary} style={styles.metaIcon} />
                  <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                    {ticket.partner_phone}
                  </Text>
                </View>
              )}

              <View style={styles.metaRow}>
                <Icon name="account-group-outline" size={16} color={colors.textSecondary} style={styles.metaIcon} />
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                  {ticket.team_id ? ticket.team_id[1] : 'No team'}
                </Text>
              </View>

              {ticket.user_id && (
                <View style={styles.metaRow}>
                  <Icon name="account-tie-outline" size={16} color={colors.textSecondary} style={styles.metaIcon} />
                  <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                    Assigned to: {ticket.user_id[1]}
                  </Text>
                </View>
              )}

              <View style={styles.metaRow}>
                <Icon name="calendar-outline" size={16} color={colors.textSecondary} style={styles.metaIcon} />
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                  Created: {new Date(ticket.create_date).toLocaleString()}
                </Text>
              </View>

              {ticket.sla_deadline && (
                <View style={styles.metaRow}>
                  <Icon name="clock-outline" size={16} color={colors.textSecondary} style={styles.metaIcon} />
                  <Text style={[styles.metaText, { color: new Date(ticket.sla_deadline) > new Date() ? '#F59E0B' : '#EF4444' }]}>
                    Deadline: {new Date(ticket.sla_deadline).toLocaleString()}
                  </Text>
                </View>
              )}

              {/* Compact Status and Priority Row */}
              <View style={styles.statusPriorityRow}>
                <View style={styles.metaRow}>
                  <Icon name="flag-variant" size={16} color={colors.textSecondary} style={styles.metaIcon} />
                  <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                    Status: {ticket.stage_id ? ticket.stage_id[1] : 'No stage'}
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <Icon name="priority-high" size={16} color={colors.textSecondary} style={styles.metaIcon} />
                  <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                    Priority: {['Low', 'Medium', 'High', 'Urgent'][ticket.priority || 0]}
                  </Text>
                </View>
              </View>
            </View>

            {/* Compact Status & Priority Controls */}
            <View style={[styles.section, { backgroundColor: colors.surface }]}>
              <View style={styles.compactControlsContainer}>
                {/* Status Controls */}
                <View style={styles.controlGroup}>
                  <Text style={[styles.controlLabel, { color: colors.text }]}>Status</Text>
                  <View style={styles.compactStageContainer}>
                    {stages.map((stage) => (
                      <TouchableOpacity
                        key={stage.id}
                        style={[
                          styles.compactStageItem,
                          ticket.stage_id && ticket.stage_id[0] === stage.id && styles.compactStageItemActive,
                          {
                            backgroundColor: ticket.stage_id && ticket.stage_id[0] === stage.id
                              ? colors.primary
                              : colors.background,
                            borderColor: colors.border
                          }
                        ]}
                        onPress={() => handleChangeStage(stage.id)}
                      >
                        <Text
                          style={[
                            styles.compactStageText,
                            {
                              color: ticket.stage_id && ticket.stage_id[0] === stage.id
                                ? colors.onPrimary
                                : colors.text
                            }
                          ]}
                        >
                          {stage.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Priority Controls */}
                <View style={styles.controlGroup}>
                  <Text style={[styles.controlLabel, { color: colors.text }]}>Priority</Text>
                  <View style={styles.compactPriorityContainer}>
                    {[0, 1, 2, 3].map((level) => (
                      <TouchableOpacity
                        key={level}
                        style={[
                          styles.compactPriorityItem,
                          ticket.priority === level && styles.compactPriorityItemActive,
                          {
                            backgroundColor: ticket.priority === level
                              ? ['#6B7280', '#3B82F6', '#F59E0B', '#EF4444'][level]
                              : colors.background,
                            borderColor: colors.border
                          }
                        ]}
                        onPress={() => handleChangePriority(level)}
                      >
                        <Text
                          style={[
                            styles.compactPriorityText,
                            {
                              color: ticket.priority === level
                                ? 'white'
                                : colors.text
                            }
                          ]}
                        >
                          {['Low', 'Med', 'High', 'Urgent'][level]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            </View>

            {/* Description Section */}
            {ticket.description && (
              <View style={[styles.section, { backgroundColor: colors.surface }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Description</Text>
                {renderedDescription}
              </View>
            )}
          </ScrollView>
        )}

        {activeTab === 'messages' && (
          <View style={styles.tabContent}>
            <HelpdeskMessageThread
              model="helpdesk.ticket"
              recordId={ticketId}
              recordName={ticket?.name || 'Ticket'}
            />
          </View>
        )}

        {activeTab === 'attachments' && (
          <View style={styles.tabContent}>
            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={() => {
                navigation.navigate('HelpdeskAttachments', {
                  ticketId: parseInt(ticketId, 10),
                  ticketName: ticket?.name || 'Ticket'
                });
              }}
            >
              <Text style={[styles.viewAllButtonText, { color: colors.primary }]}>
                View All Attachments
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={handleEditTicket}
      >
        <Icon name="pencil" size={24} color={colors.onPrimary} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
  },
  tabButtonsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  activeTabButton: {
    borderBottomWidth: 2,
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tabContentContainer: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
  },
  viewAllButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'center',
    marginTop: 16,
  },
  viewAllButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  header: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ticketNumber: {
    fontSize: 14,
  },
  ticketTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  metaIcon: {
    marginRight: 8,
  },
  metaText: {
    fontSize: 14,
  },
  statusPriorityRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  section: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  priorityText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  // Compact Controls Styles
  compactControlsContainer: {
    gap: 20,
  },
  controlGroup: {
    gap: 8,
  },
  controlLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  compactStageContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  compactStageItem: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  compactStageItemActive: {
    borderWidth: 0,
  },
  compactStageText: {
    fontSize: 12,
    fontWeight: '500',
  },
  compactPriorityContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  compactPriorityItem: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 50,
    alignItems: 'center',
  },
  compactPriorityItemActive: {
    borderWidth: 0,
  },
  compactPriorityText: {
    fontSize: 12,
    fontWeight: '500',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    margin: 16,
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignSelf: 'center',
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default HelpdeskTicketDetailScreen;