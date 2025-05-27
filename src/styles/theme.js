import { DefaultTheme, DarkTheme } from '@react-navigation/native';

export const DENSITIES = {
  COMFORTABLE: 'comfortable',
  MEDIUM: 'medium',
  COMPACT: 'compact',
};

// Spacing values based on density
export const getSpacing = (density) => {
  switch (density) {
    case DENSITIES.COMFORTABLE:
      return {
        xs: 8,
        s: 16,
        m: 24,
        l: 32,
        xl: 48,
      };
    case DENSITIES.COMPACT:
      return {
        xs: 4,
        s: 8,
        m: 16,
        l: 24,
        xl: 32,
      };
    case DENSITIES.MEDIUM:
    default:
      return {
        xs: 6,
        s: 12,
        m: 20,
        l: 28,
        xl: 40,
      };
  }
};

export const lightTheme = {
  ...DefaultTheme,
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    primary: '#3B82F6',
    background: '#F5F7FA',
    card: '#FFFFFF',
    text: '#1F2937',
    border: '#E5E7EB',
    notification: '#EF4444',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
  },
};

export const darkTheme = {
  ...DarkTheme,
  dark: true,
  colors: {
    ...DarkTheme.colors,
    primary: '#60A5FA',
    background: '#1F2937',
    card: '#374151',
    text: '#F9FAFB',
    border: '#4B5563',
    notification: '#F87171',
    success: '#34D399',
    warning: '#FBBF24',
    error: '#F87171',
    info: '#60A5FA',
  },
};

export const getTheme = (scheme, density = DENSITIES.MEDIUM) => {
  const theme = scheme === 'dark' ? darkTheme : lightTheme;
  
  return {
    ...theme,
    spacing: getSpacing(density),
  };
};
