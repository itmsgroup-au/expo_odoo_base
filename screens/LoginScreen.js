import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Keyboard,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { loadServerConfig } from '../services/auth';

const LoginScreen = () => {
  const [serverUrl, setServerUrl] = useState('');
  const [database, setDatabase] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [securePassword, setSecurePassword] = useState(true);
  const { login } = useAuth();

  // Load saved configuration on component mount
  React.useEffect(() => {
    const loadSavedConfig = async () => {
      try {
        const config = await loadServerConfig();
        if (config) {
          setServerUrl(config.serverUrl);
          setDatabase(config.database);
          setUsername(config.username);
          // Don't set password for security reasons
        }
      } catch (error) {
        console.error('Error loading saved config:', error);
      }
    };
    
    loadSavedConfig();
  }, []);

  const handleLogin = async () => {
    Keyboard.dismiss();
    
    // Basic validation
    if (!serverUrl) {
      Alert.alert('Error', 'Please enter a server URL');
      return;
    }
    if (!database) {
      Alert.alert('Error', 'Please enter a database name');
      return;
    }
    if (!username) {
      Alert.alert('Error', 'Please enter a username');
      return;
    }
    if (!password) {
      Alert.alert('Error', 'Please enter a password');
      return;
    }
    
    setIsLoading(true);
    
    try {
      let url = serverUrl;
      // Add http:// if missing
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'http://' + url;
      }
      
      const config = {
        serverUrl: url,
        database,
        username,
        password
      };
      
      const result = await login(config);
      
      if (!result.success) {
        if (result.error === 'server_error') {
          Alert.alert('Connection Error', 'Could not connect to the server. Please check the server URL.');
        } else if (result.error === 'auth_error') {
          Alert.alert('Authentication Failed', 'Invalid username or password. Please try again.');
        } else {
          Alert.alert('Login Error', result.message || 'An unexpected error occurred. Please try again.');
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('Login Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.logoContainer}>
          <Text style={styles.title}>Odoo Mobile App</Text>
          <Text style={styles.subtitle}>Connect to your Odoo server</Text>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Server URL</Text>
            <TextInput
              style={styles.input}
              placeholder="example.odoo.com or localhost"
              value={serverUrl}
              onChangeText={setServerUrl}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          
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
          
          <TouchableOpacity
            style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.loginButtonText}>Log In</Text>
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
    backgroundColor: '#f9f9f9',
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#7F8C8D',
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
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    fontSize: 16,
  },
  passwordContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  passwordInput: {
    flex: 1,
    padding: 15,
    fontSize: 16,
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
});

export default LoginScreen;