import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  TextInput,
  SafeAreaView
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

// Import components
import MainTile from '../../../components/tiles/MainTile';
import QuickAccessItem from '../components/QuickAccessItem';
import ActivityItem from '../components/ActivityItem';
import SectionHeader from '../components/SectionHeader';

// Import AppContext instead of Redux
import { useSelector, useDispatch } from '../../../contexts/app/AppContext';

const HomeScreen = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const [refreshing, setRefreshing] = useState(false);

  // Get user from our context instead of Redux
  const user = useSelector(state => state.user);

  // Mock data for tiles - using Ionicons
  const mainApps = [
    { id: 'contacts', name: 'Contacts', icon: <Ionicons name="people" size={24} color="white" />, color: '#3B82F6', count: 142, route: 'ContactsList' },
    { id: 'inventory', name: 'Inventory', icon: <Ionicons name="cube" size={24} color="white" />, color: '#10B981', count: 87, route: 'InventoryList' },
    { id: 'helpdesk', name: 'Helpdesk', icon: <Ionicons name="notifications" size={24} color="white" />, color: '#EF4444', count: 12, route: 'HelpdeskList' },
    { id: 'calendar', name: 'Calendar', icon: <Ionicons name="calendar" size={24} color="white" />, color: '#F59E0B', count: 5, route: 'CalendarView' }
  ];

  // Mock data for quick access
  const quickAccessItems = [
    { id: 'chat', name: 'Chat', icon: <Ionicons name="chatbubbles" size={20} color="white" />, color: '#8B5CF6', route: 'Chat' },
    { id: 'contacts', name: 'Contacts', icon: <Ionicons name="people" size={20} color="white" />, color: '#3B82F6', route: 'ContactsList' },
    { id: 'inventory', name: 'Inventory', icon: <Ionicons name="cube" size={20} color="white" />, color: '#10B981', route: 'InventoryList' },
    { id: 'helpdesk', name: 'Helpdesk', icon: <Ionicons name="notifications" size={20} color="white" />, color: '#EF4444', route: 'HelpdeskList' }
  ];

  // Mock data for activity
  const activityItems = [
    {
      id: 1,
      title: 'Sales Quote #1234',
      description: 'Quote created for Client XYZ',
      time: '10 min ago',
      icon: <Ionicons name="document-text-outline" size={20} color="#666" />,
      route: 'SalesDetail',
      params: { id: 1234 }
    },
    {
      id: 2,
      title: 'Support Ticket #4567',
      description: 'New ticket from Customer ABC',
      time: '45 min ago',
      icon: <Ionicons name="help-buoy-outline" size={20} color="#666" />,
      route: 'TicketDetail',
      params: { id: 4567 }
    },
    {
      id: 3,
      title: 'Invoice #INV-2023-089',
      description: 'Invoice generated',
      time: '2 hours ago',
      icon: <Ionicons name="document-outline" size={20} color="#666" />,
      route: 'InvoiceDetail',
      params: { id: 789 }
    }
  ];

  // Mock favorites
  const favorites = [
    { id: 1, name: 'Monthly Sales Report', icon: <Ionicons name="document-text-outline" size={24} color="#333" />, route: 'ReportDetail' },
    { id: 2, name: 'Inventory Restock', icon: <Ionicons name="cube-outline" size={24} color="#333" />, route: 'InventoryDetail' },
    { id: 3, name: 'Team Calendar', icon: <Ionicons name="calendar-outline" size={24} color="#333" />, route: 'CalendarView' }
  ];

  // Handle refresh
  const onRefresh = () => {
    setRefreshing(true);

    // Use our context dispatch instead of Redux
    dispatch({ type: 'REFRESH_DATA' });

    // Simulate a refresh delay
    setTimeout(() => {
      setRefreshing(false);
    }, 1500);
  };

  // Handle navigation to a screen
  const navigateTo = (route, params = {}) => {
    navigation.navigate(route, params);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Status Bar */}
      <StatusBar barStyle="dark-content" backgroundColor="#F3F4F6" />

      {/* Top Navigation Bar */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.menuButton} onPress={() => navigation.toggleDrawer()}>
          <Ionicons name="menu-outline" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ExoMobile</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconButton} onPress={() => navigateTo('Notifications')}>
            <Ionicons name="notifications-outline" size={24} color="#333" />
            <View style={styles.badge}>
              <Text style={styles.badgeText}>3</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={() => navigateTo('Settings')}>
            <Ionicons name="settings-outline" size={24} color="#333" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search across all services..."
            placeholderTextColor="#999"
          />
        </View>
      </View>

      {/* Main Content */}
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#3B82F6']}
          />
        }
      >
        {/* Welcome Message */}
        <View style={styles.welcomeContainer}>
          <Text style={styles.welcomeText}>Welcome back, {user.name}</Text>
          <Text style={styles.subtitleText}>What would you like to do today?</Text>
        </View>

        {/* Main Tiles - 2x2 Grid */}
        <View style={styles.tilesContainer}>
          <View style={styles.tileRow}>
            <View style={styles.tileCol}>
              <MainTile
                title={mainApps[0].name}
                icon={mainApps[0].icon}
                color={mainApps[0].color}
                count={mainApps[0].count}
                route={mainApps[0].route}
              />
            </View>
            <View style={styles.tileCol}>
              <MainTile
                title={mainApps[1].name}
                icon={mainApps[1].icon}
                color={mainApps[1].color}
                count={mainApps[1].count}
                route={mainApps[1].route}
              />
            </View>
          </View>
          <View style={styles.tileRow}>
            <View style={styles.tileCol}>
              <MainTile
                title={mainApps[2].name}
                icon={mainApps[2].icon}
                color={mainApps[2].color}
                count={mainApps[2].count}
                route={mainApps[2].route}
              />
            </View>
            <View style={styles.tileCol}>
              <MainTile
                title={mainApps[3].name}
                icon={mainApps[3].icon}
                color={mainApps[3].color}
                count={mainApps[3].count}
                route={mainApps[3].route}
              />
            </View>
          </View>
        </View>

        {/* Quick Access */}
        <View style={styles.sectionContainer}>
          <SectionHeader title="Quick Access" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickAccessContainer}
          >
            {quickAccessItems.map(item => (
              <QuickAccessItem
                key={item.id}
                title={item.name}
                icon={item.icon}
                color={item.color}
                onPress={() => navigateTo(item.route)}
              />
            ))}
          </ScrollView>
        </View>

        {/* Recent Activity */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderContainer}>
            <Text style={styles.sectionHeaderTitle}>Recent Activity</Text>
            <TouchableOpacity onPress={() => navigateTo('ActivityList')}>
              <Text style={styles.sectionHeaderAction}>See All</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.activityList}>
            {activityItems.map(item => (
              <ActivityItem
                key={item.id}
                title={item.title}
                description={item.description}
                time={item.time}
                icon={item.icon}
                onPress={() => navigateTo(item.route, item.params)}
              />
            ))}
          </View>
        </View>

        {/* Favorites */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderContainer}>
            <Text style={styles.sectionHeaderTitle}>Favorites</Text>
            <TouchableOpacity>
              <Text style={styles.sectionHeaderAction}>Edit</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.favoritesContainer}>
            {favorites.map(item => (
              <TouchableOpacity
                key={item.id}
                style={styles.favoriteItem}
                onPress={() => navigateTo(item.route)}
              >
                <View style={styles.favoriteIcon}>
                  {item.icon}
                </View>
                <Text style={styles.favoriteName}>{item.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Bottom Navigation Bar */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.bottomNavItem} onPress={() => {}}>
          <Ionicons name="bar-chart-outline" size={24} color="#3B82F6" />
          <Text style={[styles.bottomNavText, styles.bottomNavActive]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomNavItem} onPress={() => navigateTo('Chat')}>
          <Ionicons name="chatbubble-outline" size={24} color="#666" />
          <Text style={styles.bottomNavText}>Chat</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomNavItem} onPress={() => navigateTo('Favorites')}>
          <Ionicons name="star-outline" size={24} color="#666" />
          <Text style={styles.bottomNavText}>Favorites</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomNavItem} onPress={() => navigateTo('Settings')}>
          <Ionicons name="settings-outline" size={24} color="#666" />
          <Text style={styles.bottomNavText}>Settings</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    elevation: 2,
  },
  menuButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: 4,
    marginLeft: 16,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#EF4444',
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  searchContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
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
    color: '#1F2937',
    padding: 0,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 20,
  },
  welcomeContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  subtitleText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  tilesContainer: {
    padding: 16,
  },
  tileRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  tileCol: {
    flex: 1,
    paddingHorizontal: 8,
  },
  sectionContainer: {
    marginTop: 16,
  },
  sectionHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  sectionHeaderAction: {
    fontSize: 14,
    color: '#3B82F6',
  },
  quickAccessContainer: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  activityList: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginHorizontal: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  favoritesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
  },
  favoriteItem: {
    width: '31%',
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  favoriteIcon: {
    marginBottom: 8,
  },
  favoriteName: {
    fontSize: 12,
    textAlign: 'center',
    color: '#1F2937',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  bottomNavItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomNavText: {
    fontSize: 12,
    marginTop: 4,
    color: '#6B7280',
  },
  bottomNavActive: {
    color: '#3B82F6',
    fontWeight: '500',
  },
});

export default HomeScreen;