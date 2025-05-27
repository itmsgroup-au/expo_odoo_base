import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { NavigationContainer } from '@react-navigation/native';
import { View, Text, StyleSheet } from 'react-native';

// Import screens
import HomeScreen from '../features/home/screens/HomeScreen';
import LoginScreen from '../features/auth/screens/LoginScreen';
import ProfileScreen from '../features/profile/screens/ProfileScreen';
import EditProfileScreen from '../features/profile/screens/EditProfileScreen';
import SettingsScreen from '../features/settings/screens/SettingsScreen';

// Import feature navigators
import ContactsNavigator from '../features/contacts/ContactsNavigator';
import HelpdeskNavigator from '../features/helpdesk/navigation/HelpdeskNavigator';

// Import types
import { RootStackParamList } from './types';

// Import auth context
import { useAuth } from '../contexts/AuthContext';

// Create navigators
const Stack = createStackNavigator<RootStackParamList>();
const Drawer = createDrawerNavigator();

// Drawer content component
const DrawerContent = ({ navigation }) => {
  const { logout } = useAuth();

  return (
    <View style={styles.drawerContainer}>
      <View style={styles.drawerHeader}>
        <Text style={styles.drawerTitle}>ExoMobile</Text>
        <Text style={styles.drawerSubtitle}>v1.0.0</Text>
      </View>

      <View style={styles.drawerContent}>
        {/* Menu items would go here */}
        <Text style={styles.menuItem} onPress={() => navigation.navigate('Home')}>Dashboard</Text>
        <Text style={styles.menuItem} onPress={() => navigation.navigate('ContactsList')}>Contacts</Text>
        <Text style={styles.menuItem} onPress={() => navigation.navigate('InventoryList')}>Inventory</Text>
        <Text style={styles.menuItem} onPress={() => navigation.navigate('HelpdeskList')}>Helpdesk</Text>
        <Text style={styles.menuItem} onPress={() => navigation.navigate('CalendarView')}>Calendar</Text>
        <Text style={styles.menuItem} onPress={() => navigation.navigate('ReportDetail')}>Reports</Text>
        <Text style={styles.menuItem} onPress={() => navigation.navigate('Settings')}>Settings</Text>
      </View>

      <View style={styles.drawerFooter}>
        <Text style={styles.logoutButton} onPress={() => logout()}>
          Logout
        </Text>
      </View>
    </View>
  );
};

// Main drawer navigator
const MainDrawerNavigator = () => {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <DrawerContent navigation={props.navigation} />}
      screenOptions={{
        headerShown: false,
        drawerStyle: {
          width: '75%',
        },
        // Disable gesture navigation
        gestureEnabled: false,
        swipeEnabled: false,
      }}
    >
      <Drawer.Screen
        name="HomeDrawer"
        component={MainStackNavigator}
        options={{
          gestureEnabled: false,
          swipeEnabled: false,
        }}
      />
    </Drawer.Navigator>
  );
};

// Stack navigator for main app screens
const MainStackNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        // Disable gesture navigation for all screens
        gestureEnabled: false,
        animationEnabled: true,
      }}
    >
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{
          gestureEnabled: false,
        }}
      />

      {/* Implemented feature navigators */}
      <Stack.Screen
        name="ContactsList"
        component={ContactsNavigator}
        options={{
          gestureEnabled: false,
        }}
      />

      {/* These would be actual screens in a full implementation */}
      <Stack.Screen name="InventoryList" component={PlaceholderScreen} options={{ headerShown: true, title: 'Inventory' }} />
      <Stack.Screen name="InventoryDetail" component={PlaceholderScreen} options={{ headerShown: true, title: 'Inventory Item' }} />
      <Stack.Screen
        name="HelpdeskTickets"
        component={HelpdeskNavigator}
        options={{
          headerShown: false,
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="HelpdeskList"
        component={HelpdeskNavigator}
        options={{
          headerShown: false,
          gestureEnabled: false,
        }}
      />
      <Stack.Screen name="CalendarView" component={PlaceholderScreen} options={{ headerShown: true, title: 'Calendar' }} />
      <Stack.Screen name="CalendarDetail" component={PlaceholderScreen} options={{ headerShown: true, title: 'Event Details' }} />
      <Stack.Screen name="Chat" component={PlaceholderScreen} options={{ headerShown: true, title: 'Chat' }} />
      <Stack.Screen name="ActivityList" component={PlaceholderScreen} options={{ headerShown: true, title: 'All Activity' }} />
      <Stack.Screen name="SalesDetail" component={PlaceholderScreen} options={{ headerShown: true, title: 'Sale Details' }} />
      <Stack.Screen name="TicketDetail" component={PlaceholderScreen} options={{ headerShown: true, title: 'Ticket Details' }} />
      <Stack.Screen name="InvoiceDetail" component={PlaceholderScreen} options={{ headerShown: true, title: 'Invoice Details' }} />
      <Stack.Screen name="ReportDetail" component={PlaceholderScreen} options={{ headerShown: true, title: 'Report Details' }} />
      <Stack.Screen name="Favorites" component={PlaceholderScreen} options={{ headerShown: true, title: 'Favorites' }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: true, title: 'Profile' }} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ headerShown: true, title: 'Edit Profile' }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: true, title: 'Settings' }} />
      <Stack.Screen name="Notifications" component={PlaceholderScreen} options={{ headerShown: true, title: 'Notifications' }} />
    </Stack.Navigator>
  );
};

// Main app navigator component
export const AppNavigator = () => {
  const { isLoggedIn } = useAuth();

  // Create a custom theme to disable gesture navigation app-wide
  const navigationTheme = {
    colors: {
      primary: '#3B82F6',
      background: '#FFFFFF',
      card: '#FFFFFF',
      text: '#333333',
      border: '#E5E7EB',
      notification: '#EF4444',
    },
  };

  // Create custom navigation options that disable gestures
  const screenOptions = {
    gestureEnabled: false, // Disable gesture navigation app-wide
    swipeEnabled: false,   // Disable swipe gestures
    animationEnabled: true // Keep animations
  };

  return (
    <NavigationContainer theme={navigationTheme}>
      {isLoggedIn ? (
        // Logged in screens with drawer navigation
        <MainDrawerNavigator />
      ) : (
        // Auth screen
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            ...screenOptions // Apply gesture disabling options
          }}
        >
          <Stack.Screen name="Login" component={LoginScreen} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
};

// Placeholder screen for screens we haven't implemented yet
const PlaceholderScreen = ({ route }: { route: any }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Screen Not Implemented</Text>
      <Text style={styles.subtitle}>This is a placeholder for:</Text>
      <Text style={styles.routeName}>{route.name}</Text>
      {route.params && (
        <Text style={styles.params}>
          Params: {JSON.stringify(route.params, null, 2)}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 5,
    color: '#666',
  },
  routeName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3B82F6',
    marginBottom: 20,
  },
  params: {
    fontSize: 14,
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 5,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ddd',
    alignSelf: 'stretch',
  },
  drawerContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  drawerHeader: {
    padding: 20,
    backgroundColor: '#3B82F6',
  },
  drawerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  drawerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 5,
  },
  drawerContent: {
    padding: 20,
    flex: 1,
  },
  menuItem: {
    fontSize: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    color: '#333',
  },
  drawerFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  logoutButton: {
    fontSize: 16,
    color: '#EF4444',
    fontWeight: '500',
  },
});

export default AppNavigator;