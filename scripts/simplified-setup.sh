#!/bin/bash
# simplified-setup.sh - A simplified setup script for ExoMobile

set -e  # Exit on error

echo "Setting up ExoMobile project (simplified version)..."

# Create basic directory structure
mkdir -p src/api/models
mkdir -p src/components/tiles
mkdir -p src/contexts
mkdir -p src/features/home/screens
mkdir -p src/features/home/components
mkdir -p src/navigation
mkdir -p src/services
mkdir -p src/styles
mkdir -p src/utils
mkdir -p scripts/templates

# Check if required modules are installed
echo "Checking npm dependencies..."
required_deps=(
  "react-native-paper"
  "@react-navigation/native"
  "@react-navigation/stack"
  "@react-navigation/bottom-tabs"
  "axios"
  "@react-native-async-storage/async-storage"
  "lucide-react-native"
)

for dep in "${required_deps[@]}"; do
  if ! npm list "$dep" >/dev/null 2>&1; then
    echo "Installing $dep..."
    npm install --save "$dep"
  fi
done

# Copy existing fixed components
echo "Setting up components..."
if [ -f "src/components/tiles/MainTile.tsx" ]; then
  echo "MainTile component already exists."
else
  echo "Creating MainTile component..."
  cp scripts/templates/MainTile.tsx src/components/tiles/MainTile.tsx 2>/dev/null || echo "Warning: Could not copy MainTile template. Will create during home screen setup."
fi

# Copy API utilities
echo "Setting up API utilities..."
if [ -f "src/api/odooClient.js" ]; then
  echo "odooClient already exists."
else
  echo "Creating odooClient..."
  cp scripts/templates/odooClient.js src/api/odooClient.js 2>/dev/null || echo "Warning: Could not copy odooClient template. Will need to create manually."
fi

# Create a basic theme file
echo "Setting up theme..."
if [ ! -f "src/styles/theme.js" ]; then
  echo "Creating theme file..."
  echo "export const colors = {
  primary: '#3B82F6',
  secondary: '#10B981',
  danger: '#EF4444',
  warning: '#F59E0B',
  success: '#10B981',
  info: '#3B82F6',
  background: '#F3F4F6',
  card: '#FFFFFF',
  text: '#1F2937',
  border: '#E5E7EB',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export default {
  colors,
  spacing,
};" > src/styles/theme.js
fi

# Create authentication context
echo "Setting up authentication context..."
if [ ! -f "src/contexts/AuthContext.js" ]; then
  echo "Creating AuthContext..."
  echo "import React, { createContext, useState, useEffect, useContext } from 'react';
import { ActivityIndicator, View, StyleSheet, Text } from 'react-native';
import { odooAuth } from '../api/odooClient';

// Create context
const AuthContext = createContext(null);

// Auth provider component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  // Check authentication on mount
  useEffect(() => {
    checkAuth();
  }, []);

  // Check if user is authenticated
  const checkAuth = async () => {
    setLoading(true);
    try {
      const isAuth = await odooAuth.isLoggedIn();
      setAuthenticated(isAuth);
      
      if (isAuth) {
        const userInfo = await odooAuth.getUserInfo();
        setUser(userInfo);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setAuthenticated(false);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // Login function (to be called after successful login)
  const login = async (userData) => {
    setUser(userData);
    setAuthenticated(true);
  };

  // Logout function
  const handleLogout = async () => {
    setLoading(true);
    try {
      await odooAuth.logout();
      setAuthenticated(false);
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Loading screen
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size=\"large\" color=\"#3B82F6\" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  // Context value
  const value = {
    user,
    authenticated,
    login,
    logout: handleLogout,
    refreshAuth: checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook for using auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Styles
const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#4B5563',
  },
});" > src/contexts/AuthContext.js
fi

# Create or update the basic App.tsx
echo "Setting up App.tsx..."
echo "import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { PaperProvider } from 'react-native-paper';

// Import home screen
import HomeScreen from './src/features/home/screens/HomeScreen';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';

// Import login screen (will be created later)
// import LoginScreen from './src/features/auth/screens/LoginScreen';

// Create stack navigator
const Stack = createStackNavigator();

// Main app component with navigation
const MainNavigator = () => {
  // For now, always consider user as authenticated
  const isAuthenticated = true;
  
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <Stack.Screen name=\"Home\" component={HomeScreen} />
      ) : (
        // This will be enabled when LoginScreen is created
        // <Stack.Screen name=\"Login\" component={LoginScreen} />
        <Stack.Screen name=\"Home\" component={HomeScreen} />
      )}
    </Stack.Navigator>
  );
};

// Root component with providers
export default function App() {
  return (
    <SafeAreaProvider>
      <PaperProvider>
        <StatusBar barStyle=\"dark-content\" backgroundColor=\"#FFFFFF\" />
        <NavigationContainer>
          <MainNavigator />
        </NavigationContainer>
      </PaperProvider>
    </SafeAreaProvider>
  );
}" > App.tsx

# Create mock HomeScreen for immediate testing
echo "Setting up temporary HomeScreen for testing..."
if [ ! -f "src/features/home/screens/HomeScreen.js" ]; then
  echo "Creating basic HomeScreen..."
  mkdir -p src/features/home/screens
  echo "import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const HomeScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>ExoMobile</Text>
      <Text style={styles.subtitle}>Welcome to your Odoo mobile app</Text>
      <View style={styles.tile}>
        <Text style={styles.tileTitle}>Contacts</Text>
      </View>
      <View style={styles.tile}>
        <Text style={styles.tileTitle}>Products</Text>
      </View>
      <View style={styles.tile}>
        <Text style={styles.tileTitle}>Calendar</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 40,
    marginBottom: 8,
    color: '#1F2937',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 40,
    color: '#6B7280',
  },
  tile: {
    width: '100%',
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  tileTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
});

export default HomeScreen;" > src/features/home/screens/HomeScreen.js
fi

# Create a basic package.json if it doesn't exist
if [ ! -f "package.json" ]; then
  echo "Creating basic package.json..."
  echo '{
  "name": "exomobile",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web"
  },
  "dependencies": {}
}' > package.json
fi

echo "Basic ExoMobile setup complete!"
echo "You can now run 'npm start' to test the app."
echo "To create the full tile-based home screen, run the create-home-screen.sh script."
