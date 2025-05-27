import React, { useState, useEffect } from 'react';
import { Image, View, ActivityIndicator, Text, StyleSheet, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import odooClient from '../api/odooClient';
import logger from '../utils/logger';
import RNFetchBlob from 'react-native-blob-util';

/**
 * A component that loads images with authentication headers
 * This is necessary for loading images from Odoo that require authentication
 */
const AuthenticatedImage = ({
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

  useEffect(() => {
    // Function to fetch the image with authentication
    const fetchImage = async () => {
      try {
        setLoading(true);
        setError(false);

        if (!url) {
          throw new Error('No URL provided');
        }

        console.log(`AuthenticatedImage: Fetching image from ${url}`);

        // Get authentication headers from odooClient
        const headers = {
          Authorization: odooClient.client.defaults.headers.Authorization,
          DATABASE: odooClient.client.defaults.headers.DATABASE,
        };

        // For React Native, we'll download the image to a temporary file
        // and then display it from there
        const timestamp = new Date().getTime();
        const filename = `temp_image_${timestamp}.jpg`;

        // Download the image to a temporary file
        const res = await RNFetchBlob.config({
          fileCache: true,
          appendExt: url.toLowerCase().endsWith('.png') ? 'png' : 'jpg',
        }).fetch('GET', url, headers);

        console.log(`Image downloaded to: ${res.path()}`);

        // Set the local file path as the image URL
        const localPath = Platform.OS === 'ios' ? res.path() : `file://${res.path()}`;
        setImageUrl(localPath);
        setLoading(false);

        if (onLoad) {
          onLoad();
        }
      } catch (err) {
        console.error('Error loading authenticated image:', err);
        logger.safeErrorLog('Error loading authenticated image:', err);
        setError(true);
        setLoading(false);

        if (onError) {
          onError(err);
        }
      }
    };

    fetchImage();

    // Clean up temporary files when the component unmounts
    return () => {
      // RNFetchBlob will handle cleanup of temporary files
    };
  }, [url]);

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

  return (
    <Image
      source={{ uri: imageUrl }}
      style={style}
      resizeMode={resizeMode}
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

export default AuthenticatedImage;
