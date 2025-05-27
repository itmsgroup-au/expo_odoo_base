import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useAuth } from '../../../contexts/AuthContext';
import { loadServerConfig } from '../../../services/auth';
import { ODOO_CONFIG } from '../../../config/odoo';
import { clearAllCaches } from '../../../utils/clearContactCache';

const LoginScreen = ({ onLoginSuccess }) => {
  // Configurable login information with default values
  const [serverUrl, setServerUrl] = useState('https://itmsgroup.com.au');
  const [database, setDatabase] = useState('ITMS_v17_3_backup_2025_02_17_08_15');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [securePassword, setSecurePassword] = useState(true);
  const [showDatabaseField, setShowDatabaseField] = useState(false);
  const { login } = useAuth();

  // Load saved configuration on component mount
  useEffect(() => {
    const loadSavedConfig = async () => {
      try {
        const config = await loadServerConfig();
        if (config) {
          setServerUrl(config.serverUrl || '');
          setDatabase(config.database || '');
          setUsername(config.username || '');
          // Don't set password for security reasons
        }
      } catch (error) {
        console.error('Error loading saved config:', error);
      }
    };

    loadSavedConfig();
  }, []);

  const handleLogin = async () => {
    // If we're showing the 2FA screen, validate the 2FA code
    if (showTwoFactor) {
      if (!twoFactorCode || twoFactorCode.length < 6) {
        Alert.alert('Error', 'Please enter a valid 2FA code');
        return;
      }

      setIsLoading(true);

      try {
        let url = serverUrl;
        // Add https:// if missing
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          url = 'https://' + url;
        }

        const config = {
          serverUrl: url,
          database,
          username,
          password,
          twoFactorCode,
          // Use the OAuth2 credentials from config
          clientId: ODOO_CONFIG.clientId,
          clientSecret: ODOO_CONFIG.clientSecret,
          authEndpoint: ODOO_CONFIG.authEndpoint,
          grantType: ODOO_CONFIG.grantType
        };

        console.log('Login with 2FA config:', {
          serverUrl: url,
          database,
          username,
          has2FA: true
        });

        const result = await login(config);
        handleLoginResult(result);
      } catch (error) {
        console.error('2FA login error:', error);
        Alert.alert('Login Error', 'An unexpected error occurred. Please try again.');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Basic validation for initial login - database is optional if hidden
    if (!serverUrl || !username || !password || (showDatabaseField && !database)) {
      Alert.alert('Error', 'All visible fields are required');
      return;
    }

    setIsLoading(true);

    try {
      let url = serverUrl;
      // Add https:// if missing
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }

      const config = {
        serverUrl: url,
        database,
        username,
        password,
        // Use the OAuth2 credentials from config
        clientId: ODOO_CONFIG.clientId,
        clientSecret: ODOO_CONFIG.clientSecret,
        authEndpoint: ODOO_CONFIG.authEndpoint,
        grantType: ODOO_CONFIG.grantType
      };

      console.log('Login config:', {
        serverUrl: url,
        database,
        username
      });

      const result = await login(config);
      handleLoginResult(result);
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('Login Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle login result
  const handleLoginResult = (result) => {
    console.log('Login result in handleLoginResult:', JSON.stringify(result));

    if (!result.success) {
      if (result.error === 'server_error') {
        Alert.alert(
          'Connection Error',
          'Could not connect to the server. Please check the server URL.'
        );
      } else if (result.error === 'auth_error') {
        // Check if 2FA is required - be very explicit about checking the property
        console.log('Auth error detected, checking for 2FA requirement');
        console.log('requires2FA property:', result.requires2FA);

        if (result.requires2FA === true) {
          console.log('2FA is required, showing 2FA input screen');
          setShowTwoFactor(true);
          Alert.alert(
            '2FA Required',
            'Please enter the two-factor authentication code from your authenticator app.'
          );
        } else {
          console.log('Standard auth error, no 2FA required');
          Alert.alert(
            'Authentication Failed',
            'Invalid username or password. Please try again.'
          );
        }
      } else {
        // Check if the error message contains any indication of 2FA
        const errorMsg = (result.message || '').toLowerCase();
        if (errorMsg.includes('two-factor') ||
            errorMsg.includes('2fa') ||
            errorMsg.includes('mfa') ||
            errorMsg.includes('totp')) {
          console.log('2FA requirement detected from error message');
          setShowTwoFactor(true);
          Alert.alert(
            '2FA Required',
            'Please enter the two-factor authentication code from your authenticator app.'
          );
        } else {
          Alert.alert(
            'Login Error',
            result.message || 'An unexpected error occurred. Please try again.'
          );
        }
      }
    } else if (onLoginSuccess) {
      onLoginSuccess(result);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../../../assets/images/itms_logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <View style={styles.formContainer}>
          {!showTwoFactor ? (
            // Regular login form
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Server URL</Text>
                <TextInput
                  style={styles.input}
                  placeholder="example.odoo.com"
                  value={serverUrl}
                  onChangeText={setServerUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {showDatabaseField && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Database</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Database name"
                    value={database}
                    onChangeText={setDatabase}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              )}



              <View style={styles.inputGroup}>
                <Text style={styles.label}>Username</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Username or Email"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={securePassword}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setSecurePassword(!securePassword)}
                  >
                    <Text>{securePassword ? '👁️' : '🔒'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          ) : (
            // 2FA form
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Two-Factor Authentication Code</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter 6-digit code"
                value={twoFactorCode}
                onChangeText={setTwoFactorCode}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus={true}
              />
              <Text style={styles.helperText}>
                Enter the 6-digit code from your authenticator app
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.loginButtonText}>
                {showTwoFactor ? 'Verify Code' : 'Log In'}
              </Text>
            )}
          </TouchableOpacity>

          {showTwoFactor && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setShowTwoFactor(false)}
              disabled={isLoading}
            >
              <Text style={styles.backButtonText}>Back to Login</Text>
            </TouchableOpacity>
          )}

          {!showTwoFactor && (
            <>
              <TouchableOpacity
                style={styles.helpButton}
                onPress={() => {
                  console.log('Manual 2FA toggle pressed');
                  setShowTwoFactor(true);
                  Alert.alert(
                    '2FA Input',
                    'Enter your two-factor authentication code'
                  );
                }}
              >
                <Text style={styles.helpButtonText}>Need to enter 2FA code?</Text>
              </TouchableOpacity>

              {!showDatabaseField && (
                <TouchableOpacity
                  style={styles.databaseToggleButton}
                  onPress={() => setShowDatabaseField(true)}
                >
                  <Text style={styles.databaseToggleText}>Advanced Settings</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.resetButton}
                onPress={async () => {
                  Alert.alert(
                    'Reset App Data',
                    'This will clear all cached data including contacts. Continue?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Reset',
                        style: 'destructive',
                        onPress: async () => {
                          const success = await clearAllCaches();
                          if (success) {
                            Alert.alert('Success', 'All data cleared. You can now log in to the new server.');
                          } else {
                            Alert.alert('Error', 'Failed to clear data. Please try again.');
                          }
                        }
                      }
                    ]
                  );
                }}
              >
                <Text style={styles.resetButtonText}>Reset App Data</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 10,
    paddingVertical: 10,
  },
  logo: {
    width: 448,
    height: 192,
    marginBottom: 5,
  },
  formContainer: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D0D0D0',
    fontSize: 16,
    color: '#333',
  },
  passwordContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D0D0D0',
    overflow: 'hidden',
  },
  passwordInput: {
    flex: 1,
    padding: 15,
    fontSize: 16,
    color: '#333',
  },
  eyeButton: {
    padding: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginButton: {
    backgroundColor: '#3498DB',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  loginButtonDisabled: {
    backgroundColor: '#95A5A6',
  },
  loginButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    marginTop: 15,
    padding: 10,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#3498DB',
    fontSize: 14,
    fontWeight: '500',
  },
  helperText: {
    fontSize: 12,
    color: '#7F8C8D',
    marginTop: 5,
    marginLeft: 2,
  },
  helpButton: {
    marginTop: 20,
    padding: 10,
    alignItems: 'center',
  },
  helpButtonText: {
    color: '#3498DB',
    fontSize: 14,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  debugButton: {
    marginTop: 10,
    padding: 10,
    alignItems: 'center',
  },
  debugButtonText: {
    color: '#7F8C8D',
    fontSize: 12,
    fontWeight: '400',
    textDecorationLine: 'underline',
  },
  resetButton: {
    marginTop: 20,
    padding: 8,
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#7F8C8D',
    fontSize: 12,
    fontWeight: '400',
    textDecorationLine: 'underline',
  },
  databaseToggleButton: {
    marginBottom: 20,
    padding: 10,
    alignItems: 'center',
  },
  databaseToggleText: {
    color: '#3498DB',
    fontSize: 14,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
});

export default LoginScreen;