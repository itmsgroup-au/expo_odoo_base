import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  SafeAreaView,
  Linking,
  Alert,
  ActivityIndicator,
  ActionSheetIOS,
  Platform,
  Share,
  Animated
} from 'react-native';
import { Image } from 'expo-image';
import * as FileSystem from 'expo-file-system';
import CachedImage from '../../../components/CachedImage';
import SimplePdfViewer from '../../../components/SimplePdfViewer';
import { useRoute, useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import logger from '../../../utils/logger';
import odooClient from '../../../api/odooClient';

const { width, height } = Dimensions.get('window');

const ExpoImageViewerScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { imageUrl, title, mimetype } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [authImageUrl, setAuthImageUrl] = useState(null);
  const [urlsToTry, setUrlsToTry] = useState([]);
  const [currentUrlIndex, setCurrentUrlIndex] = useState(0);
  const [attachmentId, setAttachmentId] = useState(null);
  const [showHelper, setShowHelper] = useState(false);
  const helperOpacity = useState(new Animated.Value(0))[0];

  // Create a placeholder for loading and error states
  const blurhash =
    '|rF?hV%2WCj[ayj[a|j[az_NaeWBj@ayfRayfQfQM{M|azj[azf6fQfQfQIpWXofj[ayj[j[fQayWCoeoeaya}j[ayfQa{oLj?j[WVj[ayayj[fQoff7azayj[ayj[j[ayofayayayj[fQj[ayayj[ayfjj[j[ayjuayj[';

  // Create a URL using API v2 image endpoint format for Odoo attachments
  const createApiV2ImageUrl = (url, accessToken) => {
    // Check if this is an attachment URL
    if (url && url.includes('/api/v2/download') && url.includes('model=ir.attachment')) {
      // Extract the attachment ID
      const idMatch = url.match(/[?&]id=(\d+)/);
      if (idMatch && idMatch[1]) {
        const attachmentId = idMatch[1];
        const baseUrl = odooClient.client.defaults.baseURL || '';

        // Use the API v2 image endpoint format that works in the test script
        // Format: /api/v2/image/{attachmentId}/original
        return `${baseUrl}/api/v2/image/${attachmentId}/original`;
      }
    }
    return null;
  };

  // Create a fallback URL
  const createFallbackUrl = (url, accessToken) => {
    if (url && url.includes('/api/v2/download')) {
      // Try the web/content format as a fallback
      const baseUrl = odooClient.client.defaults.baseURL || '';

      // Extract the attachment ID
      const idMatch = url.match(/[?&]id=(\d+)/);
      if (idMatch && idMatch[1]) {
        const attachmentId = idMatch[1];
        // Use the web/content format with download parameter
        // Format: /web/content/<id>?download=true
        // Don't add the access token here, it will be added later
        return `${baseUrl}/web/content/${attachmentId}?download=true`;
      }

      // If we couldn't extract the ID, try the original URL with the API v2 format
      return url;
    }
    return null;
  };

  // Force loading state to false after a timeout
  React.useEffect(() => {
    if (loading && attachmentId) {
      console.log(`Setting up loading timeout for attachment ${attachmentId}`);
      const timer = setTimeout(() => {
        console.log(`Forcing loading=false for attachment ${attachmentId} after timeout`);
        setLoading(false);
      }, 3000); // 3 seconds timeout

      return () => clearTimeout(timer);
    }
  }, [loading, attachmentId]);

  // Ensure loading state is properly updated when component mounts
  React.useEffect(() => {
    // Check if the file is already in the cache
    const checkCache = async () => {
      if (attachmentId && mimetype) {
        try {
          // For PDFs, check with PDF extension
          let filePath = getCachedFilePath();

          // Make sure the directory exists
          const cacheDir = `${FileSystem.cacheDirectory}odoo_images/`;
          const dirInfo = await FileSystem.getInfoAsync(cacheDir);
          if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
            console.log(`Created cache directory: ${cacheDir}`);
          }

          const fileInfo = await FileSystem.getInfoAsync(filePath);

          console.log(`Cache check on mount for ${attachmentId}: exists=${fileInfo.exists}, size=${fileInfo.size || 'unknown'}, path=${filePath}`);

          if (fileInfo.exists && fileInfo.size > 0) {
            // If the file is already cached, we can set loading to false immediately
            console.log(`File already cached for ${attachmentId}, setting loading=false`);
            setTimeout(() => {
              setLoading(false);
            }, 500);
          }
        } catch (error) {
          console.error(`Error checking cache on mount: ${error.message}`);
        }
      }
    };

    checkCache();
  }, [attachmentId, mimetype]);

  // Prepare the authenticated URL
  React.useEffect(() => {
    const prepareAuthUrl = async () => {
      if (!imageUrl) {
        setError(true);
        setLoading(false);
        return;
      }

      // Extract the attachment ID from the URL
      const idMatch = imageUrl.match(/[?&]id=(\d+)/);
      if (idMatch && idMatch[1]) {
        const id = parseInt(idMatch[1]);
        console.log(`Extracted attachment ID: ${id}`);
        setAttachmentId(id);

        // If we have an attachment ID, we can start loading the image
        // This helps ensure the loading state is properly shown
        setLoading(true);
      } else {
        console.log('Could not extract attachment ID from URL');
        setError(true);
        setLoading(false);
      }

      try {
        // Get the token data from AsyncStorage
        const tokenData = await AsyncStorage.getItem('odooTokenData');
        if (!tokenData) {
          console.log('No token data found, using original URL');
          setAuthImageUrl(imageUrl);
          return;
        }

        const parsedToken = JSON.parse(tokenData);
        const accessToken = parsedToken.accessToken;
        const database = parsedToken.serverConfig?.db || odooClient.client.defaults.headers.DATABASE;

        // Try different URL formats for better compatibility
        let urlsToTry = [];

        // If this is an attachment URL, try the API v2 image endpoint format first
        // This format works better on physical iOS devices based on the test script
        const apiV2ImageUrl = createApiV2ImageUrl(imageUrl, accessToken);
        if (apiV2ImageUrl) {
          urlsToTry.push(apiV2ImageUrl);
        }

        // Also try the web/content format
        const webContentUrl = `${odooClient.client.defaults.baseURL}/web/content?model=ir.attachment&id=${imageUrl.match(/[?&]id=(\d+)/)?.[1]}&field=datas`;
        if (webContentUrl) {
          urlsToTry.push(webContentUrl);
        }

        // Add a fallback URL with access token
        const fallbackUrl = createFallbackUrl(imageUrl, accessToken);
        if (fallbackUrl) {
          urlsToTry.push(fallbackUrl);
        }

        // Add the original URL as a last resort
        if (accessToken) {
          const separator = imageUrl.includes('?') ? '&' : '?';
          const originalWithToken = `${imageUrl}${separator}access_token=${encodeURIComponent(accessToken)}`;
          urlsToTry.push(originalWithToken);
        } else {
          urlsToTry.push(imageUrl);
        }

        // Use the first URL (web/image with token) as our primary choice
        let modifiedUrl = urlsToTry[0];

        console.log(`Prepared authenticated image URL: ${modifiedUrl}`);

        // Store all URLs for fallback with authentication token
        const authenticatedUrls = urlsToTry.map(url => {
          // Check if the URL already has an access token
          if (accessToken && !url.includes('access_token=')) {
            const separator = url.includes('?') ? '&' : '?';
            return `${url}${separator}access_token=${encodeURIComponent(accessToken)}`;
          }
          return url;
        });

        setUrlsToTry(authenticatedUrls);
        setCurrentUrlIndex(0);
        setAuthImageUrl(authenticatedUrls[0]);
      } catch (err) {
        console.error('Error preparing authenticated URL:', err);
        logger.safeErrorLog('Error preparing authenticated URL:', err);
        setAuthImageUrl(imageUrl);
        setError(true);
      }
    };

    prepareAuthUrl();
  }, [imageUrl]);

  // Get the cached file path for the current file
  const getCachedFilePath = () => {
    if (!attachmentId) return null;

    const cacheKey = `${attachmentId}_original`;

    // Determine file extension based on mimetype
    let fileExtension = '.jpg'; // Default to jpg for images

    if (mimetype) {
      if (mimetype.includes('pdf')) {
        fileExtension = '.pdf';
      } else if (mimetype.includes('png')) {
        fileExtension = '.png';
      } else if (mimetype.includes('gif')) {
        fileExtension = '.gif';
      } else if (mimetype.includes('webp')) {
        fileExtension = '.webp';
      }
      // Add more file types as needed
    }

    return `${FileSystem.cacheDirectory}odoo_images/${cacheKey}${fileExtension}`;
  };

  // Share the file with other apps using React Native's Share API
  const shareFile = async () => {
    try {
      const filePath = getCachedFilePath();
      if (!filePath) {
        Alert.alert('Error', 'Could not find the cached file.');
        return;
      }

      // Check if file exists
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (!fileInfo.exists) {
        Alert.alert('Error', 'The file does not exist in the cache.');
        return;
      }

      // On iOS, we can share the file URL directly
      if (Platform.OS === 'ios') {
        const fileUrl = `file://${filePath}`;

        // Determine share title based on file type
        let shareTitle = title || 'Shared File';
        if (mimetype) {
          if (mimetype.includes('image')) {
            shareTitle = title || 'Shared Image';
          } else if (mimetype.includes('pdf')) {
            shareTitle = title || 'Shared PDF';
          }
        }

        // Use React Native's Share API
        await Share.share({
          url: fileUrl,
          title: shareTitle
        });
      } else {
        // On Android, we need to use a content URI
        // For simplicity, we'll just show an alert for now
        Alert.alert(
          'Share',
          'Sharing on Android requires additional setup. This feature is coming soon.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error sharing file:', error);
      logger.safeErrorLog('Error sharing file:', error);
      Alert.alert('Error', 'Failed to share the file.');
    }
  };

  // Show action sheet with options
  const showActionSheet = () => {
    // Determine title and message based on file type
    let title = 'File Options';
    let message = 'Choose an action for this file';

    if (mimetype) {
      if (mimetype.includes('image')) {
        title = 'Image Options';
        message = 'Choose an action for this image';
      } else if (mimetype.includes('pdf')) {
        title = 'PDF Options';
        message = 'Choose an action for this PDF';
      }
    }

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Share'],
          cancelButtonIndex: 0,
          title: title,
          message: message
        },
        (buttonIndex) => {
          switch (buttonIndex) {
            case 1: // Share
              shareFile();
              break;
          }
        }
      );
    } else {
      // For Android, we'll use a simple Alert for now
      Alert.alert(
        title,
        message,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Share', onPress: shareFile }
        ]
      );
    }
  };

  // Open file in external viewer
  const openInExternalViewer = async () => {
    try {
      // If we have no URL at all, show an error
      if (!authImageUrl && urlsToTry.length === 0) {
        throw new Error('No file URL provided');
      }

      // Try the current URL first
      if (authImageUrl) {
        console.log(`Attempting to open URL: ${authImageUrl}`);

        try {
          const canOpen = await Linking.canOpenURL(authImageUrl);
          if (canOpen) {
            await Linking.openURL(authImageUrl);
            return;
          }
        } catch (e) {
          console.log(`Failed to open ${authImageUrl}: ${e.message}`);
        }
      }

      // If that fails, try all other URLs
      for (let i = 0; i < urlsToTry.length; i++) {
        if (i === currentUrlIndex) continue; // Skip the current URL as we already tried it

        const url = urlsToTry[i];
        console.log(`Trying to open alternative URL (${i}): ${url}`);

        try {
          const canOpen = await Linking.canOpenURL(url);
          if (canOpen) {
            await Linking.openURL(url);
            return;
          }
        } catch (e) {
          console.log(`Failed to open ${url}: ${e.message}`);
        }
      }

      // If we get here, none of the URLs worked
      Alert.alert(
        'Cannot Open File',
        'Unable to open this file type on your device.',
        [{ text: 'OK' }]
      );
    } catch (err) {
      logger.safeErrorLog('Error opening file in external viewer:', err);
      Alert.alert(
        'Error',
        'Failed to open the file in an external viewer. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  // Show helper text with animation
  useEffect(() => {
    if (!loading && !error && attachmentId) {
      // Show helper text after image is loaded
      setShowHelper(true);

      // Fade in animation
      Animated.timing(helperOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true
      }).start();

      // Hide helper text after 5 seconds
      const timer = setTimeout(() => {
        Animated.timing(helperOpacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true
        }).start(() => {
          setShowHelper(false);
        });
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [loading, error, attachmentId]);

  // Handle image load success
  const handleLoadSuccess = () => {
    console.log(`Image loaded successfully in viewer for attachment ${attachmentId}`);
    // Use a short timeout to ensure the UI updates properly
    setTimeout(() => {
      setLoading(false);
    }, 100);
  };

  // Handle image load error
  const handleLoadError = (err) => {
    console.error('Error loading image:', err);
    logger.safeErrorLog('Error loading image:', err);

    // Log detailed information about the current URL
    console.log(`Failed to load image from URL (${currentUrlIndex}): ${authImageUrl}`);
    console.log(`Image mimetype: ${mimetype}`);
    console.log(`Available URLs to try: ${urlsToTry.length}`);

    // Try the next URL if available
    if (urlsToTry.length > 0 && currentUrlIndex < urlsToTry.length - 1) {
      const nextIndex = currentUrlIndex + 1;
      const nextUrl = urlsToTry[nextIndex];
      console.log(`Trying next URL (${nextIndex}): ${nextUrl}`);
      setCurrentUrlIndex(nextIndex);
      setAuthImageUrl(nextUrl);
      return;
    }

    // If we've tried all URLs, show error
    console.log('All URLs failed, showing error');
    setError(true);
    setLoading(false);
  };

  // Determine if we can display this content type
  const canDisplayInApp = mimetype && (
    mimetype.startsWith('image/jpeg') ||
    mimetype.startsWith('image/png') ||
    mimetype.startsWith('image/gif') ||
    mimetype.startsWith('image/webp') ||
    mimetype.includes('pdf')
  );

  // Determine if this is a PDF
  const isPdf = mimetype && mimetype.includes('pdf');

  // Get the appropriate icon name based on file type
  const getFileIconName = () => {
    if (!mimetype) return "file-document-outline";

    if (mimetype.startsWith('image/')) return "image";
    if (mimetype.includes('pdf')) return "file-pdf-box";
    if (mimetype.includes('word') || mimetype.includes('document')) return "file-word";
    if (mimetype.includes('excel') || mimetype.includes('sheet')) return "file-excel";
    if (mimetype.includes('powerpoint') || mimetype.includes('presentation')) return "file-powerpoint";
    if (mimetype.includes('zip') || mimetype.includes('compressed')) return "zip-box";
    if (mimetype.includes('text/')) return "file-document-outline";

    return "file-document-outline";
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title || 'File Viewer'}
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              // Try a different URL format if we have errors
              if (error && urlsToTry.length > 0) {
                setError(false);
                setLoading(true);
                const nextIndex = (currentUrlIndex + 1) % urlsToTry.length;
                setCurrentUrlIndex(nextIndex);
                setAuthImageUrl(urlsToTry[nextIndex]);
              }
            }}
          >
            <Icon name="refresh" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={showActionSheet}
            disabled={loading || error}
          >
            <Icon name="share-variant" size={24} color={loading || error ? "#666" : "#fff"} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={openInExternalViewer}
          >
            <Icon name="open-in-new" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content Container */}
      <View style={styles.contentContainer}>
        {canDisplayInApp && attachmentId ? (
          isPdf ? (
            // PDF Viewer
            <View style={styles.pdfContainer}>
              {loading && (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="large" color="#fff" />
                  <Text style={styles.loadingText}>Loading PDF...</Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.shareButton}
                onPress={showActionSheet}
                disabled={loading || error}
              >
                <Icon name="share-variant" size={24} color="#fff" />
              </TouchableOpacity>
              <SimplePdfViewer
                url={`file://${getCachedFilePath()}`}
                style={styles.pdfViewer}
                showLoadingIndicator={false}
                onLoad={() => {
                  console.log(`PDF loaded successfully for attachment ${attachmentId}`);
                  setLoading(false);
                }}
                onError={(err) => {
                  console.log(`Error loading PDF for attachment ${attachmentId}: ${err}`);
                  handleLoadError(err);
                }}
              />
            </View>
          ) : (
            // Image Viewer
            <TouchableOpacity
              style={styles.imageContainer}
              activeOpacity={0.9}
              onLongPress={() => {
                if (!loading && !error) {
                  showActionSheet();
                }
              }}
            >
              {showHelper && !loading && !error && (
                <Animated.View
                  style={[
                    styles.helperTextContainer,
                    { opacity: helperOpacity }
                  ]}
                >
                  <Text style={styles.helperText}>Long press to share</Text>
                </Animated.View>
              )}
              {loading && (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="large" color="#fff" />
                  <Text style={styles.loadingText}>Loading image...</Text>
                </View>
              )}
              <CachedImage
                attachmentId={attachmentId}
                size="original"
                style={styles.image}
                contentFit="contain"
                transition={300}
                placeholder={blurhash}
                onLoad={() => {
                  console.log(`CachedImage onLoad callback fired for ${attachmentId}`);
                  handleLoadSuccess();

                  // Force loading to false after a short delay
                  setTimeout(() => {
                    setLoading(false);
                  }, 200);
                }}
                onError={(err) => {
                  console.log(`CachedImage onError callback fired for ${attachmentId}: ${err}`);
                  handleLoadError(err);
                }}
              />
            </TouchableOpacity>
          )
        ) : (
          <View style={styles.messageContainer}>
            <Icon
              name={getFileIconName()}
              size={64}
              color="#fff"
            />
            <Text style={styles.messageTitle}>
              {title || 'File'}
            </Text>
            <Text style={styles.messageText}>
              {error
                ? "There was an error loading this file. Please try one of the options below."
                : "This file cannot be previewed directly in the app."}
            </Text>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.openButton, { backgroundColor: '#2196F3' }]}
                onPress={openInExternalViewer}
              >
                <Text style={styles.openButtonText}>Open in External App</Text>
              </TouchableOpacity>

              {error && urlsToTry.length > 0 && (
                <TouchableOpacity
                  style={[styles.openButton, { backgroundColor: '#4CAF50', marginTop: 12 }]}
                  onPress={() => {
                    setError(false);
                    setLoading(true);
                    const nextIndex = (currentUrlIndex + 1) % urlsToTry.length;
                    setCurrentUrlIndex(nextIndex);
                    setAuthImageUrl(urlsToTry[nextIndex]);
                  }}
                >
                  <Text style={styles.openButtonText}>Try Different Format</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#111',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginHorizontal: 16,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  imageContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 10,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
  },
  helperTextContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingVertical: 8,
  },
  helperText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  messageContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    width: '80%',
  },
  messageTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  messageText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 16,
  },
  openButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    minWidth: 200,
    alignItems: 'center',
  },
  openButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  pdfContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    position: 'relative',
    backgroundColor: '#fff',
  },
  pdfViewer: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#fff',
  },
  shareButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 24,
    padding: 8,
    zIndex: 10,
  },
});

export default ExpoImageViewerScreen;
