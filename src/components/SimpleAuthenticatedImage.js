import React, { useState, useEffect } from 'react';
import { Image, View, ActivityIndicator, StyleSheet, Text, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import odooClient from '../api/odooClient';
import logger from '../utils/logger';

/**
 * A simplified component that loads images with authentication headers
 * This version doesn't use any native modules and works in Expo Go
 */
const SimpleAuthenticatedImage = ({
  url,
  style,
  resizeMode = 'cover',
  fallbackIcon = 'file-image',
  showLoadingIndicator = true,
  onLoad,
  onError,
  ...props
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    // Function to handle image loading
    const loadImage = async () => {
      if (!url) {
        setError(true);
        setLoading(false);
        return;
      }

      try {
        // Get the token data from AsyncStorage
        const tokenData = await AsyncStorage.getItem('odooTokenData');
        if (!tokenData) {
          console.log('No token data found, using original URL');
          setImageUrl(url);
          setLoading(false);
          return;
        }

        const parsedToken = JSON.parse(tokenData);
        const accessToken = parsedToken.accessToken;
        const database = parsedToken.serverConfig?.db || odooClient.client.defaults.headers.DATABASE;

        // For Expo Go, we need to use a different approach
        // We'll try to append the auth token to the URL as a query parameter
        // This is a workaround and not secure for production, but works for development

        // First, try to create a thumbnail URL for better performance
        let modifiedUrl = url;

        // If this is an attachment URL, try to use the web/image endpoint instead
        if (url.includes('/api/v2/download') && url.includes('model=ir.attachment')) {
          const thumbnailUrl = createThumbnailUrl(url);
          if (thumbnailUrl && thumbnailUrl !== url) {
            console.log(`Using thumbnail URL: ${thumbnailUrl}`);
            modifiedUrl = thumbnailUrl;
          }
        }

        // Only add token if it's not already in the URL
        if (accessToken && !modifiedUrl.includes('access_token=')) {
          const separator = modifiedUrl.includes('?') ? '&' : '?';
          modifiedUrl = `${modifiedUrl}${separator}access_token=${encodeURIComponent(accessToken)}`;

          // Add database if available
          if (database) {
            modifiedUrl += `&database=${encodeURIComponent(database)}`;
          }
        }

        console.log(`Attempting to load image from: ${modifiedUrl}`);
        setImageUrl(modifiedUrl);

        // We'll set loading to false after a short timeout
        // This gives the image a chance to start loading
        setTimeout(() => {
          setLoading(false);
        }, 500);
      } catch (err) {
        console.error('Error preparing image URL:', err);
        logger.safeErrorLog('Error preparing image URL:', err);

        // If we have an error, try using the original URL as a fallback
        setImageUrl(url);
        setLoading(false);

        if (onError) {
          onError(err);
        }
      }
    };

    loadImage();
  }, [url, retryCount]);

  // Handle image load success
  const handleLoadSuccess = () => {
    setLoading(false);
    if (onLoad) {
      onLoad();
    }
  };

  // Handle image load error
  const handleLoadError = (err) => {
    console.error('Error loading image:', err);
    logger.safeErrorLog('Error loading image:', err);

    // If we have an error and haven't retried too many times, try a different approach
    if (retryCount < 2) {
      console.log(`Retrying with different approach (attempt ${retryCount + 1})`);
      setRetryCount(retryCount + 1);
      return;
    }

    setError(true);
    setLoading(false);
    if (onError) {
      onError(err);
    }
  };

  // Try to create a direct thumbnail URL for Odoo attachments
  const createThumbnailUrl = (url) => {
    // Check if this is an attachment URL
    if (url && url.includes('/api/v2/download') && url.includes('model=ir.attachment')) {
      // Extract the attachment ID
      const idMatch = url.match(/[?&]id=(\d+)/);
      if (idMatch && idMatch[1]) {
        const attachmentId = idMatch[1];
        // Create a thumbnail URL
        const baseUrl = odooClient.client.defaults.baseURL || '';
        return `${baseUrl}/web/image?model=ir.attachment&id=${attachmentId}&field=datas&small=true`;
      }
    }
    return url;
  };

  if (loading && showLoadingIndicator) {
    return (
      <View style={[styles.container, style]}>
        <ActivityIndicator size="small" color="#0073e6" />
      </View>
    );
  }

  if (error || !imageUrl) {
    return (
      <View style={[styles.container, style]}>
        <Icon name={fallbackIcon} size={24} color="#999" />
      </View>
    );
  }

  // For Expo Go, we'll use the Image component with the modified URL
  return (
    <Image
      source={{ uri: imageUrl }}
      style={style}
      resizeMode={resizeMode}
      onLoad={handleLoadSuccess}
      onError={handleLoadError}
      {...props}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
});

export default SimpleAuthenticatedImage;
