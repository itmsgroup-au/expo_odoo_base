/**
 * Format a file size in bytes to a human-readable format
 * @param {number} bytes - Size in bytes
 * @param {number} decimals - Number of decimal places to show
 * @returns {string} Formatted file size
 */
export const formatFileSize = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

/**
 * Get a file's extension from its name
 * @param {string} filename - The file name
 * @returns {string} File extension (lowercase, without the dot)
 */
export const getFileExtension = (filename) => {
  if (!filename) return '';
  return filename.split('.').pop().toLowerCase();
};

/**
 * Check if a file is an image based on its extension
 * @param {string} filename - The file name
 * @returns {boolean} Whether the file is an image
 */
export const isImageFile = (filename) => {
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];
  const extension = getFileExtension(filename);
  return imageExtensions.includes(extension);
};

/**
 * Get a file type icon name based on file extension
 * @param {string} filename - The file name
 * @returns {string} Icon name to use (for Ionicons)
 */
export const getFileIcon = (filename) => {
  const extension = getFileExtension(filename);
  
  // Common file types
  switch (extension) {
    // Documents
    case 'pdf':
      return 'document-text-outline';
    case 'doc':
    case 'docx':
      return 'document-outline';
    case 'xls':
    case 'xlsx':
    case 'csv':
      return 'grid-outline';
    case 'ppt':
    case 'pptx':
      return 'easel-outline';
      
    // Images
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'bmp':
    case 'webp':
    case 'svg':
      return 'image-outline';
      
    // Archives
    case 'zip':
    case 'rar':
    case 'tar':
    case 'gz':
    case '7z':
      return 'archive-outline';
      
    // Code
    case 'js':
    case 'ts':
    case 'jsx':
    case 'tsx':
    case 'html':
    case 'css':
    case 'json':
    case 'xml':
      return 'code-outline';
      
    // Default
    default:
      return 'document-outline';
  }
};