import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import odooClient from '../api/odooClient';
import logger from './logger';

// Cache configuration
const CACHE_FOLDER = `${FileSystem.cacheDirectory}odoo_images/`;
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const THUMBNAIL_SIZES = ['128x128', '256x256', 'original'];

// Ensure cache directory exists
const ensureCacheDirectory = async () => {
  try {
    const dirInfo = await FileSystem.getInfoAsync(CACHE_FOLDER);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(CACHE_FOLDER, { intermediates: true });
      console.log('Created image cache directory');
    }
  } catch (error) {
    console.error('Error creating cache directory:', error);
    logger.safeErrorLog('Error creating cache directory:', error);
  }
};

// Initialize cache on module load
ensureCacheDirectory();

// Get authentication token and database
const getAuthHeaders = async () => {
  try {
    const tokenData = await AsyncStorage.getItem('odooTokenData');
    if (!tokenData) {
      console.log('No token data found');
      return null;
    }

    const parsedToken = JSON.parse(tokenData);
    return {
      'Authorization': `Bearer ${parsedToken.accessToken}`,
      'DATABASE': parsedToken.serverConfig?.db || odooClient.client.defaults.headers.DATABASE
    };
  } catch (error) {
    console.error('Error getting auth headers:', error);
    logger.safeErrorLog('Error getting auth headers:', error);
    return null;
  }
};

// Generate a cache key for an image
const generateCacheKey = (attachmentId, size = 'original') => {
  return `${attachmentId}_${size}`;
};

// Get the local file path for a cached image
const getCacheFilePath = (cacheKey) => {
  return `${CACHE_FOLDER}${cacheKey}.jpg`;
};

// Check if an image is cached and not expired
const isImageCached = async (cacheKey) => {
  try {
    const cacheFilePath = getCacheFilePath(cacheKey);
    const fileInfo = await FileSystem.getInfoAsync(cacheFilePath);

    if (!fileInfo.exists) {
      console.log(`Cache file does not exist: ${cacheFilePath}`);
      return false;
    }

    // Check if the file has content
    if (fileInfo.size !== undefined && fileInfo.size === 0) {
      console.log(`Cache file exists but is empty: ${cacheFilePath}`);
      return false;
    }

    // Verify the file is readable
    try {
      // Try to read the first few bytes of the file to verify it's readable
      const fileContent = await FileSystem.readAsStringAsync(cacheFilePath, {
        encoding: FileSystem.EncodingType.Base64,
        length: 10 // Just read a tiny bit to verify it's readable
      });

      if (!fileContent || fileContent.length === 0) {
        console.log(`Cache file exists but is not readable: ${cacheFilePath}`);
        return false;
      }
    } catch (readError) {
      console.error(`Error reading cache file: ${readError.message}`);
      return false;
    }

    // Check if the cache is expired
    const cacheMetadata = await AsyncStorage.getItem(`image_cache_${cacheKey}`);
    if (cacheMetadata) {
      const { timestamp } = JSON.parse(cacheMetadata);
      const now = new Date().getTime();
      if (now - timestamp > CACHE_EXPIRY) {
        console.log(`Cache expired for ${cacheKey}`);
        return false;
      }
    }

    console.log(`Valid cache found for ${cacheKey}`);
    return true;
  } catch (error) {
    console.error(`Error checking cache for ${cacheKey}:`, error);
    logger.safeErrorLog(`Error checking cache for ${cacheKey}:`, error);
    return false;
  }
};

// Download and cache an image
const downloadAndCacheImage = async (attachmentId, size = 'original') => {
  try {
    const cacheKey = generateCacheKey(attachmentId, size);
    const cacheFilePath = getCacheFilePath(cacheKey);

    // Check if already cached
    if (await isImageCached(cacheKey)) {
      console.log(`Using cached image for ${cacheKey}`);
      return { success: true, path: cacheFilePath, fromCache: true };
    }

    // Get auth headers
    const headers = await getAuthHeaders();
    if (!headers) {
      console.error('No authentication headers available');
      return { success: false, error: 'Authentication failed' };
    }

    console.log(`Auth headers obtained: ${JSON.stringify(headers)}`);

    // Create the download URL
    const baseUrl = odooClient.client.defaults.baseURL || '';
    const downloadUrl = `${baseUrl}/api/v2/image/${attachmentId}/${size}`;

    console.log(`Downloading image from: ${downloadUrl}`);

    // Download the file with authentication headers
    const downloadOptions = {
      headers: headers
    };

    console.log(`Starting download with options: ${JSON.stringify(downloadOptions)}`);

    try {
      const downloadResult = await FileSystem.downloadAsync(
        downloadUrl,
        cacheFilePath,
        downloadOptions
      );

      console.log(`Download result: status=${downloadResult.status}, uri=${downloadResult.uri}, headers=${JSON.stringify(downloadResult.headers || {})}`);

      if (downloadResult.status === 200) {
        // Verify the file was downloaded correctly
        const fileInfo = await FileSystem.getInfoAsync(cacheFilePath);
        console.log(`Downloaded file info: exists=${fileInfo.exists}, size=${fileInfo.size || 'unknown'}`);

        if (!fileInfo.exists || (fileInfo.size !== undefined && fileInfo.size === 0)) {
          console.error(`Downloaded file is invalid or empty: ${cacheFilePath}`);
          return { success: false, error: 'Downloaded file is invalid or empty' };
        }

        // Save cache metadata
        const cacheMetadata = {
          timestamp: new Date().getTime(),
          url: downloadUrl,
          size: size
        };

        await AsyncStorage.setItem(`image_cache_${cacheKey}`, JSON.stringify(cacheMetadata));

        console.log(`Successfully downloaded and cached image: ${cacheKey}`);

        // Double-check the file exists and is readable
        try {
          const fileContent = await FileSystem.readAsStringAsync(cacheFilePath, { encoding: FileSystem.EncodingType.Base64, length: 100 });
          console.log(`File verification: Read first ${fileContent.length} bytes of Base64 data`);

          if (!fileContent || fileContent.length === 0) {
            console.error(`Downloaded file appears empty: ${cacheFilePath}`);
            return { success: false, error: 'Downloaded file appears empty' };
          }
        } catch (readError) {
          console.error(`Error verifying downloaded file: ${readError.message}`);
          // Continue anyway, as the file might still be usable
        }

        return { success: true, path: cacheFilePath, fromCache: false };
      } else {
        console.error(`Failed to download image: ${downloadResult.status}`);
        return { success: false, error: `HTTP Error: ${downloadResult.status}` };
      }
    } catch (downloadError) {
      console.error(`Error during download: ${downloadError.message}`);

      // Try an alternative approach with direct API v2 download endpoint
      const alternativeUrl = `${baseUrl}/api/v2/download/${attachmentId}`;
      console.log(`Trying alternative download URL: ${alternativeUrl}`);

      try {
        const alternativeResult = await FileSystem.downloadAsync(
          alternativeUrl,
          cacheFilePath,
          downloadOptions
        );

        console.log(`Alternative download result: status=${alternativeResult.status}`);

        if (alternativeResult.status === 200) {
          // Verify the file was downloaded correctly
          const fileInfo = await FileSystem.getInfoAsync(cacheFilePath);

          if (!fileInfo.exists || (fileInfo.size !== undefined && fileInfo.size === 0)) {
            console.error(`Alternative downloaded file is invalid or empty: ${cacheFilePath}`);
            return { success: false, error: 'Downloaded file is invalid or empty' };
          }

          // Save cache metadata
          const cacheMetadata = {
            timestamp: new Date().getTime(),
            url: alternativeUrl,
            size: size
          };

          await AsyncStorage.setItem(`image_cache_${cacheKey}`, JSON.stringify(cacheMetadata));

          console.log(`Successfully downloaded and cached image using alternative URL: ${cacheKey}`);
          return { success: true, path: cacheFilePath, fromCache: false };
        } else {
          throw new Error(`Alternative download failed with status: ${alternativeResult.status}`);
        }
      } catch (alternativeError) {
        console.error(`Alternative download also failed: ${alternativeError.message}`);
        throw downloadError; // Throw the original error
      }
    }
  } catch (error) {
    console.error(`Error downloading image for attachment ${attachmentId}:`, error);
    logger.safeErrorLog(`Error downloading image for attachment ${attachmentId}:`, error);
    return { success: false, error: error.message };
  }
};

// Get an image from cache or download it
export const getImage = async (attachmentId, size = 'original') => {
  try {
    // Validate size
    const validSize = THUMBNAIL_SIZES.includes(size) ? size : 'original';

    console.log(`Getting image for attachment ${attachmentId} with size ${validSize}`);

    // Try to get attachment info to check if it's a supported image type
    try {
      // This is a safety check to prevent trying to load thumbnails for unsupported image types
      const tokenData = await AsyncStorage.getItem('odooTokenData');
      if (tokenData) {
        const parsedToken = JSON.parse(tokenData);
        const baseUrl = odooClient.client.defaults.baseURL || '';
        const headers = {
          'Authorization': `Bearer ${parsedToken.accessToken}`,
          'DATABASE': parsedToken.serverConfig?.db || odooClient.client.defaults.headers.DATABASE
        };

        // Make a lightweight call to get the attachment's mimetype
        const response = await odooClient.client.post('/api/v2/call', {
          model: 'ir.attachment',
          method: 'read',
          args: [[attachmentId]],
          kwargs: {
            fields: ['mimetype']
          }
        }, { headers });

        if (response.data && response.data.length > 0 && response.data[0].mimetype) {
          const mimetype = response.data[0].mimetype;
          const skipThumbnailTypes = ['image/svg+xml', 'image/svg', 'image/webp', 'image/tiff'];

          if (skipThumbnailTypes.includes(mimetype)) {
            console.log(`Skipping thumbnail generation for unsupported image type: ${mimetype}`);
            return {
              success: false,
              error: `Unsupported image type: ${mimetype}`,
              mimetype: mimetype
            };
          }
        }
      }
    } catch (infoError) {
      // Ignore errors in this safety check, proceed with normal flow
      console.log('Could not check attachment mimetype, proceeding with image load');
    }

    // Try to get from cache first
    const cacheKey = generateCacheKey(attachmentId, validSize);
    const cacheFilePath = getCacheFilePath(cacheKey);

    const isCached = await isImageCached(cacheKey);
    console.log(`Image ${attachmentId} (${validSize}) cached: ${isCached}`);

    if (isCached) {
      console.log(`Using cached image at: ${cacheFilePath}`);

      // Verify the file exists and has content
      try {
        const fileInfo = await FileSystem.getInfoAsync(cacheFilePath);
        console.log(`Cached file info: exists=${fileInfo.exists}, size=${fileInfo.size || 'unknown'}`);

        if (!fileInfo.exists || (fileInfo.size !== undefined && fileInfo.size === 0)) {
          console.log(`Cache file is invalid, downloading again`);
          return await downloadAndCacheImage(attachmentId, validSize);
        }
      } catch (fileError) {
        console.error(`Error checking cached file: ${fileError.message}`);
        return await downloadAndCacheImage(attachmentId, validSize);
      }

      return { success: true, path: cacheFilePath, fromCache: true };
    }

    // If not cached, download it
    console.log(`Image not in cache, downloading attachment ${attachmentId}`);
    return await downloadAndCacheImage(attachmentId, validSize);
  } catch (error) {
    console.error(`Error getting image for attachment ${attachmentId}:`, error);
    logger.safeErrorLog(`Error getting image for attachment ${attachmentId}:`, error);
    return { success: false, error: error.message };
  }
};

// Clear the image cache
export const clearImageCache = async () => {
  try {
    await FileSystem.deleteAsync(CACHE_FOLDER, { idempotent: true });
    await ensureCacheDirectory();

    // Clear cache metadata from AsyncStorage
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(key => key.startsWith('image_cache_'));
    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys);
    }

    console.log('Image cache cleared successfully');
    return { success: true };
  } catch (error) {
    console.error('Error clearing image cache:', error);
    logger.safeErrorLog('Error clearing image cache:', error);
    return { success: false, error: error.message };
  }
};

export default {
  getImage,
  clearImageCache
};
