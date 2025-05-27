// Template for Odoo model API
// Copy this file to create APIs for specific models

import odooClient, { odooAPI } from '../odooClient';

/**
 * API service for a specific Odoo model
 * @param {string} modelName - The Odoo model name (e.g., 'res.partner')
 */
export const createModelAPI = (modelName) => {
  return {
    /**
     * Get list of records
     * @param {Array} domain - Search domain
     * @param {Array} fields - Fields to fetch
     * @param {number} limit - Maximum number of records
     * @param {number} offset - Offset for pagination
     * @param {boolean} forceRefresh - Force refresh from server
     */
    getList: (domain = [], fields = ['id', 'name'], limit = 80, offset = 0, forceRefresh = false) => {
      return odooAPI.searchRead(modelName, domain, fields, limit, offset, forceRefresh);
    },

    /**
     * Get single record by ID
     * @param {number} id - Record ID
     * @param {Array} fields - Fields to fetch
     * @param {boolean} forceRefresh - Force refresh from server
     */
    getById: (id, fields = [], forceRefresh = false) => {
      return odooAPI.read(modelName, id, fields, forceRefresh);
    },

    /**
     * Create new record
     * @param {Object} data - Record data
     */
    create: (data) => {
      return odooAPI.create(modelName, data);
    },

    /**
     * Update record
     * @param {number} id - Record ID
     * @param {Object} data - Update data
     */
    update: (id, data) => {
      console.log(`[modelApiTemplate] Updating ${modelName} with ID:`, id, 'Data:', data);
      return odooAPI.update(modelName, id, data);
    },

    /**
     * Delete record
     * @param {number} id - Record ID
     */
    delete: (id) => {
      return odooAPI.delete(modelName, id);
    },

    /**
     * Call model method
     * @param {number} id - Record ID
     * @param {string} method - Method name
     * @param {Array} args - Positional arguments
     * @param {Object} kwargs - Keyword arguments
     */
    callMethod: (id, method, args = [], kwargs = {}) => {
      return odooAPI.callMethod(modelName, method, id, args, kwargs);
    },

    /**
     * Get model fields
     * @param {Array} attributes - Field attributes to fetch
     * @param {boolean} forceRefresh - Force refresh from server
     */
    getFields: (attributes = ['type', 'string', 'required', 'selection', 'relation'], forceRefresh = false) => {
      return odooAPI.getFields(modelName, attributes, forceRefresh);
    },
  };
};

// Example usage:
// export const partnersAPI = createModelAPI('res.partner');

