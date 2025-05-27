/**
 * Helpdesk REST API Client
 * 
 * A dedicated REST client for interacting with Odoo's Helpdesk module.
 * This client uses the new REST API endpoints available in Odoo.
 */

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

class HelpdeskRestClient {
  /**
   * Create a new HelpdeskRestClient instance
   * @param {Object} config - Configuration for the client
   */
  constructor(config = {}) {
    this.config = {
      baseURL: config.baseURL || 'https://itmsgroup.com.au',
      db: config.db || '',
      username: config.username || '',
      password: config.password || '',
      ...config
    };

    // Create axios instance
    this.client = axios.create({
      baseURL: this.config.baseURL,
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.db ? { 'DATABASE': this.config.db } : {})
      }
    });

    // Add request interceptor for authentication
    this.client.interceptors.request.use(
      async config => {
        try {
          // Get token data from storage
          const tokenData = await AsyncStorage.getItem('odooTokenData');
          if (tokenData) {
            const parsedToken = JSON.parse(tokenData);
            
            // Check if token is expired
            const now = Date.now();
            if (parsedToken.expiresAt && now >= parsedToken.expiresAt) {
              console.log('Token expired, refreshing...');
              await this.refreshToken();
              
              // Get the new token
              const newTokenData = await AsyncStorage.getItem('odooTokenData');
              if (newTokenData) {
                const newParsedToken = JSON.parse(newTokenData);
                config.headers['Authorization'] = `Bearer ${newParsedToken.accessToken}`;
              }
            } else {
              // Token is still valid
              config.headers['Authorization'] = `Bearer ${parsedToken.accessToken}`;
            }
          }
        } catch (error) {
          console.error('Error in request interceptor:', error);
        }
        return config;
      },
      error => {
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get OAuth token
   * @returns {Promise<Object>} - Token data
   */
  async getToken() {
    try {
      // Create form data for OAuth request
      const formData = new URLSearchParams();
      formData.append('client_id', this.config.clientId || 'GTZmuj6gqZduLrdaPCaiaWEQJrn2eWGhhyVwFgSr');
      formData.append('client_secret', this.config.clientSecret || 'EExqnTlEAYcZ9b6mnP2DYooRkWSnlTISB0PRZObM');
      formData.append('username', this.config.username);
      formData.append('password', this.config.password);
      formData.append('grant_type', 'password');
      
      // Add 2FA code if provided
      if (this.config.twoFactorCode) {
        formData.append('totp_code', this.config.twoFactorCode);
      }
      
      const response = await axios.post(
        `${this.config.baseURL}/api/v2/authentication/oauth2/token`,
        formData,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      if (response.data && response.data.access_token) {
        const tokenData = {
          accessToken: response.data.access_token,
          refreshToken: response.data.refresh_token,
          expiresIn: response.data.expires_in || 3600,
          expiresAt: Date.now() + ((response.data.expires_in || 3600) * 1000),
          tokenType: response.data.token_type || 'Bearer',
          serverConfig: {
            baseURL: this.config.baseURL,
            db: this.config.db,
            username: this.config.username
          }
        };
        
        // Store token data
        await AsyncStorage.setItem('odooTokenData', JSON.stringify(tokenData));
        return tokenData;
      } else {
        throw new Error('Invalid token response');
      }
    } catch (error) {
      console.error('Error getting OAuth token:', error);
      throw error;
    }
  }

  /**
   * Refresh OAuth token
   * @returns {Promise<Object>} - New token data
   */
  async refreshToken() {
    try {
      const tokenData = await AsyncStorage.getItem('odooTokenData');
      if (!tokenData) {
        return this.getToken();
      }
      
      const parsedToken = JSON.parse(tokenData);
      if (!parsedToken.refreshToken) {
        return this.getToken();
      }
      
      // Create form data for refresh request
      const formData = new URLSearchParams();
      formData.append('client_id', this.config.clientId || 'GTZmuj6gqZduLrdaPCaiaWEQJrn2eWGhhyVwFgSr');
      formData.append('client_secret', this.config.clientSecret || 'EExqnTlEAYcZ9b6mnP2DYooRkWSnlTISB0PRZObM');
      formData.append('refresh_token', parsedToken.refreshToken);
      formData.append('grant_type', 'refresh_token');
      
      const response = await axios.post(
        `${this.config.baseURL}/api/v2/authentication/oauth2/token`,
        formData,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      if (response.data && response.data.access_token) {
        const newTokenData = {
          accessToken: response.data.access_token,
          refreshToken: response.data.refresh_token || parsedToken.refreshToken,
          expiresIn: response.data.expires_in || 3600,
          expiresAt: Date.now() + ((response.data.expires_in || 3600) * 1000),
          tokenType: response.data.token_type || 'Bearer',
          serverConfig: parsedToken.serverConfig
        };
        
        // Store token data
        await AsyncStorage.setItem('odooTokenData', JSON.stringify(newTokenData));
        return newTokenData;
      } else {
        throw new Error('Invalid token refresh response');
      }
    } catch (error) {
      console.error('Error refreshing OAuth token:', error);
      // If refresh fails, try getting a new token
      return this.getToken();
    }
  }

  /**
   * Ensure authentication
   * @returns {Promise<void>}
   */
  async ensureAuth() {
    try {
      const tokenData = await AsyncStorage.getItem('odooTokenData');
      if (!tokenData) {
        await this.getToken();
        return;
      }
      
      const parsedToken = JSON.parse(tokenData);
      const now = Date.now();
      if (parsedToken.expiresAt && now >= parsedToken.expiresAt) {
        await this.refreshToken();
      }
    } catch (error) {
      console.error('Error ensuring authentication:', error);
      throw error;
    }
  }

  /**
   * Get field definitions for helpdesk.ticket model
   * @param {Array} attributes - Attributes to retrieve
   * @returns {Promise<Object>} - Field definitions
   */
  async getFieldDefinitions(attributes = ['type']) {
    try {
      await this.ensureAuth();
      
      const response = await this.client.get('/api/v2/fields/helpdesk.ticket', {
        params: {
          attributes: JSON.stringify(attributes)
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error getting field definitions:', error);
      throw error;
    }
  }

  /**
   * Get helpdesk tickets
   * @param {Object} options - Options for the request
   * @returns {Promise<Array>} - List of tickets
   */
  async getTickets(options = {}) {
    try {
      await this.ensureAuth();
      
      const {
        domain = [],
        fields = ['id', 'name', 'description', 'team_id', 'user_id', 'partner_id', 'stage_id', 'priority'],
        limit = 50,
        offset = 0
      } = options;
      
      const response = await this.client.get('/api/v2/search_read/helpdesk.ticket', {
        params: {
          domain: JSON.stringify(domain),
          fields: JSON.stringify(fields),
          limit,
          offset
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error getting tickets:', error);
      // Try simplified approach
      try {
        const response = await this.client.get('/api/v2/search_extract/helpdesk.ticket', {
          params: {
            fields: JSON.stringify(['name']),
            limit: 20
          }
        });
        
        return response.data;
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
        return [];
      }
    }
  }

  /**
   * Get a single helpdesk ticket
   * @param {Number} ticketId - ID of the ticket
   * @param {Array} fields - Fields to retrieve
   * @returns {Promise<Object>} - Ticket data
   */
  async getTicket(ticketId, fields = ['id', 'name', 'description', 'team_id', 'user_id', 'partner_id', 'stage_id', 'priority']) {
    try {
      await this.ensureAuth();
      
      const response = await this.client.get('/api/v2/read/helpdesk.ticket', {
        params: {
          ids: JSON.stringify([ticketId]),
          fields: JSON.stringify(fields)
        }
      });
      
      return response.data[0];
    } catch (error) {
      console.error(`Error getting ticket ${ticketId}:`, error);
      return null;
    }
  }

  /**
   * Create a new helpdesk ticket
   * @param {Object} ticketData - Ticket data
   * @returns {Promise<Number>} - ID of the created ticket
   */
  async createTicket(ticketData) {
    try {
      await this.ensureAuth();
      
      const response = await this.client.post('/api/v2/create/helpdesk.ticket', {
        values: ticketData
      });
      
      return response.data;
    } catch (error) {
      console.error('Error creating ticket:', error);
      throw error;
    }
  }

  /**
   * Update a helpdesk ticket
   * @param {Number} ticketId - ID of the ticket
   * @param {Object} ticketData - Updated ticket data
   * @returns {Promise<Boolean>} - Success status
   */
  async updateTicket(ticketId, ticketData) {
    try {
      await this.ensureAuth();
      
      const response = await this.client.put('/api/v2/write/helpdesk.ticket', {
        ids: [ticketId],
        values: ticketData
      });
      
      return response.data;
    } catch (error) {
      console.error(`Error updating ticket ${ticketId}:`, error);
      
      // Try fallback method
      try {
        const fallbackResponse = await this.client.post('/api/v2/call', {
          model: 'helpdesk.ticket',
          method: 'write',
          args: [[ticketId], ticketData]
        });
        
        return fallbackResponse.data.result || false;
      } catch (fallbackError) {
        console.error('Fallback update failed:', fallbackError);
        return false;
      }
    }
  }

  /**
   * Delete a helpdesk ticket
   * @param {Number} ticketId - ID of the ticket
   * @returns {Promise<Boolean>} - Success status
   */
  async deleteTicket(ticketId) {
    try {
      await this.ensureAuth();
      
      const response = await this.client.delete('/api/v2/unlink/helpdesk.ticket', {
        data: { ids: [ticketId] }
      });
      
      return response.data;
    } catch (error) {
      console.error(`Error deleting ticket ${ticketId}:`, error);
      
      // Try fallback method
      try {
        const fallbackResponse = await this.client.post('/api/v2/call', {
          model: 'helpdesk.ticket',
          method: 'unlink',
          args: [[ticketId]]
        });
        
        return fallbackResponse.data.result || false;
      } catch (fallbackError) {
        console.error('Fallback delete failed:', fallbackError);
        return false;
      }
    }
  }

  /**
   * Get helpdesk teams
   * @returns {Promise<Array>} - List of teams
   */
  async getTeams() {
    try {
      await this.ensureAuth();
      
      const response = await this.client.get('/api/v2/search_read/helpdesk.team', {
        params: {
          fields: JSON.stringify(['id', 'name', 'description'])
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error getting teams:', error);
      return [];
    }
  }

  /**
   * Get helpdesk stages
   * @param {Number} teamId - Optional team ID to filter stages
   * @returns {Promise<Array>} - List of stages
   */
  async getStages(teamId = null) {
    try {
      await this.ensureAuth();
      
      // If teamId is provided, filter stages by team
      const domain = teamId ? [['team_ids', 'in', [teamId]]] : [];
      
      const response = await this.client.get('/api/v2/search_read/helpdesk.stage', {
        params: {
          domain: JSON.stringify(domain),
          fields: JSON.stringify(['id', 'name', 'sequence'])
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error getting stages:', error);
      return [];
    }
  }
  
  /**
   * Get helpdesk ticket types
   * @returns {Promise<Array>} - List of ticket types
   */
  async getTicketTypes() {
    try {
      await this.ensureAuth();
      
      const response = await this.client.get('/api/v2/search_read/helpdesk.ticket.type', {
        params: {
          fields: JSON.stringify(['id', 'name'])
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error getting ticket types:', error);
      return [];
    }
  }
  
  /**
   * Get helpdesk tags
   * @returns {Promise<Array>} - List of tags
   */
  async getTags() {
    try {
      await this.ensureAuth();
      
      const response = await this.client.get('/api/v2/search_read/helpdesk.tag', {
        params: {
          fields: JSON.stringify(['id', 'name', 'color'])
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error getting tags:', error);
      return [];
    }
  }
  
  /**
   * Get helpdesk SLA policies
   * @returns {Promise<Array>} - List of SLA policies
   */
  async getSLAPolicies() {
    try {
      await this.ensureAuth();
      
      const response = await this.client.get('/api/v2/search_read/helpdesk.sla', {
        params: {
          fields: JSON.stringify(['id', 'name', 'team_id', 'stage_id', 'time', 'priority'])
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error getting SLA policies:', error);
      return [];
    }
  }
  
  /**
   * Get SLA status for a ticket
   * @param {Number} ticketId - ID of the ticket
   * @returns {Promise<Array>} - List of SLA statuses
   */
  async getTicketSLAStatus(ticketId) {
    try {
      await this.ensureAuth();
      
      const response = await this.client.get('/api/v2/search_read/helpdesk.sla.status', {
        params: {
          domain: JSON.stringify([['ticket_id', '=', ticketId]]),
          fields: JSON.stringify(['id', 'sla_id', 'ticket_id', 'deadline', 'reached_datetime', 'status'])
        }
      });
      
      return response.data;
    } catch (error) {
      console.error(`Error getting SLA status for ticket ${ticketId}:`, error);
      return [];
    }
  }
  
  /**
   * Log time on a ticket (create timesheet)
   * @param {Number} ticketId - ID of the ticket
   * @param {Number} hours - Hours spent
   * @param {String} description - Description of the work
   * @returns {Promise<Number>} - ID of the created timesheet
   */
  async logTime(ticketId, hours, description) {
    try {
      await this.ensureAuth();
      
      // First, check if the ticket has a project and task
      const ticket = await this.getTicket(ticketId, ['id', 'name', 'project_id', 'sale_line_id', 'use_helpdesk_timesheet']);
      
      if (!ticket) {
        throw new Error(`Ticket ${ticketId} not found`);
      }
      
      // Check if timesheet is enabled for this ticket
      if (!ticket.use_helpdesk_timesheet) {
        throw new Error('Timesheet functionality is not enabled for this ticket');
      }
      
      if (!ticket.project_id) {
        throw new Error('Ticket does not have a project assigned');
      }
      
      // Get the user ID
      const user = await this.getCurrentUser();
      
      if (!user || !user.id) {
        throw new Error('Could not determine current user');
      }
      
      // Create timesheet entry
      const timesheetData = {
        name: description || `Work on ticket ${ticket.name}`,
        unit_amount: hours,
        ticket_id: ticketId,
        project_id: ticket.project_id[0],
        employee_id: user.employee_id ? user.employee_id[0] : false,
        user_id: user.id,
        so_line: ticket.sale_line_id ? ticket.sale_line_id[0] : false
      };
      
      const response = await this.client.post('/api/v2/create/account.analytic.line', {
        values: timesheetData
      });
      
      return response.data;
    } catch (error) {
      console.error(`Error logging time for ticket ${ticketId}:`, error);
      throw error;
    }
  }
  
  /**
   * Get current user
   * @returns {Promise<Object>} - User data
   */
  async getCurrentUser() {
    try {
      await this.ensureAuth();
      
      const response = await this.client.get('/api/v2/user');
      return response.data;
    } catch (error) {
      console.error('Error getting current user:', error);
      
      // Try session endpoint
      try {
        const sessionResponse = await this.client.get('/api/v2/session');
        if (sessionResponse.data && sessionResponse.data.uid) {
          return {
            id: sessionResponse.data.uid,
            name: this.config.username
          };
        }
      } catch (sessionError) {
        console.error('Error getting session:', sessionError);
      }
      
      // Last resort
      return {
        id: 1,
        name: this.config.username
      };
    }
  }
}

export default HelpdeskRestClient;
