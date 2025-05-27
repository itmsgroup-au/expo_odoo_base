// API for mail.message model

import { createModelAPI } from './modelApiTemplate';
import { odooAPI } from '../odooClient';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const mailMessageAPI = createModelAPI('mail.message');

// Cache configuration
const CACHE_CONFIG = {
  MESSAGES_CACHE_KEY: 'mail_messages_cache',
  MESSAGES_TIMESTAMP_KEY: 'mail_messages_timestamp',
  CACHE_EXPIRY: 1000 * 60 * 60, // 1 hour
};

// Cache management functions
const cacheManager = {
  // Save messages to cache
  saveMessagesToCache: async (messages, modelName, recordId) => {
    try {
      const cacheKey = `${CACHE_CONFIG.MESSAGES_CACHE_KEY}_${modelName}_${recordId}`;
      await AsyncStorage.setItem(cacheKey, JSON.stringify(messages));
      await AsyncStorage.setItem(CACHE_CONFIG.MESSAGES_TIMESTAMP_KEY, Date.now().toString());
      console.log(`Saved ${messages.length} messages to cache for ${modelName} ${recordId}`);
      return true;
    } catch (error) {
      console.error('Error saving messages to cache:', error);
      return false;
    }
  },

  // Get messages from cache
  getMessagesFromCache: async (modelName, recordId) => {
    try {
      const cacheKey = `${CACHE_CONFIG.MESSAGES_CACHE_KEY}_${modelName}_${recordId}`;
      const cachedData = await AsyncStorage.getItem(cacheKey);
      if (!cachedData) {
        console.log('No cached messages found');
        return null;
      }

      const timestamp = await AsyncStorage.getItem(CACHE_CONFIG.MESSAGES_TIMESTAMP_KEY);
      const now = Date.now();

      // Check if cache is expired
      if (timestamp && now - parseInt(timestamp) > CACHE_CONFIG.CACHE_EXPIRY) {
        console.log(`Messages cache expired (${Math.round((now - parseInt(timestamp)) / (1000 * 60))} minutes old)`);
        return null;
      }

      const messages = JSON.parse(cachedData);
      console.log(`Retrieved ${messages.length} messages from cache for ${modelName} ${recordId}`);
      return messages;
    } catch (error) {
      console.error('Error getting messages from cache:', error);
      return null;
    }
  },

  // Clear cache
  clearCache: async () => {
    try {
      // Get all keys
      const keys = await AsyncStorage.getAllKeys();

      // Filter message cache keys
      const messageCacheKeys = keys.filter(key =>
        key.startsWith(CACHE_CONFIG.MESSAGES_CACHE_KEY) ||
        key === CACHE_CONFIG.MESSAGES_TIMESTAMP_KEY
      );

      // Remove all message cache keys
      if (messageCacheKeys.length > 0) {
        await AsyncStorage.multiRemove(messageCacheKeys);
      }

      console.log('Message cache cleared');
      return true;
    } catch (error) {
      console.error('Error clearing message cache:', error);
      return false;
    }
  }
};

/**
 * Get messages for a specific record
 * @param {string} model - Model name (e.g., 'res.partner')
 * @param {number} id - Record ID
 * @param {boolean} forceRefresh - Force refresh from server
 * @returns {Promise<Array>} List of messages
 */
mailMessageAPI.getMessagesForRecord = async (model, id, forceRefresh = false) => {
  try {
    console.log(`Getting messages for ${model} with ID ${id}`);

    // Check cache first if not forcing refresh
    if (!forceRefresh) {
      const cachedMessages = await cacheManager.getMessagesFromCache(model, id);
      if (cachedMessages && cachedMessages.length > 0) {
        return cachedMessages;
      }
    }

    // Direct approach: Use search_read to get messages for this specific record
    console.log(`Using search_read to find messages for ${model} ${id}`);

    try {
      const messages = await odooAPI.searchRead(
        'mail.message',
        [
          ['model', '=', model],
          ['res_id', '=', id]
        ],
        [
          'id', 'body', 'date', 'message_type', 'subtype_id',
          'author_id', 'email_from', 'attachment_ids', 'tracking_value_ids',
          'model', 'res_id'
        ],
        100,  // Limit
        0,    // Offset
        true  // Force refresh
      );

      console.log(`Found ${messages ? messages.length : 0} messages via search_read for ${model} ${id}`);

      if (messages && messages.length > 0) {
        // Double-check that all messages are for this record
        const filteredMessages = messages.filter(msg =>
          msg.model === model &&
          msg.res_id === parseInt(id)
        );

        console.log(`After filtering: ${filteredMessages.length} messages for ${model} ${id}`);

        // Sort messages by date (newest first)
        filteredMessages.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Cache the messages
        await cacheManager.saveMessagesToCache(filteredMessages, model, id);

        return filteredMessages;
      }

      return [];
    } catch (searchError) {
      console.error(`Error using search_read for messages:`, searchError);

      // Fallback: Try to get message_ids from the record and then fetch each message
      try {
        console.log(`Fallback: Getting message_ids from ${model} ${id}`);
        const record = await odooAPI.read(model, id, ['message_ids'], true);

        if (record && record.message_ids && record.message_ids.length > 0) {
          console.log(`Found ${record.message_ids.length} message IDs for ${model} ${id}`);

          // Fetch messages in batches to avoid overwhelming the API
          const batchSize = 5;
          const allMessages = [];

          for (let i = 0; i < record.message_ids.length; i += batchSize) {
            const batch = record.message_ids.slice(i, i + batchSize);

            // Use the read endpoint to get message details
            const batchMessages = await Promise.all(
              batch.map(messageId =>
                odooAPI.read(
                  'mail.message',
                  messageId,
                  ['id', 'body', 'date', 'message_type', 'subtype_id', 'author_id', 'email_from', 'attachment_ids', 'model', 'res_id'],
                  true
                )
              )
            );

            // Filter out any null results and ensure they belong to this record
            const filteredMessages = batchMessages.filter(msg =>
              msg !== null &&
              msg.model === model &&
              msg.res_id === parseInt(id)
            );

            console.log(`Batch: ${batch.length} messages, filtered: ${filteredMessages.length} messages`);
            allMessages.push(...filteredMessages);

            // Add a small delay between batches
            if (i + batchSize < record.message_ids.length) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }

          if (allMessages.length > 0) {
            // Sort messages by date (newest first)
            allMessages.sort((a, b) => new Date(b.date) - new Date(a.date));

            // Cache the messages
            await cacheManager.saveMessagesToCache(allMessages, model, id);

            return allMessages;
          }
        }
      } catch (readError) {
        console.error(`Error in fallback message fetching:`, readError);
      }
    }

    return [];
  } catch (error) {
    console.error(`Error getting messages for ${model} ${id}:`, error);
    return [];
  }
};

/**
 * Post a new message to a record
 * @param {string} model - Model name (e.g., 'res.partner')
 * @param {number} id - Record ID
 * @param {string} body - Message body (can contain HTML)
 * @param {string} messageType - Message type (comment, notification, etc.)
 * @param {Array} attachmentIds - Optional array of attachment IDs to attach to the message
 * @returns {Promise<number|null>} New message ID or null on error
 */
mailMessageAPI.postMessage = async (model, id, body, messageType = 'comment', attachmentIds = []) => {
  try {
    console.log(`Posting message to ${model} with ID ${id}, type: ${messageType}, attachments: ${attachmentIds.length}`);

    // Using MukREST API to post a message
    const odooClient = require('../odooClient').default.client;

    // Format the message body properly - this is critical to avoid 500 errors
    // Ensure the body is properly formatted HTML
    let formattedBody = '';
    try {
      if (body && typeof body === 'string' && body.trim()) {
        // If it doesn't look like HTML, wrap it in paragraph tags
        if (!body.trim().startsWith('<') && !body.includes('</')) {
          // Escape any potentially problematic characters
          const safeBody = body
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
            .replace(/\n/g, '<br/>');
          formattedBody = `<p>${safeBody}</p>`;
        } else {
          formattedBody = body;
        }
      } else {
        // If body is empty but we have attachments, provide a minimal body
        if (attachmentIds && attachmentIds.length > 0) {
          formattedBody = '<p></p>';
        } else {
          formattedBody = '<p></p>'; // Always provide at least an empty paragraph
        }
      }
    } catch (formatError) {
      console.error('Error formatting message body:', formatError);
      formattedBody = '<p>Error formatting message</p>';
    }

    // Check if we have a lot of attachments - this can cause issues
    if (attachmentIds && attachmentIds.length > 5) {
      console.warn(`Large number of attachments (${attachmentIds.length}) may cause issues`);
    }

    // Try the direct create method first - more reliable than message_post
    try {
      console.log('Creating message directly with mail.message create');

      // Prepare message data
      const messageData = {
        model: model,
        res_id: parseInt(id),
        body: formattedBody,
        message_type: messageType,
        // Use correct subtype_id based on message type
        subtype_id: messageType === 'comment' ? 1 : 2  // 1 for comments, 2 for notes
      };

      // Add attachment_ids if there are any
      if (attachmentIds && attachmentIds.length > 0) {
        // Always use the proper Odoo command format for many2many fields
        // Command 6 means "replace all existing with this list"
        messageData.attachment_ids = [[6, 0, attachmentIds]];

        // Log the attachment IDs for debugging
        console.log(`Adding ${attachmentIds.length} attachments to message: ${JSON.stringify(attachmentIds)}`);
      }

      // Create the message
      const createResult = await odooAPI.create('mail.message', messageData);

      if (createResult) {
        console.log(`Successfully created message directly, ID: ${createResult}`);

        // Verify that the message was created with the correct attachments
        try {
          console.log(`Verifying message ${createResult} has the correct attachments`);

          // Get the message details to check if attachments were properly linked
          const messageDetails = await odooAPI.read('mail.message', createResult, ['attachment_ids']);

          if (messageDetails && messageDetails.attachment_ids) {
            console.log(`Message has ${messageDetails.attachment_ids.length} attachments linked`);

            // If attachments are missing, try to update the message
            if (attachmentIds.length > 0 && (!messageDetails.attachment_ids || messageDetails.attachment_ids.length < attachmentIds.length)) {
              console.log(`Some attachments are missing. Updating message ${createResult} with all attachments`);

              // Update the message with all attachments
              const updateResult = await odooAPI.write('mail.message', createResult, {
                attachment_ids: [[6, 0, attachmentIds]]
              });

              if (updateResult) {
                console.log(`Successfully updated message with all attachments`);
              } else {
                console.warn(`Failed to update message with all attachments, but message was created`);
              }
            }
          }
        } catch (verifyError) {
          console.error(`Error verifying message attachments:`, verifyError);
          // Continue anyway since the message was created
        }

        await cacheManager.clearCache();
        return createResult;
      }
    } catch (createError) {
      console.error(`Error creating message directly:`, createError);
      console.error('Create error details:', createError.response?.data || 'No response data');
    }

    // Fallback: Use the /api/v2/call endpoint with message_post
    console.log('Trying fallback: message_post via call endpoint');
    try {
      const kwargs = {
        body: formattedBody,
        message_type: messageType,
        subtype_xmlid: messageType === 'comment' ? 'mail.mt_comment' : 'mail.mt_note'
      };

      // Add attachment_ids if there are any
      if (attachmentIds && attachmentIds.length > 0) {
        // For message_post method, we need to pass the attachment IDs directly
        // without the Odoo command format
        kwargs.attachment_ids = attachmentIds;
        console.log(`Adding ${attachmentIds.length} attachments to message_post: ${JSON.stringify(attachmentIds)}`);
      }

      const response = await odooClient.post('/api/v2/call', {
        model: model,
        method: 'message_post',
        args: [[parseInt(id)]],  // ID must be in an array and must be an integer
        kwargs: kwargs
      });

      if (response.data && response.data.result) {
        console.log(`Successfully posted message to ${model} ${id}, result:`, response.data.result);
        // Clear cache to ensure fresh data on next fetch
        await cacheManager.clearCache();
        return response.data.result;
      }
    } catch (callError) {
      console.error(`Error calling message_post on ${model} ${id}:`, callError);
      console.error('Call error details:', callError.response?.data || 'No response data');
    }

    return null;
  } catch (error) {
    console.error(`Error posting message to ${model} ${id}:`, error);
    return null;
  }
};

/**
 * Upload a file to Odoo and create an attachment
 * @param {Object} fileData - File data object with uri, type, and name
 * @param {string} model - Model name (e.g., 'res.partner')
 * @param {number} id - Record ID
 * @returns {Promise<number|null>} Attachment ID or null on error
 */
mailMessageAPI.uploadAttachment = async (fileData, model, id) => {
  try {
    console.log(`Uploading attachment for ${model} with ID ${id}`);

    const odooClient = require('../odooClient').default.client;

    // Ensure we have a valid ID (must be an integer)
    const recordId = parseInt(id);
    if (isNaN(recordId)) {
      console.error(`Invalid record ID: ${id}`);
      return null;
    }

    // Create FormData object
    const formData = new FormData();

    // Ensure we have a valid file object
    const file = {
      uri: fileData.uri,
      type: fileData.type || 'image/jpeg',
      name: fileData.name || `file_${Date.now()}.jpg`,
    };

    // Check file size
    const fileSizeKB = fileData.size || (fileData.base64 ? Math.round(fileData.base64.length / 1024) : 0);

    // Log file details for debugging
    console.log('Preparing file for upload:', {
      name: file.name,
      type: file.type,
      size: `${fileSizeKB} KB`,
      uriPrefix: file.uri ? file.uri.substring(0, 20) + '...' : 'undefined',
      hasBase64: !!fileData.base64
    });

    // Warn about large files
    if (fileSizeKB > 2000) {
      console.warn(`Large file detected (${fileSizeKB} KB), upload may fail or take longer`);
    }

    formData.append('file', file);
    formData.append('model', model);
    formData.append('id', recordId.toString()); // Ensure ID is a string for FormData

    // First try: Use the /api/v2/upload endpoint
    try {
      console.log('Trying to upload via /api/v2/upload endpoint');
      // Adjust timeout based on file size
      const timeout = fileSizeKB > 2000 ? 60000 : 30000; // 60 seconds for large files, 30 seconds for smaller files

      console.log(`Setting upload timeout to ${timeout/1000} seconds based on file size`);

      const response = await odooClient.post('/api/v2/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: timeout,
      });

      if (response.data && response.data.id) {
        console.log(`Successfully uploaded attachment, ID: ${response.data.id}`);
        return response.data.id;
      }
    } catch (uploadError) {
      console.error('Error with /api/v2/upload endpoint:', uploadError);
      console.error('Upload error details:', uploadError.response?.data || 'No response data');
    }

    // Fallback: Create attachment directly using ir.attachment model
    try {
      console.log('Trying fallback: Creating attachment directly via ir.attachment');

      // Convert image to base64 if needed
      let base64Data = fileData.base64;
      if (!base64Data && fileData.uri) {
        // If we don't have base64 data but have a URI, we can't easily convert it here
        console.log('No base64 data available, cannot create attachment directly');
        return null;
      }

      if (base64Data) {
        // Ensure base64 data is properly formatted (no data:image/jpeg;base64, prefix)
        if (base64Data.includes(',')) {
          base64Data = base64Data.split(',')[1];
        }

        // For very large files, warn that this might fail
        if (fileSizeKB > 5000) { // > 5MB
          console.warn(`Very large file (${fileSizeKB} KB) may cause issues with direct attachment creation`);
        }

        // Create attachment directly
        const attachmentData = {
          name: fileData.name || `file_${Date.now()}.jpg`,
          type: 'binary',
          datas: base64Data,
          res_model: model,
          res_id: recordId,
          mimetype: fileData.type || 'image/jpeg',
          description: `Uploaded from mobile app on ${new Date().toISOString()}`,
        };

        const attachmentId = await odooAPI.create('ir.attachment', attachmentData);
        if (attachmentId) {
          console.log(`Successfully created attachment directly, ID: ${attachmentId}`);
          return attachmentId;
        }
      }
    } catch (createError) {
      console.error('Error creating attachment directly:', createError);
    }

    return null;
  } catch (error) {
    console.error(`Error uploading attachment for ${model} ${id}:`, error);
    return null;
  }
};

// Clear the messages cache
mailMessageAPI.clearCache = async () => {
  return cacheManager.clearCache();
};

export default mailMessageAPI;
