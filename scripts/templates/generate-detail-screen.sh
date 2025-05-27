#!/bin/bash
# generate-detail-screen.sh - Generate detail screen for a model

echo "import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Edit, Trash, ArrowLeft } from 'lucide-react-native';
import { ${MODEL_NAME}API } from '../../../api/models/${MODEL_NAME}Api';

const ${MODEL_NAME^}DetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { id, name } = route.params || {};
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await ${MODEL_NAME}API.getById(id);
      setData(result);
    } catch (err) {
      console.error('Error fetching ${MODEL_LABEL} details:', err);
      setError('Failed to load ${MODEL_LABEL} details. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchData();
  }, [id]);
  
  const handleEdit = () => {
    navigation.navigate('${MODEL_NAME^}Form', { isNew: false, id, data });
  };
  
  const handleDelete = () => {
    Alert.alert(
      'Delete ${MODEL_LABEL}',
      'Are you sure you want to delete this ${MODEL_LABEL}?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await ${MODEL_NAME}API.delete(id);
              Alert.alert('Success', '${MODEL_LABEL} deleted successfully');
              navigation.goBack();
            } catch (err) {
              console.error('Error deleting ${MODEL_LABEL}:', err);
              Alert.alert('Error', 'Failed to delete ${MODEL_LABEL}. Please try again.');
            }
          },
        },
      ]
    );
  };
  
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading ${MODEL_LABEL} details...</Text>
      </View>
    );
  }
  
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  if (!data) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>${MODEL_LABEL} not found</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  // Function to render field value based on type
  const renderFieldValue = (key, value) => {
    if (value === null || value === undefined) {
      return <Text style={styles.fieldValueEmpty}>Not set</Text>;
    }
    
    if (Array.isArray(value)) {
      if (value.length === 2 && typeof value[0] === 'number' && typeof value[1] === 'string') {
        // This is likely a Many2one field (id, name)
        return <Text style={styles.fieldValue}>{value[1]}</Text>;
      }
      return <Text style={styles.fieldValue}>{JSON.stringify(value)}</Text>;
    }
    
    if (typeof value === 'object') {
      return <Text style={styles.fieldValue}>{JSON.stringify(value)}</Text>;
    }
    
    if (typeof value === 'boolean') {
      return <Text style={styles.fieldValue}>{value ? 'Yes' : 'No'}</Text>;
    }
    
    return <Text style={styles.fieldValue}>{value.toString()}</Text>;
  };
  
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color="#4B5563" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{data.name || data.display_name}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton} onPress={handleEdit}>
            <Edit size={20} color="#4B5563" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={handleDelete}>
            <Trash size={20} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Content */}
      <ScrollView style={styles.content}>
        <View style={styles.card}>
          {Object.entries(data).map(([key, value]) => (
            <View key={key} style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>{key}</Text>
              {renderFieldValue(key, value)}
            </View>
          ))}
        </View>
      </ScrollView>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F3F4F6',
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
  },
  content: {
    flex: 1,
  },
  card: {
    margin: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  fieldContainer: {
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 8,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 16,
    color: '#1F2937',
  },
  fieldValueEmpty: {
    fontSize: 16,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
});

export default ${MODEL_NAME^}DetailScreen;
" > "$FEATURE_DIR/screens/${MODEL_NAME^}DetailScreen.js"

echo "Created detail screen at $FEATURE_DIR/screens/${MODEL_NAME^}DetailScreen.js"