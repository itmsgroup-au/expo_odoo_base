#!/bin/bash
# setup-exomobile.sh - Main setup script for ExoMobile

set -e  # Exit on error

echo "====================== ExoMobile Setup ======================"
echo "Setting up ExoMobile for Odoo integration with tile-based UI"
echo "============================================================"

# Make all scripts executable
chmod +x make-scripts-executable.sh
chmod +x scripts/simplified-setup.sh 2>/dev/null || echo "Warning: Couldn't make simplified-setup.sh executable"

# Create essential directories if they don't exist
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

# Copy template files to target locations
echo "Setting up essential files..."

# Create odooClient.js if it doesn't exist
if [ ! -f "src/api/odooClient.js" ]; then
  if [ -f "scripts/templates/odooClient.js" ]; then
    cp scripts/templates/odooClient.js src/api/odooClient.js
    echo "Created odooClient.js"
  else
    echo "Warning: odooClient.js template not found"
  fi
fi

# Create MainTile component if it doesn't exist
if [ ! -f "src/components/tiles/MainTile.tsx" ]; then
  if [ -f "scripts/templates/MainTile.tsx" ]; then
    cp scripts/templates/MainTile.tsx src/components/tiles/MainTile.tsx
    echo "Created MainTile.tsx"
  else
    echo "Warning: MainTile.tsx template not found"
  fi
fi

# Create a simple App.tsx if it doesn't exist
if [ ! -f "App.tsx" ]; then
  echo "Creating App.tsx..."
  echo "import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar, Text, View, StyleSheet } from 'react-native';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle=\"dark-content\" backgroundColor=\"#FFFFFF\" />
      <View style={styles.container}>
        <Text style={styles.title}>ExoMobile</Text>
        <Text style={styles.subtitle}>Odoo Mobile App Generator</Text>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#1F2937',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
});" > App.tsx
  echo "Created basic App.tsx"
fi

# Create a minimal package.json if it doesn't exist
if [ ! -f "package.json" ]; then
  echo "Creating package.json..."
  echo '{
  "name": "exomobile",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web"
  }
}' > package.json
  echo "Created package.json"
fi

# Ask if the user wants to install dependencies
echo
echo "Do you want to install the required dependencies? (y/n)"
read -r install_deps

if [ "$install_deps" = "y" ] || [ "$install_deps" = "Y" ]; then
  echo "Installing dependencies..."
  npm install --save react-native-paper @react-navigation/native @react-navigation/stack @react-navigation/bottom-tabs axios @react-native-async-storage/async-storage lucide-react-native react-native-safe-area-context react-native-screens
  echo "Dependencies installed!"
fi

# Create basic config directory and Odoo configuration
mkdir -p src/config
echo "// Odoo Configuration
export const ODOO_CONFIG = {
  baseURL: 'http://localhost:8018',
  db: 'OCR',
  username: 'admin',
  password: 'admin',
};" > src/config/odoo.js
echo "Created Odoo configuration"

# Create a simple HomeScreen implementation
echo "Creating simple HomeScreen component..."
echo "import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { User, Package, Calendar, Bell } from 'lucide-react-native';

const HomeScreen = () => {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>ExoMobile</Text>
        <Text style={styles.headerSubtitle}>Welcome to your Odoo mobile app</Text>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Main Modules</Text>
        <View style={styles.grid}>
          <View style={styles.gridItem}>
            <View style={[styles.iconContainer, { backgroundColor: '#3B82F6' }]}>
              <User size={24} color=\"white\" />
            </View>
            <Text style={styles.gridItemTitle}>Contacts</Text>
          </View>
          <View style={styles.gridItem}>
            <View style={[styles.iconContainer, { backgroundColor: '#10B981' }]}>
              <Package size={24} color=\"white\" />
            </View>
            <Text style={styles.gridItemTitle}>Inventory</Text>
          </View>
          <View style={styles.gridItem}>
            <View style={[styles.iconContainer, { backgroundColor: '#EF4444' }]}>
              <Bell size={24} color=\"white\" />
            </View>
            <Text style={styles.gridItemTitle}>Helpdesk</Text>
          </View>
          <View style={styles.gridItem}>
            <View style={[styles.iconContainer, { backgroundColor: '#F59E0B' }]}>
              <Calendar size={24} color=\"white\" />
            </View>
            <Text style={styles.gridItemTitle}>Calendar</Text>
          </View>
        </View>
      </View>
      
      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>Getting Started</Text>
        <Text style={styles.infoText}>
          This is a starter template for the ExoMobile app. To implement the full 
          tile-based UI, run the create-home-screen.sh script.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    padding: 24,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  section: {
    padding: 16,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    margin: -8,
  },
  gridItem: {
    width: '50%',
    padding: 8,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  gridItemTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4B5563',
  },
  infoBox: {
    margin: 16,
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
});

export default HomeScreen;" > src/features/home/screens/HomeScreen.js
echo "Created HomeScreen component"

echo
echo "ExoMobile setup completed!"
echo
echo "Next steps:"
echo "1. Install dependencies (if not done): npm install"
echo "2. Create the full tile-based UI: bash scripts/create-home-screen.sh"
echo "3. Start the app: npm start"
echo
echo "For Odoo integration, update the configuration in src/config/odoo.js"
