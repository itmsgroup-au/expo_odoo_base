import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import odooClient from '../api/odooClient';
import logger from '../utils/logger';

/**
 * A component that loads images with authentication using expo-image
 * This version uses expo-image for better performance and caching
 */
const ExpoImageWithAuth = ({
  url,
  style,
  contentFit = 'cover',
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

  // Create a placeholder for loading and error states
  const blurhash =
    '|rF?hV%2WCj[ayj[a|j[az_NaeWBj@ayfRayfQfQM{M|azj[azf6fQfQfQIpWXofj[ayj[j[fQayWCoeoeaya}j[ayfQa{oLj?j[WVj[ayayj[fQoff7azayj[ayj[j[ayofayayayj[fQj[ayayj[ayfjj[j[ayjuayj[';

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

        // First, try to create a thumbnail URL for better performance
        let modifiedUrl = url;

        // If this is an attachment URL, try to use the API v2 download format
        if (url.includes('/api/v2/download') && url.includes('model=ir.attachment')) {
          const thumbnailUrl = createThumbnailUrl(url);
          if (thumbnailUrl && thumbnailUrl !== url) {
            console.log(`Using thumbnail URL: ${thumbnailUrl}`);
            modifiedUrl = thumbnailUrl;
          }
        }

        // Add the access token to the URL if it doesn't already have one
        if (accessToken && !modifiedUrl.includes('access_token=')) {
          const separator = modifiedUrl.includes('?') ? '&' : '?';
          modifiedUrl = `${modifiedUrl}${separator}access_token=${encodeURIComponent(accessToken)}`;
        }

        console.log(`Attempting to load image from: ${modifiedUrl}`);
        setImageUrl(modifiedUrl);
        setLoading(false);
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

  // Try to create a thumbnail URL for Odoo attachments
  const createThumbnailUrl = (url, token) => {
    // Check if this is an attachment URL
    if (url && url.includes('/api/v2/download') && url.includes('model=ir.attachment')) {
      // Extract the attachment ID
      const idMatch = url.match(/[?&]id=(\d+)/);
      if (idMatch && idMatch[1]) {
        const attachmentId = idMatch[1];
        const baseUrl = odooClient.client.defaults.baseURL || '';

        // Use the API v2 download format that was working
        // Format: /api/v2/download?model=ir.attachment&id=<id>&field=raw&filename_field=name&type=file
        return `${baseUrl}/api/v2/download?model=ir.attachment&id=${attachmentId}&field=raw&filename_field=name&type=file`;
      }
    }
    return url;
  };

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

  // Use expo-image for better performance and caching
  return (
    <Image
      source={{ uri: imageUrl }}
      style={style}
      contentFit={contentFit}
      transition={200}
      placeholder={blurhash}
      onLoad={handleLoadSuccess}
      onError={handleLoadError}
      cachePolicy="memory-disk"
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

export default ExpoImageWithAuth;
