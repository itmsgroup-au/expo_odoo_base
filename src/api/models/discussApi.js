// API for discuss.channel model - Odoo's internal chat messaging system

import { createModelAPI } from './modelApiTemplate';
import { createOdooClient } from '../odooClient';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Use the existing odooClient from the codebase
const api = createOdooClient();

export const discussAPI = createModelAPI('discuss.channel');

// Cache configuration
const CACHE_CONFIG = {
  CHANNELS_CACHE_KEY: 'discuss_channels_cache',
  DIRECT_MESSAGES_CACHE_KEY: 'discuss_direct_messages_cache',
  CACHE_TIMESTAMP_KEY: 'discuss_cache_timestamp',
  CACHE_EXPIRY: 1000 * 60 * 30, // 30 minutes
  TIMEOUT: 30000, // 30 seconds
};

// Simple cache manager
const cacheManager = {
  // Get channels from cache
  getChannelsFromCache: async () => {
    try {
      const cachedData = await AsyncStorage.getItem(CACHE_CONFIG.CHANNELS_CACHE_KEY);
      if (!cachedData) return null;
      const channels = JSON.parse(cachedData);
      console.log(`Retrieved ${channels.length} channels from cache`);
      return channels;
    } catch (error) {
      console.error('Error getting channels from cache:', error);
      return null;
    }
  },

  // Save channels to cache
  saveChannelsToCache: async (channels) => {
    try {
      if (!channels || !Array.isArray(channels)) return false;
      await AsyncStorage.setItem(CACHE_CONFIG.CHANNELS_CACHE_KEY, JSON.stringify(channels));
      await AsyncStorage.setItem(CACHE_CONFIG.CACHE_TIMESTAMP_KEY, Date.now().toString());
      console.log(`Saved ${channels.length} channels to cache`);
      return true;
    } catch (error) {
      console.error('Error saving channels to cache:', error);
      return false;
    }
  },

  // Get direct messages from cache
  getDirectMessagesFromCache: async () => {
    try {
      const cachedData = await AsyncStorage.getItem(CACHE_CONFIG.DIRECT_MESSAGES_CACHE_KEY);
      if (!cachedData) return null;
      const directMessages = JSON.parse(cachedData);
      console.log(`Retrieved ${directMessages.length} direct messages from cache`);
      return directMessages;
    } catch (error) {
      console.error('Error getting direct messages from cache:', error);
      return null;
    }
  },

  // Save direct messages to cache
  saveDirectMessagesToCache: async (directMessages) => {
    try {
      if (!directMessages || !Array.isArray(directMessages)) return false;
      await AsyncStorage.setItem(CACHE_CONFIG.DIRECT_MESSAGES_CACHE_KEY, JSON.stringify(directMessages));
      console.log(`Saved ${directMessages.length} direct messages to cache`);
      return true;
    } catch (error) {
      console.error('Error saving direct messages to cache:', error);
      return false;
    }
  },

  // Check if cache is expired
  isCacheExpired: async () => {
    try {
      const timestamp = await AsyncStorage.getItem(CACHE_CONFIG.CACHE_TIMESTAMP_KEY);
      if (!timestamp) return true;
      const cacheAge = Date.now() - parseInt(timestamp);
      return cacheAge > CACHE_CONFIG.CACHE_EXPIRY;
    } catch (error) {
      console.error('Error checking cache expiry:', error);
      return true;
    }
  }
};

// Get channels - like the discuss feature logs show
discussAPI.getChannels = async (forceRefresh = false) => {
  try {
    console.log(`Fetching discuss.channel records with domain: []`);
    console.log(`Fields: ["id","name","description","channel_type","public","channel_member_ids","message_ids","is_member","member_count","last_message_id","create_date","write_date","uuid","channel_partner_ids","group_public_id","channel_last_seen_partner_ids"]`);

    // Check cache first if not forcing refresh
    if (!forceRefresh) {
      const cachedChannels = await cacheManager.getChannelsFromCache();
      if (cachedChannels && cachedChannels.length > 0) {
        const isExpired = await cacheManager.isCacheExpired();
        if (!isExpired) {
          console.log(`Using ${cachedChannels.length} cached channels`);
          return cachedChannels;
        }
      }
    }

    // Fetch from API - filter for channels only
    const domain = [["channel_type", "=", "channel"]];
    const fields = [
      "id", "name", "description", "channel_type", "public", "channel_member_ids",
      "message_ids", "is_member", "member_count", "last_message_id", "create_date",
      "write_date", "uuid", "channel_partner_ids", "group_public_id", "channel_last_seen_partner_ids"
    ];

    const response = await api.get('/api/v2/search_read/discuss.channel', {
      params: {
        domain: JSON.stringify(domain),
        fields: JSON.stringify(fields),
        limit: 100,
        offset: 0
      },
      timeout: CACHE_CONFIG.TIMEOUT
    });

    if (response.data && Array.isArray(response.data)) {
      console.log(`Successfully fetched ${response.data.length} discuss.channel records`);
      
      // Process channels to add display names
      const processedChannels = response.data.map(channel => ({
        ...channel,
        displayName: channel.name || `Channel ${channel.id}`,
        subtitle: channel.description || `${channel.member_count || 0} members`,
        hasUnread: false, // TODO: Implement unread logic
        lastActivity: channel.write_date
      }));
      
      // Save to cache
      await cacheManager.saveChannelsToCache(processedChannels);
      
      return processedChannels;
    }

    return [];
  } catch (error) {
    console.error('Error fetching channels:', error);
    
    // Try to return cached data as fallback
    const cachedChannels = await cacheManager.getChannelsFromCache();
    if (cachedChannels && cachedChannels.length > 0) {
      console.log(`API failed, using ${cachedChannels.length} cached channels as fallback`);
      return cachedChannels;
    }
    
    return [];
  }
};

// Get direct messages
discussAPI.getDirectMessages = async (forceRefresh = false) => {
  try {
    console.log(`Fetching direct message channels`);

    // Check cache first if not forcing refresh
    if (!forceRefresh) {
      const cachedDirectMessages = await cacheManager.getDirectMessagesFromCache();
      if (cachedDirectMessages && cachedDirectMessages.length > 0) {
        const isExpired = await cacheManager.isCacheExpired();
        if (!isExpired) {
          console.log(`Using ${cachedDirectMessages.length} cached direct messages`);
          return cachedDirectMessages;
        }
      }
    }

    // Fetch from API - filter for direct messages (chat type)
    const domain = [["channel_type", "=", "chat"]];
    const fields = [
      "id", "name", "description", "channel_type", "public", "channel_member_ids",
      "message_ids", "is_member", "member_count", "last_message_id", "create_date",
      "write_date", "uuid", "channel_partner_ids"
    ];

    const response = await api.get('/api/v2/search_read/discuss.channel', {
      params: {
        domain: JSON.stringify(domain),
        fields: JSON.stringify(fields),
        limit: 100,
        offset: 0
      },
      timeout: CACHE_CONFIG.TIMEOUT
    });

    if (response.data && Array.isArray(response.data)) {
      console.log(`Found ${response.data.length} direct message channels`);
      
      // Process direct messages to add display names
      const processedDirectMessages = response.data.map(dm => ({
        ...dm,
        displayName: dm.name || `Direct Message ${dm.id}`,
        subtitle: 'Direct message',
        hasUnread: false, // TODO: Implement unread logic
        lastActivity: dm.write_date,
        isDirectMessage: true
      }));
      
      // Save to cache
      await cacheManager.saveDirectMessagesToCache(processedDirectMessages);
      
      return processedDirectMessages;
    }

    return [];
  } catch (error) {
    console.error('Error fetching direct messages:', error);
    
    // Try to return cached data as fallback
    const cachedDirectMessages = await cacheManager.getDirectMessagesFromCache();
    if (cachedDirectMessages && cachedDirectMessages.length > 0) {
      console.log(`API failed, using ${cachedDirectMessages.length} cached direct messages as fallback`);
      return cachedDirectMessages;
    }
    
    return [];
  }
};

// Create a new channel
discussAPI.createChannel = async (name, description = '', channelType = 'channel', memberIds = [], isPublic = true) => {
  try {
    console.log(`Creating new channel: ${name}`);

    const channelData = {
      name: name,
      description: description,
      channel_type: channelType,
      public: isPublic ? 'public' : 'private',
      channel_partner_ids: memberIds
    };

    const response = await api.post('/api/v2/create/discuss.channel', {
      values: channelData
    });

    if (response.data) {
      console.log(`Successfully created channel with ID: ${response.data}`);
      return response.data;
    }

    return null;
  } catch (error) {
    console.error('Error creating channel:', error);
    return null;
  }
};

// Send message to channel
discussAPI.sendChannelMessage = async (channelId, message, attachmentIds = []) => {
  try {
    console.log(`Sending message to channel ${channelId}`);

    const messageData = {
      body: message,
      message_type: 'comment',
      attachment_ids: attachmentIds
    };

    const response = await api.post('/api/v2/call', {
      model: 'discuss.channel',
      method: 'message_post',
      args: [[parseInt(channelId)]],
      kwargs: messageData
    });

    if (response.data && response.data.result) {
      console.log(`Successfully sent message to channel ${channelId}`);
      return response.data.result;
    }

    return null;
  } catch (error) {
    console.error('Error sending message:', error);
    return null;
  }
};

// Get messages for a channel
discussAPI.getChannelMessages = async (channelId, limit = 50, offset = 0) => {
  try {
    console.log(`Fetching messages for channel ${channelId}`);

    const domain = [["res_id", "=", parseInt(channelId)], ["model", "=", "discuss.channel"]];
    const fields = [
      "id", "body", "author_id", "create_date", "write_date", "message_type",
      "attachment_ids", "partner_ids", "subject"
    ];

    const response = await api.get('/api/v2/search_read/mail.message', {
      params: {
        domain: JSON.stringify(domain),
        fields: JSON.stringify(fields),
        limit: limit,
        offset: offset,
        order: 'create_date desc'
      },
      timeout: CACHE_CONFIG.TIMEOUT
    });

    if (response.data && Array.isArray(response.data)) {
      console.log(`Retrieved ${response.data.length} messages for channel ${channelId}`);
      return response.data;
    }

    return [];
  } catch (error) {
    console.error(`Error fetching messages for channel ${channelId}:`, error);
    return [];
  }
};

export default discussAPI;
