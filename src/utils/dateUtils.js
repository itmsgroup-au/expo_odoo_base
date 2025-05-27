/**
 * Format a date string or Date object to a specified format
 * @param {string|Date} dateInput - The date to format
 * @param {string} format - Format string (simplified)
 * @returns {string} Formatted date string
 */
export const formatDate = (dateInput, format = 'yyyy-MM-dd') => {
  try {
    // Convert string to Date object if needed
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      return 'Invalid date';
    }
    
    // Basic formatting - in a real app, use a library like date-fns
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    // Replace format tokens
    let result = format;
    result = result.replace('yyyy', year);
    result = result.replace('MM', month);
    result = result.replace('dd', day);
    result = result.replace('HH', hours);
    result = result.replace('mm', minutes);
    result = result.replace('ss', seconds);
    
    return result;
  } catch (error) {
    console.error('Date formatting error:', error);
    return 'Error';
  }
};

/**
 * Get a relative time string (e.g., "5 minutes ago")
 * @param {string|Date} dateInput - The date to compare
 * @returns {string} Relative time string
 */
export const getRelativeTime = (dateInput) => {
  try {
    // Convert string to Date object if needed
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      return 'Invalid date';
    }
    
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    
    if (diffSec < 60) {
      return 'Just now';
    } else if (diffMin < 60) {
      return `${diffMin} ${diffMin === 1 ? 'minute' : 'minutes'} ago`;
    } else if (diffHour < 24) {
      return `${diffHour} ${diffHour === 1 ? 'hour' : 'hours'} ago`;
    } else if (diffDay < 30) {
      return `${diffDay} ${diffDay === 1 ? 'day' : 'days'} ago`;
    } else {
      return formatDate(date, 'yyyy-MM-dd');
    }
  } catch (error) {
    console.error('Relative time error:', error);
    return 'Error';
  }
};