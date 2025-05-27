// ImageHandlingTests.js
// Tests for image handling, thumbnails, and caching strategies

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  FlatList,
  ActivityIndicator,
  Platform,
  PixelRatio
} from 'react-native';
import axios from 'axios';
import * as FileSystem from 'expo-file-system';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';

// Config
const config = {
  baseURL: 'https://stairmaster18.odoo-sandbox.com',
  db: 'STAIRMASTER_18_24032025',
  username: 'ptadmin',
  password: '++Uke52br++',
  clientId: 'ZqUAbvS6PIcOobKIjz4G4OuaKgm6pK9cpcpxBz1p',
  clientSecret: 'ZDfR6WHORSfrGSl424G9zNu5yXhfle6PRMGpC69M'
};

const TEST_SIZES = ['64x64', '128x128', '256x256', '512x512'];

const ImageHandlingTests = () => {
  const [token, setToken] = useState(null);
  const [logs, setLogs] = useState([]);
  const [partnerId, setPartnerId] = useState('');
  const [attachmentId, setAttachmentId] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [imageTests, setImageTests] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [downloadProgress, setDownloadProgress] = useState({});
  const [deviceInfo, setDeviceInfo] = useState({});

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

  // Get OAuth token
  const getAuthToken = async () => {
    try {
      setIsLoading(true);
      addLog('Requesting OAuth token...');
      
      const tokenUrl = `${config.baseURL}/api/v2/authentication/oauth2/token`;
      const params = new URLSearchParams();
      params.append('grant_type', 'password');
      params.append('username', config.username);
      params.append('password', config.password);
      params.append('client_id', config.clientId);
      params.append('client_secret', config.clientSecret);

      const response = await axios.post(tokenUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      if (response.data && response.data.access_token) {
        setToken(response.data.access_token);
        addLog(`✅ Authentication successful. Token received.`);
        
        // Get device info
        gatherDeviceInfo();
        
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

  // Gather device information
  const gatherDeviceInfo = () => {
    const info = {
      platform: Platform.OS,
      version: Platform.Version,
      isSimulator: Platform.OS === 'ios' 
        ? Platform.isPad 
          ? 'iPad Simulator' 
          : 'iPhone Simulator'
        : 'Android Emulator',
      pixelRatio: PixelRatio.get(),
      pixelDensity: PixelRatio.getFontScale(),
      dimensions: {
        width: PixelRatio.getPixelSizeForLayoutSize(100),
        height: PixelRatio.getPixelSizeForLayoutSize(100)
      }
    };
    
    setDeviceInfo(info);
    addLog(`Device Info: ${JSON.stringify(info)}`);
  };
  
  // Search partners
  const searchPartners = async () => {
    if (!token) {
      addLog('❌ No token available. Please authenticate first.', true);
      return;
    }
    
    if (!searchTerm.trim()) {
      addLog('❌ Please enter a search term.', true);
      return;
    }
    
    try {
      setIsLoading(true);
      addLog(`Searching for partners matching: "${searchTerm}"...`);
      
      const domain = JSON.stringify([
        '|', '|', '|',
        ['name', 'ilike', searchTerm],
        ['email', 'ilike', searchTerm],
        ['phone', 'ilike', searchTerm],
        ['mobile', 'ilike', searchTerm]
      ]);
      
      const response = await axios.get(`${config.baseURL}/api/v2/search_read/res.partner`, {
        params: {
          domain,
          fields: JSON.stringify(['id', 'name', 'email', 'phone', 'mobile', 'image_128', 'is_company']),
          limit: 10
        },
        headers: {
          'Authorization': `Bearer ${token}`,
          'DATABASE': config.db
        }
      });
      
      if (response.data && response.data.length) {
        addLog(`✅ Found ${response.data.length} matching partners`);
        setSearchResults(response.data);
      } else {
        addLog('❌ No partners found matching your search', true);
        setSearchResults([]);
      }
    } catch (error) {
      addLog(`❌ Search error: ${error.message}`, true);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Test profile image with different methods
  const testProfileImage = async (id) => {
    if (!token || !id) {
      addLog('❌ Token or Partner ID missing', true);
      return;
    }
    
    setPartnerId(id);
    addLog(`Testing profile image for partner ID: ${id}...`);
    setImageTests([]);
    
    const testResults = [];
    
    // Test different URL formats and sizes
    for (const size of TEST_SIZES) {
      // Method 1: Direct URL with token in URL
      const test1 = {
        id: `method1_${size}`,
        name: `Method 1: URL token (${size})`,
        url: `${config.baseURL}/api/v2/image/res.partner/${id}/image_1920/${size}?access_token=${token}`,
        size,
        method: 'url_token',
        progress: 0,
        testResult: null,
        localUri: null
      };
      
      // Method 2: Download + local file (authorization header)
      const test2 = {
        id: `method2_${size}`,
        name: `Method 2: Download to file (${size})`,
        url: `${config.baseURL}/api/v2/image/res.partner/${id}/image_1920/${size}`,
        size,
        method: 'download_file',
        progress: 0,
        testResult: null,
        localUri: null
      };
      
      // Method 3: /web/image endpoint
      const test3 = {
        id: `method3_${size}`,
        name: `Method 3: web/image (${size})`,
        url: `${config.baseURL}/web/image?model=res.partner&id=${id}&field=image_1920&size=${size}`,
        size,
        method: 'web_image',
        progress: 0,
        testResult: null,
        localUri: null
      };
      
      testResults.push(test1, test2, test3);
    }
    
    setImageTests(testResults);
    
    // Run tests in sequence
    for (const test of testResults) {
      await runImageTest(test);
    }
  };
  
  // Run individual image test
  const runImageTest = async (test) => {
    addLog(`Running test: ${test.name}...`);
    
    try {
      const startTime = Date.now();
      
      // Different behavior based on method
      switch (test.method) {
        case 'url_token':
          // Just test if the URL loads in an Image component
          // The result will be visible in the UI
          updateTestProgress(test.id, 100);
          updateTestResult(test.id, {
            success: true,
            time: 0, // We can't actually measure loading time with a direct URL
            message: "Test complete - check if image is visible"
          });
          break;
          
        case 'download_file':
          // Download file with auth header
          const filename = `partner_${partnerId}_${test.size}.jpg`;
          const fileUri = `${FileSystem.cacheDirectory}/${filename}`;
          
          // Create download job
          const downloadResumable = FileSystem.createDownloadResumable(
            test.url,
            fileUri,
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'DATABASE': config.db
              }
            },
            (progress) => {
              const progressPercentage = progress.totalBytesWritten / progress.totalBytesExpectedToWrite * 100;
              updateTestProgress(test.id, progressPercentage);
            }
          );
          
          // Start download
          const result = await downloadResumable.downloadAsync();
          const endTime = Date.now();
          
          if (result && result.uri) {
            updateTestResult(test.id, {
              success: true,
              time: endTime - startTime,
              message: "Download successful",
              fileUri: result.uri,
              fileSize: result.headers && result.headers['Content-Length'] 
                ? parseInt(result.headers['Content-Length'])
                : 'Unknown'
            });
            
            // Update test object with local URI for image display
            updateTestLocalUri(test.id, result.uri);
          } else {
            throw new Error("Download failed - no URI in result");
          }
          break;
          
        case 'web_image':
          // Simple HEAD request to test if URL is accessible
          const headResult = await axios.head(test.url, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'DATABASE': config.db
            }
          });
          
          const webImageEndTime = Date.now();
          
          if (headResult && headResult.status >= 200 && headResult.status < 300) {
            updateTestResult(test.id, {
              success: true,
              time: webImageEndTime - startTime,
              message: "URL accessible",
              status: headResult.status,
              contentType: headResult.headers['content-type'],
              contentLength: headResult.headers['content-length']
            });
          } else {
            throw new Error(`HEAD request failed with status ${headResult ? headResult.status : 'unknown'}`);
          }
          break;
      }
    } catch (error) {
      addLog(`❌ Test failed: ${test.name} - ${error.message}`, true);
      updateTestResult(test.id, {
        success: false,
        message: error.message,
        error: error
      });
    }
  };
  
  // Update test progress
  const updateTestProgress = (testId, progress) => {
    setDownloadProgress(prev => ({
      ...prev,
      [testId]: progress
    }));
  };
  
  // Update test result
  const updateTestResult = (testId, result) => {
    setImageTests(prev => 
      prev.map(test => 
        test.id === testId 
          ? { ...test, testResult: result }
          : test
      )
    );
    
    addLog(`Test result for ${testId}: ${result.success ? '✅ Success' : '❌ Failed'} - ${result.message}`);
    if (result.time) {
      addLog(`Time taken: ${result.time}ms`);
    }
    if (result.fileSize) {
      addLog(`File size: ${typeof result.fileSize === 'number' ? `${Math.round(result.fileSize / 1024)} KB` : result.fileSize}`);
    }
  };
  
  // Update test local URI
  const updateTestLocalUri = (testId, uri) => {
    setImageTests(prev => 
      prev.map(test => 
        test.id === testId 
          ? { ...test, localUri: uri }
          : test
      )
    );
  };
  
  // Test attachment image
  const testAttachmentImage = async () => {
    if (!token || !attachmentId) {
      addLog('❌ Token or Attachment ID missing', true);
      return;
    }
    
    addLog(`Testing attachment image with ID: ${attachmentId}...`);
    setImageTests([]);
    
    const testResults = [];
    
    // Test different URL formats and sizes
    for (const size of TEST_SIZES) {
      // Method 1: Direct URL with token in URL (api/v2/image)
      const test1 = {
        id: `attach_method1_${size}`,
        name: `Method 1: URL token (${size})`,
        url: `${config.baseURL}/api/v2/image/${attachmentId}/${size}?access_token=${token}`,
        size,
        method: 'url_token',
        progress: 0,
        testResult: null,
        localUri: null
      };
      
      // Method 2: Download + local file (api/v2/download)
      const test2 = {
        id: `attach_method2_${size}`,
        name: `Method 2: api/v2/download`,
        url: `${config.baseURL}/api/v2/download/${attachmentId}`,
        size,
        method: 'download_file',
        progress: 0,
        testResult: null,
        localUri: null
      };
      
      // Method 3: Direct URL with header auth
      const test3 = {
        id: `attach_method3_${size}`,
        name: `Method 3: web/image with header (${size})`,
        url: `${config.baseURL}/web/image?model=ir.attachment&id=${attachmentId}&field=datas&size=${size}`,
        size,
        method: 'web_image',
        progress: 0,
        testResult: null,
        localUri: null
      };
      
      testResults.push(test1, test2, test3);
    }
    
    setImageTests(testResults);
    
    // Run tests in sequence
    for (const test of testResults) {
      await runImageTest(test);
    }
  };
  
  // Save image to camera roll
  const saveImageToCameraRoll = async (uri) => {
    try {
      const savedUri = await CameraRoll.save(uri);
      addLog(`✅ Image saved to camera roll: ${savedUri}`);
      return true;
    } catch (error) {
      addLog(`❌ Failed to save image: ${error.message}`, true);
      return false;
    }
  };
  
  // Render search result item
  const renderSearchItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.searchItem}
      onPress={() => testProfileImage(item.id)}
    >
      <View style={styles.avatarContainer}>
        {item.image_128 ? (
          <Image 
            source={{ uri: `data:image/png;base64,${item.image_128}` }} 
            style={styles.avatar} 
          />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>
              {item.name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.searchItemText}>
        <Text style={styles.searchItemName}>{item.name}</Text>
        <Text style={styles.searchItemDetail}>{item.email || item.phone || item.mobile || 'No contact info'}</Text>
        <Text style={styles.searchItemId}>ID: {item.id}</Text>
      </View>
    </TouchableOpacity>
  );
  
  // Render image test item
  const renderTestItem = ({ item }) => (
    <View style={styles.testItem}>
      <Text style={styles.testName}>{item.name}</Text>
      
      {/* Progress indicator */}
      {(item.method === 'download_file' && !item.testResult) && (
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { width: `${downloadProgress[item.id] || 0}%` }]} />
          <Text style={styles.progressText}>{Math.round(downloadProgress[item.id] || 0)}%</Text>
        </View>
      )}
      
      {/* Result indicators */}
      {item.testResult && (
        <View style={styles.resultContainer}>
          <Text style={[
            styles.resultText,
            item.testResult.success ? styles.successText : styles.errorText
          ]}>
            {item.testResult.success ? '✅ Success' : '❌ Failed'}: {item.testResult.message}
          </Text>
          
          {item.testResult.time && (
            <Text style={styles.resultDetail}>Load time: {item.testResult.time}ms</Text>
          )}
          
          {item.testResult.fileSize && (
            <Text style={styles.resultDetail}>
              Size: {typeof item.testResult.fileSize === 'number' 
                ? `${Math.round(item.testResult.fileSize / 1024)} KB` 
                : item.testResult.fileSize}
            </Text>
          )}
        </View>
      )}
      
      {/* Image display */}
      <View style={styles.imageContainer}>
        {item.method === 'url_token' && (
          <Image 
            source={{ uri: item.url }} 
            style={styles.testImage}
            resizeMode="contain" 
          />
        )}
        
        {item.method === 'download_file' && item.localUri && (
          <View>
            <Image 
              source={{ uri: item.localUri }} 
              style={styles.testImage}
              resizeMode="contain" 
            />
            <TouchableOpacity 
              style={styles.saveButton}
              onPress={() => saveImageToCameraRoll(item.localUri)}
            >
              <Text style={styles.saveButtonText}>Save to Gallery</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {item.method === 'web_image' && (
          <Image 
            source={{ 
              uri: item.url,
              headers: {
                'Authorization': `Bearer ${token}`,
                'DATABASE': config.db
              }
            }} 
            style={styles.testImage}
            resizeMode="contain" 
          />
        )}
      </View>
    </View>
  );

  // Component initialization
  useEffect(() => {
    // Automatically authenticate on component mount
    getAuthToken();
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Authentication section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Authentication</Text>
          <Text style={styles.tokenStatus}>
            Status: {token ? '✓ Authenticated' : '✗ Not authenticated'}
          </Text>
          
          {!token && (
            <TouchableOpacity
              style={styles.button}
              onPress={getAuthToken}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Authenticate</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
        
        {/* Device information */}
        {Object.keys(deviceInfo).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Device Information</Text>
            <Text style={styles.detailText}>Platform: {deviceInfo.platform}</Text>
            <Text style={styles.detailText}>Version: {deviceInfo.version}</Text>
            <Text style={styles.detailText}>Simulator: {deviceInfo.isSimulator}</Text>
            <Text style={styles.detailText}>Pixel Ratio: {deviceInfo.pixelRatio}</Text>
            <Text style={styles.detailText}>Font Scale: {deviceInfo.pixelDensity}</Text>
          </View>
        )}
        
        {/* Partner search section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Search For Partners</Text>
          
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Enter name, email or phone"
              value={searchTerm}
              onChangeText={setSearchTerm}
            />
            
            <TouchableOpacity
              style={[styles.button, styles.searchButton]}
              onPress={searchPartners}
              disabled={isLoading || !token}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Search</Text>
              )}
            </TouchableOpacity>
          </View>
          
          {searchResults.length > 0 && (
            <FlatList
              data={searchResults}
              renderItem={renderSearchItem}
              keyExtractor={item => item.id.toString()}
              style={styles.searchResults}
              scrollEnabled={false}
            />
          )}
        </View>
        
        {/* Test specific attachment */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Test Attachment Image</Text>
          
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Enter attachment ID"
              value={attachmentId}
              onChangeText={setAttachmentId}
              keyboardType="numeric"
            />
            
            <TouchableOpacity
              style={[styles.button, styles.searchButton]}
              onPress={testAttachmentImage}
              disabled={isLoading || !token || !attachmentId}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Test</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Test results */}
        {imageTests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Test Results</Text>
            
            <FlatList
              data={imageTests}
              renderItem={renderTestItem}
              keyExtractor={item => item.id}
              style={styles.testResults}
              scrollEnabled={false}
            />
          </View>
        )}
        
        {/* Logs */}
        <View style={styles.section}>
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
  section: {
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
  tokenStatus: {
    fontSize: 16,
    color: '#555',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#3498db',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    height: 48,
    backgroundColor: '#f5f8fa',
    borderRadius: 8,
    paddingHorizontal: 16,
    marginRight: 8,
  },
  searchButton: {
    paddingHorizontal: 24,
  },
  searchResults: {
    marginTop: 16,
  },
  searchItem: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 16,
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#3498db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  searchItemText: {
    flex: 1,
  },
  searchItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
  },
  searchItemDetail: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 2,
  },
  searchItemId: {
    fontSize: 12,
    color: '#bdc3c7',
    marginTop: 2,
  },
  testResults: {
    marginTop: 16,
  },
  testItem: {
    padding: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    borderRadius: 8,
    marginBottom: 16,
  },
  testName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  progressContainer: {
    height: 20,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    marginVertical: 8,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#2ecc71',
  },
  progressText: {
    position: 'absolute',
    width: '100%',
    textAlign: 'center',
    color: '#333',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 20,
  },
  resultContainer: {
    marginVertical: 8,
  },
  resultText: {
    fontSize: 14,
    marginBottom: 4,
  },
  resultDetail: {
    fontSize: 12,
    color: '#7f8c8d',
    marginBottom: 2,
  },
  successText: {
    color: '#2ecc71',
  },
  errorText: {
    color: '#e74c3c',
  },
  imageContainer: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    borderRadius: 8,
    padding: 8,
    backgroundColor: '#f9f9f9',
  },
  testImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#f0f0f0',
  },
  saveButton: {
    backgroundColor: '#3498db',
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  detailText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
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

export default ImageHandlingTests;
