import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../../contexts/ThemeContext';
import { getUser, createOdooClient } from '../../../api/odooClient';
import { usersAPI } from '../../../api/models/usersApi';

const EditProfileScreen = ({ route }) => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userData, setUserData] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    tz: '',
    street: '',
    city: '',
    state: '',
    zip: '',
    country: '',
  });

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      const user = await getUser();

      if (!user) {
        Alert.alert('Error', 'Failed to load user data');
        navigation.goBack();
        return;
      }

      setUserData(user);

      // Initialize form data with user data
      setFormData({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        tz: user.tz || '',
        street: user.address?.street || '',
        city: user.address?.city || '',
        state: user.address?.state || '',
        zip: user.address?.zip || '',
        country: user.address?.country || '',
      });
    } catch (error) {
      console.error('Error fetching user data:', error);
      Alert.alert('Error', 'Failed to load user data');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      if (!userData || !userData.id) {
        Alert.alert('Error', 'User data not available');
        return;
      }

      let updateSuccess = false;

      // First update the partner record with contact info
      if (userData.partner_id && userData.partner_id[0]) {
        const partnerId = userData.partner_id[0];
        console.log('Updating partner with ID:', partnerId);

        // Partner data for contact and address fields
        const partnerData = {
          email: formData.email,
          phone: formData.phone,
          street: formData.street,
          city: formData.city,
          state_id: false, // Would need to map to actual state_id
          zip: formData.zip,
          country_id: false, // Would need to map to actual country_id
        };

        console.log('Partner data:', partnerData);

        try {
          const { partnersAPI } = require('../../../api/models/partnersApi');

          // Use the standard write endpoint directly
          try {
            // Create a client with the correct server config
            const AsyncStorage = require('@react-native-async-storage/async-storage').default;
            const tokenData = await AsyncStorage.getItem('odooTokenData');
            const { ODOO_CONFIG } = require('../../../config/odoo');

            let config = ODOO_CONFIG;
            if (tokenData) {
              const parsedToken = JSON.parse(tokenData);
              config = parsedToken.serverConfig || ODOO_CONFIG;
            }

            // Create headers with authorization
            const headers = {
              'Content-Type': 'application/json',
              'DATABASE': config.db
            };

            if (tokenData) {
              const parsedToken = JSON.parse(tokenData);
              if (parsedToken.accessToken) {
                headers['Authorization'] = `Bearer ${parsedToken.accessToken}`;
              }
            }

            console.log('Making direct API call to update partner with ID:', partnerId);
            console.log('Partner data for direct call:', partnerData);

            // Make the PUT request to update the partner using fetch API
            const response = await fetch(`${config.baseURL}/api/v2/write/res.partner`, {
              method: 'PUT',
              headers: headers,
              body: JSON.stringify({
                ids: [partnerId],
                values: partnerData
              })
            });

            const responseData = await response.json();

            console.log('Direct API call response (write endpoint):', responseData);
            updateSuccess = true;
          } catch (directApiError) {
            console.error('Direct API call failed, trying with fallback method:', directApiError);

            // Try with fallback method using /api/v2/call endpoint
            try {
              // Create a client with the correct server config
              const AsyncStorage = require('@react-native-async-storage/async-storage').default;
              const tokenData = await AsyncStorage.getItem('odooTokenData');
              const { ODOO_CONFIG } = require('../../../config/odoo');

              let config = ODOO_CONFIG;
              if (tokenData) {
                const parsedToken = JSON.parse(tokenData);
                config = parsedToken.serverConfig || ODOO_CONFIG;
              }

              // Create headers with authorization
              const headers = {
                'Content-Type': 'application/json',
                'DATABASE': config.db
              };

              if (tokenData) {
                const parsedToken = JSON.parse(tokenData);
                if (parsedToken.accessToken) {
                  headers['Authorization'] = `Bearer ${parsedToken.accessToken}`;
                }
              }

              console.log('Trying fallback method for partner update');

              // Make the POST request to the call endpoint using fetch API
              const response = await fetch(`${config.baseURL}/api/v2/call`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                  model: 'res.partner',
                  method: 'write',
                  args: [[partnerId], partnerData]
                })
              });

              const responseData = await response.json();

              console.log('Fallback API call response:', responseData);
              updateSuccess = true;
            } catch (fallbackError) {
              console.error('All partner update methods failed:', fallbackError);
              throw fallbackError;
            }
          }
        } catch (partnerError) {
          console.error('All partner update attempts failed:', partnerError);
          Alert.alert(
            'Warning',
            'Failed to update contact information. Only name will be updated.',
            [{ text: 'Continue' }]
          );
        }
      }

      // Then update the user record with name
      console.log('Updating user with ID:', userData.id);
      const updateData = {
        name: formData.name,
      };
      console.log('User update data:', updateData);

      try {
        // Use the standard write endpoint directly
        try {
          // Create a client with the correct server config
          const AsyncStorage = require('@react-native-async-storage/async-storage').default;
          const tokenData = await AsyncStorage.getItem('odooTokenData');
          const { ODOO_CONFIG } = require('../../../config/odoo');

          let config = ODOO_CONFIG;
          if (tokenData) {
            const parsedToken = JSON.parse(tokenData);
            config = parsedToken.serverConfig || ODOO_CONFIG;
          }

          // Create headers with authorization
          const headers = {
            'Content-Type': 'application/json',
            'DATABASE': config.db
          };

          if (tokenData) {
            const parsedToken = JSON.parse(tokenData);
            if (parsedToken.accessToken) {
              headers['Authorization'] = `Bearer ${parsedToken.accessToken}`;
            }
          }

          console.log('Updating user with ID:', userData.id);
          console.log('User update data:', updateData);

          // Make the PUT request to update the user using fetch API
          const response = await fetch(`${config.baseURL}/api/v2/write/res.users`, {
            method: 'PUT',
            headers: headers,
            body: JSON.stringify({
              ids: [userData.id],
              values: updateData
            })
          });

          const responseData = await response.json();

          console.log('User update response:', responseData);
          updateSuccess = true;
        } catch (directApiError) {
          console.error('Direct API call for user failed, trying with usersAPI:', directApiError);

          // Try with fallback method using /api/v2/call endpoint
          try {
            // Create a client with the correct server config
            const AsyncStorage = require('@react-native-async-storage/async-storage').default;
            const tokenData = await AsyncStorage.getItem('odooTokenData');
            const { ODOO_CONFIG } = require('../../../config/odoo');

            let config = ODOO_CONFIG;
            if (tokenData) {
              const parsedToken = JSON.parse(tokenData);
              config = parsedToken.serverConfig || ODOO_CONFIG;
            }

            // Create headers with authorization
            const headers = {
              'Content-Type': 'application/json',
              'DATABASE': config.db
            };

            if (tokenData) {
              const parsedToken = JSON.parse(tokenData);
              if (parsedToken.accessToken) {
                headers['Authorization'] = `Bearer ${parsedToken.accessToken}`;
              }
            }

            console.log('Trying fallback method for user update');

            // Make the POST request to the call endpoint using fetch API
            const response = await fetch(`${config.baseURL}/api/v2/call`, {
              method: 'POST',
              headers: headers,
              body: JSON.stringify({
                model: 'res.users',
                method: 'write',
                args: [[userData.id], updateData]
              })
            });

            const responseData = await response.json();

            console.log('Fallback API call response for user:', responseData);
            updateSuccess = true;
          } catch (fallbackError) {
            console.error('All user update methods failed:', fallbackError);
            throw fallbackError;
          }
        }
      } catch (userError) {
        console.error('All user update attempts failed:', userError);
        if (!updateSuccess) {
          Alert.alert(
            'Warning',
            'Failed to update user name. Please try again later.',
            [{ text: 'OK' }]
          );
        }
      }

      // Force clear any cached data to ensure fresh data on next fetch
      try {
        const { resetAllCache } = require('../../../services/api');
        resetAllCache();
        console.log('Cache cleared to ensure fresh data');
      } catch (cacheError) {
        console.error('Error clearing cache:', cacheError);
      }

      if (updateSuccess) {
        Alert.alert(
          'Success',
          'Profile updated successfully',
          [{
            text: 'OK',
            onPress: () => {
              // Navigate back and trigger a refresh on the profile screen
              navigation.navigate('Profile', { refresh: true, timestamp: Date.now() });
            }
          }]
        );
      } else {
        Alert.alert('Error', 'Failed to update profile. Please try again.');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleCancel}>
            <Icon name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Edit Profile</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.profileImageSection}>
          {userData?.image_256 ? (
            <Image
              source={{ uri: `data:image/png;base64,${userData.image_256}` }}
              style={styles.profileImage}
              defaultSource={require('../../../assets/images/default_avatar.png')}
            />
          ) : (
            <View style={[styles.profileImagePlaceholder, { backgroundColor: colors.primary }]}>
              <Text style={[styles.profileImagePlaceholderText, { color: colors.onPrimary }]}>
                {userData?.name ? userData.name.charAt(0).toUpperCase() : '?'}
              </Text>
            </View>
          )}

          {/* Note: Image upload not implemented in this version */}
          <Text style={[styles.note, { color: colors.textSecondary }]}>
            Profile image can only be changed from the web interface
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Personal Information</Text>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Full Name</Text>
            <TextInput
              style={[styles.input, {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: colors.inputBackground || colors.background
              }]}
              value={formData.name}
              onChangeText={(text) => handleInputChange('name', text)}
              placeholder="Enter your full name"
              placeholderTextColor={colors.placeholder || '#999'}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Email</Text>
            <TextInput
              style={[styles.input, {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: colors.inputBackground || colors.background
              }]}
              value={formData.email}
              onChangeText={(text) => handleInputChange('email', text)}
              placeholder="Enter your email"
              placeholderTextColor={colors.placeholder || '#999'}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Phone</Text>
            <TextInput
              style={[styles.input, {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: colors.inputBackground || colors.background
              }]}
              value={formData.phone}
              onChangeText={(text) => handleInputChange('phone', text)}
              placeholder="Enter your phone number"
              placeholderTextColor={colors.placeholder || '#999'}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Address</Text>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Street</Text>
            <TextInput
              style={[styles.input, {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: colors.inputBackground || colors.background
              }]}
              value={formData.street}
              onChangeText={(text) => handleInputChange('street', text)}
              placeholder="Enter street address"
              placeholderTextColor={colors.placeholder || '#999'}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>City</Text>
            <TextInput
              style={[styles.input, {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: colors.inputBackground || colors.background
              }]}
              value={formData.city}
              onChangeText={(text) => handleInputChange('city', text)}
              placeholder="Enter city"
              placeholderTextColor={colors.placeholder || '#999'}
            />
          </View>

          <View style={styles.inputRow}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>State</Text>
              <TextInput
                style={[styles.input, {
                  color: colors.text,
                  borderColor: colors.border,
                  backgroundColor: colors.inputBackground || colors.background
                }]}
                value={formData.state}
                onChangeText={(text) => handleInputChange('state', text)}
                placeholder="State"
                placeholderTextColor={colors.placeholder || '#999'}
              />
            </View>

            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>ZIP Code</Text>
              <TextInput
                style={[styles.input, {
                  color: colors.text,
                  borderColor: colors.border,
                  backgroundColor: colors.inputBackground || colors.background
                }]}
                value={formData.zip}
                onChangeText={(text) => handleInputChange('zip', text)}
                placeholder="ZIP"
                placeholderTextColor={colors.placeholder || '#999'}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Country</Text>
            <TextInput
              style={[styles.input, {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: colors.inputBackground || colors.background
              }]}
              value={formData.country}
              onChangeText={(text) => handleInputChange('country', text)}
              placeholder="Enter country"
              placeholderTextColor={colors.placeholder || '#999'}
            />
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton, { borderColor: colors.primary }]}
            onPress={handleCancel}
            disabled={saving}
          >
            <Text style={[styles.buttonText, { color: colors.primary }]}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.saveButton, {
              backgroundColor: colors.primary,
              opacity: saving ? 0.7 : 1
            }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={[styles.buttonText, styles.saveButtonText]}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  profileImageSection: {
    alignItems: 'center',
    marginVertical: 20,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  profileImagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImagePlaceholderText: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  note: {
    marginTop: 8,
    fontSize: 12,
    fontStyle: 'italic',
  },
  section: {
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginVertical: 24,
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    marginRight: 8,
    borderWidth: 1,
  },
  saveButton: {
    marginLeft: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  saveButtonText: {
    color: 'white',
  },
});

export default EditProfileScreen;
