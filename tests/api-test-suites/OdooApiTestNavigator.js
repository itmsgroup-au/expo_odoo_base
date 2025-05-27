// OdooApiTestNavigator.js
// This file serves as the main navigation for all Odoo API tests

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer } from '@react-navigation/native';

// Import test suite screens
import AuthenticationTests from './AuthenticationTests';
import BinaryDataTests from './BinaryDataTests';
import ImageHandlingTests from './ImageHandlingTests';
import ModelAccessTests from './ModelAccessTests';
import ReportTests from './ReportTests';
import SystemInfoTests from './SystemInfoTests';

// Home screen with navigation to all test suites
const HomeScreen = ({ navigation }) => {
  const testSuites = [
    { name: 'Authentication Tests', component: 'AuthenticationTests', description: 'Test OAuth1, OAuth2, token refresh, and session management' },
    { name: 'Binary Data Tests', component: 'BinaryDataTests', description: 'Test binary data endpoints for files and attachments' },
    { name: 'Image Handling Tests', component: 'ImageHandlingTests', description: 'Test image loading, thumbnails, and caching' },
    { name: 'Model Access Tests', component: 'ModelAccessTests', description: 'Test CRUD operations on Odoo models' },
    { name: 'Report Tests', component: 'ReportTests', description: 'Test report generation and downloading' },
    { name: 'System Info Tests', component: 'SystemInfoTests', description: 'Test system info endpoints and configurations' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Odoo API Test Suite</Text>
      <Text style={styles.subheader}>Select a test suite to run</Text>
      
      <ScrollView style={styles.scrollView}>
        {testSuites.map((suite, index) => (
          <TouchableOpacity
            key={index}
            style={styles.suiteButton}
            onPress={() => navigation.navigate(suite.component)}
          >
            <Text style={styles.suiteName}>{suite.name}</Text>
            <Text style={styles.suiteDescription}>{suite.description}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

// Create stack navigator
const Stack = createStackNavigator();

function OdooApiTestNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen 
          name="Home" 
          component={HomeScreen} 
          options={{ headerShown: false }} 
        />
        <Stack.Screen name="AuthenticationTests" component={AuthenticationTests} />
        <Stack.Screen name="BinaryDataTests" component={BinaryDataTests} />
        <Stack.Screen name="ImageHandlingTests" component={ImageHandlingTests} />
        <Stack.Screen name="ModelAccessTests" component={ModelAccessTests} />
        <Stack.Screen name="ReportTests" component={ReportTests} />
        <Stack.Screen name="SystemInfoTests" component={SystemInfoTests} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    padding: 16,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3498db',
    marginTop: 20,
    marginBottom: 8,
    textAlign: 'center',
  },
  subheader: {
    fontSize: 16,
    color: '#7f8c8d',
    marginBottom: 20,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  suiteButton: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  suiteName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
  },
  suiteDescription: {
    fontSize: 14,
    color: '#7f8c8d',
  }
});

export default OdooApiTestNavigator;
