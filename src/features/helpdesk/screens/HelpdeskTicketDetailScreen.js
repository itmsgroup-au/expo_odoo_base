import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../../contexts/ThemeContext';
import { getHelpdeskTicket, getHelpdeskStages, updateHelpdeskTicket } from '../../../api/helpdeskServiceV2';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import HTML from 'react-native-render-html';
import HelpdeskMessageThread from '../components/HelpdeskMessageThread';

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

  // Load data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [ticketId])
  );

  const loadData = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      // Fetch ticket details
      const ticketData = await getHelpdeskTicket(ticketId, forceRefresh);
      setTicket(ticketData);

      // Fetch stages for this ticket's team
      if (ticketData && ticketData.team_id) {
        const stagesData = await getHelpdeskStages(ticketData.team_id[0], forceRefresh);
        setStages(stagesData || []);
      }
    } catch (error) {
      console.error(`Error loading helpdesk ticket ${ticketId}:`, error);
      setError('Failed to load ticket details. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData(true);
  }, [ticketId]);

  const handleEditTicket = () => {
    navigation.navigate('HelpdeskTicketForm', { ticketId: ticketId });
  };

  const handleChangeStage = async (stageId) => {
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
  };

  const handleChangePriority = async (priority) => {
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
  };

  const renderPriorityBadge = (priority) => {
    const priorityLabels = ['Low', 'Medium', 'High', 'Urgent'];
    const priorityColors = ['#6B7280', '#3B82F6', '#F59E0B', '#EF4444'];
    const level = priority || 0;

    return (
      <View style={[styles.priorityBadge, { backgroundColor: priorityColors[level] }]}>
        <Text style={styles.priorityText}>{priorityLabels[level]}</Text>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
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
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>Ticket not found</Text>
      </View>
    );
  }

  // Render tab buttons
  const renderTabButtons = () => (
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
  );

  // Render details tab content
  const renderDetailsTab = () => (
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
        <View style={[styles.header, { backgroundColor: colors.surface }]}>
          <View style={styles.headerTop}>
            <Text style={[styles.ticketNumber, { color: colors.textSecondary }]}>
              Ticket #{ticket.id}
            </Text>
            {renderPriorityBadge(ticket.priority)}
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
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Status</Text>
          <View style={styles.stageContainer}>
            {stages.map((stage, index) => (
              <TouchableOpacity
                key={stage.id}
                style={[
                  styles.stageItem,
                  ticket.stage_id && ticket.stage_id[0] === stage.id && styles.stageItemActive,
                  {
                    backgroundColor: ticket.stage_id && ticket.stage_id[0] === stage.id
                      ? colors.primary
                      : colors.surface,
                    borderColor: colors.border
                  }
                ]}
                onPress={() => handleChangeStage(stage.id)}
              >
                <Text
                  style={[
                    styles.stageText,
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

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Priority</Text>
          <View style={styles.priorityContainer}>
            {[0, 1, 2, 3].map((level) => (
              <TouchableOpacity
                key={level}
                style={[
                  styles.priorityItem,
                  ticket.priority === level && styles.priorityItemActive,
                  {
                    backgroundColor: ticket.priority === level
                      ? ['#6B7280', '#3B82F6', '#F59E0B', '#EF4444'][level]
                      : colors.surface,
                    borderColor: colors.border
                  }
                ]}
                onPress={() => handleChangePriority(level)}
              >
                <Text
                  style={[
                    styles.priorityItemText,
                    {
                      color: ticket.priority === level
                        ? colors.onPrimary
                        : colors.text
                    }
                  ]}
                >
                  {['Low', 'Medium', 'High', 'Urgent'][level]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {ticket.description && (
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Description</Text>
            <HTML
              source={{ html: ticket.description }}
              contentWidth={Dimensions.get('window').width - 64} // Account for padding
              tagsStyles={{
                body: { color: colors.text, fontSize: 14, lineHeight: 20 },
                p: { marginBottom: 10 },
                a: { color: colors.primary },
                img: { maxWidth: '100%', height: 'auto' }
              }}
              renderersProps={{
                img: {
                  enableExperimentalPercentWidth: true
                }
              }}
              ignoredStyles={['font-family', 'letter-spacing']}
              baseFontStyle={{ color: colors.text, fontSize: 14 }}
            />
          </View>
        )}
      </ScrollView>
  );

  // Render messages tab content
  const renderMessagesTab = () => (
    <View style={styles.tabContent}>
      <HelpdeskMessageThread
        model="helpdesk.ticket"
        recordId={ticketId}
        recordName={ticket.name}
      />
    </View>
  );

  // Render attachments tab content
  const renderAttachmentsTab = () => (
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
  );



  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {renderTabButtons()}

      <View style={styles.tabContentContainer}>
        {activeTab === 'details' && renderDetailsTab()}
        {activeTab === 'messages' && renderMessagesTab()}
        {activeTab === 'attachments' && renderAttachmentsTab()}
      </View>

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
  tabButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  attachmentBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  attachmentBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  tabContentContainer: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
  },
  attachmentsContainer: {
    padding: 16,
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
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
  stageContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  stageItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  stageItemActive: {
    borderWidth: 0,
  },
  stageText: {
    fontSize: 14,
    fontWeight: '500',
  },
  priorityContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  priorityItem: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 4,
    marginHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1,
  },
  priorityItemActive: {
    borderWidth: 0,
  },
  priorityItemText: {
    fontSize: 14,
    fontWeight: '500',
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
