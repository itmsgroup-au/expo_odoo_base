/**
 * Clear all Helpdesk caches
 * @returns {Promise<Boolean>} - Success status
 */
export const clearHelpdeskCache = async () => {
  try {
    console.log('Clearing all helpdesk caches');

    // Get all keys from AsyncStorage
    const allKeys = await AsyncStorage.getAllKeys();
    
    // Filter keys related to helpdesk cache
    const helpdeskCacheKeys = allKeys.filter(key => 
      key.startsWith(TICKETS_CACHE_KEY) || 
      key.startsWith(TICKET_DETAIL_CACHE_PREFIX) || 
      key.startsWith(ATTACHMENTS_CACHE_PREFIX)
    );
    
    if (helpdeskCacheKeys.length > 0) {
      // Remove all helpdesk cache items
      await AsyncStorage.multiRemove(helpdeskCacheKeys);
      console.log(`Cleared ${helpdeskCacheKeys.length} helpdesk cache items`);
    } else {
      console.log('No helpdesk cache items found');
    }
    
    // Clear the file cache directory
    try {
      const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
      if (dirInfo.exists) {
        await FileSystem.deleteAsync(CACHE_DIR);
        await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
        console.log('Cleared helpdesk file cache directory');
      }
    } catch (error) {
      console.error('Error clearing file cache directory:', error);
    }
    
    return true;
  } catch (error) {
    console.error('Error clearing helpdesk cache:', error);
    return false;
  }
};

/**
 * Clear cache for a specific ticket
 * @param {Number} ticketId - Ticket ID
 * @returns {Promise<Boolean>} - Success status
 */
export const clearTicketCache = async (ticketId) => {
  try {
    console.log(`Clearing cache for ticket ${ticketId}`);
    
    // Remove ticket detail cache
    const ticketCacheKey = `${TICKET_DETAIL_CACHE_PREFIX}${ticketId}`;
    await AsyncStorage.removeItem(ticketCacheKey);
    
    // Remove attachments cache
    const attachmentsCacheKey = `${ATTACHMENTS_CACHE_PREFIX}${ticketId}`;
    await AsyncStorage.removeItem(attachmentsCacheKey);
    
    console.log(`Cleared cache for ticket ${ticketId}`);
    return true;
  } catch (error) {
    console.error(`Error clearing cache for ticket ${ticketId}:`, error);
    return false;
  }
};

/**
 * Clear expired cache entries
 * @returns {Promise<Boolean>} - Success status
 */
export const clearExpiredCache = async () => {
  try {
    console.log('Clearing expired helpdesk cache entries');
    
    // Get all keys from AsyncStorage
    const allKeys = await AsyncStorage.getAllKeys();
    
    // Filter keys related to helpdesk cache
    const helpdeskCacheKeys = allKeys.filter(key => 
      key.startsWith(TICKETS_CACHE_KEY) || 
      key.startsWith(TICKET_DETAIL_CACHE_PREFIX) || 
      key.startsWith(ATTACHMENTS_CACHE_PREFIX)
    );
    
    let expiredCount = 0;
    const currentTime = Date.now();
    
    // Check each cache entry for expiration
    for (const key of helpdeskCacheKeys) {
      try {
        const cachedData = await AsyncStorage.getItem(key);
        if (cachedData) {
          const { timestamp } = JSON.parse(cachedData);
          const isExpired = currentTime - timestamp > CACHE_EXPIRATION_MS;
          
          if (isExpired) {
            await AsyncStorage.removeItem(key);
            expiredCount++;
          }
        }
      } catch (error) {
        console.error(`Error checking cache entry ${key}:`, error);
      }
    }
    
    console.log(`Cleared ${expiredCount} expired cache entries`);
    return true;
  } catch (error) {
    console.error('Error clearing expired cache:', error);
    return false;
  }
};

/**
 * Check cache health and clear old entries if needed
 * @returns {Promise<Object>} - Cache status info
 */
export const checkCacheHealth = async () => {
  try {
    // Get all keys from AsyncStorage
    const allKeys = await AsyncStorage.getAllKeys();
    
    // Filter keys related to helpdesk cache
    const helpdeskCacheKeys = allKeys.filter(key => 
      key.startsWith(TICKETS_CACHE_KEY) || 
      key.startsWith(TICKET_DETAIL_CACHE_PREFIX) || 
      key.startsWith(ATTACHMENTS_CACHE_PREFIX)
    );
    
    const currentTime = Date.now();
    let totalSize = 0;
    let expiredCount = 0;
    let validCount = 0;
    
    // Check each cache entry
    for (const key of helpdeskCacheKeys) {
      try {
        const cachedData = await AsyncStorage.getItem(key);
        if (cachedData) {
          const dataSize = cachedData.length;
          totalSize += dataSize;
          
          const { timestamp } = JSON.parse(cachedData);
          const isExpired = currentTime - timestamp > CACHE_EXPIRATION_MS;
          
          if (isExpired) {
            expiredCount++;
          } else {
            validCount++;
          }
        }
      } catch (error) {
        console.error(`Error checking cache entry ${key}:`, error);
      }
    }
    
    // Clear expired cache if there are expired entries
    if (expiredCount > 0) {
      console.log(`Found ${expiredCount} expired cache entries, clearing...`);
      await clearExpiredCache();
    }
    
    // Check file cache size
    let fileCacheSize = 0;
    try {
      const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
      if (dirInfo.exists) {
        const dirContents = await FileSystem.readDirectoryAsync(CACHE_DIR);
        
        for (const fileName of dirContents) {
          const fileInfo = await FileSystem.getInfoAsync(`${CACHE_DIR}${fileName}`);
          if (fileInfo.exists && fileInfo.size) {
            fileCacheSize += fileInfo.size;
          }
        }
      }
    } catch (error) {
      console.error('Error checking file cache size:', error);
    }
    
    return {
      totalEntries: helpdeskCacheKeys.length,
      validEntries: validCount,
      expiredEntries: expiredCount,
      asyncStorageCacheSize: Math.round(totalSize / 1024), // Size in KB
      fileCacheSize: Math.round(fileCacheSize / 1024), // Size in KB
      cacheHealthy: expiredCount === 0
    };
  } catch (error) {
    console.error('Error checking cache health:', error);
    return {
      error: error.message,
      cacheHealthy: false
    };
  }
};

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { ODOO_CONFIG } from '../config/odoo';

// Cache constants
const CACHE_EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const TICKETS_CACHE_KEY = 'helpdesk_tickets_cache';
const TICKET_DETAIL_CACHE_PREFIX = 'helpdesk_ticket_';
const ATTACHMENTS_CACHE_PREFIX = 'helpdesk_attachments_';
const CACHE_DIR = `${FileSystem.cacheDirectory}odoo_tickets/`;

// Initialize cache directory
const initCacheDirectory = async () => {
  try {
    const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
      console.log(`Created cache directory: ${CACHE_DIR}`);
    }
    return true;
  } catch (error) {
    console.error('Error initializing cache directory:', error);
    return false;
  }
};

// Initialize cache on module load
initCacheDirectory();

// Helper function to make API requests with proper authentication
const makeApiRequest = async (method, endpoint, params = null, data = null) => {
  try {
    // Get the stored token data
    const tokenData = await AsyncStorage.getItem('odooTokenData');
    if (!tokenData) {
      console.error('No access token available. Please authenticate first.');
      return null;
    }

    const parsedToken = JSON.parse(tokenData);
    const accessToken = parsedToken.accessToken;
    const serverConfig = parsedToken.serverConfig || ODOO_CONFIG;

    const url = `${serverConfig.baseURL}${endpoint}`;
    console.log(`Making ${method.toUpperCase()} request to: ${url}`);
    if (params) console.log('Params:', JSON.stringify(params));
    if (data) console.log('Data:', JSON.stringify(data));

    const requestConfig = {
      method,
      url,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'DATABASE': serverConfig.db,
        'Content-Type': 'application/json'
      }
    };

    if (params) requestConfig.params = params;
    if (data) requestConfig.data = data;

    const response = await axios(requestConfig);
    console.log(`Request successful (${response.status})`);
    return response.data;
  } catch (error) {
    console.error(`API request error: ${error.message}`);
    if (error.response) {
      console.error(`Status code: ${error.response.status}`);
      console.error('Error response:', error.response.data);
    }
    return null;
  }
};

/**
 * Fetch helpdesk tickets with optional filters
 * @param {Object} options - Query options
 * @param {Array} options.domain - Domain filter
 * @param {Array} options.fields - Fields to fetch
 * @param {Number} options.limit - Maximum number of records
 * @param {Number} options.offset - Offset for pagination
 * @returns {Promise<Array>} - List of tickets
 */
export const getHelpdeskTickets = async (options = {}) => {
  const {
    domain = [],
    fields = [
      'id',
      'name',
      'description',
      'team_id',
      'user_id',
      'partner_id',
      'partner_name',
      'partner_email',
      'partner_phone',
      'priority',
      'stage_id',
      'color',
      'create_date',
      'write_date',
      'kanban_state',
      'activity_state',
      'ticket_ref',
      'sla_deadline',
      'sla_reached',
      'sla_fail',
    ],
    limit = 80,
    offset = 0,
  } = options;

  console.log('Fetching helpdesk tickets');

  const params = {
    fields: JSON.stringify(fields),
    limit,
    offset
  };

  // Add domain if provided
  if (domain && domain.length > 0) {
    params.domain = JSON.stringify(domain);
  }

  const data = await makeApiRequest('get', '/api/v2/search_read/helpdesk.ticket', params);

  if (data) {
    console.log(`Retrieved ${data.length} tickets`);
    return data;
  }

  return [];
};

/**
 * Fetch a single helpdesk ticket by ID
 * @param {Number} ticketId - Ticket ID
 * @param {Array} fields - Fields to fetch
 * @returns {Promise<Object>} - Ticket details
 */
export const getHelpdeskTicket = async (
  ticketId,
  fields = [
    'id',
    'name',
    'description',
    'team_id',
    'user_id',
    'partner_id',
    'partner_name',
    'partner_email',
    'partner_phone',
    'priority',
    'stage_id',
    'color',
    'create_date',
    'write_date',
    'kanban_state',
    'activity_state',
    'ticket_ref',
  ]
) => {
  console.log(`Fetching helpdesk ticket ${ticketId}`);

  const params = {
    ids: JSON.stringify([ticketId]),
    fields: JSON.stringify(fields)
  };

  const data = await makeApiRequest('get', '/api/v2/read/helpdesk.ticket', params);

  if (data && data.length > 0) {
    console.log(`Retrieved ticket: ${data[0].name}`);
    return data[0];
  }

  // If read endpoint fails, try search_read
  if (!data) {
    console.log('Read endpoint failed, trying search_read');
    const searchParams = {
      domain: JSON.stringify([['id', '=', ticketId]]),
      fields: JSON.stringify(fields),
      limit: 1
    };

    const searchData = await makeApiRequest('get', '/api/v2/search_read/helpdesk.ticket', searchParams);

    if (searchData && searchData.length > 0) {
      console.log(`Retrieved ticket via search: ${searchData[0].name}`);
      return searchData[0];
    }
  }

  // Return minimal object with ID if all else fails
  return {
    id: ticketId,
    name: `Ticket #${ticketId}`,
    description: 'Details not available',
    create_date: new Date().toISOString()
  };
};

/**
 * Create a new helpdesk ticket
 * @param {Object} ticketData - Ticket data
 * @returns {Promise<Number>} - ID of the created ticket
 */
export const createHelpdeskTicket = async (ticketData) => {
  console.log('Creating new helpdesk ticket:', ticketData.name);

  const data = await makeApiRequest('post', '/api/v2/create/helpdesk.ticket', null, {
    values: ticketData
  });

  if (data) {
    console.log(`Created ticket with ID: ${data}`);
    return data;
  }

  throw new Error('Failed to create ticket');
};

/**
 * Update an existing helpdesk ticket
 * @param {Number} ticketId - Ticket ID
 * @param {Object} ticketData - Updated ticket data
 * @returns {Promise<Boolean>} - Success status
 */
export const updateHelpdeskTicket = async (ticketId, ticketData) => {
  console.log(`Updating helpdesk ticket ${ticketId}`);

  const data = await makeApiRequest('put', '/api/v2/write/helpdesk.ticket', null, {
    ids: [ticketId],
    values: ticketData
  });

  if (data) {
    console.log(`Updated ticket successfully`);
    return true;
  }

  return false;
};

/**
 * Fetch helpdesk teams
 * @returns {Promise<Array>} - List of teams
 */
export const getHelpdeskTeams = async () => {
  console.log('Fetching helpdesk teams');

  const params = {
    fields: JSON.stringify(['id', 'name', 'description', 'use_sla', 'use_rating', 'use_helpdesk_timesheet'])
  };

  const data = await makeApiRequest('get', '/api/v2/search_read/helpdesk.team', params);

  if (data) {
    console.log(`Retrieved ${data.length} teams`);
    return data;
  }

  return [];
};

/**
 * Fetch helpdesk stages with team filter
 * @param {Number} teamId - Team ID to filter stages (optional)
 * @returns {Promise<Array>} - List of stages
 */
export const getHelpdeskStages = async (teamId = null) => {
  console.log('Fetching helpdesk stages' + (teamId ? ` for team ${teamId}` : ''));

  const params = {
    fields: JSON.stringify(['id', 'name', 'sequence', 'team_ids', 'fold']),
  };

  if (teamId) {
    params.domain = JSON.stringify([['team_ids', 'in', [teamId]]]);
  }

  const data = await makeApiRequest('get', '/api/v2/search_read/helpdesk.stage', params);

  if (data) {
    console.log(`Retrieved ${data.length} stages`);
    return data;
  }

  // Return basic stages as fallback
  return [
    { id: 1, name: 'New', sequence: 0 },
    { id: 2, name: 'In Progress', sequence: 1 },
    { id: 3, name: 'Done', sequence: 2 }
  ];
};

/**
 * Fetch helpdesk ticket types
 * @returns {Promise<Array>} - List of ticket types
 */
export const getHelpdeskTicketTypes = async () => {
  console.log('Fetching helpdesk ticket types');

  const params = {
    fields: JSON.stringify(['id', 'name'])
  };

  const data = await makeApiRequest('get', '/api/v2/search_read/helpdesk.ticket.type', params);

  if (data) {
    console.log(`Retrieved ${data.length} ticket types`);
    return data;
  }

  return [];
};

/**
 * Fetch helpdesk tags
 * @returns {Promise<Array>} - List of tags
 */
export const getHelpdeskTags = async () => {
  console.log('Fetching helpdesk tags');

  const params = {
    fields: JSON.stringify(['id', 'name', 'color'])
  };

  const data = await makeApiRequest('get', '/api/v2/search_read/helpdesk.tag', params);

  if (data) {
    console.log(`Retrieved ${data.length} tags`);
    return data;
  }

  return [];
};

/**
 * Fetch SLA policies
 * @param {Number} teamId - Team ID to filter policies (optional)
 * @returns {Promise<Array>} - List of SLA policies
 */
export const getHelpdeskSLAPolicies = async (teamId = null) => {
  console.log('Fetching helpdesk SLA policies' + (teamId ? ` for team ${teamId}` : ''));

  const params = {
    fields: JSON.stringify(['id', 'name', 'team_id', 'stage_id', 'time', 'priority'])
  };

  if (teamId) {
    params.domain = JSON.stringify([['team_id', '=', teamId]]);
  }

  const data = await makeApiRequest('get', '/api/v2/search_read/helpdesk.sla', params);

  if (data) {
    console.log(`Retrieved ${data.length} SLA policies`);
    return data;
  }

  return [];
};

/**
 * Fetch SLA status for a ticket
 * @param {Number} ticketId - Ticket ID
 * @returns {Promise<Array>} - List of SLA statuses
 */
export const getTicketSLAStatus = async (ticketId) => {
  console.log(`Fetching SLA status for ticket ${ticketId}`);

  const params = {
    domain: JSON.stringify([['ticket_id', '=', ticketId]]),
    fields: JSON.stringify(['id', 'sla_id', 'ticket_id', 'deadline', 'reached_datetime', 'status'])
  };

  const data = await makeApiRequest('get', '/api/v2/search_read/helpdesk.sla.status', params);

  if (data) {
    console.log(`Retrieved ${data.length} SLA statuses`);
    return data;
  }

  return [];
};

/**
 * Create timesheet entry for a ticket
 * @param {Number} ticketId - Ticket ID
 * @param {Number} hours - Hours spent
 * @param {String} description - Work description
 * @returns {Promise<Number>} - Timesheet entry ID
 */
export const createTicketTimesheet = async (ticketId, hours, description) => {
  console.log(`Creating timesheet entry for ticket ${ticketId}`);

  // First get ticket details to get project_id
  const ticket = await getHelpdeskTicket(ticketId, ['id', 'name', 'project_id', 'use_helpdesk_timesheet']);

  if (!ticket) {
    throw new Error(`Ticket ${ticketId} not found`);
  }

  if (!ticket.use_helpdesk_timesheet) {
    throw new Error('Timesheet functionality is not enabled for this ticket');
  }

  if (!ticket.project_id) {
    throw new Error('Ticket does not have a project assigned');
  }

  // Create timesheet entry
  const timesheetData = {
    name: description || `Work on ${ticket.name}`,
    unit_amount: hours,
    ticket_id: ticketId,
    project_id: Array.isArray(ticket.project_id) ? ticket.project_id[0] : ticket.project_id,
    date: new Date().toISOString().split('T')[0] // Today's date in YYYY-MM-DD format
  };

  const data = await makeApiRequest('post', '/api/v2/create/account.analytic.line', null, {
    values: timesheetData
  });

  if (data) {
    console.log(`Created timesheet entry with ID: ${data}`);
    return data;
  }

  throw new Error('Failed to create timesheet entry');
};

/**
 * Get timesheets for a ticket
 * @param {Number} ticketId - Ticket ID
 * @returns {Promise<Array>} - List of timesheet entries
 */
export const getTicketTimesheets = async (ticketId) => {
  console.log(`Fetching timesheets for ticket ${ticketId}`);

  const params = {
    domain: JSON.stringify([['ticket_id', '=', ticketId]]),
    fields: JSON.stringify(['id', 'name', 'date', 'unit_amount', 'employee_id', 'user_id'])
  };

  const data = await makeApiRequest('get', '/api/v2/search_read/account.analytic.line', params);

  if (data) {
    console.log(`Retrieved ${data.length} timesheet entries`);
    return data;
  }

  return [];
};

/**
 * Get attachments for a ticket
 * @param {Number} ticketId - Ticket ID
 * @returns {Promise<Array>} - List of attachments
 */
export const getTicketAttachments = async (ticketId) => {
  console.log(`Fetching attachments for ticket ${ticketId}`);

  const params = {
    domain: JSON.stringify([
      ['res_model', '=', 'helpdesk.ticket'],
      ['res_id', '=', ticketId]
    ]),
    fields: JSON.stringify(['id', 'name', 'mimetype', 'file_size', 'create_date', 'create_uid', 'type', 'url'])
  };

  const data = await makeApiRequest('get', '/api/v2/search_read/ir.attachment', params);

  if (data) {
    console.log(`Retrieved ${data.length} attachments`);

    // Process attachments using the imageUtils helper
    const { processAttachment } = require('../utils/imageUtils');
    const processedAttachments = data.map(att => processAttachment(att));

    // Debug the first attachment
    if (processedAttachments.length > 0) {
      console.log(`First attachment: ${processedAttachments[0].name} (${processedAttachments[0].mimetype})`);
      console.log(`Attachment URLs available: ${processedAttachments[0].fullUrl ? 'Yes' : 'No'}`);
    }

    return processedAttachments;
  }

  return [];
};

/**
 * Archive a helpdesk ticket
 * @param {Number} ticketId - Ticket ID
 * @returns {Promise<Boolean>} - Success status
 */
export const archiveHelpdeskTicket = async (ticketId) => {
  console.log(`Archiving helpdesk ticket ${ticketId}`);

  // In Odoo, archiving is done by setting the 'active' field to false
  const data = await makeApiRequest('put', '/api/v2/write/helpdesk.ticket', null, {
    ids: [ticketId],
    values: { active: false }
  });

  if (data) {
    console.log(`Archived ticket successfully`);
    return true;
  }

  return false;
};

/**
 * Delete a helpdesk ticket
 * @param {Number} ticketId - Ticket ID
 * @returns {Promise<Boolean>} - Success status
 */
export const deleteHelpdeskTicket = async (ticketId) => {
  console.log(`Deleting helpdesk ticket ${ticketId}`);

  const data = await makeApiRequest('delete', '/api/v2/unlink/helpdesk.ticket', null, {
    ids: [ticketId]
  });

  if (data) {
    console.log(`Deleted ticket successfully`);
    return true;
  }

  return false;
};

/**
 * Assign a helpdesk ticket to a user
 * @param {Number} ticketId - Ticket ID
 * @param {Number} userId - User ID
 * @returns {Promise<Boolean>} - Success status
 */
export const assignHelpdeskTicket = async (ticketId, userId) => {
  console.log(`Assigning helpdesk ticket ${ticketId} to user ${userId}`);

  const data = await makeApiRequest('put', '/api/v2/write/helpdesk.ticket', null, {
    ids: [ticketId],
    values: { user_id: userId }
  });

  if (data) {
    console.log(`Assigned ticket successfully`);
    return true;
  }

  return false;
};

/**
 * Get employees who can be assigned to helpdesk tickets
 * @returns {Promise<Array>} - List of employees
 */
export const getHelpdeskUsers = async () => {
  console.log('Fetching helpdesk employees');

  const params = {
    fields: JSON.stringify(['id', 'name', 'work_email', 'job_title', 'department_id'])
  };

  const data = await makeApiRequest('get', '/api/v2/search_read/hr.employee', params);

  if (data) {
    console.log(`Retrieved ${data.length} employees`);
    return data;
  }

  return [];
};

export default {
  getHelpdeskTickets,
  getHelpdeskTicket,
  createHelpdeskTicket,
  updateHelpdeskTicket,
  archiveHelpdeskTicket,
  deleteHelpdeskTicket,
  assignHelpdeskTicket,
  getHelpdeskUsers,
  getHelpdeskTeams,
  getHelpdeskStages,
  getHelpdeskTicketTypes,
  getHelpdeskTags,
  getHelpdeskSLAPolicies,
  getTicketSLAStatus,
  createTicketTimesheet,
  getTicketTimesheets,
  getTicketAttachments,
  clearHelpdeskCache,
  clearTicketCache,
  clearExpiredCache,
  checkCacheHealth
};