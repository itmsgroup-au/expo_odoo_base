import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '../../../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';

const HomeScreen = ({ userSession }) => {
  const { logout } = useAuth();
  const navigation = useNavigation();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Logout Error', 'An error occurred during logout.');
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>Odoo Mobile</Text>
          <Text style={styles.subtitle}>Welcome, {userSession?.username || 'User'}</Text>
        </View>

        <View style={styles.tilesContainer}>
          <TouchableOpacity style={styles.tile}>
            <Text style={styles.tileTitle}>Products</Text>
            <Text style={styles.tileDescription}>Manage your product catalog</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tile}
            onPress={() => navigation.navigate('ContactsList')}
          >
            <Text style={styles.tileTitle}>Contacts</Text>
            <Text style={styles.tileDescription}>View and manage contacts</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.tile}>
            <Text style={styles.tileTitle}>Orders</Text>
            <Text style={styles.tileDescription}>Track sales orders</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.tile}>
            <Text style={styles.tileTitle}>Inventory</Text>
            <Text style={styles.tileDescription}>Manage stock levels</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tile}
            onPress={() => navigation.navigate('HelpdeskList')}
          >
            <Text style={styles.tileTitle}>Helpdesk</Text>
            <Text style={styles.tileDescription}>Manage support tickets</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
        </View>

        <View style={styles.activityContainer}>
          <View style={styles.activityItem}>
            <Text style={styles.activityTitle}>New Order Created</Text>
            <Text style={styles.activityDescription}>Order #1234 for Customer ABC</Text>
            <Text style={styles.activityTime}>Today, 10:30 AM</Text>
          </View>

          <View style={styles.activityItem}>
            <Text style={styles.activityTitle}>Product Updated</Text>
            <Text style={styles.activityDescription}>Price changed for Product XYZ</Text>
            <Text style={styles.activityTime}>Yesterday, 2:45 PM</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#3B82F6',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 5,
  },
  tilesContainer: {
    padding: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  tile: {
    width: '48%',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tileTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  tileDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  activityContainer: {
    padding: 16,
  },
  activityItem: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  activityDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  activityTime: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 8,
  },
  logoutButton: {
    backgroundColor: '#EF4444',
    borderRadius: 8,
    padding: 16,
    margin: 16,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default HomeScreen;