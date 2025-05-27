import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import imageLoader from '../utils/imageLoader';
import logger from '../utils/logger';

/**
 * A component that displays images from Odoo with proper caching and authentication
 *
 * @param {Object} props - Component props
 * @param {number} props.attachmentId - The ID of the attachment to display
 * @param {string} props.size - The size of the image ('128x128', '256x256', 'original')
 * @param {Object} props.style - Style object for the image
 * @param {string} props.contentFit - How the image should be resized to fit its container
 * @param {Function} props.onLoad - Callback when the image is loaded
 * @param {Function} props.onError - Callback when there's an error loading the image
 * @param {string} props.placeholder - Blurhash placeholder for the image
 */
const CachedImage = ({
  attachmentId,
  size = '128x128',
  style,
  contentFit = 'cover',
  onLoad,
  onError,
  placeholder,
  ...props
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [imagePath, setImagePath] = useState(null);

  // Default blurhash placeholder
  const defaultPlaceholder = '|rF?hV%2WCj[ayj[a|j[az_NaeWBj@ayfRayfQfQM{M|azj[azf6fQfQfQIpWXofj[ayj[j[fQayWCoeoeaya}j[ayfQa{oLj?j[WVj[ayayj[fQoff7azayj[ayj[j[ayofayayayj[fQj[ayayj[ayfjj[j[ayjuayj[';

  useEffect(() => {
    let isMounted = true;

    const loadImage = async () => {
      if (!attachmentId) {
        if (isMounted) {
          setError(true);
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);
        setError(false);

        // Add a safety check for SVG and other problematic file types
        // This is a fallback in case the processAttachment function didn't filter them out
        try {
          // Try to get attachment info from the parent component's props
          // This is a workaround since we don't have direct access to the attachment object
          const attachmentInfo = props.attachmentInfo;
          if (attachmentInfo && attachmentInfo.mimetype) {
            const skipThumbnailTypes = ['image/svg+xml', 'image/svg', 'image/webp', 'image/tiff'];
            if (skipThumbnailTypes.includes(attachmentInfo.mimetype)) {
              console.log(`Skipping image loading for non-standard image type: ${attachmentInfo.mimetype}`);
              setError(true);
              setLoading(false);
              if (onError) onError(new Error(`Unsupported image type: ${attachmentInfo.mimetype}`));
              return;
            }
          }
        } catch (infoError) {
          // Ignore errors in this safety check
          console.log('Could not check attachment info, proceeding with image load');
        }

        const result = await imageLoader.getImage(attachmentId, size);

        if (isMounted) {
          if (result.success) {
            console.log(`Loaded image for attachment ${attachmentId} from ${result.fromCache ? 'cache' : 'network'}`);

            // Set the image path immediately
            setImagePath(result.path);

            // For both cached and network-loaded images, we need to ensure the loading state is updated
            // Use a short timeout to ensure the UI has time to update
            setTimeout(() => {
              if (isMounted) {
                console.log(`Setting loading=false for attachment ${attachmentId} (fromCache: ${result.fromCache})`);
                setLoading(false);
                if (onLoad) onLoad();
              }
            }, result.fromCache ? 100 : 300);
          } else {
            console.error(`Failed to load image for attachment ${attachmentId}: ${result.error}`);
            setError(true);
            setLoading(false);
            if (onError) onError(result.error);
          }
        }
      } catch (err) {
        if (isMounted) {
          console.error(`Error loading image for attachment ${attachmentId}:`, err);
          logger.safeErrorLog(`Error loading image for attachment ${attachmentId}:`, err);
          setError(true);
          setLoading(false);
          if (onError) onError(err);
        }
      }
    };

    loadImage();

    return () => {
      isMounted = false;
    };
  }, [attachmentId, size]);

  // Handle successful image load
  const handleLoadSuccess = () => {
    console.log(`Image loaded successfully for attachment ${attachmentId}`);
    // Use a short timeout to ensure the UI updates properly
    setTimeout(() => {
      setLoading(false);
      if (onLoad) onLoad();
    }, 50);
  };

  // Handle image load error
  const handleLoadError = (err) => {
    console.error(`Error displaying image for attachment ${attachmentId}:`, err);
    logger.safeErrorLog(`Error displaying image for attachment ${attachmentId}:`, err);
    setError(true);
    setLoading(false);
    if (onError) onError(err);
  };

  // For debugging
  useEffect(() => {
    console.log(`CachedImage render state for ${attachmentId}: loading=${loading}, error=${error}, imagePath=${imagePath ? 'set' : 'not set'}`);
  }, [loading, error, imagePath, attachmentId]);

  // Force loading state to false after a timeout
  useEffect(() => {
    if (loading && imagePath) {
      console.log(`Setting up loading timeout for CachedImage ${attachmentId}`);
      const timer = setTimeout(() => {
        console.log(`Forcing loading=false for CachedImage ${attachmentId} after timeout`);
        setLoading(false);
        if (onLoad) onLoad();
      }, 3000); // 3 seconds timeout

      return () => clearTimeout(timer);
    }
  }, [loading, imagePath, attachmentId, onLoad]);

  return (
    <View style={[styles.container, style]}>
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#0073e6" />
        </View>
      )}

      {imagePath && !error && (
        <Image
          source={{ uri: `file://${imagePath}` }}
          style={[styles.image, style]}
          contentFit={contentFit}
          transition={100} // Reduce transition time for faster loading appearance
          placeholder={placeholder || defaultPlaceholder}
          onLoad={handleLoadSuccess}
          onLoadStart={() => console.log(`Image load started for ${attachmentId}`)}
          onProgress={(e) => console.log(`Image loading progress for ${attachmentId}: ${JSON.stringify(e)}`)}
          onError={handleLoadError}
          cachePolicy="memory-disk" // Use aggressive caching
          {...props}
        />
      )}

      {error && (
        <View style={[styles.errorContainer, style]}>
          <Image
            source={require('../assets/images/default_avatar.png')}
            style={styles.errorImage}
            contentFit="contain"
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  errorContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  errorImage: {
    width: '50%',
    height: '50%',
    opacity: 0.5,
  },
});

export default CachedImage;
