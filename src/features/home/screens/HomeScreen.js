import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl, ActivityIndicator } from 'react-native';
import { useAuth } from '../../../contexts/AuthContext';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../../contexts/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const HomeScreen = ({ userSession }) => {
  const { logout, user } = useAuth();
  const navigation = useNavigation();
  const { colors } = useTheme();

  // State
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [recentActivity, setRecentActivity] = useState([]);

  // Load recent activity data
  const loadRecentActivity = async () => {
    try {
      setLoading(true);
      // Simulate loading recent activity
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mock recent activity data
      setRecentActivity([
        {
          id: 1,
          title: 'New Helpdesk Ticket',
          description: 'Ticket #12345 created by John Doe',
          time: 'Today, 10:30 AM',
          icon: 'ticket-account',
          color: colors.primary
        },
        {
          id: 2,
          title: 'Contact Updated',
          description: 'ABC Company contact information updated',
          time: 'Yesterday, 2:45 PM',
          icon: 'account-edit',
          color: colors.secondary
        },
        {
          id: 3,
          title: 'New Message',
          description: 'Message received in General channel',
          time: 'Yesterday, 11:20 AM',
          icon: 'message-text',
          color: colors.success
        }
      ]);
    } catch (error) {
      console.error('Error loading recent activity:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Load data on focus
  useFocusEffect(
    React.useCallback(() => {
      loadRecentActivity();
    }, [])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadRecentActivity();
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Logout Error', 'An error occurred during logout.');
    }
  };

  // Module tiles data
  const moduleData = [
    {
      id: 'products',
      title: 'Products',
      description: 'Manage your product catalog',
      icon: 'package-variant',
      color: colors.primary,
      onPress: () => Alert.alert('Coming Soon', 'Products module is under development')
    },
    {
      id: 'contacts',
      title: 'Contacts',
      description: 'View and manage contacts',
      icon: 'account-group',
      color: colors.secondary,
      onPress: () => navigation.navigate('ContactsList')
    },
    {
      id: 'chat',
      title: 'Chat',
      description: 'Team messaging and channels',
      icon: 'chat',
      color: colors.success,
      onPress: () => navigation.navigate('Discuss')
    },
    {
      id: 'orders',
      title: 'Orders',
      description: 'Track sales orders',
      icon: 'cart',
      color: '#F59E0B',
      onPress: () => Alert.alert('Coming Soon', 'Orders module is under development')
    },
    {
      id: 'inventory',
      title: 'Inventory',
      description: 'Manage stock levels',
      icon: 'warehouse',
      color: '#8B5CF6',
      onPress: () => Alert.alert('Coming Soon', 'Inventory module is under development')
    },
    {
      id: 'helpdesk',
      title: 'Helpdesk',
      description: 'Manage support tickets',
      icon: 'ticket-account',
      color: colors.error,
      onPress: () => navigation.navigate('HelpdeskList')
    }
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.primary }]}>
          <View style={styles.headerContent}>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: colors.onPrimary }]}>
                Odoo Mobile
              </Text>
              <Text style={[styles.subtitle, { color: colors.onPrimary }]}>
                Welcome, {user?.name || userSession?.username || 'User'}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.settingsButton, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
              onPress={() => Alert.alert('Settings', 'Settings panel coming soon')}
            >
              <Icon name="cog" size={24} color={colors.onPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={[styles.statsContainer, { backgroundColor: colors.surface }]}>
          <View style={styles.statItem}>
            <Icon name="ticket-account" size={24} color={colors.primary} />
            <Text style={[styles.statNumber, { color: colors.text }]}>12</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Open Tickets</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Icon name="account-group" size={24} color={colors.secondary} />
            <Text style={[styles.statNumber, { color: colors.text }]}>248</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Contacts</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Icon name="message-text" size={24} color={colors.success} />
            <Text style={[styles.statNumber, { color: colors.text }]}>5</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Unread</Text>
          </View>
        </View>

        {/* Modules Grid */}
        <View style={styles.modulesContainer}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Modules
          </Text>
          <View style={styles.modulesGrid}>
            {moduleData.map((module) => (
              <TouchableOpacity
                key={module.id}
                style={[styles.moduleCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={module.onPress}
              >
                <View style={[styles.moduleIcon, { backgroundColor: `${module.color}15` }]}>
                  <Icon name={module.icon} size={28} color={module.color} />
                </View>
                <Text style={[styles.moduleTitle, { color: colors.text }]}>
                  {module.title}
                </Text>
                <Text style={[styles.moduleDescription, { color: colors.textSecondary }]}>
                  {module.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.activitySection}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Recent Activity
            </Text>
            <TouchableOpacity onPress={handleRefresh}>
              <Icon name="refresh" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                Loading activity...
              </Text>
            </View>
          ) : (
            <View style={styles.activityContainer}>
              {recentActivity.map((activity) => (
                <TouchableOpacity
                  key={activity.id}
                  style={[styles.activityItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={styles.activityContent}>
                    <View style={[styles.activityIcon, { backgroundColor: `${activity.color}15` }]}>
                      <Icon name={activity.icon} size={20} color={activity.color} />
                    </View>
                    <View style={styles.activityDetails}>
                      <Text style={[styles.activityTitle, { color: colors.text }]}>
                        {activity.title}
                      </Text>
                      <Text style={[styles.activityDescription, { color: colors.textSecondary }]}>
                        {activity.description}
                      </Text>
                      <Text style={[styles.activityTime, { color: colors.textSecondary }]}>
                        {activity.time}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Logout Button */}
        <View style={styles.logoutSection}>
          <TouchableOpacity
            style={[styles.logoutButton, { backgroundColor: colors.error }]}
            onPress={handleLogout}
          >
            <Icon name="logout" size={20} color={colors.onPrimary} style={styles.logoutIcon} />
            <Text style={[styles.logoutButtonText, { color: colors.onPrimary }]}>
              Logout
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  // Container Styles
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },

  // Header Styles
  header: {
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    marginTop: 4,
    opacity: 0.9,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Stats Container Styles
  statsContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: -12,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statDivider: {
    width: 1,
    marginHorizontal: 16,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },

  // Modules Container Styles
  modulesContainer: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  modulesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  moduleCard: {
    width: '48%',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  moduleIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  moduleTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  moduleDescription: {
    fontSize: 13,
    lineHeight: 18,
  },

  // Activity Section Styles
  activitySection: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  activityContainer: {
    gap: 12,
  },
  activityItem: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  activityContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityDetails: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  activityDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 12,
    fontWeight: '500',
  },

  // Loading Styles
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '500',
  },

  // Logout Section Styles
  logoutSection: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 32,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  logoutIcon: {
    marginRight: 4,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default HomeScreen;