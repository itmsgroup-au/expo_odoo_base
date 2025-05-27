import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Animated,
  Dimensions
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../../contexts/ThemeContext';
import { updateHelpdeskTicket } from '../../../api/helpdeskServiceV2';

const { width } = Dimensions.get('window');

const SwipeableTicketItem = ({ 
  ticket, 
  onPress, 
  onArchive, 
  onDelete, 
  onAssign,
  onSwipeableOpen,
  onSwipeableClose
}) => {
  const swipeableRef = useRef(null);
  const { colors } = useTheme();

  // Format dates
  const createDate = new Date(ticket.create_date).toLocaleDateString();
  const hasDeadline = ticket.sla_deadline && new Date(ticket.sla_deadline) > new Date();
  const deadlineDate = hasDeadline ? new Date(ticket.sla_deadline).toLocaleDateString() : null;

  // Determine priority color
  const priorityColors = ['#6B7280', '#3B82F6', '#F59E0B', '#EF4444'];
  const priorityLevel = ticket.priority || 0;
  const ticketRef = ticket.ticket_ref || `#${ticket.id}`;

  // Determine status color based on kanban_state
  let statusColor = colors.primary;
  if (ticket.kanban_state === 'blocked') {
    statusColor = '#EF4444'; // Red for blocked
  } else if (ticket.kanban_state === 'done') {
    statusColor = '#10B981'; // Green for done
  }

  // Handle archive action
  const handleArchive = () => {
    Alert.alert(
      'Archive Ticket',
      `Are you sure you want to archive ticket ${ticketRef}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Archive', 
          style: 'destructive',
          onPress: () => {
            if (onArchive) {
              onArchive(ticket);
            }
            if (swipeableRef.current) {
              swipeableRef.current.close();
            }
          }
        }
      ]
    );
  };

  // Handle delete action
  const handleDelete = () => {
    Alert.alert(
      'Delete Ticket',
      `Are you sure you want to delete ticket ${ticketRef}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            if (onDelete) {
              onDelete(ticket);
            }
            if (swipeableRef.current) {
              swipeableRef.current.close();
            }
          }
        }
      ]
    );
  };

  // Handle assign action
  const handleAssign = () => {
    if (onAssign) {
      onAssign(ticket);
    }
    if (swipeableRef.current) {
      swipeableRef.current.close();
    }
  };

  // Render left actions (archive)
  const renderLeftActions = (progress, dragX) => {
    const trans = dragX.interpolate({
      inputRange: [0, 50, 100, 101],
      outputRange: [-20, 0, 0, 0],
    });
    
    return (
      <TouchableOpacity 
        style={[styles.leftAction, { backgroundColor: '#4CAF50' }]}
        onPress={handleArchive}
      >
        <Animated.View
          style={[
            styles.actionContent,
            {
              transform: [{ translateX: trans }],
            },
          ]}>
          <Icon name="archive" size={24} color="#fff" />
          <Text style={styles.actionText}>Archive</Text>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  // Render right actions (delete and assign)
  const renderRightActions = (progress, dragX) => {
    const trans = dragX.interpolate({
      inputRange: [-101, -100, -50, 0],
      outputRange: [0, 0, 0, 20],
    });
    
    return (
      <View style={styles.rightActionsContainer}>
        <TouchableOpacity 
          style={[styles.rightAction, { backgroundColor: '#2196F3' }]}
          onPress={handleAssign}
        >
          <Animated.View
            style={[
              styles.actionContent,
              {
                transform: [{ translateX: trans }],
              },
            ]}>
            <Icon name="account-plus" size={24} color="#fff" />
            <Text style={styles.actionText}>Assign</Text>
          </Animated.View>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.rightAction, { backgroundColor: '#F44336' }]}
          onPress={handleDelete}
        >
          <Animated.View
            style={[
              styles.actionContent,
              {
                transform: [{ translateX: trans }],
              },
            ]}>
            <Icon name="delete" size={24} color="#fff" />
            <Text style={styles.actionText}>Delete</Text>
          </Animated.View>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      onSwipeableOpen={(direction) => {
        if (onSwipeableOpen) onSwipeableOpen(direction);
      }}
      onSwipeableClose={() => {
        if (onSwipeableClose) onSwipeableClose();
      }}
      friction={2}
      leftThreshold={30}
      rightThreshold={40}
    >
      <TouchableOpacity
        style={[styles.ticketItem, { backgroundColor: colors.surface }]}
        onPress={() => onPress(ticket)}
      >
        <View style={styles.ticketHeader}>
          <Text style={[styles.ticketNumber, { color: colors.primary }]}>{ticketRef}</Text>
          <View style={[styles.priorityIndicator, { backgroundColor: priorityColors[priorityLevel] }]} />
        </View>

        <Text style={[styles.ticketTitle, { color: colors.text }]} numberOfLines={2}>
          {ticket.name}
        </Text>

        <View style={styles.ticketMeta}>
          {ticket.partner_name && (
            <Text style={[styles.ticketCustomer, { color: colors.textSecondary }]} numberOfLines={1}>
              {ticket.partner_name}
            </Text>
          )}
          
          <View style={styles.ticketMetaRow}>
            <Text style={[styles.ticketDate, { color: colors.textSecondary }]}>
              Created: {createDate}
            </Text>
            
            {deadlineDate && (
              <Text style={[styles.ticketDeadline, { color: colors.error }]}>
                Due: {deadlineDate}
              </Text>
            )}
          </View>
        </View>

        {ticket.user_id && (
          <View style={styles.assigneeContainer}>
            <Icon name="account" size={14} color={colors.textSecondary} />
            <Text style={[styles.assigneeText, { color: colors.textSecondary }]}>
              {ticket.user_id[1]}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </Swipeable>
  );
};

const styles = StyleSheet.create({
  ticketItem: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
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
    marginBottom: 4,
  },
  ticketCustomer: {
    fontSize: 14,
    marginBottom: 4,
  },
  ticketMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  ticketDate: {
    fontSize: 12,
  },
  ticketDeadline: {
    fontSize: 12,
    fontWeight: '500',
  },
  assigneeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  assigneeText: {
    fontSize: 12,
    marginLeft: 4,
  },
  leftAction: {
    flex: 1,
    justifyContent: 'center',
    marginBottom: 8,
    borderRadius: 8,
  },
  rightActionsContainer: {
    width: width * 0.4,
    flexDirection: 'row',
    marginBottom: 8,
  },
  rightAction: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginLeft: 4,
  },
  actionContent: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  actionText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
    marginTop: 4,
  },
});

export default SwipeableTicketItem;
