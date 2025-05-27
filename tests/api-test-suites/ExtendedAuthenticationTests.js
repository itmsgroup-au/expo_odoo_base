// ExtendedAuthenticationTests.js
// Extended tests for Odoo authentication methods (OAuth1, OAuth2 authorization flows)

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import axios from 'axios';
import * as Crypto from 'expo-crypto';
import base64 from 'react-native-base64';
import * as Random from 'expo-random';
import { Buffer } from 'buffer';

// Configuration
const config = {
  baseURL: 'https://stairmaster18.odoo-sandbox.com',
  db: 'STAIRMASTER_18_24032025',
  username: 'ptadmin',
  password: '++Uke52br++',
  clientId: 'ZqUAbvS6PIcOobKIjz4G4OuaKgm6pK9cpcpxBz1p',
  clientSecret: 'ZDfR6WHORSfrGSl424G9zNu5yXhfle6PRMGpC69M',
  redirectUri: 'exomobile://auth/callback'
};

const ExtendedAuthenticationTests = () => {
  // State variables
  const [token, setToken] = useState(null);
  const [tokenExpiry, setTokenExpiry] = useState(null);
  const [refreshToken, setRefreshToken] = useState(null);
  const [logs, setLogs] = useState([]);
  const [authorizationCode, setAuthorizationCode] = useState('');
  const [state, setState] = useState('');
  const [oauth1RequestToken, setOauth1RequestToken] = useState(null);
  const [oauth1RequestTokenSecret, setOauth1RequestTokenSecret] = useState(null);
  const [oauth1Verifier, setOauth1Verifier] = useState('');
  const [oauth1ConsumerKey, setOauth1ConsumerKey] = useState('odoo_consumer_key');
  const [oauth1ConsumerSecret, setOauth1ConsumerSecret] = useState('odoo_consumer_secret');

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

  // Generate random string for state parameter
  const generateRandomString = async (length = 32) => {
    const randomBytes = await Random.getRandomBytesAsync(length);
    return Buffer.from(randomBytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '').substring(0, length);
  };

  // Generate PKCE code verifier and challenge
  const generatePKCE = async () => {
    const codeVerifier = await generateRandomString(64);
    const codeChallenge = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      codeVerifier,
      { encoding: Crypto.CryptoEncoding.BASE64 }
    );
    // Base64-URL encoding
    const codeChallengeFormatted = codeChallenge
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    return { codeVerifier, codeChallenge: codeChallengeFormatted };
  };

  // OAuth1 Tests
  
  // Test OAuth1 Temporary Credentials Acquisition
  const testOauth1TemporaryCredentials = async () => {
    try {
      addLog('Testing OAuth1 Temporary Credentials Acquisition...');
      
      // Generate timestamp and nonce
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const nonce = await generateRandomString(32);
      
      // Parameters for OAuth1 signature
      const parameters = {
        oauth_consumer_key: oauth1ConsumerKey,
        oauth_nonce: nonce,
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: timestamp,
        oauth_version: '1.0',
        oauth_callback: config.redirectUri
      };
      
      // Create base string
      const method = 'POST';
      const baseUrl = `${config.baseURL}/api/authentication/oauth1/initiate`;
      const paramString = Object.keys(parameters)
        .sort()
        .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(parameters[key])}`)
        .join('&');
      
      const baseString = `${method}&${encodeURIComponent(baseUrl)}&${encodeURIComponent(paramString)}`;
      
      // Create signing key
      const signingKey = `${encodeURIComponent(oauth1ConsumerSecret)}&`;
      
      // Generate signature
      const signature = await Crypto.hmacSHA1Async(baseString, signingKey, { encoding: Crypto.CryptoEncoding.BASE64 });
      
      // Append signature to parameters
      parameters.oauth_signature = signature;
      
      // Create OAuth header
      const authHeader = 'OAuth ' + Object.keys(parameters)
        .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(parameters[key])}"`)
        .join(', ');
      
      // Make request
      const response = await axios.post(baseUrl, null, {
        headers: {
          'Authorization': authHeader,
          'DATABASE': config.db
        }
      });
      
      // Parse response
      const responseParams = new URLSearchParams(response.data);
      const requestToken = responseParams.get('oauth_token');
      const requestTokenSecret = responseParams.get('oauth_token_secret');
      
      if (requestToken && requestTokenSecret) {
        setOauth1RequestToken(requestToken);
        setOauth1RequestTokenSecret(requestTokenSecret);
        
        addLog(`✅ OAuth1 Temporary Credentials acquired successfully.`);
        addLog(`Request Token: ${requestToken}`);
        addLog(`Request Token Secret: ${requestTokenSecret.substring(0, 5)}...`);
      } else {
        addLog('❌ Failed to parse OAuth1 Temporary Credentials', true);
      }
    } catch (error) {
      addLog(`❌ OAuth1 Temporary Credentials error: ${error.message}`, true);
      if (error.response) {
        addLog(`Error response: ${formatResponse(error.response.data)}`, true);
      }
    }
  };
  
  // Test OAuth1 Authorization
  const testOauth1Authorization = async () => {
    if (!oauth1RequestToken) {
      addLog('❌ No OAuth1 request token available. Run Temporary Credentials Acquisition first.', true);
      return;
    }
    
    try {
      addLog('Launching OAuth1 Authorization flow...');
      
      const authUrl = `${config.baseURL}/api/authentication/oauth1/authorize?oauth_token=${oauth1RequestToken}`;
      
      // Open browser for authorization
      const result = await WebBrowser.openAuthSessionAsync(authUrl, config.redirectUri);
      
      if (result.type === 'success') {
        // Parse the callback URL
        const callbackUrl = new URL(result.url);
        const verifier = callbackUrl.searchParams.get('oauth_verifier');
        
        if (verifier) {
          setOauth1Verifier(verifier);
          addLog(`✅ OAuth1 Authorization successful. Verifier received.`);
          addLog(`Verifier: ${verifier}`);
        } else {
          addLog('❌ OAuth1 Authorization failed: No verifier in callback URL', true);
        }
      } else {
        addLog(`❌ OAuth1 Authorization flow canceled or failed: ${result.type}`, true);
      }
    } catch (error) {
      addLog(`❌ OAuth1 Authorization error: ${error.message}`, true);
    }
  };
  
  // Test OAuth1 Token Exchange
  const testOauth1TokenExchange = async () => {
    if (!oauth1RequestToken || !oauth1RequestTokenSecret || !oauth1Verifier) {
      addLog('❌ Missing OAuth1 request token, secret, or verifier. Complete previous steps first.', true);
      return;
    }
    
    try {
      addLog('Testing OAuth1 Token Exchange...');
      
      // Generate timestamp and nonce
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const nonce = await generateRandomString(32);
      
      // Parameters for OAuth1 signature
      const parameters = {
        oauth_consumer_key: oauth1ConsumerKey,
        oauth_nonce: nonce,
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: timestamp,
        oauth_version: '1.0',
        oauth_token: oauth1RequestToken,
        oauth_verifier: oauth1Verifier
      };
      
      // Create base string
      const method = 'POST';
      const baseUrl = `${config.baseURL}/api/authentication/oauth1/token`;
      const paramString = Object.keys(parameters)
        .sort()
        .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(parameters[key])}`)
        .join('&');
      
      const baseString = `${method}&${encodeURIComponent(baseUrl)}&${encodeURIComponent(paramString)}`;
      
      // Create signing key
      const signingKey = `${encodeURIComponent(oauth1ConsumerSecret)}&${encodeURIComponent(oauth1RequestTokenSecret)}`;
      
      // Generate signature
      const signature = await Crypto.hmacSHA1Async(baseString, signingKey, { encoding: Crypto.CryptoEncoding.BASE64 });
      
      // Append signature to parameters
      parameters.oauth_signature = signature;
      
      // Create OAuth header
      const authHeader = 'OAuth ' + Object.keys(parameters)
        .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(parameters[key])}"`)
        .join(', ');
      
      // Make request
      const response = await axios.post(baseUrl, null, {
        headers: {
          'Authorization': authHeader,
          'DATABASE': config.db
        }
      });
      
      // Parse response
      const responseParams = new URLSearchParams(response.data);
      const accessToken = responseParams.get('oauth_token');
      const accessTokenSecret = responseParams.get('oauth_token_secret');
      
      if (accessToken && accessTokenSecret) {
        setToken(accessToken);
        
        addLog(`✅ OAuth1 Token Exchange successful.`);
        addLog(`Access Token: ${accessToken.substring(0, 15)}...`);
        addLog(`Access Token Secret: ${accessTokenSecret.substring(0, 5)}...`);
        
        // Try to get user info with the token
        try {
          addLog('Testing token by fetching user info...');
          
          // Generate new timestamp and nonce for user info request
          const userInfoTimestamp = Math.floor(Date.now() / 1000).toString();
          const userInfoNonce = await generateRandomString(32);
          
          // Parameters for OAuth1 signature
          const userInfoParams = {
            oauth_consumer_key: oauth1ConsumerKey,
            oauth_nonce: userInfoNonce,
            oauth_signature_method: 'HMAC-SHA1',
            oauth_timestamp: userInfoTimestamp,
            oauth_version: '1.0',
            oauth_token: accessToken
          };
          
          // Create base string
          const userInfoMethod = 'GET';
          const userInfoUrl = `${config.baseURL}/api/user`;
          const userInfoParamString = Object.keys(userInfoParams)
            .sort()
            .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(userInfoParams[key])}`)
            .join('&');
          
          const userInfoBaseString = `${userInfoMethod}&${encodeURIComponent(userInfoUrl)}&${encodeURIComponent(userInfoParamString)}`;
          
          // Create signing key
          const userInfoSigningKey = `${encodeURIComponent(oauth1ConsumerSecret)}&${encodeURIComponent(accessTokenSecret)}`;
          
          // Generate signature
          const userInfoSignature = await Crypto.hmacSHA1Async(userInfoBaseString, userInfoSigningKey, { encoding: Crypto.CryptoEncoding.BASE64 });
          
          // Append signature to parameters
          userInfoParams.oauth_signature = userInfoSignature;
          
          // Create OAuth header
          const userInfoAuthHeader = 'OAuth ' + Object.keys(userInfoParams)
            .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(userInfoParams[key])}"`)
            .join(', ');
          
          // Make request
          const userInfoResponse = await axios.get(userInfoUrl, {
            headers: {
              'Authorization': userInfoAuthHeader,
              'DATABASE': config.db
            }
          });
          
          addLog(`✅ User info retrieved successfully with OAuth1 token.`);
          addLog(`User data: ${formatResponse(userInfoResponse.data)}`);
        } catch (userInfoError) {
          addLog(`❌ Failed to get user info with OAuth1 token: ${userInfoError.message}`, true);
        }
      } else {
        addLog('❌ Failed to parse OAuth1 Token Exchange response', true);
      }
    } catch (error) {
      addLog(`❌ OAuth1 Token Exchange error: ${error.message}`, true);
      if (error.response) {
        addLog(`Error response: ${formatResponse(error.response.data)}`, true);
      }
    }
  };
  
  // OAuth2 Tests
  
  // Test OAuth2 Authorization Code Flow
  const testOauth2AuthorizationCode = async () => {
    try {
      addLog('Testing OAuth2 Authorization Code Flow...');
      
      // Generate state parameter for security
      const stateValue = await generateRandomString(32);
      setState(stateValue);
      
      // Generate PKCE code challenge
      const { codeVerifier, codeChallenge } = await generatePKCE();
      
      // Store code verifier in component state - in a real app, store it securely
      addLog(`Generated code verifier: ${codeVerifier.substring(0, 10)}...`);
      
      // Construct authorization URL
      const authUrl = `${config.baseURL}/api/authentication/oauth2/authorize?` +
        `response_type=code` +
        `&client_id=${encodeURIComponent(config.clientId)}` +
        `&redirect_uri=${encodeURIComponent(config.redirectUri)}` +
        `&state=${encodeURIComponent(stateValue)}` +
        `&code_challenge=${encodeURIComponent(codeChallenge)}` +
        `&code_challenge_method=S256` +
        `&scope=profile`;
      
      // Open browser for authorization
      const result = await WebBrowser.openAuthSessionAsync(authUrl, config.redirectUri);
      
      if (result.type === 'success') {
        // Parse the callback URL
        const callbackUrl = new URL(result.url);
        const code = callbackUrl.searchParams.get('code');
        const returnedState = callbackUrl.searchParams.get('state');
        
        // Verify state to prevent CSRF attacks
        if (returnedState !== stateValue) {
          addLog('❌ OAuth2 Authorization failed: State mismatch', true);
          return;
        }
        
        if (code) {
          setAuthorizationCode(code);
          addLog(`✅ OAuth2 Authorization successful. Code received.`);
          addLog(`Code: ${code}`);
          
          // Exchange code for token
          try {
            addLog('Exchanging authorization code for token...');
            
            const tokenUrl = `${config.baseURL}/api/authentication/oauth2/token`;
            const params = new URLSearchParams();
            params.append('grant_type', 'authorization_code');
            params.append('code', code);
            params.append('redirect_uri', config.redirectUri);
            params.append('client_id', config.clientId);
            params.append('client_secret', config.clientSecret);
            params.append('code_verifier', codeVerifier);
            
            const response = await axios.post(tokenUrl, params, {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'DATABASE': config.db
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
              
              addLog(`✅ Token exchange successful.`);
              addLog(`Token: ${response.data.access_token.substring(0, 15)}...`);
              addLog(`Full response: ${formatResponse(response.data)}`);
              
              // Test the token
              await testToken(response.data.access_token);
            } else {
              addLog('❌ Token exchange failed: No access token in response', true);
            }
          } catch (tokenError) {
            addLog(`❌ Token exchange error: ${tokenError.message}`, true);
            if (tokenError.response) {
              addLog(`Error response: ${formatResponse(tokenError.response.data)}`, true);
            }
          }
        } else {
          addLog('❌ OAuth2 Authorization failed: No code in callback URL', true);
        }
      } else {
        addLog(`❌ OAuth2 Authorization flow canceled or failed: ${result.type}`, true);
      }
    } catch (error) {
      addLog(`❌ OAuth2 Authorization error: ${error.message}`, true);
    }
  };

  // Test OAuth2 Client Credentials Flow
  const testOauth2ClientCredentials = async () => {
    try {
      addLog('Testing OAuth2 Client Credentials Flow...');
      
      const tokenUrl = `${config.baseURL}/api/authentication/oauth2/token`;
      const params = new URLSearchParams();
      params.append('grant_type', 'client_credentials');
      params.append('client_id', config.clientId);
      params.append('client_secret', config.clientSecret);
      params.append('scope', 'profile');
      
      const response = await axios.post(tokenUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'DATABASE': config.db
        }
      });
      
      if (response.data && response.data.access_token) {
        setToken(response.data.access_token);
        
        // Calculate token expiry if expires_in is provided
        if (response.data.expires_in) {
          const expiryDate = new Date();
          expiryDate.setSeconds(expiryDate.getSeconds() + response.data.expires_in);
          setTokenExpiry(expiryDate.toLocaleString());
        }
        
        addLog(`✅ Client Credentials authentication successful.`);
        addLog(`Token: ${response.data.access_token.substring(0, 15)}...`);
        addLog(`Full response: ${formatResponse(response.data)}`);
        
        // Test the token
        await testToken(response.data.access_token);
      } else {
        addLog('❌ Client Credentials authentication failed: No access token in response', true);
      }
    } catch (error) {
      addLog(`❌ Client Credentials error: ${error.message}`, true);
      if (error.response) {
        addLog(`Error response: ${formatResponse(error.response.data)}`, true);
      }
    }
  };

  // Test token by getting user info
  const testToken = async (accessToken) => {
    try {
      addLog('Testing token by fetching user info...');
      
      const response = await axios.get(`${config.baseURL}/api/user`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'DATABASE': config.db
        }
      });
      
      addLog(`✅ Token is valid. User info retrieved successfully.`);
      addLog(`User data: ${formatResponse(response.data)}`);
    } catch (error) {
      addLog(`❌ Token validation error: ${error.message}`, true);
      if (error.response) {
        addLog(`Error response: ${formatResponse(error.response.data)}`, true);
      }
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
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
          <Text style={styles.sectionTitle}>OAuth1 Tests</Text>
          
          <TouchableOpacity 
            style={styles.button} 
            onPress={testOauth1TemporaryCredentials}
          >
            <Text style={styles.buttonText}>1. Get OAuth1 Temporary Credentials</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, !oauth1RequestToken && styles.buttonDisabled]} 
            onPress={testOauth1Authorization}
            disabled={!oauth1RequestToken}
          >
            <Text style={styles.buttonText}>2. OAuth1 Authorization</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, (!oauth1RequestToken || !oauth1Verifier) && styles.buttonDisabled]} 
            onPress={testOauth1TokenExchange}
            disabled={!oauth1RequestToken || !oauth1Verifier}
          >
            <Text style={styles.buttonText}>3. OAuth1 Token Exchange</Text>
          </TouchableOpacity>
          
          <Text style={styles.sectionTitle}>OAuth2 Tests</Text>
          
          <TouchableOpacity 
            style={styles.button} 
            onPress={testOauth2AuthorizationCode}
          >
            <Text style={styles.buttonText}>OAuth2 Authorization Code Flow</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.button} 
            onPress={testOauth2ClientCredentials}
          >
            <Text style={styles.buttonText}>OAuth2 Client Credentials Flow</Text>
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

export default ExtendedAuthenticationTests;
