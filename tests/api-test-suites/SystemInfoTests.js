// SystemInfoTests.js
// Tests for Odoo system information endpoints (version, languages, countries, modules)

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import axios from 'axios';

// Configuration
const config = {
  baseURL: 'https://stairmaster18.odoo-sandbox.com',
  db: 'STAIRMASTER_18_24032025',
  clientId: 'ZqUAbvS6PIcOobKIjz4G4OuaKgm6pK9cpcpxBz1p',
  clientSecret: 'ZDfR6WHORSfrGSl424G9zNu5yXhfle6PRMGpC69M'
};

const SystemInfoTests = () => {
  const [token, setToken] = useState(null);
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

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

  // Get OAuth2 token first (using client credentials flow)
  const getToken = async () => {
    try {
      setIsLoading(true);
      addLog('Getting OAuth2 token via client credentials flow...');
      
      const tokenUrl = `${config.baseURL}/api/authentication/oauth2/token`;
      const params = new URLSearchParams();
      params.append('grant_type', 'client_credentials');
      params.append('client_id', config.clientId);
      params.append('client_secret', config.clientSecret);
      
      const response = await axios.post(tokenUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'DATABASE': config.db
        }
      });
      
      if (response.data && response.data.access_token) {
        setToken(response.data.access_token);
        addLog(`✅ Authentication successful. Token received.`);
        addLog(`Token: ${response.data.access_token.substring(0, 15)}...`);
        return response.data.access_token;
      } else {
        addLog('❌ Authentication failed: No access token in response', true);
        return null;
      }
    } catch (error) {
      addLog(`❌ Authentication error: ${error.message}`, true);
      if (error.response) {
        addLog(`Error response: ${formatResponse(error.response.data)}`, true);
      }
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Test API Version endpoint
  const testVersionEndpoint = async () => {
    let currentToken = token;
    if (!currentToken) {
      currentToken = await getToken();
      if (!currentToken) {
        addLog('❌ Cannot test API Version endpoint without a token.', true);
        return;
      }
    }
    
    try {
      addLog('Testing API Version endpoint...');
      
      const response = await axios.get(`${config.baseURL}/api`, {
        headers: {
          'Authorization': `Bearer ${currentToken}`,
          'DATABASE': config.db
        }
      });
      
      addLog(`✅ API Version retrieved successfully.`);
      addLog(`Version data: ${formatResponse(response.data)}`);
    } catch (error) {
      addLog(`❌ API Version error: ${error.message}`, true);
      if (error.response) {
        addLog(`Error response: ${formatResponse(error.response.data)}`, true);
      }
    }
  };

  // Test Languages endpoint
  const testLanguagesEndpoint = async () => {
    let currentToken = token;
    if (!currentToken) {
      currentToken = await getToken();
      if (!currentToken) {
        addLog('❌ Cannot test Languages endpoint without a token.', true);
        return;
      }
    }
    
    try {
      addLog('Testing Languages endpoint...');
      
      const response = await axios.get(`${config.baseURL}/api/languages`, {
        headers: {
          'Authorization': `Bearer ${currentToken}`,
          'DATABASE': config.db
        }
      });
      
      addLog(`✅ Languages retrieved successfully.`);
      addLog(`Found ${response.data.length} languages`);
      addLog(`First few languages: ${formatResponse(response.data.slice(0, 3))}`);
    } catch (error) {
      addLog(`❌ Languages error: ${error.message}`, true);
      if (error.response) {
        addLog(`Error response: ${formatResponse(error.response.data)}`, true);
      }
    }
  };

  // Test Countries endpoint
  const testCountriesEndpoint = async () => {
    let currentToken = token;
    if (!currentToken) {
      currentToken = await getToken();
      if (!currentToken) {
        addLog('❌ Cannot test Countries endpoint without a token.', true);
        return;
      }
    }
    
    try {
      addLog('Testing Countries endpoint...');
      
      const response = await axios.get(`${config.baseURL}/api/countries`, {
        headers: {
          'Authorization': `Bearer ${currentToken}`,
          'DATABASE': config.db
        }
      });
      
      addLog(`✅ Countries retrieved successfully.`);
      addLog(`Found ${response.data.length} countries`);
      addLog(`First few countries: ${formatResponse(response.data.slice(0, 3))}`);
    } catch (error) {
      addLog(`❌ Countries error: ${error.message}`, true);
      if (error.response) {
        addLog(`Error response: ${formatResponse(error.response.data)}`, true);
      }
    }
  };

  // Test Modules endpoint
  const testModulesEndpoint = async () => {
    let currentToken = token;
    if (!currentToken) {
      currentToken = await getToken();
      if (!currentToken) {
        addLog('❌ Cannot test Modules endpoint without a token.', true);
        return;
      }
    }
    
    try {
      addLog('Testing Modules endpoint...');
      
      const response = await axios.get(`${config.baseURL}/api/modules`, {
        headers: {
          'Authorization': `Bearer ${currentToken}`,
          'DATABASE': config.db
        }
      });
      
      addLog(`✅ Modules retrieved successfully.`);
      addLog(`Found ${response.data.length} modules`);
      addLog(`First few modules: ${formatResponse(response.data.slice(0, 3))}`);
    } catch (error) {
      addLog(`❌ Modules error: ${error.message}`, true);
      if (error.response) {
        addLog(`Error response: ${formatResponse(error.response.data)}`, true);
      }
    }
  };

  // Test User endpoint
  const testUserEndpoint = async () => {
    let currentToken = token;
    if (!currentToken) {
      currentToken = await getToken();
      if (!currentToken) {
        addLog('❌ Cannot test User endpoint without a token.', true);
        return;
      }
    }
    
    try {
      addLog('Testing User endpoint...');
      
      const response = await axios.get(`${config.baseURL}/api/user`, {
        headers: {
          'Authorization': `Bearer ${currentToken}`,
          'DATABASE': config.db
        }
      });
      
      addLog(`✅ User info retrieved successfully.`);
      addLog(`User data: ${formatResponse(response.data)}`);
    } catch (error) {
      addLog(`❌ User info error: ${error.message}`, true);
      if (error.response) {
        addLog(`Error response: ${formatResponse(error.response.data)}`, true);
      }
    }
  };

  // Test Session endpoint
  const testSessionEndpoint = async () => {
    let currentToken = token;
    if (!currentToken) {
      currentToken = await getToken();
      if (!currentToken) {
        addLog('❌ Cannot test Session endpoint without a token.', true);
        return;
      }
    }
    
    try {
      addLog('Testing Session endpoint...');
      
      const response = await axios.get(`${config.baseURL}/api/session`, {
        headers: {
          'Authorization': `Bearer ${currentToken}`,
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

  // Test Binary endpoint
  const testBinaryEndpoint = async () => {
    let currentToken = token;
    if (!currentToken) {
      currentToken = await getToken();
      if (!currentToken) {
        addLog('❌ Cannot test Binary endpoint without a token.', true);
        return;
      }
    }
    
    try {
      addLog('Testing Binary endpoint with company logo...');
      
      // First, let's get the company ID 
      const companyResponse = await axios.get(`${config.baseURL}/api/search_read/res.company`, {
        headers: {
          'Authorization': `Bearer ${currentToken}`,
          'DATABASE': config.db
        },
        params: {
          fields: '["id", "name", "logo"]',
          limit: 1
        }
      });
      
      if (companyResponse.data && companyResponse.data.length > 0) {
        const companyId = companyResponse.data[0].id;
        
        // Now, let's test the binary endpoint
        const response = await axios.get(`${config.baseURL}/api/binary/res.company/${companyId}/logo`, {
          headers: {
            'Authorization': `Bearer ${currentToken}`,
            'DATABASE': config.db
          },
          responseType: 'arraybuffer'
        });
        
        if (response.headers['content-type'].includes('image')) {
          addLog(`✅ Binary data (logo) retrieved successfully.`);
          addLog(`Content type: ${response.headers['content-type']}`);
          addLog(`Data size: ${response.data.byteLength} bytes`);
        } else {
          addLog(`❌ Binary endpoint returned non-image data`, true);
        }
      } else {
        addLog(`❌ Couldn't find company to test binary endpoint`, true);
      }
    } catch (error) {
      addLog(`❌ Binary endpoint error: ${error.message}`, true);
      if (error.response) {
        const errorData = error.response.data instanceof ArrayBuffer 
          ? `Binary data, ${error.response.data.byteLength} bytes` 
          : formatResponse(error.response.data);
        
        addLog(`Error response: ${errorData}`, true);
      }
    }
  };

  // Run all tests in sequence
  const runAllTests = async () => {
    setLogs([]);
    addLog('Running all system information endpoint tests...');
    
    // Get a token first
    const currentToken = await getToken();
    if (!currentToken) {
      addLog('❌ Cannot run tests without a token.', true);
      return;
    }
    
    // Run all tests in sequence
    await testVersionEndpoint();
    await testLanguagesEndpoint();
    await testCountriesEndpoint();
    await testModulesEndpoint();
    await testUserEndpoint();
    await testSessionEndpoint();
    await testBinaryEndpoint();
    
    addLog('✅ All tests completed.');
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.tokenInfo}>
          <Text style={styles.sectionTitle}>Authentication Status</Text>
          <Text style={styles.tokenText}>Status: {token ? '✓ Authenticated' : '✗ Not authenticated'}</Text>
          {token && (
            <Text style={styles.tokenText}>Token: {token.substring(0, 15)}...</Text>
          )}
        </View>
        
        <View style={styles.buttonsContainer}>
          <TouchableOpacity 
            style={styles.button} 
            onPress={getToken}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Get OAuth2 Token</Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.button} 
            onPress={runAllTests}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>Run All Tests</Text>
          </TouchableOpacity>
          
          <Text style={styles.sectionTitle}>Individual Endpoint Tests</Text>
          
          <TouchableOpacity 
            style={styles.button} 
            onPress={testVersionEndpoint}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>Test API Version</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.button} 
            onPress={testLanguagesEndpoint}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>Test Languages</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.button} 
            onPress={testCountriesEndpoint}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>Test Countries</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.button} 
            onPress={testModulesEndpoint}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>Test Modules</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.button} 
            onPress={testUserEndpoint}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>Test User Info</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.button} 
            onPress={testSessionEndpoint}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>Test Session Info</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.button} 
            onPress={testBinaryEndpoint}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>Test Binary (Logo)</Text>
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
    marginTop: 8,
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

export default SystemInfoTests;
