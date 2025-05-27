# ExoMobile Deployment Guide

## Overview
This guide will help you deploy ExoMobile to Expo Go and then to the Apple App Store and Google Play Store.

## Prerequisites

1. **Install Required Tools**
   ```bash
   npm install -g @expo/cli eas-cli
   ```

2. **Expo Account**
   - You're already logged in as `itmsadmin`
   - Project ID: `1b9f1730-f28b-42b3-a17f-0916ec64d122`

## Step 1: Create Required Assets

Your app is missing some required assets. You need to create:

### App Icon (1024x1024 PNG)
- **Location**: `./src/assets/icon.png`
- **Requirements**: 1024x1024 pixels, PNG format, no transparency
- **Purpose**: Used for app stores and device home screen

### Adaptive Icon (1024x1024 PNG)
- **Location**: `./src/assets/adaptive-icon.png`
- **Requirements**: 1024x1024 pixels, PNG format, foreground image for Android
- **Purpose**: Android adaptive icon foreground

### Splash Screen (1284x2778 PNG)
- **Location**: `./src/assets/splash.png`
- **Requirements**: 1284x2778 pixels (iPhone 12 Pro Max resolution)
- **Purpose**: Loading screen when app starts

### Favicon (48x48 PNG)
- **Location**: `./src/assets/favicon.png`
- **Requirements**: 48x48 pixels, PNG format
- **Purpose**: Web version favicon

## Step 2: Update App Configuration

Your current `app.json` is minimal. Here's what you need:

```json
{
  "expo": {
    "name": "ExoMobile",
    "slug": "exomobile",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./src/assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./src/assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "assetBundlePatterns": [
      "**/*"
    ],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.exomobile.app",
      "buildNumber": "1",
      "infoPlist": {
        "NSPhotoLibraryUsageDescription": "Allow ExoMobile to access your photos to upload attachments",
        "NSCameraUsageDescription": "Allow ExoMobile to use your camera to take photos for attachments",
        "NSDocumentPickerUsageDescription": "Allow ExoMobile to access documents for attachments"
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./src/assets/adaptive-icon.png",
        "backgroundColor": "#FFFFFF"
      },
      "permissions": [
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.CAMERA",
        "android.permission.INTERNET",
        "android.permission.ACCESS_NETWORK_STATE"
      ],
      "package": "com.exomobile.app",
      "versionCode": 1
    },
    "web": {
      "favicon": "./src/assets/favicon.png",
      "bundler": "metro"
    },
    "plugins": [
      "expo-document-picker",
      "expo-image-picker"
    ],
    "extra": {
      "eas": {
        "projectId": "1b9f1730-f28b-42b3-a17f-0916ec64d122"
      }
    },
    "owner": "itmsadmin"
  }
}
```

## Step 3: Deploy to Expo Go

1. **Start Development Server**
   ```bash
   npx expo start
   ```

2. **Test on Device**
   - Install Expo Go app on your phone
   - Scan QR code from terminal
   - Test all functionality

3. **Publish to Expo Go**
   ```bash
   npx expo publish
   ```

## Step 4: Build for App Stores

### Configure EAS Build

Your `eas.json` looks good, but let's enhance it:

```json
{
  "cli": {
    "version": ">= 16.4.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false
      }
    },
    "production": {
      "autoIncrement": true,
      "env": {
        "NODE_ENV": "production"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@email.com",
        "ascAppId": "your-app-store-connect-app-id",
        "appleTeamId": "your-apple-team-id"
      },
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

### Build Commands

1. **Build for iOS**
   ```bash
   eas build --platform ios --profile production
   ```

2. **Build for Android**
   ```bash
   eas build --platform android --profile production
   ```

3. **Build for Both**
   ```bash
   eas build --platform all --profile production
   ```

## Step 5: App Store Preparation

### iOS App Store

1. **Apple Developer Account**
   - Enroll in Apple Developer Program ($99/year)
   - Create App Store Connect app

2. **App Store Connect Setup**
   - Create new app
   - Fill app information
   - Upload screenshots
   - Set pricing

3. **Submit for Review**
   ```bash
   eas submit --platform ios --profile production
   ```

### Google Play Store

1. **Google Play Console**
   - Create developer account ($25 one-time fee)
   - Create new app

2. **Store Listing**
   - Upload screenshots
   - Write app description
   - Set content rating

3. **Submit for Review**
   ```bash
   eas submit --platform android --profile production
   ```

## Step 6: Testing Strategy

1. **Internal Testing**
   - Use development builds
   - Test on multiple devices
   - Verify all features work offline

2. **Beta Testing**
   - Use TestFlight (iOS) and Internal Testing (Android)
   - Invite beta testers
   - Gather feedback

3. **Production Testing**
   - Test production builds before submission
   - Verify app store metadata
   - Check compliance with store guidelines

## Common Issues and Solutions

### Build Failures
- Check for missing dependencies
- Verify asset paths
- Review error logs in EAS dashboard

### Store Rejections
- Follow platform guidelines
- Ensure proper permissions usage
- Test on actual devices

### Performance Issues
- Optimize images and assets
- Implement proper caching
- Monitor bundle size

## Next Steps

1. Create the missing assets (icons, splash screen)
2. Update app.json with complete configuration
3. Test locally with Expo Go
4. Build and test production versions
5. Submit to app stores

Would you like me to help you create the missing assets or proceed with any specific step?
