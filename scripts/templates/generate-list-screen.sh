#!/bin/bash
# generate-list-screen.sh - Generate list screen for a model

echo "import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Search, Plus } from 'lucide-react-native';
import { ${MODEL_NAME}API } from '../../../api/models/${MODEL_NAME}Api';

const ${MODEL_NAME^}ListScreen = () => {
  const navigation = useNavigation();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  
  const fetchData = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await ${MODEL_NAME}API.getList(
        [], // Domain
        ['id', 'name', 'display_name'], // Fields
        50, // Limit
        0, // Offset
        forceRefresh
      );
      
      setData(result || []);
    } catch (err) {
      console.error('Error fetching ${MODEL_LABEL}:', err);
      setError('Failed to load ${MODEL_LABEL}. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  useEffect(() => {
    fetchData();
  }, []);
  
  const handleRefresh = () => {
    setRefreshing(true);
    fetchData(true);
  };
  
  const handleItemPress = (item) => {
    navigation.navigate('${MODEL_NAME^}Detail', { id: item.id, name: item.name || item.display_name });
  };
  
  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.itemContainer}
      onPress={() => handleItemPress(item)}
    >
      <View style={styles.itemContent}>
        <Text style={styles.itemName}>{item.name || item.display_name}</Text>
        <Text style={styles.itemId}>ID: {item.id}</Text>
      </View>
    </TouchableOpacity>
  );
  
  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading ${MODEL_LABEL}...</Text>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <FlatList
        data={data}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {error || 'No ${MODEL_LABEL} found'}
            </Text>
          </View>
        }
      />
      
      <TouchableOpacity
        style={styles.fabButton}
        onPress={() => navigation.navigate('${MODEL_NAME^}Form', { isNew: true })}
      >
        <Plus size={24} color="white" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
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
  listContent: {
    padding: 16,
  },
  itemContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  itemContent: {
    padding: 16,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  itemId: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
  },
  fabButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
});

export default ${MODEL_NAME^}ListScreen;
" > "$FEATURE_DIR/screens/${MODEL_NAME^}ListScreen.js"

echo "Created list screen at $FEATURE_DIR/screens/${MODEL_NAME^}ListScreen.js"