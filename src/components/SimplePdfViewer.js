import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import logger from '../utils/logger';

/**
 * A simple PDF viewer component that uses WebView to display PDFs
 * This is a fallback for when react-native-pdf is not available
 */
const SimplePdfViewer = ({
  url,
  style,
  showLoadingIndicator = true,
  onLoad,
  onError,
  ...props
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Handle load success
  const handleLoadSuccess = () => {
    setLoading(false);
    if (onLoad) {
      onLoad();
    }
  };

  // Handle load error
  const handleLoadError = (err) => {
    console.error('Error loading PDF:', err);
    logger.safeErrorLog('Error loading PDF:', err);
    setError(true);
    setLoading(false);
    if (onError) {
      onError(err);
    }
  };

  // Create a Google Drive embed URL if it's a PDF
  const getWebViewSource = () => {
    if (!url) return null;

    // If it's a local file URL, use it directly
    if (url.startsWith('file://')) {
      return { uri: url };
    }

    // For remote PDFs, use Google Drive PDF viewer as a fallback
    // This works for publicly accessible PDFs
    if (url.toLowerCase().endsWith('.pdf')) {
      return {
        uri: `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`
      };
    }

    // For other file types, just use the URL directly
    return { uri: url };
  };

  if (loading && showLoadingIndicator) {
    return (
      <View style={[styles.container, style]}>
        <ActivityIndicator size="large" color="#0073e6" />
        <Text style={styles.loadingText}>Loading document...</Text>
      </View>
    );
  }

  if (error || !url) {
    return (
      <View style={[styles.container, style]}>
        <Icon name="file-alert-outline" size={64} color="#999" />
        <Text style={styles.errorText}>
          Failed to load document. The file may be unavailable or in an unsupported format.
        </Text>
      </View>
    );
  }

  return (
    <WebView
      source={getWebViewSource()}
      style={[styles.webView, style]}
      onLoad={handleLoadSuccess}
      onError={handleLoadError}
      originWhitelist={['*']}
      javaScriptEnabled={true}
      domStorageEnabled={true}
      startInLoadingState={true}
      renderLoading={() => (
        <View style={styles.webViewLoading}>
          <ActivityIndicator size="large" color="#0073e6" />
        </View>
      )}
      {...props}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    padding: 20,
  },
  webView: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  webViewLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});

export default SimplePdfViewer;
