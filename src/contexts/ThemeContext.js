import React, { createContext, useState, useContext, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Define theme colors
const lightTheme = {
  primary: '#3B82F6',
  onPrimary: '#FFFFFF',
  secondary: '#10B981',
  background: '#F3F4F6',
  surface: '#FFFFFF',
  error: '#EF4444',
  success: '#10B981',
  text: '#1F2937',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
  divider: '#F3F4F6',
  disabled: '#9CA3AF',
  placeholder: '#9CA3AF',
};

const darkTheme = {
  primary: '#60A5FA',
  onPrimary: '#FFFFFF',
  secondary: '#34D399',
  background: '#111827',
  surface: '#1F2937',
  error: '#F87171',
  success: '#34D399',
  text: '#F9FAFB',
  textSecondary: '#9CA3AF',
  border: '#374151',
  divider: '#374151',
  disabled: '#6B7280',
  placeholder: '#6B7280',
};

// Create context
const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const deviceTheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load theme preference from storage
  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const storedTheme = await AsyncStorage.getItem('themePreference');
        if (storedTheme !== null) {
          setIsDarkMode(storedTheme === 'dark');
        } else {
          // Use device theme as default
          setIsDarkMode(deviceTheme === 'dark');
        }
      } catch (error) {
        console.error('Error loading theme preference:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadThemePreference();
  }, [deviceTheme]);

  // Save theme preference
  const toggleTheme = async () => {
    try {
      const newThemeValue = !isDarkMode;
      setIsDarkMode(newThemeValue);
      await AsyncStorage.setItem('themePreference', newThemeValue ? 'dark' : 'light');
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  // Set specific theme
  const setTheme = async (isDark) => {
    try {
      setIsDarkMode(isDark);
      await AsyncStorage.setItem('themePreference', isDark ? 'dark' : 'light');
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  const theme = {
    isDarkMode,
    colors: isDarkMode ? darkTheme : lightTheme,
    toggleTheme,
    setTheme,
    isLoading,
  };

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export default ThemeContext;
