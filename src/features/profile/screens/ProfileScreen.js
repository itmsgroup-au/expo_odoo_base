import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { getCurrentUser } from '../../../api/models/usersApi';
import { getUser, getCompanyInfo, createOdooClient } from '../../../api/odooClient';
import { useAuth } from '../../../contexts/AuthContext';
import { useTheme } from '../../../contexts/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LogViewer from '../../../components/LogViewer';
import '../../../utils/logger'; // Import to initialize enhanced logging

const ProfileScreen = ({ route }) => {
  const [user, setUser] = useState(null);
  const [companyInfo, setCompanyInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [logViewerVisible, setLogViewerVisible] = useState(false);
  const { user: authUser } = useAuth();
  const navigation = useNavigation();
  const { colors } = useTheme();

  // Initial data fetch and respond to route params changes
  useEffect(() => {
    // Check if we have a refresh parameter from navigation
    if (route.params?.refresh) {
      console.log('Refresh triggered from route params:', route.params);
      fetchUserData(true);
    } else {
      fetchUserData();
    }
  }, [route.params?.refresh, route.params?.timestamp]);

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchUserData(false);
    }, [])
  );

  const fetchUserData = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }

      console.log('Fetching user data for profile screen');

      // Clear cache to ensure fresh data
      try {
        const { resetAllCache } = require('../../../services/api');
        resetAllCache();
        console.log('Cache cleared to ensure fresh data');
      } catch (cacheError) {
        console.error('Error clearing cache:', cacheError);
      }

      // Get user data from the API with force refresh
      try {
        console.log('Fetching fresh user data');
        const userData = await getUser(true);

        if (userData) {
          console.log('Successfully got fresh user data:', {
            id: userData?.id,
            name: userData?.name,
            login: userData?.login,
            hasImage: !!userData?.image_256,
            hasPicture: !!userData?.picture,
            pictureType: userData?.picture ? typeof userData.picture : 'none'
          });

          // If we have a picture field that's binary data, convert it to a data URL
          if (userData?.picture && typeof userData.picture === 'string' && !userData.picture.startsWith('data:')) {
            userData.picture = `data:image/png;base64,${userData.picture}`;
            console.log('Converted picture to data URL');
          }

          setUser(userData);

          // Fetch company information
          try {
            console.log('Fetching company information...');
            const company = await getCompanyInfo(true);
            console.log('Company info fetched:', company);
            setCompanyInfo(company);
          } catch (companyError) {
            console.error('Error fetching company info:', companyError);
            // Continue even if company info fetch fails
          }

          setError(null);
          return;
        }
      } catch (directApiError) {
        console.error('Error making direct API call:', directApiError);
      }

      // Fallback to getUser function without force refresh
      console.log('Falling back to getUser function without force refresh');
      try {
        const userData = await getUser();

        if (!userData) {
          setError('Failed to load profile data. Please try again.');
          console.error('No user data returned');
          return;
        }

        console.log('User data fetched successfully:', {
          id: userData?.id,
          name: userData?.name,
          login: userData?.login,
          hasImage: !!userData?.image_256,
          hasPicture: !!userData?.picture,
          pictureType: userData?.picture ? typeof userData.picture : 'none'
        });

        // If we have a picture field that's binary data, convert it to a data URL
        if (userData?.picture && typeof userData.picture === 'string' && !userData.picture.startsWith('data:')) {
          userData.picture = `data:image/png;base64,${userData.picture}`;
          console.log('Converted picture to data URL');
        }

        setUser(userData);

        // Fetch company information
        try {
          console.log('Fetching company information...');
          const company = await getCompanyInfo();
          console.log('Company info fetched:', company);
          setCompanyInfo(company);
        } catch (companyError) {
          console.error('Error fetching company info:', companyError);
          // Continue even if company info fetch fails
        }

        setError(null);
      } catch (fallbackError) {
        console.error('Error in fallback getUser:', fallbackError);
        setError('Failed to load profile data. Please try again.');
      }
    } catch (err) {
      setError('Failed to load profile data. Please check your connection.');
      console.error('Error fetching user data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchUserData(false);
  }, []);



  const handleEditProfile = () => {
    navigation.navigate('EditProfile', { userId: user?.id });
  };

  const handleNavigateToSettings = () => {
    navigation.navigate('Settings');
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={fetchUserData}
        >
          <Text style={[styles.buttonText, { color: colors.onPrimary }]}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <LogViewer
        visible={logViewerVisible}
        onClose={() => setLogViewerVisible(false)}
      />

      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.profileImageContainer}>
            {user?.image_256 || user?.picture ? (
              <Image
                source={{
                  uri: user.picture ?
                    (user.picture.startsWith('data:') ? user.picture : `data:image/png;base64,${user.picture}`) :
                    `data:image/png;base64,${user.image_256}`
                }}
                style={styles.profileImage}
                defaultSource={require('../../../assets/images/default_avatar.png')}
              />
            ) : (
              <View style={[styles.profileImagePlaceholder, { backgroundColor: colors.primary }]}>
                <Text style={[styles.profileImagePlaceholderText, { color: colors.onPrimary }]}>
                  {user?.name ? user.name.charAt(0).toUpperCase() : '?'}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.headerInfo}>
            <Text style={[styles.name, { color: colors.text }]}>{user?.name || 'User'}</Text>
            <Text style={[styles.email, { color: colors.textSecondary }]}>{user?.email || user?.login || 'No email'}</Text>
          </View>
          <TouchableOpacity
            style={styles.editIconButton}
            onPress={handleEditProfile}
          >
            <Icon name="pencil-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Contact Information</Text>

        <View style={styles.infoRow}>
          <View style={styles.infoHeader}>
            <Text style={styles.infoLabel}>Email</Text>
          </View>
          <Text style={styles.infoValue} selectable={true}>{user?.email || 'Not provided'}</Text>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoHeader}>
            <Text style={styles.infoLabel}>Phone</Text>
          </View>
          <Text style={styles.infoValue} selectable={true}>{user?.phone || 'Not provided'}</Text>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoHeader}>
            <Text style={styles.infoLabel}>Timezone</Text>
          </View>
          <Text style={styles.infoValue} selectable={true}>{user?.tz || 'Not set'}</Text>
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Account Information</Text>

        <View style={styles.infoRow}>
          <View style={styles.infoHeader}>
            <Text style={styles.infoLabel}>Username</Text>
          </View>
          <Text style={styles.infoValue} selectable={true}>{user?.login || 'Not available'}</Text>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoHeader}>
            <Text style={styles.infoLabel}>Company</Text>
          </View>
          <Text style={styles.infoValue} selectable={true}>
            {companyInfo?.current_company ? companyInfo.current_company[1] :
             user?.company_id ? user.company_id[1] : 'YourCompany'}
          </Text>
        </View>

        {companyInfo?.allowed_companies && companyInfo.allowed_companies.length > 1 && (
          <View style={styles.infoRow}>
            <View style={styles.infoHeader}>
              <Text style={styles.infoLabel}>Available Companies</Text>
            </View>
            <View style={styles.companiesList}>
              {companyInfo.allowed_companies.map((company, index) => (
                <Text key={index} style={styles.companyItem} selectable={true}>
                  • {company[1]}
                </Text>
              ))}
            </View>
          </View>
        )}
      </View>

      {user?.address && (
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Address</Text>

          {user.address.formatted ? (
            <View style={styles.infoRow}>
              <View style={styles.infoHeader}>
                <Text style={styles.infoLabel}>Full Address</Text>
              </View>
              <Text style={styles.infoValue} selectable={true}>
                {user.address.formatted.split('\n').map((line, index) => (
                  <Text key={index}>{line}{index < user.address.formatted.split('\n').length - 1 ? '\n' : ''}</Text>
                ))}
              </Text>
            </View>
          ) : (
            <>
              {user.address.street && (
                <View style={styles.infoRow}>
                  <View style={styles.infoHeader}>
                    <Text style={styles.infoLabel}>Street</Text>
                  </View>
                  <Text style={styles.infoValue} selectable={true}>{user.address.street}</Text>
                </View>
              )}

              {user.address.city && (
                <View style={styles.infoRow}>
                  <View style={styles.infoHeader}>
                    <Text style={styles.infoLabel}>City</Text>
                  </View>
                  <Text style={styles.infoValue} selectable={true}>{user.address.city}</Text>
                </View>
              )}

              {user.address.state && (
                <View style={styles.infoRow}>
                  <View style={styles.infoHeader}>
                    <Text style={styles.infoLabel}>State</Text>
                  </View>
                  <Text style={styles.infoValue} selectable={true}>{user.address.state}</Text>
                </View>
              )}

              {user.address.zip && (
                <View style={styles.infoRow}>
                  <View style={styles.infoHeader}>
                    <Text style={styles.infoLabel}>Zip</Text>
                  </View>
                  <Text style={styles.infoValue} selectable={true}>{user.address.zip}</Text>
                </View>
              )}
            </>
          )}

          {user.address.country && (
            <View style={styles.infoRow}>
              <View style={styles.infoHeader}>
                <Text style={styles.infoLabel}>Country</Text>
              </View>
              <Text style={styles.infoValue} selectable={true}>{user.address.country}</Text>
            </View>
          )}
        </View>
      )}

      <View style={[styles.section, { backgroundColor: colors.surface, marginTop: 16 }]}>
        <TouchableOpacity
          style={[styles.logViewerButton, { backgroundColor: colors.secondary || '#555' }]}
          onPress={() => setLogViewerVisible(true)}
        >
          <Icon name="console" size={18} color="#FFFFFF" style={styles.buttonIcon} />
          <Text style={styles.buttonText}>View Logs</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.bottomPadding} />
    </ScrollView>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    paddingTop: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginBottom: 16,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 16,
  },
  editIconButton: {
    padding: 8,
  },
  profileImageContainer: {
  },
  profileImage: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  profileImagePlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  profileImagePlaceholderText: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  name: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#6B7280',
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  logViewerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  bottomPadding: {
    height: 30,
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
  infoRow: {
    flexDirection: 'column',
    marginBottom: 12,
  },
  infoIcon: {
    marginRight: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
    fontWeight: '400',
  },
  infoValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
    paddingLeft: 10,
    paddingRight: 10,
    paddingVertical: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  companiesList: {
    paddingLeft: 10,
    paddingRight: 10,
    paddingVertical: 6,
    backgroundColor: '#F9FAFB',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  companyItem: {
    fontSize: 14,
    color: '#1F2937',
    paddingVertical: 4,
  },

  errorText: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '500',
  },
});

export default ProfileScreen;
