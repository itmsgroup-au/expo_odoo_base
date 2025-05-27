/**
 * Enhanced logging utility for better debugging
 * Provides copyable text output and better error formatting
 */

// Store original console methods
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
  debug: console.debug,
};

// Log history for retrieval
const logHistory = {
  logs: [],
  errors: [],
  warnings: [],
  info: [],
  debug: [],
  all: [],
  maxEntries: 100,
};

// Add timestamp to logs
const timestamp = () => {
  const now = new Date();
  return `[${now.toISOString()}]`;
};

// Format objects for better readability
const formatValue = (value) => {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch (e) {
      return String(value);
    }
  }

  return String(value);
};

// Safely convert any value to a string
const safeToString = (value) => {
  try {
    return String(value);
  } catch (e) {
    return '[Object]';
  }
};

// Add entry to history
const addToHistory = (type, args) => {
  const entry = {
    type,
    timestamp: new Date(),
    message: args.map(formatValue).join(' '),
  };

  logHistory[type].push(entry);
  logHistory.all.push(entry);

  // Trim history if it gets too long
  if (logHistory[type].length > logHistory.maxEntries) {
    logHistory[type].shift();
  }
  if (logHistory.all.length > logHistory.maxEntries * 5) {
    logHistory.all.shift();
  }
};

// Enhanced console methods
console.log = function(...args) {
  addToHistory('logs', args);
  try {
    originalConsole.log(timestamp(), ...args.map(arg => safeToString(arg)));
  } catch (e) {
    originalConsole.log(timestamp(), '[LOG]', 'Error logging message');
  }
};

// Create a safe error logging function that doesn't display on screen
const safeLogError = function(...args) {
  addToHistory('errors', args);

  // Format error objects for better readability
  const formattedArgs = args.map(arg => {
    if (arg instanceof Error) {
      return `Error: ${safeToString(arg.message)}\nStack: ${safeToString(arg.stack)}`;
    }
    return safeToString(arg);
  });

  try {
    // Use console.log instead of console.error to avoid screen display
    // and remove the emoji that might trigger screen display
    const prefix = `${timestamp()} [ERROR] `;
    originalConsole.log(prefix, ...formattedArgs);
  } catch (e) {
    // Fallback if there's an error with the console.log call
    originalConsole.log(`${timestamp()} [ERROR LOGGING FAILED]`);
  }
};

// Override console.error to use our safe version
console.error = safeLogError;

// Create a safe warning logging function that doesn't display on screen
const safeLogWarning = function(...args) {
  addToHistory('warnings', args);
  try {
    // Use console.log instead of console.warn to avoid screen display
    // and remove the emoji that might trigger screen display
    const prefix = `${timestamp()} [WARNING] `;
    originalConsole.log(prefix, ...args.map(arg => safeToString(arg)));
  } catch (e) {
    // Fallback if there's an error with the console.log call
    originalConsole.log(`${timestamp()} [WARNING LOGGING FAILED]`);
  }
};

// Override console.warn to use our safe version
console.warn = safeLogWarning;

console.info = function(...args) {
  addToHistory('info', args);
  try {
    const prefix = `${timestamp()} ℹ️ `;
    originalConsole.info(prefix, ...args.map(arg => safeToString(arg)));
  } catch (e) {
    const prefix = `${timestamp()} [INFO] `;
    originalConsole.log(prefix, 'Error logging info');
  }
};

console.debug = function(...args) {
  addToHistory('debug', args);
  try {
    const prefix = `${timestamp()} 🔍 `;
    originalConsole.debug(prefix, ...args.map(arg => safeToString(arg)));
  } catch (e) {
    const prefix = `${timestamp()} [DEBUG] `;
    originalConsole.log(prefix, 'Error logging debug message');
  }
};

// Add utility methods to console
console.getHistory = (type = 'all', count = 10) => {
  const history = logHistory[type] || logHistory.all;
  return history.slice(-count);
};

console.clearHistory = () => {
  Object.keys(logHistory).forEach(key => {
    if (Array.isArray(logHistory[key])) {
      logHistory[key] = [];
    }
  });
};

// Method to get logs as text
console.getLogsAsText = (type = 'all', count = 10) => {
  try {
    const history = console.getHistory(type, count);
    const text = history.map(entry =>
      `[${entry.timestamp.toISOString()}] ${entry.type}: ${entry.message}`
    ).join('\n');

    console.info('Logs text generated');
    return text;
  } catch (e) {
    console.error('Failed to generate logs text:', e);
    return null;
  }
};

// Method to display logs in a readable format
console.showLogs = (type = 'all', count = 10) => {
  const history = console.getHistory(type, count);
  const text = history.map(entry =>
    `[${entry.timestamp.toISOString()}] ${entry.type}: ${entry.message}`
  ).join('\n\n');

  console.log('\n======== LOG HISTORY ========\n');
  console.log(text);
  console.log('\n============================\n');

  return text;
};

// Utility function for safely logging errors without displaying on screen
// This can be imported and used directly in components
const safeErrorLog = (message, error) => {
  // Create a sanitized error object that won't cause rendering issues
  const errorMessage = error?.message || 'Unknown error';
  const errorCode = error?.response?.status || 'N/A';
  const errorStack = error?.stack || '';

  // Log to console in a way that won't trigger screen display
  originalConsole.log(`${timestamp()} [SAFE ERROR LOG] ${message} - Code: ${errorCode}, Message: ${errorMessage}`);

  // Only log stack in development
  if (__DEV__ && errorStack) {
    originalConsole.log(`Stack: ${errorStack}`);
  }

  // Add to history
  addToHistory('errors', [`${message} - ${errorMessage}`]);
};

export default {
  getHistory: console.getHistory,
  clearHistory: console.clearHistory,
  getLogsAsText: console.getLogsAsText,
  showLogs: console.showLogs,
  safeErrorLog, // Export the safe error logging function
};
