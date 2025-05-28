import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  ScrollView,
  SectionList,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../../contexts/ThemeContext';
import { useAuth } from '../../../contexts/AuthContext';
import {
  getHelpdeskTickets,
  getHelpdeskTeams,
  getHelpdeskStages,
  archiveHelpdeskTicket,
  deleteHelpdeskTicket,
  assignHelpdeskTicket
} from '../../../api/helpdeskServiceV2';
import SwipeableTicketItem from '../components/SwipeableTicketItem';
import UserSelectionModal from '../components/UserSelectionModal';
import { getCurrentUser } from '../../../api/models/usersApi';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// Component for ticket list by team
const HelpdeskTicketsScreen = () => {
  const [allTickets, setAllTickets] = useState([]);
  const [teams, setTeams] = useState([]);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [selectedStage, setSelectedStage] = useState(null);
  const [viewMode, setViewMode] = useState('byTeam'); // 'byTeam' or 'flat'
  const [currentUser, setCurrentUser] = useState(null);
  const [showMyTickets, setShowMyTickets] = useState(false);
  const [userModalVisible, setUserModalVisible] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [openSwipeableId, setOpenSwipeableId] = useState(null);

  const navigation = useNavigation();
  const { colors } = useTheme();
  const { user } = useAuth();

  // Load data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [selectedTeam, selectedStage, showMyTickets])
  );

  // Load current user on component mount
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const userData = await getCurrentUser();
        setCurrentUser(userData);
        console.log('Current user loaded:', userData);
      } catch (error) {
        console.error('Error loading current user:', error);
      }
    };

    fetchCurrentUser();
  }, []);

  // Organize tickets by team or stage
  const ticketsByTeam = useMemo(() => {
    if (!allTickets.length) return [];

    // If showing "My Tickets" and we have stages, group by stage instead of team
    if (showMyTickets && stages.length > 0) {
      // Group tickets by stage
      const sections = stages.map(stage => {
        const stageTickets = allTickets.filter(ticket =>
          ticket.stage_id && ticket.stage_id[0] === stage.id
        );

        return {
          title: stage.name,
          stageId: stage.id,
          data: stageTickets,
          sequence: stage.sequence || 0
        };
      });

      // Sort by stage sequence and filter out empty sections
      return sections
        .filter(section => section.data.length > 0)
        .sort((a, b) => a.sequence - b.sequence);
    }

    // If not showing "My Tickets", proceed with team grouping
    if (!teams.length) return [];

    // If a team is selected, only show that team
    if (selectedTeam) {
      const team = teams.find(t => t.id === selectedTeam);
      if (!team) return [];

      const teamTickets = allTickets.filter(ticket =>
        ticket.team_id && ticket.team_id[0] === selectedTeam &&
        (!selectedStage || (ticket.stage_id && ticket.stage_id[0] === selectedStage))
      );

      return [{
        title: team.name,
        teamId: team.id,
        data: teamTickets
      }];
    }

    // Group tickets by team
    const sections = teams.map(team => {
      const teamTickets = allTickets.filter(ticket =>
        ticket.team_id && ticket.team_id[0] === team.id &&
        (!selectedStage || (ticket.stage_id && ticket.stage_id[0] === selectedStage))
      );

      return {
        title: team.name,
        teamId: team.id,
        data: teamTickets
      };
    });

    // Filter out empty sections
    return sections.filter(section => section.data.length > 0);
  }, [allTickets, teams, stages, selectedTeam, selectedStage, showMyTickets]);

  // Filtered tickets for flat view
  const filteredTickets = useMemo(() => {
    if (!allTickets.length) return [];

    return allTickets.filter(ticket => {
      // Apply team filter if selected
      const teamMatch = !selectedTeam || (ticket.team_id && ticket.team_id[0] === selectedTeam);

      // Apply stage filter if selected
      const stageMatch = !selectedStage || (ticket.stage_id && ticket.stage_id[0] === selectedStage);

      // Apply "My Tickets" filter if enabled
      const assigneeMatch = !showMyTickets ||
        (currentUser && ticket.user_id && ticket.user_id[0] === currentUser.id);

      return teamMatch && stageMatch && assigneeMatch;
    });
  }, [allTickets, selectedTeam, selectedStage, showMyTickets, currentUser]);

  const loadData = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      console.log('Loading helpdesk data with forceRefresh:', forceRefresh);

      // Load teams first
      try {
        console.log('Loading teams...');
        const teamsData = await getHelpdeskTeams(forceRefresh);
        console.log('Teams data loaded:', teamsData);
        setTeams(teamsData || []);

        // Then load stages based on selected team
        console.log('Loading stages for team:', selectedTeam);
        const stagesData = await getHelpdeskStages(selectedTeam, forceRefresh);
        console.log('Stages data loaded:', stagesData);
        setStages(stagesData || []);

        // Finally load tickets with appropriate filters
        let domain = [];
        if (selectedTeam) {
          domain.push(['team_id', '=', selectedTeam]);
        }
        if (selectedStage) {
          domain.push(['stage_id', '=', selectedStage]);
        }

        // Add filter for "My Tickets" if enabled
        if (showMyTickets && currentUser && currentUser.id) {
          domain.push(['user_id', '=', currentUser.id]);
          console.log('Filtering for tickets assigned to current user:', currentUser.id);
        }

        // Filter out "Solved" tickets
        const solvedStages = stages.filter(stage =>
          stage.name.toLowerCase().includes('solved') ||
          stage.name.toLowerCase().includes('done') ||
          stage.name.toLowerCase().includes('closed')
        );

        if (solvedStages.length > 0) {
          const solvedStageIds = solvedStages.map(stage => stage.id);
          domain.push(['stage_id', 'not in', solvedStageIds]);
          console.log('Filtering out solved tickets with stage IDs:', solvedStageIds);
        }

        console.log('Loading tickets with domain:', domain);
        const ticketsData = await getHelpdeskTickets({
          domain,
          limit: 100, // Increase limit to get more tickets
          forceRefresh
        });
        console.log('Tickets data loaded:', ticketsData);
        setAllTickets(ticketsData || []);
      } catch (apiError) {
        console.error('API error:', apiError);
        setError('Failed to load data from server. Please try again.');
      }
    } catch (error) {
      console.error('Error loading helpdesk data:', error);
      setError('Failed to load helpdesk tickets. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData(true);
  }, [selectedTeam, selectedStage]);

  const handleTicketPress = (ticket) => {
    navigation.navigate('HelpdeskTicketDetail', { ticketId: ticket.id });
  };

  const handleCreateTicket = () => {
    navigation.navigate('HelpdeskTicketForm', { teamId: selectedTeam });
  };

  const handleTeamFilter = (teamId) => {
    setSelectedTeam(teamId === selectedTeam ? null : teamId);
    setSelectedStage(null); // Reset stage filter when team changes
  };

  const handleStageFilter = (stageId) => {
    setSelectedStage(stageId === selectedStage ? null : stageId);
  };

  const toggleMyTickets = () => {
    setShowMyTickets(!showMyTickets);
    // Reset other filters when toggling My Tickets
    if (!showMyTickets) {
      setSelectedTeam(null);
    }
  };

  // Handle archive action
  const handleArchiveTicket = async (ticket) => {
    try {
      const success = await archiveHelpdeskTicket(ticket.id);
      if (success) {
        // Remove the ticket from the list
        setAllTickets(prev => prev.filter(t => t.id !== ticket.id));
        Alert.alert('Success', `Ticket ${ticket.ticket_ref || '#' + ticket.id} has been archived.`);
      } else {
        Alert.alert('Error', 'Failed to archive the ticket. Please try again.');
      }
    } catch (error) {
      console.error('Error archiving ticket:', error);
      Alert.alert('Error', 'An error occurred while archiving the ticket.');
    }
  };

  // Handle delete action
  const handleDeleteTicket = async (ticket) => {
    try {
      const success = await deleteHelpdeskTicket(ticket.id);
      if (success) {
        // Remove the ticket from the list
        setAllTickets(prev => prev.filter(t => t.id !== ticket.id));
        Alert.alert('Success', `Ticket ${ticket.ticket_ref || '#' + ticket.id} has been deleted.`);
      } else {
        Alert.alert('Error', 'Failed to delete the ticket. Please try again.');
      }
    } catch (error) {
      console.error('Error deleting ticket:', error);
      Alert.alert('Error', 'An error occurred while deleting the ticket.');
    }
  };

  // Handle assign action
  const handleAssignTicket = (ticket) => {
    setSelectedTicket(ticket);
    setUserModalVisible(true);
  };

  // Handle user selection from modal
  const handleUserSelected = async (user) => {
    if (!selectedTicket) return;

    try {
      const success = await assignHelpdeskTicket(selectedTicket.id, user.id);
      if (success) {
        // Update the ticket in the list
        setAllTickets(prev => prev.map(t => {
          if (t.id === selectedTicket.id) {
            return { ...t, user_id: [user.id, user.name] };
          }
          return t;
        }));
        Alert.alert('Success', `Ticket ${selectedTicket.ticket_ref || '#' + selectedTicket.id} has been assigned to ${user.name}.`);
      } else {
        Alert.alert('Error', 'Failed to assign the ticket. Please try again.');
      }
    } catch (error) {
      console.error('Error assigning ticket:', error);
      Alert.alert('Error', 'An error occurred while assigning the ticket.');
    } finally {
      setSelectedTicket(null);
    }
  };

  // Handle swipeable open
  const handleSwipeableOpen = (ticketId, direction) => {
    // Close any previously opened swipeable
    if (openSwipeableId && openSwipeableId !== ticketId) {
      // This would require refs to each swipeable item, which is complex in a list
      // For simplicity, we'll just track the open swipeable ID
      setOpenSwipeableId(ticketId);
    } else {
      setOpenSwipeableId(ticketId);
    }
  };

  // Handle swipeable close
  const handleSwipeableClose = () => {
    setOpenSwipeableId(null);
  };

  const renderTicketItem = ({ item }) => {
    return (
      <SwipeableTicketItem
        ticket={item}
        onPress={handleTicketPress}
        onArchive={handleArchiveTicket}
        onDelete={handleDeleteTicket}
        onAssign={handleAssignTicket}
        onSwipeableOpen={(direction) => handleSwipeableOpen(item.id, direction)}
        onSwipeableClose={handleSwipeableClose}
      />
    );
  };

  // Render section header for team or stage
  const renderSectionHeader = ({ section }) => (
    <View style={[styles.sectionHeader, { backgroundColor: colors.background }]}>
      <Text style={[styles.sectionHeaderText, { color: colors.text }]}>{section.title}</Text>
      {section.teamId && (
        <TouchableOpacity
          style={[styles.sectionHeaderButton, { backgroundColor: colors.primary }]}
          onPress={() => navigation.navigate('HelpdeskTicketForm', { teamId: section.teamId })}
        >
          <Icon name="plus" size={16} color={colors.onPrimary} />
          <Text style={[styles.sectionHeaderButtonText, { color: colors.onPrimary }]}>New</Text>
        </TouchableOpacity>
      )}
      {showMyTickets && section.stageId && (
        <View style={styles.stageIndicator}>
          <Text style={[styles.stageCount, { color: colors.textSecondary }]}>
            {section.data.length} {section.data.length === 1 ? 'ticket' : 'tickets'}
          </Text>
        </View>
      )}
    </View>
  );

  // Render filters for teams and stages
  const renderFilters = () => (
    <View style={styles.filtersContainer}>
      {/* My Tickets Filter */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[
            styles.myTicketsButton,
            {
              backgroundColor: showMyTickets ? colors.primary : colors.surface,
              borderColor: colors.border
            }
          ]}
          onPress={toggleMyTickets}
        >
          <Icon
            name="account-check"
            size={18}
            color={showMyTickets ? colors.onPrimary : colors.text}
            style={styles.myTicketsIcon}
          />
          <Text
            style={[
              styles.myTicketsText,
              { color: showMyTickets ? colors.onPrimary : colors.text }
            ]}
          >
            My Tickets
          </Text>
        </TouchableOpacity>
      </View>

      {/* Teams Filter - Only show if not in My Tickets mode */}
      {!showMyTickets && (
        <View style={styles.filterRow}>
          <View style={styles.filterContainer}>
            <Text style={[styles.filterTitle, { color: colors.text }]}>Teams:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
              {teams.map(team => (
                <TouchableOpacity
                  key={team.id}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: selectedTeam === team.id ? colors.primary : colors.surface,
                      borderColor: colors.border
                    }
                  ]}
                  onPress={() => handleTeamFilter(team.id)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      { color: selectedTeam === team.id ? colors.onPrimary : colors.text }
                    ]}
                  >
                    {team.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

      {/* Stages Filter */}
      <View style={styles.filterRow}>
        <View style={styles.filterContainer}>
          <Text style={[styles.filterTitle, { color: colors.text }]}>Stages:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            {stages.map(stage => (
              <TouchableOpacity
                key={stage.id}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: selectedStage === stage.id ? colors.primary : colors.surface,
                    borderColor: colors.border
                  }
                ]}
                onPress={() => handleStageFilter(stage.id)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: selectedStage === stage.id ? colors.onPrimary : colors.text }
                  ]}
                >
                  {stage.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      {/* View Mode Toggle */}
      <View style={styles.viewToggleContainer}>
        <TouchableOpacity
          style={[
            styles.viewToggleButton,
            {
              backgroundColor: viewMode === 'byTeam' ? colors.primary : colors.surface,
              borderColor: colors.border
            }
          ]}
          onPress={() => setViewMode('byTeam')}
        >
          <Icon
            name={showMyTickets ? "format-list-group" : "view-list"}
            size={16}
            color={viewMode === 'byTeam' ? colors.onPrimary : colors.text}
          />
          <Text
            style={[
              styles.viewToggleText,
              { color: viewMode === 'byTeam' ? colors.onPrimary : colors.text }
            ]}
          >
            {showMyTickets ? "By Stage" : "By Team"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.viewToggleButton,
            {
              backgroundColor: viewMode === 'flat' ? colors.primary : colors.surface,
              borderColor: colors.border
            }
          ]}
          onPress={() => setViewMode('flat')}
        >
          <Icon
            name="ticket-outline"
            size={16}
            color={viewMode === 'flat' ? colors.onPrimary : colors.text}
          />
          <Text
            style={[
              styles.viewToggleText,
              { color: viewMode === 'flat' ? colors.onPrimary : colors.text }
            ]}
          >
            All Tickets
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

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

  // Render empty component
  const renderEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <Icon name="ticket-outline" size={48} color={colors.textSecondary} />
      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
        No tickets found
      </Text>
      {!selectedTeam && (
        <TouchableOpacity
          style={[styles.createButton, { backgroundColor: colors.primary }]}
          onPress={() => navigation.navigate('HelpdeskTicketForm')}
        >
          <Text style={[styles.createButtonText, { color: colors.onPrimary }]}>
            Create New Ticket
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // Main render method
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {renderFilters()}

      {viewMode === 'byTeam' ? (
        <SectionList
          sections={ticketsByTeam}
          renderItem={({ item }) => renderTicketItem({ item })}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={true}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={renderEmptyComponent}
        />
      ) : (
        <FlatList
          data={filteredTickets}
          renderItem={renderTicketItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={renderEmptyComponent}
        />
      )}

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={handleCreateTicket}
      >
        <Icon name="plus" size={24} color={colors.onPrimary} />
      </TouchableOpacity>

      {/* User Selection Modal */}
      <UserSelectionModal
        visible={userModalVisible}
        onClose={() => setUserModalVisible(false)}
        onSelectUser={handleUserSelected}
        ticketId={selectedTicket?.id}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 80, // Extra padding for FAB
  },
  // Ticket item styles
  ticketItem: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ticketNumber: {
    fontSize: 14,
    fontWeight: '500',
  },
  priorityIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  ticketTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  ticketMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  ticketMetaLeft: {
    flex: 1,
    marginRight: 8,
  },
  ticketMetaRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  ticketCustomer: {
    fontSize: 14,
    marginBottom: 4,
  },
  ticketActivity: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  ticketTeam: {
    fontSize: 14,
    marginBottom: 4,
  },
  ticketAssignee: {
    fontSize: 12,
  },
  ticketFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stageTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
  },
  stageText: {
    fontSize: 12,
    fontWeight: '500',
  },
  ticketDates: {
    alignItems: 'flex-end',
  },
  ticketDate: {
    fontSize: 12,
    marginBottom: 2,
  },
  ticketDeadline: {
    fontSize: 12,
    fontWeight: '500',
  },

  // Section header styles
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  sectionHeaderText: {
    fontSize: 18,
    fontWeight: '600',
  },
  sectionHeaderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  sectionHeaderButtonText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },

  // Filter styles
  filtersContainer: {
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterRow: {
    flexDirection: 'row',
  },
  filterContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  filterTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  filterScroll: {
    flexDirection: 'row',
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 14,
  },

  // View toggle styles
  viewToggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  viewToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginHorizontal: 8,
    borderWidth: 1,
  },
  viewToggleText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  myTicketsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  myTicketsIcon: {
    marginRight: 8,
  },
  myTicketsText: {
    fontSize: 14,
    fontWeight: '600',
  },
  stageIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  stageCount: {
    fontSize: 12,
    fontWeight: '500',
  },

  // Empty state styles
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    flex: 1,
    minHeight: 300,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    marginBottom: 24,
  },
  createButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },

  // Error and retry styles
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

  // FAB styles
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
});

export default HelpdeskTicketsScreen;
