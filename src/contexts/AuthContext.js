import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isAuthenticated, authenticateUser, logout, getSessionInfo } from '../services/auth';

// Create the Auth Context
export const AuthContext = createContext({
  isLoggedIn: false,
  user: null,
  login: async () => {},
  logout: async () => {},
  loading: true,
});

// Auth Provider Component
export const AuthProvider = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check authentication status on initial load
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Clear any saved credentials to ensure we're using the new values
        console.log('AuthContext: Clearing saved credentials');
        await AsyncStorage.removeItem('serverConfig');
        await AsyncStorage.removeItem('sessionInfo');
        await AsyncStorage.removeItem('authToken');
        await AsyncStorage.removeItem('odooTokenData');

        console.log('AuthContext: Checking authentication status');
        const authenticated = await isAuthenticated();
        console.log('AuthContext: Authentication status:', authenticated);
        setIsLoggedIn(authenticated);

        if (authenticated) {
          console.log('AuthContext: Getting session info');
          const sessionInfo = await getSessionInfo();
          console.log('AuthContext: Session info:', sessionInfo);
          setUser(sessionInfo);
        }
      } catch (error) {
        console.error('Auth check error:', error);
        setIsLoggedIn(false);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Login function
  const handleLogin = async (serverConfig) => {
    setLoading(true);
    try {
      console.log('AuthContext: Attempting login with config:', {
        serverUrl: serverConfig.serverUrl,
        database: serverConfig.database,
        username: serverConfig.username
      });

      const result = await authenticateUser(serverConfig);
      console.log('AuthContext: Login result:', JSON.stringify(result));

      if (result.success) {
        console.log('AuthContext: Login successful, setting user state');
        setIsLoggedIn(true);
        setUser(result.sessionInfo);
        return { success: true };
      } else {
        console.log('AuthContext: Login failed:', JSON.stringify(result));
        // Make sure we're passing all properties, especially requires2FA
        return {
          ...result,
          success: false,
          error: result.error || 'unknown_error',
          message: result.message || 'An unknown error occurred',
          requires2FA: result.requires2FA || false
        };
      }
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: 'unknown_error',
        message: error.message || 'An unknown error occurred'
      };
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const handleLogout = async () => {
    setLoading(true);
    try {
      await logout();
      setIsLoggedIn(false);
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Context value
  const contextValue = {
    isLoggedIn,
    user,
    login: handleLogin,
    logout: handleLogout,
    loading,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook for using the auth context
export const useAuth = () => useContext(AuthContext);
