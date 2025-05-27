import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
  BackHandler,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect, useIsFocused } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { partnersAPI } from '../../../api/models/partnersApi';

// Try to import ImagePicker, but handle the case where it's not available
let ImagePicker;
try {
  ImagePicker = require('expo-image-picker');
} catch (error) {
  console.warn('expo-image-picker is not available:', error);
}

// Default avatar image
import defaultAvatar from '../../../assets/images/default_avatar.png';

const ContactFormScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const isFocused = useIsFocused();
  const { mode, id, contact: initialContact } = route.params || { mode: 'create' };
  const hasUnsavedChanges = useRef(false);

  // Configure screen options to DISABLE gesture navigation completely
  React.useLayoutEffect(() => {
    navigation.setOptions({
      gestureEnabled: false, // Completely disable gesture navigation to prevent crashes
      gestureResponseDistance: 0, // Set to 0 to further prevent gesture detection
      cardOverlayEnabled: false, // Disable overlay
    });
  }, [navigation]);

  const [loading, setLoading] = useState(mode === 'edit' && !initialContact);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [initialFormState, setInitialFormState] = useState({});

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    mobile: '',
    street: '',
    street2: '',
    city: '',
    zip: '',
    website: '',
    function: '',
    comment: '',
    is_company: false,
    image: null,
  });

  // Fetch contact details if in edit mode
  const fetchContactDetails = useCallback(async () => {
    if (mode !== 'edit' || initialContact) return null;

    try {
      setLoading(true);
      setError(null);

      const response = await partnersAPI.getById(
        id,
        [
          'id', 'name', 'email', 'phone', 'mobile', 'image_1920', 'street', 'street2',
          'city', 'state_id', 'zip', 'country_id', 'website', 'function', 'title',
          'comment', 'is_company', 'parent_id'
        ]
      );

      console.log('Fetched contact details for edit:', response);

      if (response) {
        const contactData = {
          name: response.name || '',
          email: response.email || '',
          phone: response.phone || '',
          mobile: response.mobile || '',
          street: response.street || '',
          street2: response.street2 || '',
          city: response.city || '',
          zip: response.zip || '',
          website: response.website || '',
          function: response.function || '',
          comment: response.comment || '',
          is_company: response.is_company || false,
          image: response.image_1920 || null,
        };

        setFormData(contactData);
        return contactData;
      } else {
        setError('Failed to load contact details. Please try again.');
        return null;
      }
    } catch (err) {
      console.error('Error fetching contact details for edit:', err);
      setError('Failed to load contact details. Please check your connection.');
      return null;
    } finally {
      setLoading(false);
    }
  }, [mode, id, initialContact]);

  // Load contact details when the screen is focused
  useFocusEffect(
    useCallback(() => {
      let initialData = {
        name: '',
        email: '',
        phone: '',
        mobile: '',
        street: '',
        street2: '',
        city: '',
        zip: '',
        website: '',
        function: '',
        comment: '',
        is_company: false,
        image: null,
      };

      if (initialContact) {
        // Use the contact data passed from the previous screen
        initialData = {
          name: initialContact.name || '',
          email: initialContact.email || '',
          phone: initialContact.phone || '',
          mobile: initialContact.mobile || '',
          street: initialContact.street || '',
          street2: initialContact.street2 || '',
          city: initialContact.city || '',
          zip: initialContact.zip || '',
          website: initialContact.website || '',
          function: initialContact.function || '',
          comment: initialContact.comment || '',
          is_company: initialContact.is_company || false,
          image: initialContact.image_1920 || null,
        };
        setFormData(initialData);
        setInitialFormState(initialData);
        hasUnsavedChanges.current = false;
      } else if (mode === 'edit') {
        fetchContactDetails().then(contactData => {
          if (contactData) {
            setInitialFormState(contactData);
            hasUnsavedChanges.current = false;
          }
        });
      } else {
        // For create mode, set empty initial state
        setInitialFormState(initialData);
        hasUnsavedChanges.current = false;
      }

      // Reset unsaved changes flag when screen is focused
      return () => {
        // Clean up if needed
      };
    }, [fetchContactDetails, initialContact, mode])
  );

  // Check for unsaved changes
  const checkForUnsavedChanges = useCallback(() => {
    // Compare current form data with initial state
    const hasChanges = Object.keys(formData).some(key => {
      return formData[key] !== initialFormState[key];
    });
    hasUnsavedChanges.current = hasChanges;
    return hasChanges;
  }, [formData, initialFormState]);

  // Handle safe navigation back
  const handleGoBack = useCallback(() => {
    if (checkForUnsavedChanges() && !saving) {
      Alert.alert(
        'Unsaved Changes',
        'You have unsaved changes. Are you sure you want to discard them?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              // Safe navigation back
              navigation.goBack();
            }
          }
        ]
      );
    } else {
      // No changes, safe to go back
      navigation.goBack();
    }
  }, [checkForUnsavedChanges, navigation, saving]);

  // Set up navigation handlers
  useEffect(() => {
    // Handle hardware back button (Android)
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isFocused) {
        handleGoBack();
        return true; // Prevent default behavior
      }
      return false;
    });

    // Create a function to handle navigation attempts
    const handleNavigationAttempt = (e) => {
      try {
        // If we're not saving and have unsaved changes, show confirmation
        if (!saving && checkForUnsavedChanges()) {
          // Prevent default navigation behavior
          e.preventDefault();

          // Show confirmation dialog
          Alert.alert(
            'Unsaved Changes',
            'You have unsaved changes. Are you sure you want to discard them?',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Discard',
                style: 'destructive',
                onPress: () => {
                  try {
                    // Allow the navigation to proceed
                    hasUnsavedChanges.current = false;
                    // Use a try-catch to handle any navigation dispatch errors
                    try {
                      navigation.dispatch(e.data.action);
                    } catch (dispatchError) {
                      console.log('Navigation dispatch error:', dispatchError);
                      // Fallback to simple goBack if dispatch fails
                      navigation.goBack();
                    }
                  } catch (err) {
                    console.log('Error during navigation confirmation:', err);
                    // Ultimate fallback
                    navigation.goBack();
                  }
                },
              },
            ]
          );
        }
        // Otherwise, allow the navigation
      } catch (err) {
        console.log('Error in navigation handler:', err);
        // Don't block navigation if our handler has an error
      }
    };

    // Set up navigation event listeners for redundancy
    const unsubscribeBeforeRemove = navigation.addListener('beforeRemove', handleNavigationAttempt);

    // Attempt to intercept any gesture events that might still occur despite disabling gestures
    let unsubscribeGestureStart;
    try {
      unsubscribeGestureStart = navigation.addListener('gestureStart', (e) => {
        // Immediately try to cancel any gesture to prevent crashes
        try {
          // Force disable gestures again
          navigation.setOptions({ gestureEnabled: false });

          // Try to cancel the gesture event if possible
          if (e && e.preventDefault) {
            e.preventDefault();
          }

          // If we have unsaved changes, show dialog
          if (!saving && checkForUnsavedChanges()) {
            Alert.alert(
              'Navigation Blocked',
              'Please use the Cancel button to go back safely.',
              [{ text: 'OK', style: 'default' }]
            );
          }
        } catch (gestureError) {
          console.log('Error handling gesture:', gestureError);
        }
        return true; // Try to prevent default behavior
      });
    } catch (listenerError) {
      console.log('Could not add gesture listener:', listenerError);
      unsubscribeGestureStart = null;
    }

    // Also try to intercept state changes that might be related to gestures
    const unsubscribeStateChange = navigation.addListener('state', (e) => {
      // If we detect a state change that might be from a gesture, try to handle it
      if (isFocused && !saving && checkForUnsavedChanges()) {
        // Force disable gestures again
        navigation.setOptions({ gestureEnabled: false });
      }
    });

    return () => {
      // Clean up all listeners
      backHandler.remove();
      unsubscribeBeforeRemove();
      if (unsubscribeGestureStart) unsubscribeGestureStart();
      if (unsubscribeStateChange) unsubscribeStateChange();
    };
  }, [navigation, isFocused, handleGoBack, saving, checkForUnsavedChanges]);

  // Handle form input changes
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Handle image picker
  const handlePickImage = async () => {
    if (!ImagePicker) {
      Alert.alert('Feature Not Available', 'Image picker is not available in this version.');
      return;
    }

    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions to change the profile picture.');
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        if (asset.base64) {
          setFormData(prev => ({ ...prev, image: asset.base64 }));
        }
      }
    } catch (err) {
      console.error('Error picking image:', err);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  // Validate form
  const validateForm = () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Name is required');
      return false;
    }

    // Validate email format if provided
    if (formData.email && !isValidEmail(formData.email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return false;
    }

    return true;
  };

  // Email validation helper
  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Save contact
  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      setSaving(true);
      setError(null);

      // Prepare data for API
      const contactData = {
        name: formData.name,
        email: formData.email || false,
        phone: formData.phone || false,
        mobile: formData.mobile || false,
        street: formData.street || false,
        street2: formData.street2 || false,
        city: formData.city || false,
        zip: formData.zip || false,
        website: formData.website || false,
        function: formData.function || false,
        comment: formData.comment || false,
        is_company: formData.is_company,
      };

      // Add image if changed
      if (formData.image) {
        contactData.image_1920 = formData.image;
      }

      let result;
      if (mode === 'edit') {
        // Update existing contact
        result = await partnersAPI.update(id, contactData);
        console.log('Update result:', result);

        if (result) {
          // Mark that we have no unsaved changes before navigating
          hasUnsavedChanges.current = false;
          Alert.alert('Success', 'Contact updated successfully');

          // Safe navigation back
          try {
            navigation.goBack();
          } catch (navError) {
            console.log('Navigation error after save:', navError);
            // Try alternative navigation if goBack fails
            navigation.navigate('ContactsList');
          }
        } else {
          setError('Failed to update contact. Please try again.');
        }
      } else {
        // Create new contact
        result = await partnersAPI.create(contactData);
        console.log('Create result:', result);

        if (result) {
          // Mark that we have no unsaved changes before navigating
          hasUnsavedChanges.current = false;
          Alert.alert('Success', 'Contact created successfully');

          // Safe navigation back
          try {
            navigation.goBack();
          } catch (navError) {
            console.log('Navigation error after save:', navError);
            // Try alternative navigation if goBack fails
            navigation.navigate('ContactsList');
          }
        } else {
          setError('Failed to create contact. Please try again.');
        }
      }
    } catch (err) {
      console.error(`Error ${mode === 'edit' ? 'updating' : 'creating'} contact:`, err);
      setError(`Failed to ${mode === 'edit' ? 'update' : 'create'} contact. Please check your connection.`);
    } finally {
      setSaving(false);
    }
  };

  // Convert base64 image to URI
  const getImageUri = (base64Image) => {
    if (!base64Image) return null;
    return `data:image/png;base64,${base64Image}`;
  };

  // Get initials for avatar placeholder
  const getInitials = (name) => {
    if (!name) return '';
    return name
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  // Generate a color based on the contact name
  const getColorFromName = (name) => {
    if (!name) return '#3498db';

    const colors = [
      '#1abc9c', '#2ecc71', '#3498db', '#9b59b6', '#34495e',
      '#16a085', '#27ae60', '#2980b9', '#8e44ad', '#2c3e50',
      '#f1c40f', '#e67e22', '#e74c3c', '#ecf0f1', '#95a5a6',
      '#f39c12', '#d35400', '#c0392b', '#bdc3c7', '#7f8c8d'
    ];

    // Simple hash function to get a consistent color for a name
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }

    return colors[Math.abs(hash) % colors.length];
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
      </View>
    );
  }

  const imageUri = getImageUri(formData.image);
  const initials = getInitials(formData.name);
  const avatarColor = getColorFromName(formData.name);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.headerButton}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {mode === 'edit' ? 'Edit Contact' : 'New Contact'}
        </Text>
        <TouchableOpacity
          onPress={handleSave}
          style={[styles.headerButton, saving && styles.disabledButton]}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#3498db" />
          ) : (
            <Text style={styles.saveText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView style={styles.scrollView}>
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Profile Image */}
          <View style={styles.imageSection}>
            <TouchableOpacity onPress={handlePickImage} style={styles.avatarContainer}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: avatarColor }]}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
              )}
              <View style={styles.editImageButton}>
                <Icon name="camera" size={16} color="#fff" />
              </View>
            </TouchableOpacity>
          </View>

          {/* Form Fields */}
          <View style={styles.formSection}>
            {/* Company Switch */}
            <View style={styles.switchContainer}>
              <Text style={styles.switchLabel}>Company</Text>
              <Switch
                value={formData.is_company}
                onValueChange={(value) => handleChange('is_company', value)}
                trackColor={{ false: '#d0d0d0', true: '#bde0fe' }}
                thumbColor={formData.is_company ? '#3498db' : '#f4f3f4'}
              />
            </View>

            {/* Basic Info */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Name *</Text>
              <TextInput
                style={styles.formInput}
                value={formData.name}
                onChangeText={(text) => handleChange('name', text)}
                placeholder="Enter name"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Job Title</Text>
              <TextInput
                style={styles.formInput}
                value={formData.function}
                onChangeText={(text) => handleChange('function', text)}
                placeholder="Enter job title"
                placeholderTextColor="#999"
              />
            </View>

            {/* Contact Info */}
            <Text style={styles.sectionTitle}>Contact Information</Text>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Phone</Text>
              <TextInput
                style={styles.formInput}
                value={formData.phone}
                onChangeText={(text) => handleChange('phone', text)}
                placeholder="Enter phone number"
                placeholderTextColor="#999"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Mobile</Text>
              <TextInput
                style={styles.formInput}
                value={formData.mobile}
                onChangeText={(text) => handleChange('mobile', text)}
                placeholder="Enter mobile number"
                placeholderTextColor="#999"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Email</Text>
              <TextInput
                style={styles.formInput}
                value={formData.email}
                onChangeText={(text) => handleChange('email', text)}
                placeholder="Enter email address"
                placeholderTextColor="#999"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Website</Text>
              <TextInput
                style={styles.formInput}
                value={formData.website}
                onChangeText={(text) => handleChange('website', text)}
                placeholder="Enter website"
                placeholderTextColor="#999"
                autoCapitalize="none"
              />
            </View>

            {/* Address */}
            <Text style={styles.sectionTitle}>Address</Text>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Street</Text>
              <TextInput
                style={styles.formInput}
                value={formData.street}
                onChangeText={(text) => handleChange('street', text)}
                placeholder="Enter street address"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Street 2</Text>
              <TextInput
                style={styles.formInput}
                value={formData.street2}
                onChangeText={(text) => handleChange('street2', text)}
                placeholder="Enter additional address info"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, styles.formGroupHalf]}>
                <Text style={styles.formLabel}>City</Text>
                <TextInput
                  style={styles.formInput}
                  value={formData.city}
                  onChangeText={(text) => handleChange('city', text)}
                  placeholder="Enter city"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={[styles.formGroup, styles.formGroupHalf]}>
                <Text style={styles.formLabel}>ZIP</Text>
                <TextInput
                  style={styles.formInput}
                  value={formData.zip}
                  onChangeText={(text) => handleChange('zip', text)}
                  placeholder="Enter ZIP code"
                  placeholderTextColor="#999"
                />
              </View>
            </View>

            {/* Notes */}
            <Text style={styles.sectionTitle}>Notes</Text>

            <View style={styles.formGroup}>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                value={formData.comment}
                onChangeText={(text) => handleChange('comment', text)}
                placeholder="Enter notes about this contact"
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    padding: 16,
    backgroundColor: '#ffebee',
    marginBottom: 16,
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 14,
  },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  headerButton: {
    padding: 8,
  },
  cancelText: {
    fontSize: 16,
    color: '#666',
  },
  saveText: {
    fontSize: 16,
    color: '#3498db',
    fontWeight: '500',
  },
  disabledButton: {
    opacity: 0.5,
  },
  imageSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 36,
    fontWeight: 'bold',
  },
  editImageButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#3498db',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  formSection: {
    padding: 16,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  switchLabel: {
    fontSize: 16,
    color: '#333',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 24,
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  formRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  formGroupHalf: {
    width: '48%',
  },
  formLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#333',
  },
  textArea: {
    height: 100,
    paddingTop: 12,
  },
});

export default ContactFormScreen;
