#!/bin/bash

# ExoMobile Deployment Script
# This script helps deploy ExoMobile to various platforms

set -e

echo "🚀 ExoMobile Deployment Script"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "app.json" ]; then
    print_error "app.json not found. Please run this script from the project root."
    exit 1
fi

# Check if required tools are installed
check_tools() {
    print_status "Checking required tools..."
    
    if ! command -v npx &> /dev/null; then
        print_error "npx not found. Please install Node.js"
        exit 1
    fi
    
    if ! command -v eas &> /dev/null; then
        print_warning "EAS CLI not found. Installing..."
        npm install -g eas-cli
    fi
    
    print_success "All required tools are available"
}

# Function to start development server
start_dev() {
    print_status "Starting development server..."
    npx expo start
}

# Function to publish to Expo Go
publish_expo() {
    print_status "Publishing to Expo Go..."
    npx expo publish
    print_success "Published to Expo Go successfully!"
}

# Function to build for production
build_production() {
    local platform=$1
    
    print_status "Building for $platform (production)..."
    
    case $platform in
        "ios")
            eas build --platform ios --profile production
            ;;
        "android")
            eas build --platform android --profile production
            ;;
        "all")
            eas build --platform all --profile production
            ;;
        *)
            print_error "Invalid platform. Use: ios, android, or all"
            exit 1
            ;;
    esac
    
    print_success "Build completed for $platform"
}

# Function to submit to app stores
submit_stores() {
    local platform=$1
    
    print_status "Submitting to $platform store..."
    
    case $platform in
        "ios")
            print_warning "Make sure you have configured your Apple Developer account in eas.json"
            eas submit --platform ios --profile production
            ;;
        "android")
            print_warning "Make sure you have configured your Google Play service account in eas.json"
            eas submit --platform android --profile production
            ;;
        *)
            print_error "Invalid platform. Use: ios or android"
            exit 1
            ;;
    esac
    
    print_success "Submission completed for $platform"
}

# Main menu
show_menu() {
    echo ""
    echo "What would you like to do?"
    echo "1) Start development server (Expo Go)"
    echo "2) Publish to Expo Go"
    echo "3) Build for iOS (production)"
    echo "4) Build for Android (production)"
    echo "5) Build for both platforms (production)"
    echo "6) Submit to iOS App Store"
    echo "7) Submit to Google Play Store"
    echo "8) Check EAS build status"
    echo "9) Exit"
    echo ""
    read -p "Enter your choice (1-9): " choice
    
    case $choice in
        1)
            start_dev
            ;;
        2)
            publish_expo
            ;;
        3)
            build_production "ios"
            ;;
        4)
            build_production "android"
            ;;
        5)
            build_production "all"
            ;;
        6)
            submit_stores "ios"
            ;;
        7)
            submit_stores "android"
            ;;
        8)
            print_status "Checking EAS build status..."
            eas build:list
            ;;
        9)
            print_success "Goodbye!"
            exit 0
            ;;
        *)
            print_error "Invalid choice. Please try again."
            show_menu
            ;;
    esac
}

# Main execution
main() {
    check_tools
    
    # Check if user is logged in to Expo
    if ! npx expo whoami &> /dev/null; then
        print_warning "You are not logged in to Expo. Please log in first:"
        npx expo login
    fi
    
    print_success "Logged in as: $(npx expo whoami)"
    
    show_menu
}

# Run main function
main
