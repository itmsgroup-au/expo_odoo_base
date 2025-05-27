#!/bin/bash
# create-module.sh - Script to create a new module in the ExoMobile project

set -e  # Exit on error

MODULE_NAME=$1

if [ -z "$MODULE_NAME" ]; then
  echo "Error: Please provide a module name"
  echo "Usage: ./scripts/create-module.sh <module-name>"
  exit 1
fi

echo "Creating module: $MODULE_NAME"

# Create module directory structure
mkdir -p src/features/$MODULE_NAME
mkdir -p src/features/$MODULE_NAME/components
mkdir -p src/features/$MODULE_NAME/screens
mkdir -p src/features/$MODULE_NAME/__tests__

# Create module files
touch src/features/$MODULE_NAME/index.js
touch src/api/models/${MODULE_NAME}Api.js
touch src/redux/slices/${MODULE_NAME}Slice.js

# Create screen templates
echo "import React from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

const ${MODULE_NAME}ListScreen = () => {
  // Redux
  const dispatch = useDispatch();
  
  return (
    <View style={styles.container}>
      <Text>${MODULE_NAME} List Screen</Text>
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

export default ${MODULE_NAME}ListScreen;" > src/features/$MODULE_NAME/screens/${MODULE_NAME}ListScreen.js

echo "import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRoute } from '@react-navigation/native';

const ${MODULE_NAME}DetailScreen = () => {
  const route = useRoute();
  const { recordId } = route.params || {};
  
  return (
    <ScrollView style={styles.container}>
      <Text>${MODULE_NAME} Detail Screen</Text>
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

export default ${MODULE_NAME}DetailScreen;" > src/features/$MODULE_NAME/screens/${MODULE_NAME}DetailScreen.js

# Create Redux slice template
echo "import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { ${MODULE_NAME}Api } from '../../api/models/${MODULE_NAME}Api';

// Define initial state
const initialState = {
  items: [],
  selectedItem: null,
  status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
  error: null,
};

// Async thunks
export const fetch${MODULE_NAME}s = createAsyncThunk(
  '${MODULE_NAME}/fetch${MODULE_NAME}s',
  async (params, { rejectWithValue }) => {
    try {
      const response = await ${MODULE_NAME}Api.get${MODULE_NAME}s(params);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Slice
const ${MODULE_NAME}Slice = createSlice({
  name: '${MODULE_NAME}',
  initialState,
  reducers: {
    setSelectedItem: (state, action) => {
      state.selectedItem = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetch${MODULE_NAME}s.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetch${MODULE_NAME}s.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload;
      })
      .addCase(fetch${MODULE_NAME}s.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      });
  },
});

export const { setSelectedItem } = ${MODULE_NAME}Slice.actions;
export default ${MODULE_NAME}Slice.reducer;" > src/redux/slices/${MODULE_NAME}Slice.js

# Create API service template
echo "import apiClient from '../client';

export const ${MODULE_NAME}Api = {
  // Get all items with pagination and filtering
  get${MODULE_NAME}s: (params = {}) => {
    return apiClient.get('/api/v2/search_read/${MODULE_NAME}', { params });
  },
  
  // Get single item by ID
  get${MODULE_NAME}: (id) => {
    return apiClient.get(`/api/v2/read/${MODULE_NAME}`, {
      params: { ids: [id] }
    });
  },
  
  // Create new item
  create${MODULE_NAME}: (data) => {
    return apiClient.post('/api/v2/create/${MODULE_NAME}', { values: data });
  },
  
  // Update item
  update${MODULE_NAME}: (id, data) => {
    return apiClient.put('/api/v2/write/${MODULE_NAME}', {
      ids: [id],
      values: data
    });
  },
  
  // Delete item
  delete${MODULE_NAME}: (id) => {
    return apiClient.delete('/api/v2/unlink/${MODULE_NAME}', {
      data: { ids: [id] }
    });
  }
};" > src/api/models/${MODULE_NAME}Api.js

# Create test files
echo "import React from 'react';
import { render } from '@testing-library/react-native';
import ${MODULE_NAME}ListScreen from '../screens/${MODULE_NAME}ListScreen';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';

const mockStore = configureStore([]);

describe('${MODULE_NAME}ListScreen', () => {
  let store;
  
  beforeEach(() => {
    store = mockStore({
      ${MODULE_NAME}: {
        items: [],
        status: 'idle',
        error: null,
      }
    });
  });

  test('renders correctly', () => {
    const { getByText } = render(
      <Provider store={store}>
        <${MODULE_NAME}ListScreen />
      </Provider>
    );
    
    expect(getByText('${MODULE_NAME} List Screen')).toBeTruthy();
  });
});" > src/features/$MODULE_NAME/__tests__/${MODULE_NAME}ListScreen.test.js

echo "import ${MODULE_NAME}Reducer, { setSelectedItem } from '../../../redux/slices/${MODULE_NAME}Slice';

describe('${MODULE_NAME}Slice', () => {
  const initialState = {
    items: [],
    selectedItem: null,
    status: 'idle',
    error: null,
  };

  test('should return the initial state', () => {
    expect(${MODULE_NAME}Reducer(undefined, { type: undefined })).toEqual(initialState);
  });

  test('should handle setSelectedItem', () => {
    const payload = { id: 1, name: 'Test' };
    const newState = ${MODULE_NAME}Reducer(initialState, setSelectedItem(payload));
    expect(newState.selectedItem).toEqual(payload);
  });
});" > src/features/$MODULE_NAME/__tests__/${MODULE_NAME}Slice.test.js

echo "Module $MODULE_NAME created successfully!"
echo "Remember to:"
echo "1. Add the module's reducer to src/redux/store.js"
echo "2. Add the module's routes to your navigation"
echo "3. Create test fixtures for the module"

