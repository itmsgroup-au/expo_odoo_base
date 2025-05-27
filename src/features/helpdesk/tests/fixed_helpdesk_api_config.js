/**
 * Helpdesk API Test Configuration
 * 
 * Contains the configuration for connecting to the Odoo REST API
 * with the correct credentials for testing the Helpdesk module.
 */

const HELPDESK_API_CONFIG = {
  // Server configuration
  baseURL: 'https://itmsgroup.com.au',
  db: 'ITMS_v17_3_backup_2025_02_17_08_15',
  
  // Authentication credentials
  username: 'mark.shaw@itmsgroup.com.au',
  password: 'hTempTWxeCFYWVswzMcv',
  
  // OAuth2 client credentials
  clientId: 'GTZmuj6gqZduLrdaPCaiaWEQJrn2eWGhhyVwFgSr',
  clientSecret: 'EExqnTlEAYcZ9b6mnP2DYooRkWSnlTISB0PRZObM',
  
  // API endpoints
  authEndpoint: '/api/v2/authentication/oauth2/token',
  apiBase: '/api/v2'
};

module.exports = HELPDESK_API_CONFIG;
