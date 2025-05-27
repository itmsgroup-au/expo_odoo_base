#!/bin/bash
# generate-navigator.sh - Generate navigator for a model

echo "import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

// Import screens
import ${MODEL_NAME^}ListScreen from './screens/${MODEL_NAME^}ListScreen';
import ${MODEL_NAME^}DetailScreen from './screens/${MODEL_NAME^}DetailScreen';
import ${MODEL_NAME^}FormScreen from './screens/${MODEL_NAME^}FormScreen';

const Stack = createStackNavigator();

const ${MODEL_NAME^}Navigator = () => {
  return (
    <Stack.Navigator
      initialRouteName=\"${MODEL_NAME^}List\"
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name=\"${MODEL_NAME^}List\" component={${MODEL_NAME^}ListScreen} />
      <Stack.Screen name=\"${MODEL_NAME^}Detail\" component={${MODEL_NAME^}DetailScreen} />
      <Stack.Screen name=\"${MODEL_NAME^}Form\" component={${MODEL_NAME^}FormScreen} />
    </Stack.Navigator>
  );
};

export default ${MODEL_NAME^}Navigator;
" > "$FEATURE_DIR/${MODEL_NAME^}Navigator.js"

echo "Created navigator at $FEATURE_DIR/${MODEL_NAME^}Navigator.js"