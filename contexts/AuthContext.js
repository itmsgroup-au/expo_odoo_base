import React, { createContext, useState, useContext, useEffect } from 'react';
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
        const authenticated = await isAuthenticated();
        setIsLoggedIn(authenticated);
        
        if (authenticated) {
          const sessionInfo = await getSessionInfo();
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
      const result = await authenticateUser(serverConfig);
      
      if (result.success) {
        setIsLoggedIn(true);
        setUser(result.sessionInfo);
        return { success: true };
      } else {
        return result; // Return error information
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
