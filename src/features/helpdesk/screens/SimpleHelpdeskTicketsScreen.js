import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { getHelpdeskTickets } from '../../../api/helpdeskService';

const SimpleHelpdeskTicketsScreen = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const navigation = useNavigation();
  const PAGE_SIZE = 20; // Smaller page size for better performance

  // Load data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadTickets();
    }, [])
  );

  // Load tickets from API
  const loadTickets = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      // Reset state if refreshing
      if (forceRefresh) {
        setPage(0);
        setHasMore(true);
      }

      // Fetch tickets with pagination
      const ticketsData = await getHelpdeskTickets({
        limit: PAGE_SIZE,
        offset: forceRefresh ? 0 : page * PAGE_SIZE,
        forceRefresh
      });

      // Update state based on response
      if (Array.isArray(ticketsData)) {
        if (forceRefresh) {
          setTickets(ticketsData);
        } else {
          setTickets(prev => [...prev, ...ticketsData]);
        }

        // Check if we have more data to load
        setHasMore(ticketsData.length >= PAGE_SIZE);
      } else {
        console.error('Unexpected response format:', ticketsData);
        setError('Invalid response format from server');
      }
    } catch (err) {
      console.error('Error loading helpdesk tickets:', err);
      setError('Failed to load tickets. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  // Handle refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadTickets(true);
  }, []);

  // Handle load more
  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore && !refreshing) {
      console.log('Loading more tickets...');
      setLoadingMore(true);
      setPage(prevPage => prevPage + 1);
      loadTickets(false);
    }
  }, [loadingMore, hasMore, refreshing]);

  // Navigate to ticket detail
  const handleTicketPress = (ticket) => {
    navigation.navigate('HelpdeskTicketDetail', { ticketId: ticket.id });
  };

  // Create new ticket
  const handleCreateTicket = () => {
    navigation.navigate('HelpdeskTicketForm');
  };

  // Render ticket item
  const renderTicketItem = ({ item }) => {
    const priorityColors = ['#6B7280', '#3B82F6', '#F59E0B', '#EF4444'];
    const priorityLevel = item.priority || 0;
    
    // Format date
    const createDate = item.create_date ? 
      new Date(item.create_date).toLocaleDateString() : 
      'Unknown date';
    
    // Get ticket reference or ID
    const ticketRef = item.ticket_ref || `#${item.id}`;
    
    // Determine status color based on kanban_state
    let statusColor = '#3B82F6'; // Default blue
    if (item.kanban_state === 'blocked') {
      statusColor = '#EF4444'; // Red for blocked
    } else if (item.kanban_state === 'done') {
      statusColor = '#10B981'; // Green for done
    }

    return (
      <TouchableOpacity
        style={styles.ticketItem}
        onPress={() => handleTicketPress(item)}
      >
        <View style={styles.ticketHeader}>
          <Text style={styles.ticketNumber}>{ticketRef}</Text>
          <View style={[styles.priorityIndicator, { backgroundColor: priorityColors[priorityLevel] }]} />
        </View>

        <Text style={styles.ticketTitle} numberOfLines={2}>
          {item.name}
        </Text>

        <View style={styles.ticketMeta}>
          {item.partner_name && (
            <Text style={styles.ticketCustomer} numberOfLines={1}>
              {item.partner_name}
            </Text>
          )}
          
          <Text style={styles.ticketDate}>
            Created: {createDate}
          </Text>
        </View>
        
        {item.stage_id && (
          <View style={[styles.stageTag, { backgroundColor: statusColor + '20', borderColor: statusColor }]}>
            <Text style={[styles.stageText, { color: statusColor }]}>
              {typeof item.stage_id === 'object' ? item.stage_id[1] : 'Processing'}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // Render loading indicator in footer when loading more
  const renderFooter = () => {
    if (!loadingMore) return null;
    
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#3498db" />
        <Text style={styles.footerText}>Loading more tickets...</Text>
      </View>
    );
  };

  // Render empty state
  const renderEmptyComponent = () => {
    if (loading && !refreshing) return null;
    
    return (
      <View style={styles.emptyContainer}>
        <Icon name="ticket-outline" size={48} color="#ccc" />
        <Text style={styles.emptyText}>
          No tickets found
        </Text>
        <TouchableOpacity 
          style={styles.addFirstButton}
          onPress={handleCreateTicket}
        >
          <Text style={styles.addFirstButtonText}>Create your first ticket</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.homeButton}
          onPress={() => navigation.navigate('Home')}
        >
          <Icon name="home" size={24} color="#3498db" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>
            Helpdesk Tickets
          </Text>
          {tickets.length > 0 && (
            <Text style={styles.headerCount}>
              {tickets.length} tickets
            </Text>
          )}
        </View>
        <View style={{width: 24}} /> {/* Empty view for balance */}
      </View>

      {/* Main Content */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3498db" />
          <Text style={styles.loadingText}>Loading tickets...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Icon name="alert-circle-outline" size={48} color="#e74c3c" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => loadTickets(true)}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={tickets}
          renderItem={renderTicketItem}
          keyExtractor={(item) => `ticket-${item.id}`}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyComponent}
          ListFooterComponent={renderFooter}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#3498db']}
            />
          }
        />
      )}

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={handleCreateTicket}
      >
        <Icon name="plus" size={24} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    height: 60,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitleContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  headerCount: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  homeButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#e74c3c',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#3498db',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: 300,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
  },
  addFirstButton: {
    marginTop: 16,
    backgroundColor: '#3498db',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
  addFirstButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  ticketItem: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
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
    color: '#3498db',
  },
  priorityIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  ticketTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  ticketMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  ticketCustomer: {
    fontSize: 14,
    color: '#666',
  },
  ticketDate: {
    fontSize: 12,
    color: '#999',
  },
  stageTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  stageText: {
    fontSize: 12,
    fontWeight: '500',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  footerLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  footerText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
});

export default SimpleHelpdeskTicketsScreen;
