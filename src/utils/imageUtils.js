import odooClient from '../api/odooClient';

/**
 * Creates an authenticated URL for an attachment
 * @param {Object} attachment - The attachment object
 * @param {string} accessToken - Optional access token
 * @returns {Object} - An object with url and fullUrl properties
 */
export const createAttachmentUrl = (attachment, accessToken = null) => {
  if (!attachment || !attachment.id) {
    return { url: null, fullUrl: null };
  }

  const baseUrl = odooClient.client.defaults.baseURL || '';

  // Use the API v2 download format that was working
  // Format: /api/v2/download?model=ir.attachment&id=<id>&field=raw&filename_field=name&type=file
  const urlPath = `/api/v2/download?model=ir.attachment&id=${attachment.id}&field=raw&filename_field=name&type=file`;

  // Create the full URL
  let fullUrl = `${baseUrl}${urlPath}`;

  // Add the access token to the URL if it doesn't already have one
  if (accessToken && !urlPath.includes('access_token=')) {
    const separator = urlPath.includes('?') ? '&' : '?';
    fullUrl = `${baseUrl}${urlPath}${separator}access_token=${accessToken}`;
  }

  // Log the URL for debugging
  console.log(`Created attachment URL for ID ${attachment.id}:`);
  console.log(`  - URL path: ${urlPath}`);
  console.log(`  - Full URL: ${fullUrl}`);

  return {
    url: urlPath,
    fullUrl: fullUrl
  };
};

/**
 * Creates a fallback URL for an attachment
 * @param {Object} attachment - The attachment object
 * @param {string} accessToken - Optional access token
 * @returns {string} - The fallback URL
 */
export const createFallbackUrl = (attachment, accessToken = null) => {
  if (!attachment || !attachment.id) {
    return null;
  }

  const baseUrl = odooClient.client.defaults.baseURL || '';

  // Use the API v2 download format with ID only
  // Format: /api/v2/download/<id>
  const url = `${baseUrl}/api/v2/download/${attachment.id}`;

  // Add the access token to the URL if it doesn't already have one
  if (accessToken && !url.includes('access_token=')) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}access_token=${accessToken}`;
  }

  return url;
};

/**
 * Creates a second fallback URL for an attachment
 * @param {Object} attachment - The attachment object
 * @param {string} accessToken - Optional access token
 * @returns {string} - The second fallback URL
 */
export const createSecondFallbackUrl = (attachment, accessToken = null) => {
  if (!attachment || !attachment.id) {
    return null;
  }

  const baseUrl = odooClient.client.defaults.baseURL || '';
  const fileName = attachment.name || `File-${attachment.id}`;

  // Use the API v2 download format with ID and filename
  // Format: /api/v2/download/<id>/<filename>
  const url = `${baseUrl}/api/v2/download/${attachment.id}/${encodeURIComponent(fileName)}`;

  // Add the access token to the URL if it doesn't already have one
  if (accessToken && !url.includes('access_token=')) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}access_token=${accessToken}`;
  }

  return url;
};

/**
 * Creates a thumbnail URL using the API v2 image endpoint
 * @param {Object} attachment - The attachment object
 * @param {string} accessToken - Optional access token
 * @param {string} size - Optional size parameter (default: 128x128)
 * @returns {string} - The thumbnail URL
 */
export const createThumbnailUrl = (attachment, accessToken = null, size = '128x128') => {
  if (!attachment || !attachment.id) {
    return null;
  }

  const baseUrl = odooClient.client.defaults.baseURL || '';

  // Use the API v2 image endpoint with size parameter
  // Format: /api/v2/image/{attachmentId}/{size}
  // This format is proven to work in the test script
  const url = `${baseUrl}/api/v2/image/${attachment.id}/${size}`;

  // Add the access token to the URL if it doesn't already have one
  if (accessToken && !url.includes('access_token=')) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}access_token=${accessToken}`;
  }

  return url;
};

/**
 * Processes an attachment to add URL properties
 * @param {Object} attachment - The attachment object from Odoo
 * @returns {Object} - The processed attachment with URL properties
 */
export const processAttachment = (attachment) => {
  if (!attachment) {
    return null;
  }

  // Get the base URL from the Odoo client
  const baseUrl = odooClient.client.defaults.baseURL || '';

  // Log attachment details for debugging
  console.log(`Processing attachment ID ${attachment.id}: ${attachment.name || 'unnamed'}`);
  console.log(`  - Type: ${attachment.mimetype || 'unknown'}`);
  console.log(`  - Size: ${attachment.file_size || 0} bytes`);

  // Create the primary URL for displaying/downloading files
  // This is the most reliable format that works with the Odoo API
  const primaryUrl = `/api/v2/download?model=ir.attachment&id=${attachment.id}&field=raw&filename_field=name&type=file`;
  const fullPrimaryUrl = `${baseUrl}${primaryUrl}`;

  // Create backup URLs for downloading files
  const downloadUrl = `/api/v2/download/${attachment.id}`;
  const fallbackUrl = `/api/v2/download/${attachment.id}/${encodeURIComponent(attachment.name || `File-${attachment.id}`)}`;
  const fullDownloadUrl = `${baseUrl}${downloadUrl}`;
  const fullFallbackUrl = `${baseUrl}${fallbackUrl}`;

  // Create thumbnail URL using the API v2 image endpoint
  // Only create thumbnails for standard image types (not SVG or other special formats)
  let thumbnailUrl = null;
  if (attachment.mimetype && attachment.mimetype.startsWith('image/')) {
    // Skip SVG and other non-standard image types that might cause issues
    const skipThumbnailTypes = ['image/svg+xml', 'image/svg', 'image/webp', 'image/tiff'];
    if (!skipThumbnailTypes.includes(attachment.mimetype)) {
      thumbnailUrl = `${baseUrl}/api/v2/image/${attachment.id}/128x128`;
      console.log(`  - Created thumbnail URL: ${thumbnailUrl}`);
    } else {
      console.log(`  - Skipping thumbnail for non-standard image type: ${attachment.mimetype}`);
    }
  }

  // Create a display name that includes file size if available
  let displayName = attachment.name || `File-${attachment.id}`;
  if (attachment.file_size) {
    const fileSizeKB = Math.round(attachment.file_size / 1024);
    const fileSizeMB = (attachment.file_size / (1024 * 1024)).toFixed(1);

    if (fileSizeKB < 1000) {
      displayName += ` (${fileSizeKB} KB)`;
    } else {
      displayName += ` (${fileSizeMB} MB)`;
    }
  }

  return {
    id: attachment.id,
    name: attachment.name || `File-${attachment.id}`,
    displayName: displayName,
    mimetype: attachment.mimetype || 'application/octet-stream',
    fileSize: attachment.file_size || 0,
    createDate: attachment.create_date,
    createUser: attachment.create_uid ? attachment.create_uid[1] : 'Unknown',
    // Use the primary URL as the main URL
    url: primaryUrl,
    fullUrl: fullPrimaryUrl,
    // Keep the backup URLs for compatibility
    downloadUrl: downloadUrl,
    fullDownloadUrl: fullDownloadUrl,
    fallbackUrl: fallbackUrl,
    fullFallbackUrl: fullFallbackUrl,
    thumbnailUrl: thumbnailUrl,
    resModel: attachment.res_model,
    resId: attachment.res_id,
    type: attachment.type,
    rawData: attachment
  };
};
