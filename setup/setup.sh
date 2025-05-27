#!/bin/bash
# setup.sh - Script to set up the ExoMobile project

set -e  # Exit on error

echo "Setting up ExoMobile project..."

# Run the project structure setup script
if [ -f "./scripts/setup_project.sh" ]; then
  bash ./scripts/setup_project.sh
else
  echo "Project structure setup script not found, creating basic directories..."
  mkdir -p src/{api,components,contexts,features,navigation,services,styles,utils}
fi

# Install dependencies
echo "Installing dependencies..."

# Base dependencies
npm install react-native-paper@5.11.1 @react-navigation/native@6.1.9 @react-navigation/stack@6.3.20 @react-navigation/bottom-tabs@6.5.11

# State management
npm install redux@4.2.1 @reduxjs/toolkit@1.9.7 react-redux@8.1.3 redux-persist@6.0.0

# API and offline support
npm install axios@1.6.0 @react-native-async-storage/async-storage@1.19.4 @react-native-community/netinfo@9.3.10

# UI and navigation dependencies
npm install react-native-safe-area-context@4.7.4 react-native-screens@3.27.0 react-native-gesture-handler@2.13.4

# Icons
npm install lucide-react-native@0.292.0

# Dev dependencies
npm install --save-dev @types/react@18.2.37 @types/react-native@0.72.6 typescript@5.2.2

# Create a basic tsconfig.json if it doesn't exist
if [ ! -f "tsconfig.json" ]; then
  echo '{
  "compilerOptions": {
    "allowJs": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "jsx": "react-native",
    "lib": ["es6", "esnext"],
    "moduleResolution": "node",
    "noEmit": true,
    "strict": true,
    "target": "esnext",
    "skipLibCheck": true
  },
  "exclude": [
    "node_modules",
    "babel.config.js",
    "metro.config.js",
    "jest.config.js"
  ]
}' > tsconfig.json
  echo "Created tsconfig.json"
fi

# Create a basic package.json if it doesn't exist
if [ ! -f "package.json" ]; then
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
    "lint": "eslint ."
  }
}' > package.json
  echo "Created package.json"
fi

# Create or update the .gitignore file
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
echo "Updated .gitignore"

# Create a README file
if [ ! -f "README.md" ]; then
  echo '# ExoMobile

A mobile application for connecting to Odoo ERP systems with a clean tile-based UI.

## Features

- Tile-based home screen
- Modular architecture
- Offline support
- Authentication with Odoo
- Multi-module support

## Getting Started

### Prerequisites

- Node.js 14+ and npm
- Expo CLI

### Installation

```bash
# Clone the repo
git clone https://github.com/yourusername/exomobile.git
cd exomobile

# Install dependencies
./setup.sh

# Start the app
npm start
```

## Project Structure

```
exomobile/
├── src/                      # Source code
│   ├── api/                  # API integration
│   ├── components/           # Reusable UI components
│   ├── contexts/             # React contexts
│   ├── features/             # Feature modules
│   ├── navigation/           # Navigation configuration
│   ├── services/             # Business logic services
│   ├── styles/               # Theming and styling
│   └── utils/                # Utility functions
├── scripts/                  # Development scripts
└── docs/                     # Project documentation
```

## License

This project is licensed under the MIT License.
' > README.md
  echo "Created README.md"
fi

# Make create-home-screen.sh executable
chmod +x scripts/create-home-screen.sh

echo "ExoMobile project setup completed!"
echo "You can now run 'npm start' to start the development server."