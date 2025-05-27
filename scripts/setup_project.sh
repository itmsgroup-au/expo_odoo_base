#!/bin/bash
# setup_project.sh - Script to set up the initial ExoMobile project structure

set -e  # Exit on error

echo "Setting up ExoMobile project structure..."

# Base directories
mkdir -p src/api
mkdir -p src/components/common
mkdir -p src/components/forms
mkdir -p src/components/tiles
mkdir -p src/features
mkdir -p src/navigation
mkdir -p src/redux/slices
mkdir -p src/styles
mkdir -p src/utils
mkdir -p src/tests/fixtures
mkdir -p src/tests/mocks

# Tools and templates
mkdir -p tools/model-explorer
mkdir -p tools/code-generator
mkdir -p templates/components
mkdir -p templates/screens
mkdir -p templates/tests
mkdir -p test-configs

# Move existing Odoo tools to the tools directory
echo "Moving existing Odoo tools to tools directory..."
cp odoo-model-explorer.py tools/model-explorer/
cp odoo_diagram_generator.py tools/model-explorer/
cp odoo-api-swagger-generator.py tools/model-explorer/

# Create basic files
touch src/api/client.js
touch src/components/index.js
touch src/navigation/index.js
touch src/redux/store.js
touch src/styles/theme.js
touch src/tests/setup.js
touch src/utils/index.js

echo "Creating basic config files..."

# Create a basic package.json if it doesn't exist
if [ ! -f package.json ]; then
  echo '{
  "name": "exomobile",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:module": "./scripts/test-module.sh",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix"
  }
}' > package.json
  echo "Created package.json"
fi

# Create a basic .gitignore
if [ ! -f .gitignore ]; then
  echo "# Node dependencies
node_modules/

# Expo
.expo/
dist/
web-build/

# Native
*.orig.*
*.jks
*.p8
*.p12
*.key
*.mobileprovision

# Metro
.metro-health-check*

# Jest
coverage/

# Local env files
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# macOS
.DS_Store

# Temporary files
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*" > .gitignore
  echo "Created .gitignore"
fi

# Create a basic Jest config
if [ ! -f jest.config.js ]; then
  echo "module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)'
  ],
  setupFilesAfterEnv: [
    '@testing-library/jest-native/extend-expect',
    './src/tests/setup.js'
  ],
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.expo/'
  ],
  moduleFileExtensions: [
    'ts',
    'tsx',
    'js',
    'jsx',
    'json',
    'node'
  ],
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts'
  ],
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 70,
      functions: 80,
      lines: 80
    }
  }
};" > jest.config.js
  echo "Created jest.config.js"
fi

# Create test setup file
echo "import 'react-native-gesture-handler/jestSetup';
import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

// Mock Reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Silence the warning: Animated: \`useNativeDriver\` is not supported
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');

// Mock navigation
jest.mock('@react-navigation/native', () => {
  return {
    ...jest.requireActual('@react-navigation/native'),
    useNavigation: () => ({
      navigate: jest.fn(),
      goBack: jest.fn(),
    }),
    useRoute: () => ({
      params: {},
    }),
  };
});" > src/tests/setup.js
echo "Created test setup file"

# Create a basic testing module script
echo "#!/bin/bash
# test-module.sh

MODULE_NAME=\$1
COVERAGE_THRESHOLD=80

if [ -z \"\$MODULE_NAME\" ]; then
  echo \"Error: Please provide a module name\"
  echo \"Usage: ./scripts/test-module.sh <module-name>\"
  exit 1
fi

echo \"Testing module: \$MODULE_NAME\"

# Run Jest with module-specific pattern
npx jest --testPathPattern=src/features/\$MODULE_NAME --coverage

# Check coverage threshold
COVERAGE=\$(cat coverage/coverage-summary.json | grep -o '\"pct\": [0-9]*.[0-9]*' | head -1 | grep -o '[0-9]*.[0-9]*')

if (( \$(echo \"\$COVERAGE < \$COVERAGE_THRESHOLD\" | bc -l) )); then
  echo \"❌ Test coverage (\$COVERAGE%) is below threshold (\$COVERAGE_THRESHOLD%)\"
  exit 1
else
  echo \"✅ Test coverage (\$COVERAGE%) meets threshold (\$COVERAGE_THRESHOLD%)\"
fi" > scripts/test-module.sh
chmod +x scripts/test-module.sh
echo "Created test module script"

# Create a component template for MainTile
mkdir -p templates/components
echo "import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';

interface MainTileProps {
  title: string;
  icon: React.ReactNode;
  color: string;
  count?: number;
  route: string;
}

const MainTile: React.FC<MainTileProps> = ({ title, icon, color, count, route }) => {
  const navigation = useNavigation();
  
  const handlePress = () => {
    navigation.navigate(route);
  };
  
  return (
    <TouchableOpacity 
      style={styles.container} 
      onPress={handlePress}
      testID={`main-tile-${title.toLowerCase()}`}
    >
      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: color }]}>
          {icon}
        </View>
        <Text style={styles.title}>{title}</Text>
        {count !== undefined && (
          <Text style={styles.count}>{count} items</Text>
        )}
      </View>
      <View style={styles.footer}>
        <Text style={styles.viewAll}>View All</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  content: {
    padding: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  count: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  viewAll: {
    fontSize: 12,
    fontWeight: '500',
    color: '#3B82F6',
  },
});

export default MainTile;" > templates/components/MainTile.tsx
echo "Created MainTile component template"

# Create a test template for MainTile
mkdir -p templates/tests
echo "import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import MainTile from '../MainTile';

const mockNavigate = jest.fn();

// Mock the useNavigation hook
jest.mock('@react-navigation/native', () => {
  return {
    ...jest.requireActual('@react-navigation/native'),
    useNavigation: () => ({
      navigate: mockNavigate,
    }),
  };
});

describe('MainTile Component', () => {
  const defaultProps = {
    title: 'Contacts',
    icon: <></>,
    color: '#3B82F6',
    count: 42,
    route: 'ContactsList',
  };

  beforeEach(() => {
    mockNavigate.mockClear();
  });

  test('renders correctly with all props', () => {
    const { getByText, getByTestId } = render(<MainTile {...defaultProps} />);
    
    expect(getByTestId('main-tile-contacts')).toBeTruthy();
    expect(getByText('Contacts')).toBeTruthy();
    expect(getByText('42 items')).toBeTruthy();
    expect(getByText('View All')).toBeTruthy();
  });

  test('renders without count when not provided', () => {
    const props = { ...defaultProps, count: undefined };
    const { queryByText } = render(<MainTile {...props} />);
    
    expect(queryByText(/items/)).toBeNull();
  });

  test('navigates to the correct route when pressed', () => {
    const { getByTestId } = render(<MainTile {...defaultProps} />);
    
    fireEvent.press(getByTestId('main-tile-contacts'));
    expect(mockNavigate).toHaveBeenCalledWith('ContactsList');
  });
});" > templates/tests/MainTile.test.tsx
echo "Created MainTile test template"

# Create API client template
echo "import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const API_URL = 'http://localhost:8069/api/v2';
const TOKEN_KEY = 'auth_token';

/**
 * API client for making requests to the Odoo REST API
 */
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Add auth token to requests
 */
apiClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Check for internet connection
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected && ['post', 'put', 'delete', 'patch'].includes(config.method)) {
      // Throw a custom error to be caught by the caller for offline handling
      throw new Error('OFFLINE_MODE');
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Handle response errors
 */
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Handle token expiration (401)
    if (error.response && error.response.status === 401) {
      // Clear token
      await AsyncStorage.removeItem(TOKEN_KEY);
      // Redirect to login (handled by auth context)
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;" > src/api/client.js
echo "Created API client template"

# Create theme file
echo "import { DefaultTheme, DarkTheme } from '@react-navigation/native';

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
};" > src/styles/theme.js
echo "Created theme file"

# Create basic Redux store
echo "import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import autoMergeLevel2 from 'redux-persist/lib/stateReconciler/autoMergeLevel2';

// Import reducers as they're created
// import authReducer from './slices/authSlice';
// import uiReducer from './slices/uiSlice';

const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  stateReconciler: autoMergeLevel2,
  whitelist: ['auth', 'ui'], // Only persist these slices
};

// Create combined reducer as slices are added
const rootReducer = {
  // auth: authReducer,
  // ui: uiReducer,
};

const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST'],
      },
    }),
});

export const persistor = persistStore(store);
export default store;" > src/redux/store.js
echo "Created Redux store template"

# Create a basic UI slice
mkdir -p src/redux/slices
echo "import { createSlice } from '@reduxjs/toolkit';
import { DENSITIES } from '../../styles/theme';

const initialState = {
  density: DENSITIES.MEDIUM,
  theme: 'light',
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setDensity: (state, action) => {
      state.density = action.payload;
    },
    setTheme: (state, action) => {
      state.theme = action.payload;
    },
  },
});

export const { setDensity, setTheme } = uiSlice.actions;
export default uiSlice.reducer;" > src/redux/slices/uiSlice.js
echo "Created UI slice template"

# Create test for UI slice
mkdir -p src/redux/slices/__tests__
echo "import uiReducer, { setDensity, setTheme } from '../uiSlice';
import { DENSITIES } from '../../../styles/theme';

describe('uiSlice', () => {
  const initialState = {
    density: DENSITIES.MEDIUM,
    theme: 'light',
  };

  test('should return the initial state', () => {
    expect(uiReducer(undefined, { type: undefined })).toEqual(initialState);
  });

  test('should handle setDensity', () => {
    const newState = uiReducer(initialState, setDensity(DENSITIES.COMPACT));
    expect(newState.density).toBe(DENSITIES.COMPACT);
  });

  test('should handle setTheme', () => {
    const newState = uiReducer(initialState, setTheme('dark'));
    expect(newState.theme).toBe('dark');
  });
});" > src/redux/slices/__tests__/uiSlice.test.js
echo "Created UI slice test"

# Create module generation script
echo "#!/bin/bash
# create-module.sh - Script to create a new module in the ExoMobile project

set -e  # Exit on error

MODULE_NAME=\$1

if [ -z \"\$MODULE_NAME\" ]; then
  echo \"Error: Please provide a module name\"
  echo \"Usage: ./scripts/create-module.sh <module-name>\"
  exit 1
fi

echo \"Creating module: \$MODULE_NAME\"

# Create module directory structure
mkdir -p src/features/\$MODULE_NAME
mkdir -p src/features/\$MODULE_NAME/components
mkdir -p src/features/\$MODULE_NAME/screens
mkdir -p src/features/\$MODULE_NAME/__tests__

# Create module files
touch src/features/\$MODULE_NAME/index.js
touch src/api/models/\${MODULE_NAME}Api.js
touch src/redux/slices/\${MODULE_NAME}Slice.js

# Create screen templates
echo \"import React from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

const \${MODULE_NAME}ListScreen = () => {
  // Redux
  const dispatch = useDispatch();
  
  return (
    <View style={styles.container}>
      <Text>\${MODULE_NAME} List Screen</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#F5F7FA',
  },
});

export default \${MODULE_NAME}ListScreen;\" > src/features/\$MODULE_NAME/screens/\${MODULE_NAME}ListScreen.js

echo \"import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRoute } from '@react-navigation/native';

const \${MODULE_NAME}DetailScreen = () => {
  const route = useRoute();
  const { recordId } = route.params || {};
  
  return (
    <ScrollView style={styles.container}>
      <Text>\${MODULE_NAME} Detail Screen</Text>
      <Text>Record ID: {recordId}</Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#F5F7FA',
  },
});

export default \${MODULE_NAME}DetailScreen;\" > src/features/\$MODULE_NAME/screens/\${MODULE_NAME}DetailScreen.js

# Create Redux slice template
echo \"import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { \${MODULE_NAME}Api } from '../../api/models/\${MODULE_NAME}Api';

// Define initial state
const initialState = {
  items: [],
  selectedItem: null,
  status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
  error: null,
};

// Async thunks
export const fetch\${MODULE_NAME}s = createAsyncThunk(
  '\${MODULE_NAME}/fetch\${MODULE_NAME}s',
  async (params, { rejectWithValue }) => {
    try {
      const response = await \${MODULE_NAME}Api.get\${MODULE_NAME}s(params);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Slice
const \${MODULE_NAME}Slice = createSlice({
  name: '\${MODULE_NAME}',
  initialState,
  reducers: {
    setSelectedItem: (state, action) => {
      state.selectedItem = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetch\${MODULE_NAME}s.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetch\${MODULE_NAME}s.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload;
      })
      .addCase(fetch\${MODULE_NAME}s.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      });
  },
});

export const { setSelectedItem } = \${MODULE_NAME}Slice.actions;
export default \${MODULE_NAME}Slice.reducer;\" > src/redux/slices/\${MODULE_NAME}Slice.js

# Create API service template
echo \"import apiClient from '../client';

export const \${MODULE_NAME}Api = {
  // Get all items with pagination and filtering
  get\${MODULE_NAME}s: (params = {}) => {
    return apiClient.get('/api/v2/search_read/\${MODULE_NAME}', { params });
  },
  
  // Get single item by ID
  get\${MODULE_NAME}: (id) => {
    return apiClient.get(\`/api/v2/read/\${MODULE_NAME}\`, {
      params: { ids: [id] }
    });
  },
  
  // Create new item
  create\${MODULE_NAME}: (data) => {
    return apiClient.post('/api/v2/create/\${MODULE_NAME}', { values: data });
  },
  
  // Update item
  update\${MODULE_NAME}: (id, data) => {
    return apiClient.put('/api/v2/write/\${MODULE_NAME}', {
      ids: [id],
      values: data
    });
  },
  
  // Delete item
  delete\${MODULE_NAME}: (id) => {
    return apiClient.delete('/api/v2/unlink/\${MODULE_NAME}', {
      data: { ids: [id] }
    });
  }
};\" > src/api/models/\${MODULE_NAME}Api.js

# Create test files
echo \"import React from 'react';
import { render } from '@testing-library/react-native';
import \${MODULE_NAME}ListScreen from '../screens/\${MODULE_NAME}ListScreen';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';

const mockStore = configureStore([]);

describe('\${MODULE_NAME}ListScreen', () => {
  let store;
  
  beforeEach(() => {
    store = mockStore({
      \${MODULE_NAME}: {
        items: [],
        status: 'idle',
        error: null,
      }
    });
  });

  test('renders correctly', () => {
    const { getByText } = render(
      <Provider store={store}>
        <\${MODULE_NAME}ListScreen />
      </Provider>
    );
    
    expect(getByText('\${MODULE_NAME} List Screen')).toBeTruthy();
  });
});\" > src/features/\$MODULE_NAME/__tests__/\${MODULE_NAME}ListScreen.test.js

echo \"import \${MODULE_NAME}Reducer, { setSelectedItem } from '../../../redux/slices/\${MODULE_NAME}Slice';

describe('\${MODULE_NAME}Slice', () => {
  const initialState = {
    items: [],
    selectedItem: null,
    status: 'idle',
    error: null,
  };

  test('should return the initial state', () => {
    expect(\${MODULE_NAME}Reducer(undefined, { type: undefined })).toEqual(initialState);
  });

  test('should handle setSelectedItem', () => {
    const payload = { id: 1, name: 'Test' };
    const newState = \${MODULE_NAME}Reducer(initialState, setSelectedItem(payload));
    expect(newState.selectedItem).toEqual(payload);
  });
});\" > src/features/\$MODULE_NAME/__tests__/\${MODULE_NAME}Slice.test.js

echo \"Module \$MODULE_NAME created successfully!\"
echo \"Remember to:\"
echo \"1. Add the module's reducer to src/redux/store.js\"
echo \"2. Add the module's routes to your navigation\"
echo \"3. Create test fixtures for the module\"
" > scripts/create-module.sh
chmod +x scripts/create-module.sh
echo "Created module generation script"

# Create dependency installation script
echo "#!/bin/bash
# install-dependencies.sh - Script to install all required dependencies for ExoMobile

set -e  # Exit on error

echo \"Installing dependencies for ExoMobile...\"

# Base dependencies
npm install --save react-native-paper @react-navigation/native @react-navigation/stack @react-navigation/bottom-tabs

# State management
npm install --save redux @reduxjs/toolkit react-redux redux-persist

# API and offline support
npm install --save axios @react-native-async-storage/async-storage @react-native-community/netinfo

# UI components
npm install --save react-native-reanimated react-native-gesture-handler react-native-safe-area-context react-native-screens

# Icons
npm install --save lucide-react-native

# Testing
npm install --save-dev jest @testing-library/react-native @testing-library/jest-native jest-expo react-test-renderer @testing-library/react-hooks msw

# Linting
npm install --save-dev eslint eslint-plugin-react eslint-plugin-react-native prettier eslint-config-prettier eslint-plugin-prettier

echo \"Dependencies installed successfully!\"
" > scripts/install-dependencies.sh
chmod +x scripts/install-dependencies.sh
echo "Created dependency installation script"

# Make scripts executable
chmod +x scripts/*.sh

echo "ExoMobile project structure setup complete!"
echo "Next steps:"
echo "1. Run './scripts/install-dependencies.sh' to install dependencies"
echo "2. Start building the app with 'npm start'"
