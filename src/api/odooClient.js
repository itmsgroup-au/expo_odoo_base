import { ODOO_CONFIG } from '../config/odoo';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Create axios instance for Odoo API
const createOdooClient = (config = ODOO_CONFIG) => {
  console.log('Creating Odoo client with config:', {
    baseURL: config.baseURL,
    db: config.db
  });

  const instance = axios.create({
    baseURL: config.baseURL,
    headers: {
      'Content-Type': 'application/json',
      // Add DATABASE header if db is provided
      ...(config.db ? { 'DATABASE': config.db } : {})
    }
  });

  // Add request interceptor to add authorization token
  instance.interceptors.request.use(
    async config => {
      try {
        // Check for OAuth token in storage
        const tokenData = await AsyncStorage.getItem('odooTokenData');
        if (tokenData) {
          const parsedToken = JSON.parse(tokenData);

          // Get the server config from the token data
          const serverConfig = parsedToken.serverConfig || ODOO_CONFIG;

          // Check if token is expired
          const now = Date.now();
          if (parsedToken.expiresAt && now >= parsedToken.expiresAt) {
            console.log('Token expired, refreshing...');
            // Token is expired, refresh it
            await refreshOAuthToken();
            // Get the new token
            const newTokenData = await AsyncStorage.getItem('odooTokenData');
            if (newTokenData) {
              const newParsedToken = JSON.parse(newTokenData);
              config.headers['Authorization'] = `Bearer ${newParsedToken.accessToken}`;

              // Add database header if needed
              if (serverConfig.db) {
                config.headers['DATABASE'] = serverConfig.db;
              }
            }
          } else {
            // Token is still valid
            config.headers['Authorization'] = `Bearer ${parsedToken.accessToken}`;

            // Add database header if needed
            if (serverConfig.db) {
              config.headers['DATABASE'] = serverConfig.db;
            }
          }

          // Update the baseURL if needed
          if (serverConfig.baseURL && !config.baseURL) {
            config.baseURL = serverConfig.baseURL;
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

  return instance;
};

// Function to get OAuth token with specific config
export const getOAuthTokenWithConfig = async (config) => {
  try {
    console.log('Getting OAuth token with config:', {
      baseURL: config.baseURL,
      db: config.db,
      username: config.username,
      // password is omitted for security
    });

    // Use the REST API OAuth2 token endpoint
    const authEndpoint = config.authEndpoint || '/api/v2/authentication/oauth2/token';

    // Create form data for the request (this is what the test script uses)
    const formData = new URLSearchParams();
    formData.append('client_id', config.clientId || 'GTZmuj6gqZduLrdaPCaiaWEQJrn2eWGhhyVwFgSr');
    formData.append('client_secret', config.clientSecret || 'EExqnTlEAYcZ9b6mnP2DYooRkWSnlTISB0PRZObM');
    formData.append('username', config.username);
    formData.append('password', config.password);
    formData.append('grant_type', config.grantType || 'password');

    // Add 2FA code if provided
    if (config.twoFactorCode) {
      console.log('Adding 2FA code to request');
      formData.append('totp_code', config.twoFactorCode);
    }

    console.log('Sending OAuth request with form data');

    const response = await axios.post(
      `${config.baseURL}${authEndpoint}`,
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
        // Store the server config with the token
        serverConfig: {
          baseURL: config.baseURL,
          db: config.db,
          username: config.username
        }
      };

      // Store token data
      await AsyncStorage.setItem('odooTokenData', JSON.stringify(tokenData));
      console.log('OAuth token obtained and stored');
      return tokenData;
    } else {
      console.error('Invalid token response:', response.data);
      throw new Error('Invalid token response');
    }
  } catch (error) {
    console.error('Error getting OAuth token:', error);
    throw error;
  }
};

// Function to get OAuth token using default config
export const getOAuthToken = async () => {
  return getOAuthTokenWithConfig(ODOO_CONFIG);
};

// Function to refresh OAuth token
export const refreshOAuthToken = async () => {
  try {
    const tokenData = await AsyncStorage.getItem('odooTokenData');
    if (!tokenData) {
      return getOAuthToken();
    }

    const parsedToken = JSON.parse(tokenData);
    if (!parsedToken.refreshToken) {
      return getOAuthToken();
    }

    // Use the stored server config if available, otherwise use default
    const config = parsedToken.serverConfig || ODOO_CONFIG;
    const authEndpoint = config.authEndpoint || '/api/v2/authentication/oauth2/token';

    console.log('Refreshing OAuth token for server:', config.baseURL);

    // Create form data for the request (this is what the test script uses)
    const formData = new URLSearchParams();
    formData.append('client_id', config.clientId || 'GTZmuj6gqZduLrdaPCaiaWEQJrn2eWGhhyVwFgSr');
    formData.append('client_secret', config.clientSecret || 'EExqnTlEAYcZ9b6mnP2DYooRkWSnlTISB0PRZObM');
    formData.append('refresh_token', parsedToken.refreshToken);
    formData.append('grant_type', 'refresh_token');

    console.log('Sending OAuth refresh request with form data');

    const response = await axios.post(
      `${config.baseURL}${authEndpoint}`,
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
        // Keep the server config
        serverConfig: config
      };

      // Store token data
      await AsyncStorage.setItem('odooTokenData', JSON.stringify(newTokenData));
      console.log('OAuth token refreshed and stored');
      return newTokenData;
    } else {
      console.error('Invalid token refresh response:', response.data);
      // If refresh fails, try getting a new token with the stored config
      return getOAuthTokenWithConfig(config);
    }
  } catch (error) {
    console.error('Error refreshing OAuth token:', error);
    // If refresh fails, try getting a new token
    // Get the stored token data to extract the server config
    try {
      const tokenData = await AsyncStorage.getItem('odooTokenData');
      if (tokenData) {
        const parsedToken = JSON.parse(tokenData);
        if (parsedToken.serverConfig) {
          return getOAuthTokenWithConfig(parsedToken.serverConfig);
        }
      }
    } catch (e) {
      console.error('Error getting stored token data:', e);
    }

    return getOAuthToken();
  }
};

// Create default client
const odooClient = createOdooClient();

// Authentication methods
export const odooAuth = {
  async login(serverConfig = null) {
    try {
      // Create a temporary config that combines the server config with the default config
      const config = {
        ...ODOO_CONFIG,
        ...serverConfig,
        // Map serverUrl to baseURL if provided
        baseURL: serverConfig?.serverUrl || ODOO_CONFIG.baseURL,
        // Map database to db if provided
        db: serverConfig?.database || ODOO_CONFIG.db
      };

      console.log('Attempting login to Odoo server:', config.baseURL);
      console.log('Database:', config.db);
      console.log('Username:', config.username);

      // Log the complete config for debugging
      console.log('Complete login config:', {
        baseURL: config.baseURL,
        db: config.db,
        username: config.username,
        authEndpoint: config.authEndpoint || '/api/v2/authentication/oauth2/token'
      });

      // Get OAuth token using the combined config
      const tokenData = await getOAuthTokenWithConfig(config);

      if (!tokenData || !tokenData.accessToken) {
        console.error('Failed to obtain OAuth token');
        return {
          success: false,
          error: 'auth_error',
          message: 'Failed to obtain OAuth token'
        };
      }

      // Get session info to verify authentication
      try {
        const client = createOdooClient(config);
        console.log('Getting session info with token');
        const response = await client.get('/api/v2/session', {
          headers: {
            'Authorization': `Bearer ${tokenData.accessToken}`,
            'DATABASE': config.db
          }
        });

        console.log('Session response status:', response.status);
        console.log('Session response data:', response.data);

        if (response.status === 200) {
          return {
            success: true,
            userId: response.data.uid || 1,
            sessionInfo: {
              username: config.username,
              uid: response.data.uid || 1,
              db: config.db,
              sessionId: response.data.sid || 'session_id',
              userContext: response.data.user_context || {},
              serverVersion: response.data.server_version || 'unknown',
              serverUrl: config.baseURL,
              database: config.db
            }
          };
        }
      } catch (error) {
        console.error('Error getting session info:', error);

        // Even if session info fails, we still have a token, so consider login successful
        return {
          success: true,
          userId: 1,
          sessionInfo: {
            username: config.username,
            uid: 1,
            db: config.db,
            sessionId: 'session_id',
            userContext: {},
            serverVersion: 'unknown',
            serverUrl: config.baseURL,
            database: config.db
          }
        };
      }

      // If we get here, authentication failed
      return {
        success: false,
        error: 'auth_error',
        message: 'Authentication failed'
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: 'auth_error',
        message: error.message || 'Authentication failed'
      };
    }
  },

  async isLoggedIn() {
    try {
      const tokenData = await AsyncStorage.getItem('odooTokenData');
      if (!tokenData) {
        return false;
      }

      const parsedToken = JSON.parse(tokenData);
      const now = Date.now();

      // If token is expired, try to refresh it
      if (parsedToken.expiresAt && now >= parsedToken.expiresAt) {
        try {
          await refreshOAuthToken();
          return true;
        } catch (error) {
          console.error('Error refreshing token during isLoggedIn check:', error);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Error checking login status:', error);
      return false;
    }
  },

  async logout() {
    try {
      // Clear OAuth token
      await AsyncStorage.removeItem('odooTokenData');
      console.log('Logged out - OAuth token removed');
      return true;
    } catch (error) {
      console.error('Logout error:', error);
      return false;
    }
  }
};

// User information methods
export const getUser = async () => {
  try {
    // Ensure we have a valid token
    const tokenData = await AsyncStorage.getItem('odooTokenData');
    let config = ODOO_CONFIG;

    if (!tokenData) {
      await getOAuthToken();
    } else {
      const parsedToken = JSON.parse(tokenData);
      // Get the server config from the token data
      config = parsedToken.serverConfig || ODOO_CONFIG;

      const now = Date.now();
      if (parsedToken.expiresAt && now >= parsedToken.expiresAt) {
        await refreshOAuthToken();
      }
    }

    // Create a client with the correct server config
    const client = createOdooClient(config);

    // First try the userinfo endpoint with database header
    try {
      console.log('Trying to get user data from /api/v2/userinfo endpoint');
      const infoResponse = await client.get('/api/v2/userinfo', {
        headers: {
          'DATABASE': config.db
        }
      });

      console.log('Successfully got user data from /api/v2/userinfo endpoint:', infoResponse.data);

      // Transform the data to match our expected format
      if (infoResponse.data) {
        const userInfoData = infoResponse.data;
        return {
          id: userInfoData.sub || 1,
          name: userInfoData.name || 'User',
          login: userInfoData.username || userInfoData.email || 'User',
          email: userInfoData.email || '',
          phone: userInfoData.phone_number || '',
          image_256: null,
          picture: userInfoData.picture || null,
          // If picture doesn't start with data:, add the prefix
          ...(userInfoData.picture && !userInfoData.picture.startsWith('data:') ?
            { picture: `data:image/png;base64,${userInfoData.picture}` } : {}),
          tz: userInfoData.zoneinfo || '',
          address: userInfoData.address ? {
            street: userInfoData.address.street_address || '',
            city: userInfoData.address.locality || '',
            state: userInfoData.address.region || '',
            zip: userInfoData.address.postal_code || '',
            country: userInfoData.address.country || '',
            formatted: userInfoData.address.formatted || ''
          } : null
        };
      }

      return infoResponse.data;
    } catch (infoError) {
      console.error('Error getting user from /api/v2/userinfo endpoint:', infoError);

      // Fallback to the user endpoint
      try {
        console.log('Falling back to /api/v2/user endpoint');
        const response = await client.get('/api/v2/user', {
          headers: {
            'DATABASE': config.db
          }
        });
        console.log('Successfully got user data from /api/v2/user endpoint:', response.data);
        return response.data;
      } catch (userError) {
        console.error('Error getting user from /api/v2/user endpoint:', userError);

        // Try one more fallback to the session endpoint
        try {
          console.log('Falling back to /api/v2/session endpoint');
          // Get the server config from the token data
          let username = ODOO_CONFIG.username;

          if (tokenData) {
            const parsedToken = JSON.parse(tokenData);
            username = parsedToken.serverConfig?.username || ODOO_CONFIG.username;
          }

          const sessionResponse = await client.get('/api/v2/session', {
            headers: {
              'DATABASE': config.db
            }
          });

          if (sessionResponse.data && sessionResponse.data.uid) {
            // If we have a session with UID, try to get user data directly
            console.log('Got session data with UID:', sessionResponse.data.uid);
            return {
              id: sessionResponse.data.uid,
              name: username,
              login: username
            };
          }
        } catch (sessionError) {
          console.error('Error getting session:', sessionError);
        }

        // Last resort fallback
        console.log('All methods failed, using fallback user object');
        let username = ODOO_CONFIG.username;
        try {
          const tokenData = await AsyncStorage.getItem('odooTokenData');
          if (tokenData) {
            const parsedToken = JSON.parse(tokenData);
            if (parsedToken.serverConfig && parsedToken.serverConfig.username) {
              username = parsedToken.serverConfig.username;
            }
          }
        } catch (e) {
          console.error('Error getting username from token data:', e);
        }

        return {
          id: 1,
          name: username,
          login: username
        };
      }
    }
  } catch (error) {
    console.error('Error getting user:', error);

    // Last resort fallback
    return {
      id: 1,
      name: ODOO_CONFIG.username || 'Admin User',
      login: ODOO_CONFIG.username || 'admin'
    };
  }
};

export const getSession = async () => {
  try {
    // Ensure we have a valid token
    const tokenData = await AsyncStorage.getItem('odooTokenData');
    let config = ODOO_CONFIG;

    if (!tokenData) {
      await getOAuthToken();
    } else {
      const parsedToken = JSON.parse(tokenData);
      // Get the server config from the token data
      config = parsedToken.serverConfig || ODOO_CONFIG;

      const now = Date.now();
      if (parsedToken.expiresAt && now >= parsedToken.expiresAt) {
        await refreshOAuthToken();
      }
    }

    // Create a client with the correct server config
    const client = createOdooClient(config);

    // Make sure we include the database header
    const response = await client.get('/api/v2/session', {
      headers: {
        'DATABASE': config.db
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error getting session:', error);

    // Get config from token data if available
    let db = ODOO_CONFIG.db;
    let username = ODOO_CONFIG.username;

    try {
      const tokenData = await AsyncStorage.getItem('odooTokenData');
      if (tokenData) {
        const parsedToken = JSON.parse(tokenData);
        if (parsedToken.serverConfig) {
          db = parsedToken.serverConfig.db || ODOO_CONFIG.db;
          username = parsedToken.serverConfig.username || ODOO_CONFIG.username;
        }
      }
    } catch (e) {
      console.error('Error getting config from token data:', e);
    }

    // Return minimal session data as fallback
    return {
      uid: 1,
      db: db,
      username: username
    };
  }
};

export const getCompanyInfo = async () => {
  try {
    // Ensure we have a valid token
    const tokenData = await AsyncStorage.getItem('odooTokenData');
    let config = ODOO_CONFIG;

    if (!tokenData) {
      await getOAuthToken();
    } else {
      const parsedToken = JSON.parse(tokenData);
      // Get the server config from the token data
      config = parsedToken.serverConfig || ODOO_CONFIG;

      const now = Date.now();
      if (parsedToken.expiresAt && now >= parsedToken.expiresAt) {
        await refreshOAuthToken();
      }
    }

    // Create a client with the correct server config
    const client = createOdooClient(config);

    // Make sure we include the database header
    const response = await client.get('/api/v2/company', {
      headers: {
        'DATABASE': config.db
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error getting company info:', error);
    return null;
  }
};

// CRUD operations
export const odooAPI = {
  async searchRead(model, domain = [], fields = ['id', 'name'], limit = 80, offset = 0) {
    try {
      console.log(`Fetching ${model} records with domain:`, JSON.stringify(domain));
      console.log(`Fields:`, JSON.stringify(fields));

      const response = await odooClient.get(`/api/v2/search_read/${model}`, {
        params: {
          domain: JSON.stringify(domain),
          fields: JSON.stringify(fields),
          limit,
          offset
        }
      });

      console.log(`Successfully fetched ${response.data ? response.data.length : 0} ${model} records`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching ${model} records:`, error);
      console.error('Error details:', error.response?.data || 'No response data');
      console.error('Error status:', error.response?.status);

      // Try the fallback API method
      try {
        console.log(`Trying fallback method for ${model} with domain:`, JSON.stringify(domain));

        const fallbackResponse = await odooClient.post('/api/v2/call', {
          model,
          method: 'search_read',
          args: [domain, fields],
          kwargs: { limit, offset }
        });

        const result = fallbackResponse.data.result || [];
        console.log(`Fallback method returned ${result.length} ${model} records`);
        return result;
      } catch (fallbackError) {
        console.error(`Fallback API call for ${model} failed:`, fallbackError);
        console.error('Fallback error details:', fallbackError.response?.data || 'No response data');
        console.error('Fallback error status:', fallbackError.response?.status);

        // Try one more approach with a simpler domain
        try {
          console.log(`Trying simplified approach for ${model}`);
          const simpleDomain = [['active', '=', true]];
          const simpleLimit = Math.min(limit, 20);

          const simpleResponse = await odooClient.post('/api/v2/call', {
            model,
            method: 'search_read',
            args: [simpleDomain, fields],
            kwargs: { limit: simpleLimit, offset: 0 }
          });

          const simpleResult = simpleResponse.data.result || [];
          console.log(`Simplified method returned ${simpleResult.length} ${model} records`);
          return simpleResult;
        } catch (simpleError) {
          console.error(`Simplified API call for ${model} failed:`, simpleError);
          return [];
        }
      }
    }
  },

  async read(model, ids, fields = ['id', 'name']) {
    try {
      const response = await odooClient.get(`/api/v2/read/${model}`, {
        params: {
          ids: JSON.stringify(ids),
          fields: JSON.stringify(fields)
        }
      });
      return response.data;
    } catch (error) {
      console.error(`Error reading ${model} records:`, error);

      // Try the fallback API method
      try {
        const fallbackResponse = await odooClient.post('/api/v2/call', {
          model,
          method: 'read',
          args: [ids, fields]
        });
        return fallbackResponse.data.result || [];
      } catch (fallbackError) {
        console.error(`Fallback API call for ${model} failed:`, fallbackError);
        return [];
      }
    }
  },

  async create(model, values) {
    try {
      const response = await odooClient.post(`/api/v2/create/${model}`, {
        values
      });
      return response.data;
    } catch (error) {
      console.error(`Error creating ${model} record:`, error);

      // Try the fallback API method
      try {
        const fallbackResponse = await odooClient.post('/api/v2/call', {
          model,
          method: 'create',
          args: [values]
        });
        return fallbackResponse.data.result || null;
      } catch (fallbackError) {
        console.error(`Fallback API call for ${model} failed:`, fallbackError);
        return null;
      }
    }
  },

  async update(model, ids, values) {
    try {
      console.log(`Updating ${model} with ID(s):`, ids, 'Values:', values);

      // Convert single ID to array if needed
      const idArray = Array.isArray(ids) ? ids : [ids];

      const response = await odooClient.put(`/api/v2/write/${model}`, {
        ids: idArray,
        values
      });
      console.log(`Update response for ${model}:`, response.data);
      return response.data;
    } catch (error) {
      console.error(`Error updating ${model} record:`, error);
      console.error('Error details:', error.response?.data || 'No response data');

      // Try the fallback API method
      try {
        console.log(`Trying fallback method for updating ${model}`);
        // Convert single ID to array if needed
        const idArray = Array.isArray(ids) ? ids : [ids];

        const fallbackResponse = await odooClient.post('/api/v2/call', {
          model,
          method: 'write',
          args: [idArray, values]
        });
        console.log(`Fallback update response for ${model}:`, fallbackResponse.data);
        return fallbackResponse.data.result || false;
      } catch (fallbackError) {
        console.error(`Fallback API call for ${model} failed:`, fallbackError);
        console.error('Fallback error details:', fallbackError.response?.data || 'No response data');
        return false;
      }
    }
  },

  async delete(model, ids) {
    try {
      const response = await odooClient.delete(`/api/v2/unlink/${model}`, {
        data: { ids }
      });
      return response.data;
    } catch (error) {
      console.error(`Error deleting ${model} record:`, error);

      // Try the fallback API method
      try {
        const fallbackResponse = await odooClient.post('/api/v2/call', {
          model,
          method: 'unlink',
          args: [ids]
        });
        return fallbackResponse.data.result || false;
      } catch (fallbackError) {
        console.error(`Fallback API call for ${model} failed:`, fallbackError);
        return false;
      }
    }
  }
};

export { createOdooClient };

export default {
  auth: odooAuth,
  api: odooAPI,
  client: odooClient,
  createOdooClient
};