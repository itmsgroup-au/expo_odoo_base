// AuthenticationTests.js
// Tests for Odoo authentication methods (OAuth1, OAuth2, token management)

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import axios from 'axios';

// Configuration
const config = {
  baseURL: 'https://stairmaster18.odoo-sandbox.com',
  db: 'STAIRMASTER_18_24032025',
  username: 'ptadmin',
  password: '++Uke52br++',
  clientId: 'ZqUAbvS6PIcOobKIjz4G4OuaKgm6pK9cpcpxBz1p',
  clientSecret: 'ZDfR6WHORSfrGSl424G9zNu5yXhfle6PRMGpC69M'
};

const AuthenticationTests = () => {
  const [token, setToken] = useState(null);
  const [tokenExpiry, setTokenExpiry] = useState(null);
  const [refreshToken, setRefreshToken] = useState(null);
  const [logs, setLogs] = useState([]);
  const [username, setUsername] = useState(config.username);
  const [password, setPassword] = useState(config.password);

  // Add log message
  const addLog = (message, isError = false) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    setLogs(prevLogs => [{ text: logMessage, isError }, ...prevLogs]);
  };

  // Format JSON response for logging
  const formatResponse = (data) => {
    return JSON.stringify(data, null, 2);
  };

  // Test OAuth2 Password Grant
  const testOAuth2PasswordGrant = async () => {
    try {
      addLog('Testing OAuth2 Password Grant...');
      
      const tokenUrl = `${config.baseURL}/api/v2/authentication/oauth2/token`;
      const params = new URLSearchParams();
      params.append('grant_type', 'password');
      params.append('username', username);
      params.append('password', password);
      params.append('client_id', config.clientId);
      params.append('client_secret', config.clientSecret);

      const response = await axios.post(tokenUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      if (response.data && response.data.access_token) {
        setToken(response.data.access_token);
        setRefreshToken(response.data.refresh_token || null);
        
        // Calculate token expiry if expires_in is provided
        if (response.data.expires_in) {
          const expiryDate = new Date();
          expiryDate.setSeconds(expiryDate.getSeconds() + response.data.expires_in);
          setTokenExpiry(expiryDate.toLocaleString());
        }
        
        addLog(`✅ Authentication successful. Token received.`);
        addLog(`Token: ${response.data.access_token.substring(0, 15)}...`);
        addLog(`Full response: ${formatResponse(response.data)}`);
      } else {
        addLog('❌ Authentication failed: No access token in response', true);
      }
    } catch (error) {
      addLog(`❌ Authentication error: ${error.message}`, true);
      if (error.response) {
        addLog(`Error response: ${formatResponse(error.response.data)}`, true);
      }
    }
  };

  // Test token refresh
  const testTokenRefresh = async () => {
    if (!refreshToken) {
      addLog('❌ No refresh token available. Cannot test refresh.', true);
      return;
    }

    try {
      addLog('Testing OAuth2 Token Refresh...');
      
      const tokenUrl = `${config.baseURL}/api/v2/authentication/oauth2/token`;
      const params = new URLSearchParams();
      params.append('grant_type', 'refresh_token');
      params.append('refresh_token', refreshToken);
      params.append('client_id', config.clientId);
      params.append('client_secret', config.clientSecret);

      const response = await axios.post(tokenUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      if (response.data && response.data.access_token) {
        setToken(response.data.access_token);
        setRefreshToken(response.data.refresh_token || refreshToken);
        
        // Calculate token expiry if expires_in is provided
        if (response.data.expires_in) {
          const expiryDate = new Date();
          expiryDate.setSeconds(expiryDate.getSeconds() + response.data.expires_in);
          setTokenExpiry(expiryDate.toLocaleString());
        }
        
        addLog(`✅ Token refresh successful. New token received.`);
        addLog(`New token: ${response.data.access_token.substring(0, 15)}...`);
        addLog(`Full response: ${formatResponse(response.data)}`);
      } else {
        addLog('❌ Token refresh failed: No access token in response', true);
      }
    } catch (error) {
      addLog(`❌ Token refresh error: ${error.message}`, true);
      if (error.response) {
        addLog(`Error response: ${formatResponse(error.response.data)}`, true);
      }
    }
  };

  // Test token revocation
  const testTokenRevocation = async () => {
    if (!token) {
      addLog('❌ No token available. Cannot test revocation.', true);
      return;
    }

    try {
      addLog('Testing OAuth2 Token Revocation...');
      
      const revokeUrl = `${config.baseURL}/api/v2/authentication/oauth2/revoke`;
      const params = new URLSearchParams();
      params.append('token', token);
      params.append('client_id', config.clientId);
      params.append('client_secret', config.clientSecret);

      const response = await axios.post(revokeUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      addLog(`✅ Token revocation request sent successfully.`);
      addLog(`Response status: ${response.status}`);
      
      // Verify token is actually revoked by trying to use it
      try {
        addLog('Verifying token revocation by trying to use the token...');
        await axios.get(`${config.baseURL}/api/v2/user`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'DATABASE': config.db
          }
        });
        
        // If we get here, the token is still valid
        addLog('❌ Token still appears to be valid after revocation attempt', true);
      } catch (error) {
        // If we get a 401, the token was successfully revoked
        if (error.response && error.response.status === 401) {
          addLog('✅ Token successfully revoked. As expected, cannot use it anymore.');
          setToken(null);
          setTokenExpiry(null);
        } else {
          addLog(`❓ Unexpected error when verifying token revocation: ${error.message}`, true);
        }
      }
    } catch (error) {
      addLog(`❌ Token revocation error: ${error.message}`, true);
      if (error.response) {
        addLog(`Error response: ${formatResponse(error.response.data)}`, true);
      }
    }
  };

  // Test session info
  const testSessionInfo = async () => {
    if (!token) {
      addLog('❌ No token available. Cannot test session info.', true);
      return;
    }

    try {
      addLog('Testing Session Info Endpoint...');
      
      const response = await axios.get(`${config.baseURL}/api/v2/session`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'DATABASE': config.db
        }
      });

      addLog(`✅ Session info retrieved successfully.`);
      addLog(`Session data: ${formatResponse(response.data)}`);
    } catch (error) {
      addLog(`❌ Session info error: ${error.message}`, true);
      if (error.response) {
        addLog(`Error response: ${formatResponse(error.response.data)}`, true);
      }
    }
  };

  // Test different authentication header formats
  const testAuthHeaders = async () => {
    if (!token) {
      addLog('❌ No token available. Cannot test auth headers.', true);
      return;
    }

    addLog('Testing different authentication header formats...');

    // Test standard Bearer header
    try {
      addLog('1. Testing standard Bearer token header...');
      
      const response = await axios.get(`${config.baseURL}/api/v2/user`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'DATABASE': config.db
        }
      });

      addLog(`✅ Standard Bearer token header works.`);
      addLog(`User data: ${formatResponse(response.data)}`);
    } catch (error) {
      addLog(`❌ Standard Bearer token header failed: ${error.message}`, true);
    }

    // Test token in URL
    try {
      addLog('2. Testing token as URL parameter...');
      
      const response = await axios.get(`${config.baseURL}/api/v2/user?access_token=${token}&db=${config.db}`);

      addLog(`✅ Token as URL parameter works.`);
      addLog(`User data: ${formatResponse(response.data)}`);
    } catch (error) {
      addLog(`❌ Token as URL parameter failed: ${error.message}`, true);
    }

    // Test token without Bearer prefix
    try {
      addLog('3. Testing token without Bearer prefix...');
      
      const response = await axios.get(`${config.baseURL}/api/v2/user`, {
        headers: {
          'Authorization': token,
          'DATABASE': config.db
        }
      });

      addLog(`✅ Token without Bearer prefix works.`);
      addLog(`User data: ${formatResponse(response.data)}`);
    } catch (error) {
      addLog(`❌ Token without Bearer prefix failed: ${error.message}`, true);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.credentialsContainer}>
          <Text style={styles.sectionTitle}>Auth Credentials</Text>
          <TextInput
            style={styles.input}
            placeholder="Username"
            value={username}
            onChangeText={setUsername}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={true}
          />
        </View>
        
        <View style={styles.tokenInfo}>
          <Text style={styles.sectionTitle}>Token Information</Text>
          <Text style={styles.tokenText}>Status: {token ? '✓ Authenticated' : '✗ Not authenticated'}</Text>
          {token && (
            <>
              <Text style={styles.tokenText}>Token: {token.substring(0, 15)}...</Text>
              {tokenExpiry && (
                <Text style={styles.tokenText}>Expires: {tokenExpiry}</Text>
              )}
              <Text style={styles.tokenText}>
                Refresh Token: {refreshToken ? '✓ Available' : '✗ Not available'}
              </Text>
            </>
          )}
        </View>
        
        <View style={styles.buttonsContainer}>
          <TouchableOpacity 
            style={styles.button} 
            onPress={testOAuth2PasswordGrant}
          >
            <Text style={styles.buttonText}>Test OAuth2 Password Grant</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, !refreshToken && styles.buttonDisabled]} 
            onPress={testTokenRefresh}
            disabled={!refreshToken}
          >
            <Text style={styles.buttonText}>Test Token Refresh</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, !token && styles.buttonDisabled]} 
            onPress={testTokenRevocation}
            disabled={!token}
          >
            <Text style={styles.buttonText}>Test Token Revocation</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, !token && styles.buttonDisabled]} 
            onPress={testSessionInfo}
            disabled={!token}
          >
            <Text style={styles.buttonText}>Get Session Info</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, !token && styles.buttonDisabled]} 
            onPress={testAuthHeaders}
            disabled={!token}
          >
            <Text style={styles.buttonText}>Test Auth Header Formats</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.logsContainer}>
          <Text style={styles.sectionTitle}>Test Logs</Text>
          {logs.length === 0 ? (
            <Text style={styles.noLogs}>No logs yet. Run tests to see results.</Text>
          ) : (
            logs.map((log, index) => (
              <Text 
                key={index} 
                style={[styles.logText, log.isError && styles.errorLog]}
              >
                {log.text}
              </Text>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f8fa',
  },
  scrollView: {
    padding: 16,
  },
  credentialsContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  input: {
    height: 48,
    backgroundColor: '#f5f8fa',
    borderRadius: 8,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  tokenInfo: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tokenText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
  },
  buttonsContainer: {
    flexDirection: 'column',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#3498db',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#b1d4ea',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  logsContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#2c3e50',
  },
  logText: {
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 6,
    color: '#333',
  },
  errorLog: {
    color: '#e74c3c',
  },
  noLogs: {
    fontStyle: 'italic',
    color: '#999',
  },
});

export default AuthenticationTests;
