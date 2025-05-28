import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  ScrollView,
  Modal,
  TextInput,
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
import AsyncStorage from '@react-native-async-storage/async-storage';

// Cache keys for local storage
const TEAMS_CACHE_KEY = 'helpdesk_teams_cache';
const STAGES_CACHE_KEY = 'helpdesk_stages_cache';
const TICKETS_CACHE_KEY = 'helpdesk_tickets_cache';
const CACHE_EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// Cache helper functions
const getCachedData = async (key) => {
  try {
    const cachedItem = await AsyncStorage.getItem(key);
    if (cachedItem) {
      const { data, timestamp } = JSON.parse(cachedItem);
      const isExpired = Date.now() - timestamp > CACHE_EXPIRATION_MS;
      if (!isExpired) {
        console.log(`Cache hit for ${key}`);
        return data;
      } else {
        console.log(`Cache expired for ${key}`);
        await AsyncStorage.removeItem(key);
      }
    }
  } catch (error) {
    console.error(`Error reading cache for ${key}:`, error);
  }
  return null;
};

const setCachedData = async (key, data) => {
  try {
    const cacheItem = {
      data,
      timestamp: Date.now()
    };
    await AsyncStorage.setItem(key, JSON.stringify(cacheItem));
    console.log(`Data cached for ${key}`);
  } catch (error) {
    console.error(`Error caching data for ${key}:`, error);
  }
};

// Dropdown component for team selection
const TeamDropdown = ({ title, options, selectedValue, onSelect, icon, colors }) => {
  const [isVisible, setIsVisible] = useState(false);

  const selectedOption = options.find(option => option.id === selectedValue);
  const displayTitle = selectedOption ? selectedOption.name : title;

  return (
    <>
      <TouchableOpacity
        style={[
          styles.dropdownButton,
          {
            backgroundColor: selectedValue ? colors.primary : colors.surface,
            borderColor: colors.border
          }
        ]}
        onPress={() => setIsVisible(true)}
      >
        <Icon
          name={icon}
          size={18}
          color={selectedValue ? colors.onPrimary : colors.text}
          style={styles.dropdownIcon}
        />
        <Text
          style={[
            styles.dropdownText,
            { color: selectedValue ? colors.onPrimary : colors.text }
          ]}
          numberOfLines={1}
        >
          {displayTitle}
        </Text>
        <Icon
          name="chevron-down"
          size={18}
          color={selectedValue ? colors.onPrimary : colors.text}
        />
      </TouchableOpacity>

      <Modal
        visible={isVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsVisible(false)}
        >
          <View style={[styles.dropdownModal, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Select {title}
              </Text>
              <TouchableOpacity onPress={() => setIsVisible(false)}>
                <Icon name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.optionsList}>
              {/* Clear selection option */}
              <TouchableOpacity
                style={[
                  styles.option,
                  !selectedValue && { backgroundColor: colors.primaryLight }
                ]}
                onPress={() => {
                  onSelect(null);
                  setIsVisible(false);
                }}
              >
                <Text style={[styles.optionText, { color: colors.text }]}>
                  All {title}
                </Text>
              </TouchableOpacity>

              {/* Options */}
              {options.map(option => (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.option,
                    selectedValue === option.id && { backgroundColor: colors.primaryLight }
                  ]}
                  onPress={() => {
                    onSelect(option.id);
                    setIsVisible(false);
                  }}
                >
                  <Text style={[styles.optionText, { color: colors.text }]}>
                    {option.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

// Stage checkbox dropdown component
const StageCheckboxDropdown = ({ title, options, selectedValues, onToggle, icon, colors }) => {
  const [isVisible, setIsVisible] = useState(false);

  const selectedCount = selectedValues.length;
  const displayTitle = selectedCount === 0 ? title : `${title} (${selectedCount})`;

  return (
    <>
      <TouchableOpacity
        style={[
          styles.dropdownButton,
          {
            backgroundColor: selectedCount > 0 ? colors.primary : colors.surface,
            borderColor: colors.border
          }
        ]}
        onPress={() => setIsVisible(true)}
      >
        <Icon
          name={icon}
          size={18}
          color={selectedCount > 0 ? colors.onPrimary : colors.text}
          style={styles.dropdownIcon}
        />
        <Text
          style={[
            styles.dropdownText,
            { color: selectedCount > 0 ? colors.onPrimary : colors.text }
          ]}
          numberOfLines={1}
        >
          {displayTitle}
        </Text>
        <Icon
          name="chevron-down"
          size={18}
          color={selectedCount > 0 ? colors.onPrimary : colors.text}
        />
      </TouchableOpacity>

      <Modal
        visible={isVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsVisible(false)}
        >
          <View style={[styles.dropdownModal, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Select {title}
              </Text>
              <TouchableOpacity onPress={() => setIsVisible(false)}>
                <Icon name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.optionsList}>
              {/* Options with checkboxes */}
              {options.map(option => (
                <TouchableOpacity
                  key={option.id}
                  style={styles.checkboxOption}
                  onPress={() => onToggle(option.id)}
                >
                  <Icon
                    name={selectedValues.includes(option.id) ? "checkbox-marked" : "checkbox-blank-outline"}
                    size={24}
                    color={selectedValues.includes(option.id) ? colors.primary : colors.textSecondary}
                  />
                  <Text style={[styles.checkboxOptionText, { color: colors.text }]}>
                    {option.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

// Main component
const HelpdeskTicketsScreen = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { user } = useAuth();

  // State
  const [tickets, setTickets] = useState([]);
  const [teams, setTeams] = useState([]);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filter state
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [selectedStages, setSelectedStages] = useState([]); // Changed to array for multiple selection
  const [showMyTickets, setShowMyTickets] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Favorites state
  const [showFavoritesModal, setShowFavoritesModal] = useState(false);
  const [favoriteFilters, setFavoriteFilters] = useState({
    myTickets: false,
    selectedTeam: null,
    selectedStages: []
  });

  // Modal state
  const [userModalVisible, setUserModalVisible] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);

  // Current user
  const [currentUser, setCurrentUser] = useState(null);

  // Refs
  const searchInputRef = useRef(null);

  // Load current user
  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const userData = await getCurrentUser();
        setCurrentUser(userData);
      } catch (error) {
        console.error('Error loading current user:', error);
      }
    };
    loadCurrentUser();
  }, []);

  // Load favorites from AsyncStorage
  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const savedFilters = await AsyncStorage.getItem('helpdesk_favorite_filters');
        if (savedFilters) {
          const parsed = JSON.parse(savedFilters);
          setFavoriteFilters(parsed);
          // Apply favorite filters
          setShowMyTickets(parsed.myTickets);
          setSelectedTeam(parsed.selectedTeam);
          setSelectedStages(parsed.selectedStages);
        }
      } catch (error) {
        console.error('Error loading favorite filters:', error);
      }
    };
    loadFavorites();
  }, []);

  // Load data with caching
  const loadData = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(!forceRefresh);
      setError(null);

      // Load teams and stages from cache first, then API
      let teamsData = [];
      let stagesData = [];

      if (!forceRefresh) {
        teamsData = await getCachedData(TEAMS_CACHE_KEY) || [];
        stagesData = await getCachedData(STAGES_CACHE_KEY) || [];
      }

      // If no cached data or force refresh, fetch from API
      if (forceRefresh || teamsData.length === 0) {
        console.log('Fetching teams from API...');
        teamsData = await getHelpdeskTeams();
        if (teamsData) {
          await setCachedData(TEAMS_CACHE_KEY, teamsData);
        }
      }

      if (forceRefresh || stagesData.length === 0) {
        console.log('Fetching stages from API...');
        stagesData = await getHelpdeskStages();
        if (stagesData) {
          // Filter out "Solved" and "Cancelled" stages from the dropdown options (comprehensive)
          const filteredStages = stagesData.filter(stage => {
            const stageName = stage.name.toLowerCase();
            return !stageName.includes('solved') &&
                   !stageName.includes('solve') &&
                   !stageName.includes('closed') &&
                   !stageName.includes('close') &&
                   !stageName.includes('done') &&
                   !stageName.includes('complete') &&
                   !stageName.includes('finished') &&
                   !stageName.includes('cancelled') &&
                   !stageName.includes('canceled') &&
                   !stageName.includes('cancel') &&
                   !stageName.includes('reject') &&
                   !stageName.includes('declined');
          });
          await setCachedData(STAGES_CACHE_KEY, filteredStages);
          stagesData = filteredStages;
        }
      }

      setTeams(teamsData || []);
      setStages(stagesData || []);

      // Build domain filter (no search - search is local only)
      const domain = [
        // Exclude solved tickets (multiple variations)
        '!', ['stage_id.name', 'ilike', 'solved'],
        '!', ['stage_id.name', 'ilike', 'solve'],
        '!', ['stage_id.name', 'ilike', 'closed'],
        '!', ['stage_id.name', 'ilike', 'close'],
        '!', ['stage_id.name', 'ilike', 'done'],
        '!', ['stage_id.name', 'ilike', 'complete'],
        '!', ['stage_id.name', 'ilike', 'finished'],
        // Exclude cancelled tickets (multiple variations)
        '!', ['stage_id.name', 'ilike', 'cancelled'],
        '!', ['stage_id.name', 'ilike', 'canceled'],
        '!', ['stage_id.name', 'ilike', 'cancel'],
        '!', ['stage_id.name', 'ilike', 'reject'],
        '!', ['stage_id.name', 'ilike', 'declined']
      ];

      console.log('Fetching tickets from API with enhanced filtering...');
      const ticketsData = await getHelpdeskTickets({
        domain,
        forceRefresh
      });

      if (ticketsData) {
        // Cache tickets for offline use
        await setCachedData(TICKETS_CACHE_KEY, ticketsData);
        setTickets(ticketsData);
      }

    } catch (err) {
      console.error('Error loading helpdesk data:', err);
      setError('Failed to load helpdesk data. Please try again.');

      // Try to load from cache as fallback
      const cachedTickets = await getCachedData(TICKETS_CACHE_KEY);
      if (cachedTickets) {
        setTickets(cachedTickets);
        console.log('Loaded tickets from cache as fallback');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Load data on focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // Handle refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData(true);
  }, [loadData]);

  // Filter and group tickets by stages with local search
  const groupedTickets = useMemo(() => {
    if (!tickets.length) return [];

    // First filter tickets based on selected filters
    const filtered = tickets.filter(ticket => {
      // Apply team filter
      const teamMatch = !selectedTeam || (ticket.team_id && ticket.team_id[0] === selectedTeam);

      // Apply stage filter (multiple stages)
      const stageMatch = selectedStages.length === 0 ||
        (ticket.stage_id && selectedStages.includes(ticket.stage_id[0]));

      // Apply "My Tickets" filter
      const assigneeMatch = !showMyTickets ||
        (currentUser && ticket.user_id && ticket.user_id[0] === currentUser.id);

      // Apply local search filter
      const searchMatch = !searchQuery.trim() || (
        (ticket.name && ticket.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (ticket.description && ticket.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (ticket.partner_name && ticket.partner_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (ticket.id && ticket.id.toString().includes(searchQuery))
      );

      return teamMatch && stageMatch && assigneeMatch && searchMatch;
    });

    // Group tickets by stage
    const groupedByStage = {};

    filtered.forEach(ticket => {
      const stageName = ticket.stage_id ? ticket.stage_id[1] : 'No Stage';
      if (!groupedByStage[stageName]) {
        groupedByStage[stageName] = [];
      }
      groupedByStage[stageName].push(ticket);
    });

    // Convert to section list format and sort stages in logical order
    const stageOrder = ['New', 'In Info', 'Pend Int', 'Pend Cust', 'Hold'];
    const sections = [];

    // Add stages in preferred order first
    stageOrder.forEach(stageName => {
      if (groupedByStage[stageName]) {
        sections.push({
          title: stageName,
          data: groupedByStage[stageName].sort((a, b) => {
            // Sort by priority (higher first), then by creation date (newer first)
            if (a.priority !== b.priority) {
              return (b.priority || 0) - (a.priority || 0);
            }
            return new Date(b.create_date) - new Date(a.create_date);
          })
        });
        delete groupedByStage[stageName];
      }
    });

    // Add any remaining stages not in the preferred order
    Object.keys(groupedByStage).sort().forEach(stageName => {
      sections.push({
        title: stageName,
        data: groupedByStage[stageName].sort((a, b) => {
          // Sort by priority (higher first), then by creation date (newer first)
          if (a.priority !== b.priority) {
            return (b.priority || 0) - (a.priority || 0);
          }
          return new Date(b.create_date) - new Date(a.create_date);
        })
      });
    });

    return sections;
  }, [tickets, selectedTeam, selectedStages, showMyTickets, currentUser, searchQuery]);

  // Event handlers
  const handleTicketPress = (ticket) => {
    navigation.navigate('HelpdeskTicketDetail', { ticketId: ticket.id });
  };

  const handleCreateTicket = () => {
    navigation.navigate('HelpdeskTicketForm', { teamId: selectedTeam });
  };

  const handleTeamSelect = (teamId) => {
    setSelectedTeam(teamId);
  };

  const handleStageToggle = (stageId) => {
    setSelectedStages(prev => {
      if (prev.includes(stageId)) {
        return prev.filter(id => id !== stageId);
      } else {
        return [...prev, stageId];
      }
    });
  };

  const toggleMyTickets = () => {
    setShowMyTickets(!showMyTickets);
  };

  const handleSearchChange = (text) => {
    setSearchQuery(text);
    // Local search - no API calls needed
  };

  const clearAllFilters = () => {
    setSelectedTeam(null);
    setSelectedStages([]);
    setShowMyTickets(false);
    setSearchQuery('');
  };

  const clearFiltersOnly = () => {
    setSelectedTeam(null);
    setSelectedStages([]);
    setShowMyTickets(false);
  };

  const saveFavoriteFilters = async () => {
    try {
      const filters = {
        myTickets: showMyTickets,
        selectedTeam,
        selectedStages
      };
      await AsyncStorage.setItem('helpdesk_favorite_filters', JSON.stringify(filters));
      setFavoriteFilters(filters);
      setShowFavoritesModal(false);
      Alert.alert('Success', 'Favorite filters saved!');
    } catch (error) {
      console.error('Error saving favorite filters:', error);
      Alert.alert('Error', 'Failed to save favorite filters');
    }
  };

  const loadFavoriteFilters = () => {
    setShowMyTickets(favoriteFilters.myTickets);
    setSelectedTeam(favoriteFilters.selectedTeam);
    setSelectedStages(favoriteFilters.selectedStages);
    setShowFavoritesModal(false);
  };

  const handleUserSelected = async (userId) => {
    if (selectedTicket) {
      try {
        await assignHelpdeskTicket(selectedTicket.id, userId);
        setUserModalVisible(false);
        setSelectedTicket(null);
        loadData(true); // Refresh data
        Alert.alert('Success', 'Ticket assigned successfully');
      } catch (error) {
        console.error('Error assigning ticket:', error);
        Alert.alert('Error', 'Failed to assign ticket');
      }
    }
  };

  const handleArchiveTicket = async (ticketId) => {
    try {
      await archiveHelpdeskTicket(ticketId);
      loadData(true); // Refresh data
      Alert.alert('Success', 'Ticket archived successfully');
    } catch (error) {
      console.error('Error archiving ticket:', error);
      Alert.alert('Error', 'Failed to archive ticket');
    }
  };

  const handleDeleteTicket = async (ticketId) => {
    Alert.alert(
      'Delete Ticket',
      'Are you sure you want to delete this ticket? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteHelpdeskTicket(ticketId);
              loadData(true); // Refresh data
              Alert.alert('Success', 'Ticket deleted successfully');
            } catch (error) {
              console.error('Error deleting ticket:', error);
              Alert.alert('Error', 'Failed to delete ticket');
            }
          }
        }
      ]
    );
  };

  const handleAssignTicket = (ticket) => {
    setSelectedTicket(ticket);
    setUserModalVisible(true);
  };

  // Render ticket item (memoized)
  const renderTicketItem = useCallback(({ item }) => (
    <SwipeableTicketItem
      ticket={item}
      onPress={() => handleTicketPress(item)}
      onArchive={() => handleArchiveTicket(item.id)}
      onDelete={() => handleDeleteTicket(item.id)}
      onAssign={() => handleAssignTicket(item)}
      colors={colors}
    />
  ), [colors, handleTicketPress, handleArchiveTicket, handleDeleteTicket, handleAssignTicket]);

  // Render section header (stage divider) (memoized)
  const renderSectionHeader = useCallback(({ section: { title, data } }) => (
    <View style={[styles.sectionHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      <View style={styles.sectionHeaderContent}>
        <Text style={[styles.sectionHeaderTitle, { color: colors.text }]}>
          {title}
        </Text>
        <View style={[styles.sectionHeaderBadge, { backgroundColor: colors.primary }]}>
          <Text style={[styles.sectionHeaderCount, { color: colors.onPrimary }]}>
            {data.length}
          </Text>
        </View>
      </View>
    </View>
  ), [colors]);

  // Render search bar with clear filters button
  const renderSearchBar = () => (
    <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      <View style={[styles.searchInputContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <Icon name="magnify" size={20} color={colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search tickets by title, description, or ID..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={handleSearchChange}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchButton}>
            <Icon name="close-circle-outline" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Clear Filters Button in Search Bar */}
      {(selectedTeam || selectedStages.length > 0 || showMyTickets) && (
        <TouchableOpacity
          style={[styles.clearAllFiltersButton, { borderColor: colors.border }]}
          onPress={clearFiltersOnly}
        >
          <Icon name="filter-off" size={18} color={colors.textSecondary} />
          <Text style={[styles.clearAllText, { color: colors.textSecondary }]}>Clear</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // Render compact filter bar (single row)
  const renderFilters = () => (
    <View style={[styles.filtersContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      <View style={styles.filterRow}>
        {/* Favorites Button */}
        <TouchableOpacity
          style={[
            styles.favoritesButton,
            {
              borderColor: colors.border,
              backgroundColor: colors.background,
            }
          ]}
          onPress={() => setShowFavoritesModal(true)}
        >
          <Icon name="star" size={16} color={colors.primary} />
        </TouchableOpacity>

        {/* My Tickets Button */}
        <TouchableOpacity
          style={[
            styles.myTicketsButton,
            {
              backgroundColor: showMyTickets ? colors.primary : colors.background,
              borderColor: showMyTickets ? colors.primary : colors.border,
            }
          ]}
          onPress={toggleMyTickets}
        >
          <Icon
            name="account-heart"
            size={14}
            color={showMyTickets ? colors.onPrimary : colors.primary}
            style={styles.buttonIcon}
          />
          <Text
            style={[
              styles.buttonText,
              { color: showMyTickets ? colors.onPrimary : colors.text }
            ]}
          >
            My Tickets
          </Text>
        </TouchableOpacity>

        {/* Teams Dropdown */}
        <TeamDropdown
          title="Teams"
          options={teams}
          selectedValue={selectedTeam}
          onSelect={handleTeamSelect}
          icon="account-group"
          colors={colors}
        />

        {/* Stages Checkbox Dropdown */}
        <StageCheckboxDropdown
          title="Stages"
          options={stages}
          selectedValues={selectedStages}
          onToggle={handleStageToggle}
          icon="flag-variant"
          colors={colors}
        />
      </View>
    </View>
  );

  // Render empty component
  const renderEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <Icon name="ticket-outline" size={48} color={colors.textSecondary} />
      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
        No tickets found
      </Text>
      <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
        {showMyTickets ? 'No tickets assigned to you' : 'Create a new ticket to get started'}
      </Text>
      <TouchableOpacity
        style={[styles.createButton, { backgroundColor: colors.primary }]}
        onPress={handleCreateTicket}
      >
        <Text style={[styles.createButtonText, { color: colors.onPrimary }]}>
          Create New Ticket
        </Text>
      </TouchableOpacity>
    </View>
  );

  // Calculate total tickets count for empty check
  const totalTicketsCount = groupedTickets.reduce((total, section) => total + section.data.length, 0);

  // Loading state
  if (loading && !refreshing) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>Loading tickets...</Text>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Icon name="alert-circle-outline" size={48} color={colors.error} />
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

  // Main render
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Search Bar */}
      {renderSearchBar()}

      {/* Compact Filter Bar */}
      {renderFilters()}

      {/* Tickets List with Stage Dividers */}
      <SectionList
        sections={groupedTickets}
        renderItem={renderTicketItem}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={totalTicketsCount === 0 ? renderEmptyComponent : null}
        contentContainerStyle={totalTicketsCount === 0 ? styles.emptyListContainer : styles.listContainer}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={true}
        ItemSeparatorComponent={() => <View style={[styles.itemSeparator, { backgroundColor: colors.border }]} />}
      />

      {/* Floating Action Button */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={handleCreateTicket}
      >
        <Icon name="plus" size={24} color={colors.onPrimary} />
      </TouchableOpacity>

      {/* User Selection Modal */}
      <UserSelectionModal
        visible={userModalVisible}
        onClose={() => {
          setUserModalVisible(false);
          setSelectedTicket(null);
        }}
        onUserSelected={handleUserSelected}
        colors={colors}
      />

      {/* Favorites Modal */}
      <Modal
        visible={showFavoritesModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFavoritesModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.favoritesModal, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Favorite Filters
              </Text>
              <TouchableOpacity onPress={() => setShowFavoritesModal(false)}>
                <Icon name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.favoritesContent}>
              <Text style={[styles.favoritesSubtitle, { color: colors.textSecondary }]}>
                Save your current filter settings as favorites
              </Text>

              <View style={styles.currentFiltersSection}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Current Filters:</Text>

                <View style={styles.filterSummary}>
                  <Text style={[styles.filterItem, { color: colors.text }]}>
                    My Tickets: {showMyTickets ? 'Yes' : 'No'}
                  </Text>
                  <Text style={[styles.filterItem, { color: colors.text }]}>
                    Team: {selectedTeam ? teams.find(t => t.id === selectedTeam)?.name || 'Unknown' : 'All'}
                  </Text>
                  <Text style={[styles.filterItem, { color: colors.text }]}>
                    Stages: {selectedStages.length === 0 ? 'All' : `${selectedStages.length} selected`}
                  </Text>
                </View>
              </View>

              <View style={styles.favoritesActions}>
                <TouchableOpacity
                  style={[styles.favoriteActionButton, { backgroundColor: colors.primary }]}
                  onPress={saveFavoriteFilters}
                >
                  <Icon name="content-save" size={20} color={colors.onPrimary} />
                  <Text style={[styles.favoriteActionText, { color: colors.onPrimary }]}>
                    Save Current Filters
                  </Text>
                </TouchableOpacity>

                {(favoriteFilters.myTickets || favoriteFilters.selectedTeam || favoriteFilters.selectedStages.length > 0) && (
                  <TouchableOpacity
                    style={[styles.favoriteActionButton, { backgroundColor: colors.secondary || colors.primary }]}
                    onPress={loadFavoriteFilters}
                  >
                    <Icon name="star" size={20} color={colors.onPrimary} />
                    <Text style={[styles.favoriteActionText, { color: colors.onPrimary }]}>
                      Load Saved Filters
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  // Search Bar Styles
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 4,
  },
  clearSearchButton: {
    padding: 4,
  },
  clearAllFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 6,
    gap: 4,
  },
  clearAllText: {
    fontSize: 12,
    fontWeight: '500',
  },

  // Filter Bar Styles
  filtersContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },

  // List Container Styles
  listContainer: {
    paddingBottom: 100, // Space for FAB
  },
  itemSeparator: {
    height: 1,
    marginHorizontal: 16,
  },

  // Section Header Styles
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sectionHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionHeaderBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 24,
    alignItems: 'center',
  },
  sectionHeaderCount: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Favorites Button
  favoritesButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 36,
    height: 36,
  },

  // Compact My Tickets Button
  compactMyTicketsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    minWidth: 50,
  },

  // My Tickets Button (legacy - keeping for compatibility)
  myTicketsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    minWidth: 80,
  },

  // Dropdown Button Styles
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    flex: 1,
    minWidth: 60,
  },
  dropdownIcon: {
    marginRight: 4,
  },
  dropdownText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
  },

  // Button Common Styles
  buttonIcon: {
    marginRight: 4,
  },
  buttonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  compactButtonText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownModal: {
    width: '80%',
    maxHeight: '60%',
    borderRadius: 12,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  optionsList: {
    maxHeight: 300,
  },
  option: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5E5',
  },
  optionText: {
    fontSize: 16,
  },

  // Checkbox Option Styles
  checkboxOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5E5',
  },
  checkboxOptionText: {
    fontSize: 16,
    marginLeft: 12,
    flex: 1,
  },

  // Favorites Modal Styles
  favoritesModal: {
    width: '90%',
    maxHeight: '70%',
    borderRadius: 12,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  favoritesContent: {
    padding: 16,
  },
  favoritesSubtitle: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  currentFiltersSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  filterSummary: {
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
  },
  filterItem: {
    fontSize: 14,
    marginBottom: 4,
  },
  favoritesActions: {
    gap: 12,
  },
  favoriteActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  favoriteActionText: {
    fontSize: 16,
    fontWeight: '600',
  },

  // Empty State Styles
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyListContainer: {
    flexGrow: 1,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  createButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },

  // Loading State Styles
  loadingText: {
    fontSize: 16,
    marginTop: 16,
  },

  // Error State Styles
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },

  // Floating Action Button
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
});

export default HelpdeskTicketsScreen;