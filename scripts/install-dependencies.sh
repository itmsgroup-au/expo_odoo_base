#!/bin/bash
# install-dependencies.sh - Script to install all required dependencies for ExoMobile

set -e  # Exit on error

echo "Installing dependencies for ExoMobile..."

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

echo "Dependencies installed successfully!"

