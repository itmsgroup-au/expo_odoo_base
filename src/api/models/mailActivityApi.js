// API for mail.activity model

import { createModelAPI } from './modelApiTemplate';
import { odooAPI } from '../odooClient';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const mailActivityAPI = createModelAPI('mail.activity');

// Cache configuration
const CACHE_CONFIG = {
  ACTIVITIES_CACHE_KEY: 'mail_activities_cache',
  ACTIVITIES_TIMESTAMP_KEY: 'mail_activities_timestamp',
  CACHE_EXPIRY: 1000 * 60 * 15, // 15 minutes (shorter than messages since activities change more frequently)
};

// Cache management functions
const cacheManager = {
  // Save activities to cache
  saveActivitiesToCache: async (activities, modelName, recordId) => {
    try {
      const cacheKey = `${CACHE_CONFIG.ACTIVITIES_CACHE_KEY}_${modelName}_${recordId}`;
      await AsyncStorage.setItem(cacheKey, JSON.stringify(activities));
      await AsyncStorage.setItem(CACHE_CONFIG.ACTIVITIES_TIMESTAMP_KEY, Date.now().toString());
      console.log(`Saved ${activities.length} activities to cache for ${modelName} ${recordId}`);
      return true;
    } catch (error) {
      console.error('Error saving activities to cache:', error);
      return false;
    }
  },

  // Get activities from cache
  getActivitiesFromCache: async (modelName, recordId) => {
    try {
      const cacheKey = `${CACHE_CONFIG.ACTIVITIES_CACHE_KEY}_${modelName}_${recordId}`;
      const cachedData = await AsyncStorage.getItem(cacheKey);
      if (!cachedData) {
        console.log('No cached activities found');
        return null;
      }

      const timestamp = await AsyncStorage.getItem(CACHE_CONFIG.ACTIVITIES_TIMESTAMP_KEY);
      const now = Date.now();

      // Check if cache is expired
      if (timestamp && now - parseInt(timestamp) > CACHE_CONFIG.CACHE_EXPIRY) {
        console.log(`Activities cache expired (${Math.round((now - parseInt(timestamp)) / (1000 * 60))} minutes old)`);
        return null;
      }

      const activities = JSON.parse(cachedData);
      console.log(`Retrieved ${activities.length} activities from cache for ${modelName} ${recordId}`);
      return activities;
    } catch (error) {
      console.error('Error getting activities from cache:', error);
      return null;
    }
  },

  // Clear cache
  clearCache: async () => {
    try {
      // Get all keys
      const keys = await AsyncStorage.getAllKeys();

      // Filter activity cache keys
      const activityCacheKeys = keys.filter(key =>
        key.startsWith(CACHE_CONFIG.ACTIVITIES_CACHE_KEY) ||
        key === CACHE_CONFIG.ACTIVITIES_TIMESTAMP_KEY
      );

      // Remove all activity cache keys
      if (activityCacheKeys.length > 0) {
        await AsyncStorage.multiRemove(activityCacheKeys);
      }

      console.log('Activity cache cleared');
      return true;
    } catch (error) {
      console.error('Error clearing activity cache:', error);
      return false;
    }
  }
};

/**
 * Get activities for a specific record
 * @param {string} model - Model name (e.g., 'res.partner')
 * @param {number} id - Record ID
 * @param {boolean} forceRefresh - Force refresh from server
 * @returns {Promise<Array>} List of activities
 */
mailActivityAPI.getActivitiesForRecord = async (model, id, forceRefresh = false) => {
  try {
    console.log(`Getting activities for ${model} with ID ${id}`);

    // Check cache first if not forcing refresh
    if (!forceRefresh) {
      const cachedActivities = await cacheManager.getActivitiesFromCache(model, id);
      if (cachedActivities && cachedActivities.length > 0) {
        return cachedActivities;
      }
    }

    // Direct approach: Use search_read to get activities for this specific record
    console.log(`Using search_read to find activities for ${model} ${id}`);

    try {
      const activities = await odooAPI.searchRead(
        'mail.activity',
        [
          ['res_model', '=', model],
          ['res_id', '=', id]
        ],
        [
          'id', 'activity_type_id', 'summary', 'note', 'date_deadline',
          'user_id', 'create_date', 'state', 'res_model', 'res_id'
        ],
        100,  // Limit
        0,    // Offset
        true  // Force refresh
      );

      console.log(`Found ${activities ? activities.length : 0} activities via search_read for ${model} ${id}`);

      if (activities && activities.length > 0) {
        // Double-check that all activities are for this record
        const filteredActivities = activities.filter(act =>
          act.res_model === model &&
          act.res_id === parseInt(id)
        );

        console.log(`After filtering: ${filteredActivities.length} activities for ${model} ${id}`);

        // Sort activities by deadline (closest first)
        filteredActivities.sort((a, b) => new Date(a.date_deadline) - new Date(b.date_deadline));

        // Cache the activities
        await cacheManager.saveActivitiesToCache(filteredActivities, model, id);

        return filteredActivities;
      }

      return [];
    } catch (searchError) {
      console.error(`Error using search_read for activities:`, searchError);

      // Fallback: Try to get activity_ids from the record and then fetch each activity
      try {
        console.log(`Fallback: Getting activity_ids from ${model} ${id}`);
        const record = await odooAPI.read(model, id, ['activity_ids'], true);

        if (record && record.activity_ids && record.activity_ids.length > 0) {
          console.log(`Found ${record.activity_ids.length} activity IDs for ${model} ${id}`);

          // Fetch activities in batches to avoid overwhelming the API
          const batchSize = 5;
          const allActivities = [];

          for (let i = 0; i < record.activity_ids.length; i += batchSize) {
            const batch = record.activity_ids.slice(i, i + batchSize);

            // Use the read endpoint to get activity details
            const batchActivities = await Promise.all(
              batch.map(activityId =>
                odooAPI.read(
                  'mail.activity',
                  activityId,
                  ['id', 'activity_type_id', 'summary', 'note', 'date_deadline', 'user_id', 'create_date', 'state', 'res_model', 'res_id'],
                  true
                )
              )
            );

            // Filter out any null results and ensure they belong to this record
            const filteredActivities = batchActivities.filter(act =>
              act !== null &&
              act.res_model === model &&
              act.res_id === parseInt(id)
            );

            console.log(`Batch: ${batch.length} activities, filtered: ${filteredActivities.length} activities`);
            allActivities.push(...filteredActivities);

            // Add a small delay between batches
            if (i + batchSize < record.activity_ids.length) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }

          if (allActivities.length > 0) {
            // Sort activities by deadline (closest first)
            allActivities.sort((a, b) => new Date(a.date_deadline) - new Date(b.date_deadline));

            // Cache the activities
            await cacheManager.saveActivitiesToCache(allActivities, model, id);

            return allActivities;
          }
        }
      } catch (readError) {
        console.error(`Error in fallback activity fetching:`, readError);
      }
    }

    return [];
  } catch (error) {
    console.error(`Error getting activities for ${model} ${id}:`, error);
    return [];
  }
};

/**
 * Create a new activity for a record
 * @param {string} model - Model name (e.g., 'res.partner')
 * @param {number} id - Record ID
 * @param {number} activityTypeId - Activity type ID
 * @param {string} summary - Activity summary
 * @param {string} note - Activity note
 * @param {string} dateDeadline - Deadline date (YYYY-MM-DD)
 * @param {number} userId - Assigned user ID
 * @returns {Promise<number|null>} New activity ID or null on error
 */
mailActivityAPI.createActivity = async (model, id, activityTypeId, summary, note, dateDeadline, userId) => {
  try {
    console.log(`Creating activity for ${model} with ID ${id}`);

    const activityData = {
      res_model: model,
      res_id: id,
      activity_type_id: activityTypeId,
      summary: summary,
      note: note,
      date_deadline: dateDeadline,
      user_id: userId
    };

    const result = await odooAPI.create('mail.activity', activityData);

    if (result) {
      // Clear cache to ensure fresh data on next fetch
      await cacheManager.clearCache();
      return result;
    }

    return null;
  } catch (error) {
    console.error(`Error creating activity for ${model} ${id}:`, error);
    return null;
  }
};

/**
 * Mark an activity as done
 * @param {number} activityId - Activity ID
 * @param {string} feedback - Feedback message
 * @returns {Promise<boolean>} Success status
 */
mailActivityAPI.markAsDone = async (activityId, feedback = '') => {
  try {
    console.log(`Marking activity ${activityId} as done`);

    const result = await odooAPI.callMethod(
      'mail.activity',
      'action_feedback',
      activityId,
      [],
      { feedback: feedback }
    );

    if (result) {
      // Clear cache to ensure fresh data on next fetch
      await cacheManager.clearCache();
      return true;
    }

    return false;
  } catch (error) {
    console.error(`Error marking activity ${activityId} as done:`, error);
    return false;
  }
};

// Clear the activities cache
mailActivityAPI.clearCache = async () => {
  return cacheManager.clearCache();
};

export default mailActivityAPI;
