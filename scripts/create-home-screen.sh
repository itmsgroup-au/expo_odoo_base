#!/bin/bash
# create-home-screen.sh - Script to create the tile-based HomeScreen

set -e  # Exit on error

echo "Creating HomeScreen with tile-based UI..."

# Create directories
mkdir -p src/features/home
mkdir -p src/features/home/components
mkdir -p src/features/home/screens
mkdir -p src/features/home/__tests__

# Create MainTile component (if it doesn't exist already in components)
mkdir -p src/components/tiles
echo "import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';

interface MainTileProps {
  title: string;
  icon: React.ReactNode;
  color: string;
  count?: number;
  route: string;
}

const MainTile: React.FC<MainTileProps> = ({ title, icon, color, count, route }) => {
  const navigation = useNavigation();
  
  const handlePress = () => {
    navigation.navigate(route);
  };
  
  return (
    <TouchableOpacity 
      style={styles.container} 
      onPress={handlePress}
      testID={\`main-tile-\${title.toLowerCase()}\`}
    >
      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: color }]}>
          {icon}
        </View>
        <Text style={styles.title}>{title}</Text>
        {count !== undefined && (
          <Text style={styles.count}>{count} items</Text>
        )}
      </View>
      <View style={styles.footer}>
        <Text style={styles.viewAll}>View All</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  content: {
    padding: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  count: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  viewAll: {
    fontSize: 12,
    fontWeight: '500',
    color: '#3B82F6',
  },
});

export default MainTile;" > src/components/tiles/MainTile.tsx
echo "Created MainTile component"

# Create QuickAccessItem component
echo "import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface QuickAccessItemProps {
  title: string;
  icon: React.ReactNode;
  color: string;
  onPress: () => void;
}

const QuickAccessItem: React.FC<QuickAccessItemProps> = ({ title, icon, color, onPress }) => {
  return (
    <TouchableOpacity 
      style={styles.container} 
      onPress={onPress}
      testID={\`quick-access-\${title.toLowerCase()}\`}
    >
      <View style={[styles.iconContainer, { backgroundColor: color }]}>
        {icon}
      </View>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: 80,
    marginHorizontal: 8,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
  },
});

export default QuickAccessItem;" > src/features/home/components/QuickAccessItem.tsx
echo "Created QuickAccessItem component"

# Create ActivityItem component
echo "import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface ActivityItemProps {
  title: string;
  description: string;
  time: string;
  icon: React.ReactNode;
  onPress: () => void;
}

const ActivityItem: React.FC<ActivityItemProps> = ({ title, description, time, icon, onPress }) => {
  return (
    <TouchableOpacity 
      style={styles.container} 
      onPress={onPress}
      testID={\`activity-item-\${title.toLowerCase().replace(/\\s+/g, '-')}\`}
    >
      <View style={styles.iconContainer}>
        {icon}
      </View>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <Text style={styles.description} numberOfLines={1}>{description}</Text>
        <Text style={styles.time}>{time}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  description: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  time: {
    fontSize: 10,
    color: '#999',
    marginTop: 4,
  },
});

export default ActivityItem;" > src/features/home/components/ActivityItem.tsx
echo "Created ActivityItem component"

# Create SectionHeader component
echo "import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface SectionHeaderProps {
  title: string;
  actionText?: string;
  onAction?: () => void;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ title, actionText, onAction }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {actionText && onAction && (
        <TouchableOpacity onPress={onAction}>
          <Text style={styles.actionText}>{actionText}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#3B82F6',
  },
});

export default SectionHeader;" > src/features/home/components/SectionHeader.tsx
echo "Created SectionHeader component"

# Create HomeScreen component
echo "import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  RefreshControl
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { User, Package, MessageSquare, Calendar, Bell, Filter } from 'lucide-react-native';

// Import components
import MainTile from '../../components/tiles/MainTile';
import QuickAccessItem from '../components/QuickAccessItem';
import ActivityItem from '../components/ActivityItem';
import SectionHeader from '../components/SectionHeader';

const HomeScreen = () => {
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);
  
  // Normally you would fetch this data from Redux
  // const { user } = useSelector(state => state.auth);
  const user = { name: 'Alex' }; // Mock user
  
  // Mock data for tiles
  const mainApps = [
    { id: 'contacts', name: 'Contacts', icon: <User size={24} color=\"white\" />, color: '#3B82F6', count: 142, route: 'ContactsList' },
    { id: 'inventory', name: 'Inventory', icon: <Package size={24} color=\"white\" />, color: '#10B981', count: 87, route: 'InventoryList' },
    { id: 'helpdesk', name: 'Helpdesk', icon: <Bell size={24} color=\"white\" />, color: '#EF4444', count: 12, route: 'HelpdeskList' },
    { id: 'calendar', name: 'Calendar', icon: <Calendar size={24} color=\"white\" />, color: '#F59E0B', count: 5, route: 'CalendarView' }
  ];
  
  // Mock data for quick access
  const quickAccessItems = [
    { id: 'chat', name: 'Chat', icon: <MessageSquare size={20} color=\"white\" />, color: '#8B5CF6', route: 'Chat' },
    { id: 'contacts', name: 'Contacts', icon: <User size={20} color=\"white\" />, color: '#3B82F6', route: 'ContactsList' },
    { id: 'inventory', name: 'Inventory', icon: <Package size={20} color=\"white\" />, color: '#10B981', route: 'InventoryList' },
    { id: 'helpdesk', name: 'Helpdesk', icon: <Bell size={20} color=\"white\" />, color: '#EF4444', route: 'HelpdeskList' },
    { id: 'calendar', name: 'Calendar', icon: <Calendar size={20} color=\"white\" />, color: '#F59E0B', route: 'CalendarView' }
  ];
  
  // Mock data for activity
  const activityItems = [
    { 
      id: 1,
      title: 'Sales Quote #1234',
      description: 'Quote created for Client XYZ',
      time: '10 min ago',
      icon: <Package size={20} color=\"#666\" />,
      route: 'SalesDetail',
      params: { id: 1234 }
    },
    { 
      id: 2,
      title: 'Support Ticket #4567',
      description: 'New ticket from Customer ABC',
      time: '45 min ago',
      icon: <Bell size={20} color=\"#666\" />,
      route: 'TicketDetail',
      params: { id: 4567 }
    },
    { 
      id: 3,
      title: 'Project Milestone',
      description: 'Phase 1 completed',
      time: '2 hours ago',
      icon: <Calendar size={20} color=\"#666\" />,
      route: 'ProjectDetail',
      params: { id: 789 }
    }
  ];
  
  // Handle refresh
  const onRefresh = () => {
    setRefreshing(true);
    
    // Simulate a refresh - in a real app, dispatch actions to fetch data
    setTimeout(() => {
      setRefreshing(false);
    }, 1500);
  };
  
  // Handle navigation to a screen
  const navigateTo = (route, params = {}) => {
    navigation.navigate(route, params);
  };
  
  return (
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
      <SectionHeader title=\"Quick Access\" />
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
      
      {/* Recent Activity */}
      <View style={styles.activityContainer}>
        <SectionHeader 
          title=\"Recent Activity\" 
          actionText=\"See All\" 
          onAction={() => navigateTo('ActivityList')} 
        />
        
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
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
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
  quickAccessContainer: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  activityContainer: {
    marginTop: 16,
  },
  activityList: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginHorizontal: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
});

export default HomeScreen;" > src/features/home/screens/HomeScreen.tsx
echo "Created HomeScreen component"

# Create directories for tests
mkdir -p src/features/home/screens/__tests__

# Create test for HomeScreen
echo "import React from 'react';
import { render } from '@testing-library/react-native';
import HomeScreen from '../HomeScreen';

// Mock the navigation
jest.mock('@react-navigation/native', () => {
  return {
    useNavigation: () => ({
      navigate: jest.fn(),
    }),
  };
});

describe('HomeScreen', () => {
  test('renders correctly', () => {
    const { getByText } = render(<HomeScreen />);
    
    // Check for welcome message
    expect(getByText('Welcome back, Alex')).toBeTruthy();
    
    // Check for section headers
    expect(getByText('Quick Access')).toBeTruthy();
    expect(getByText('Recent Activity')).toBeTruthy();
  });
});" > src/features/home/screens/__tests__/HomeScreen.test.tsx
echo "Created HomeScreen test"

# Create navigation setup for HomeScreen
mkdir -p src/navigation
echo "import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { Home, User, MessageSquare, Star } from 'lucide-react-native';

// Import screens
import HomeScreen from '../features/home/screens/HomeScreen';

// Create navigators
const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Bottom Tab Navigator
const BottomTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#3B82F6',
        tabBarInactiveTintColor: '#6B7280',
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          paddingTop: 5,
          paddingBottom: 5,
        },
      }}
    >
      <Tab.Screen 
        name=\"Home\" 
        component={HomeScreen} 
        options={{
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tab.Screen 
        name=\"Chat\" 
        component={HomeScreen} // Placeholder - replace with actual ChatScreen
        options={{
          tabBarIcon: ({ color, size }) => <MessageSquare size={size} color={color} />,
        }}
      />
      <Tab.Screen 
        name=\"Favorites\" 
        component={HomeScreen} // Placeholder - replace with actual FavoritesScreen
        options={{
          tabBarIcon: ({ color, size }) => <Star size={size} color={color} />,
        }}
      />
      <Tab.Screen 
        name=\"Profile\" 
        component={HomeScreen} // Placeholder - replace with actual ProfileScreen
        options={{
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
};

// Main navigation container
const AppNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen 
          name=\"Main\" 
          component={BottomTabNavigator} 
          options={{ headerShown: false }}
        />
        {/* Add more screens here */}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;" > src/navigation/AppNavigator.tsx
echo "Created AppNavigator"

# Create basic App.tsx
echo "import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle=\"dark-content\" backgroundColor=\"#ffffff\" />
      <AppNavigator />
    </SafeAreaProvider>
  );
}" > App.tsx
echo "Created App.tsx"

echo "HomeScreen creation script completed!"
echo "You can now run 'npm start' to test the app with the tile-based home screen"
