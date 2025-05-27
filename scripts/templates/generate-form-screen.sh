#!/bin/bash
# generate-form-screen.sh - Generate form screen for a model

echo "import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ArrowLeft, Save } from 'lucide-react-native';
import { ${MODEL_NAME}API } from '../../../api/models/${MODEL_NAME}Api';

const ${MODEL_NAME^}FormScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { isNew, id, data: initialData } = route.params || { isNew: true };
  
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(!isNew && !initialData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [fieldInfo, setFieldInfo] = useState({});
  
  useEffect(() => {
    const fetchData = async () => {
      if (!isNew && !initialData) {
        try {
          setLoading(true);
          const result = await ${MODEL_NAME}API.getById(id);
          setFormData(result || {});
        } catch (err) {
          console.error('Error fetching ${MODEL_LABEL} details:', err);
          setError('Failed to load ${MODEL_LABEL} details. Please try again.');
        } finally {
          setLoading(false);
        }
      } else if (initialData) {
        setFormData(initialData);
      }
    };
    
    const fetchFieldInfo = async () => {
      try {
        const result = await ${MODEL_NAME}API.getFields();
        setFieldInfo(result || {});
      } catch (err) {
        console.error('Error fetching field info:', err);
      }
    };
    
    fetchData();
    fetchFieldInfo();
  }, [isNew, id, initialData]);
  
  const handleChange = (field, value) => {
    setFormData({
      ...formData,
      [field]: value,
    });
  };
  
  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Basic validation - check required fields
      const requiredFields = Object.entries(fieldInfo)
        .filter(([_, info]) => info.required)
        .map(([field]) => field);
      
      const missingFields = requiredFields.filter(field => !formData[field]);
      if (missingFields.length > 0) {
        Alert.alert(
          'Validation Error',
          \`Please fill in all required fields: \${missingFields.join(', ')}\`
        );
        setSaving(false);
        return;
      }
      
      let result;
      if (isNew) {
        result = await ${MODEL_NAME}API.create(formData);
      } else {
        result = await ${MODEL_NAME}API.update(id, formData);
      }
      
      Alert.alert(
        'Success',
        \`${MODEL_LABEL} \${isNew ? 'created' : 'updated'} successfully\`
      );
      
      // Navigate back or to detail screen
      if (isNew && result) {
        navigation.replace('${MODEL_NAME^}Detail', { id: result, name: formData.name || formData.display_name });
      } else {
        navigation.goBack();
      }
    } catch (err) {
      console.error('Error saving ${MODEL_LABEL}:', err);
      Alert.alert(
        'Error',
        \`Failed to \${isNew ? 'create' : 'update'} ${MODEL_LABEL}. Please try again.\`
      );
    } finally {
      setSaving(false);
    }
  };
  
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size=\"large\" color=\"#3B82F6\" />
        <Text style={styles.loadingText}>Loading ${MODEL_LABEL} details...</Text>
      </View>
    );
  }
  
  // Function to render appropriate input based on field type
  const renderField = (field, info, value) => {
    if (!info) return null;
    
    // Skip computed fields and internal fields
    if (info.readonly || field.startsWith('_') || field === 'id') {
      return null;
    }
    
    switch (info.type) {
      case 'char':
      case 'text':
        return (
          <TextInput
            style={styles.input}
            value={value?.toString() || ''}
            onChangeText={(text) => handleChange(field, text)}
            placeholder={info.string || field}
            multiline={info.type === 'text'}
          />
        );
        
      case 'boolean':
        return (
          <Switch
            value={Boolean(value)}
            onValueChange={(val) => handleChange(field, val)}
          />
        );
        
      case 'integer':
      case 'float':
        return (
          <TextInput
            style={styles.input}
            value={value?.toString() || ''}
            onChangeText={(text) => handleChange(field, text)}
            placeholder={info.string || field}
            keyboardType=\"numeric\"
          />
        );
        
      case 'selection':
        // In a real app, this would be a picker/dropdown
        return (
          <TextInput
            style={styles.input}
            value={value?.toString() || ''}
            onChangeText={(text) => handleChange(field, text)}
            placeholder={info.string || field}
          />
        );
        
      case 'many2one':
        // In a real app, this would be a relation picker
        return (
          <TextInput
            style={styles.input}
            value={Array.isArray(value) ? value[1] : value?.toString() || ''}
            onChangeText={(text) => handleChange(field, text)}
            placeholder={info.string || field}
          />
        );
        
      default:
        return (
          <TextInput
            style={styles.input}
            value={value?.toString() || ''}
            onChangeText={(text) => handleChange(field, text)}
            placeholder={info.string || field}
          />
        );
    }
  };
  
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color=\"#4B5563\" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isNew ? 'New' : 'Edit'} ${MODEL_LABEL}</Text>
        <TouchableOpacity 
          style={[styles.saveButton, saving ? styles.saveButtonDisabled : null]} 
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size=\"small\" color=\"white\" />
          ) : (
            <>
              <Save size={20} color=\"white\" style={styles.saveButtonIcon} />
              <Text style={styles.saveButtonText}>Save</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
      
      {/* Form */}
      <ScrollView style={styles.content}>
        <View style={styles.formContainer}>
          {Object.entries(fieldInfo).map(([field, info]) => {
            // Skip readonly and internal fields
            if (info?.readonly || field.startsWith('_') || field === 'id') {
              return null;
            }
            
            return (
              <View key={field} style={styles.fieldContainer}>
                <Text style={[
                  styles.fieldLabel,
                  info?.required ? styles.requiredField : null
                ]}>
                  {info?.string || field}
                  {info?.required && <Text style={styles.requiredAsterisk}>*</Text>}
                </Text>
                {renderField(field, info, formData[field])}
                {info?.help && (
                  <Text style={styles.fieldHelp}>{info.help}</Text>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
      
      {/* Bottom save button for easy access */}
      <View style={styles.bottomButtonContainer}>
        <TouchableOpacity 
          style={[styles.bottomSaveButton, saving ? styles.saveButtonDisabled : null]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size=\"small\" color=\"white\" />
          ) : (
            <Text style={styles.bottomSaveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>
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
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#93C5FD',
  },
  saveButtonIcon: {
    marginRight: 4,
  },
  saveButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  formContainer: {
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
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4B5563',
    marginBottom: 8,
  },
  requiredField: {
    color: '#1F2937',
  },
  requiredAsterisk: {
    color: '#EF4444',
    marginLeft: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    color: '#1F2937',
    backgroundColor: '#F9FAFB',
  },
  fieldHelp: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    fontStyle: 'italic',
  },
  bottomButtonContainer: {
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  bottomSaveButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  bottomSaveButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
});

export default ${MODEL_NAME^}FormScreen;
" > "$FEATURE_DIR/screens/${MODEL_NAME^}FormScreen.js"

echo "Created form screen at $FEATURE_DIR/screens/${MODEL_NAME^}FormScreen.js"