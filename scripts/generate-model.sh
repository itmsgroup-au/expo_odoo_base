#!/bin/bash
# generate-model.sh - Script to generate code for an Odoo model

set -e  # Exit on error

# Default values
MODEL_NAME=""
MODEL_LABEL=""
ODOO_MODEL=""
SERVER_URL="http://localhost:8018"
DATABASE="OCR"
USERNAME="admin"
PASSWORD="admin"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --name)
      MODEL_NAME="$2"
      shift 2
      ;;
    --label)
      MODEL_LABEL="$2"
      shift 2
      ;;
    --odoo-model)
      ODOO_MODEL="$2"
      shift 2
      ;;
    --url)
      SERVER_URL="$2"
      shift 2
      ;;
    --db)
      DATABASE="$2"
      shift 2
      ;;
    --username)
      USERNAME="$2"
      shift 2
      ;;
    --password)
      PASSWORD="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Validate required parameters
if [ -z "$MODEL_NAME" ]; then
  echo "Error: Model name is required (--name)"
  exit 1
fi

if [ -z "$ODOO_MODEL" ]; then
  echo "Error: Odoo model is required (--odoo-model)"
  exit 1
fi

# Set default label if not provided
if [ -z "$MODEL_LABEL" ]; then
  # Convert snake_case to Title Case with spaces
  MODEL_LABEL=$(echo "$MODEL_NAME" | sed 's/_/ /g' | sed 's/\b\(.\)/\u\1/g')
fi

echo "Generating code for model:"
echo "  Name: $MODEL_NAME"
echo "  Label: $MODEL_LABEL"
echo "  Odoo Model: $ODOO_MODEL"
echo "  Server: $SERVER_URL"

# Create model API file
MODELS_DIR="src/api/models"
mkdir -p "$MODELS_DIR"

# Use separate scripts for each component
SCRIPTS_DIR="scripts/templates"
mkdir -p "$SCRIPTS_DIR"

# Generate API file
source "$SCRIPTS_DIR/generate-api.sh"

# Create feature directories
FEATURE_DIR="src/features/$MODEL_NAME"
mkdir -p "$FEATURE_DIR/screens"
mkdir -p "$FEATURE_DIR/components"
mkdir -p "$FEATURE_DIR/__tests__"

# Generate screens
source "$SCRIPTS_DIR/generate-list-screen.sh"
source "$SCRIPTS_DIR/generate-detail-screen.sh"
source "$SCRIPTS_DIR/generate-form-screen.sh"

# Generate navigator
source "$SCRIPTS_DIR/generate-navigator.sh"

# Generate index file 
echo "// Export main components from the ${MODEL_NAME} feature
import ${MODEL_NAME^}Navigator from './${MODEL_NAME^}Navigator';
import ${MODEL_NAME^}ListScreen from './screens/${MODEL_NAME^}ListScreen';
import ${MODEL_NAME^}DetailScreen from './screens/${MODEL_NAME^}DetailScreen';
import ${MODEL_NAME^}FormScreen from './screens/${MODEL_NAME^}FormScreen';

export {
  ${MODEL_NAME^}Navigator,
  ${MODEL_NAME^}ListScreen,
  ${MODEL_NAME^}DetailScreen,
  ${MODEL_NAME^}FormScreen,
};

export default ${MODEL_NAME^}Navigator;
" > "$FEATURE_DIR/index.js"

echo "Created index file at $FEATURE_DIR/index.js"

# Update navigation configuration - add to main AppNavigator.tsx
NAV_FILE="src/navigation/AppNavigator.tsx"
if [ -f "$NAV_FILE" ]; then
  echo "Updating navigation configuration in $NAV_FILE"
  
  # Check if import already exists
  if ! grep -q "import ${MODEL_NAME^}Navigator" "$NAV_FILE"; then
    # Add import statement
    sed -i '' "s/\/\/ Import screens/\/\/ Import screens\nimport ${MODEL_NAME^}Navigator from '..\/features\/${MODEL_NAME}\/${MODEL_NAME^}Navigator';/" "$NAV_FILE"
    
    # Add to stack navigator or tab navigator if found
    if grep -q "<Stack.Screen name=\"Main\"" "$NAV_FILE"; then
      # Add to drawer or stack
      sed -i '' "s/<Stack.Screen name=\"Main\" component={BottomTabNavigator} \/>/<Stack.Screen name=\"Main\" component={BottomTabNavigator} \/>\n        <Stack.Screen name=\"${MODEL_NAME^}\" component={${MODEL_NAME^}Navigator} \/>/" "$NAV_FILE"
    elif grep -q "<Tab.Navigator" "$NAV_FILE"; then
      # Add to tab navigator 
      sed -i '' "s/<\/Tab.Navigator>/  <Tab.Screen name=\"${MODEL_NAME^}\" component={${MODEL_NAME^}Navigator} \/>\n    <\/Tab.Navigator>/" "$NAV_FILE"
    fi
  fi
fi

echo "Model generation completed. Created files for '${MODEL_NAME}' ($MODEL_LABEL)."
echo "To integrate this model in your app, please add it to your navigation if it wasn't automatically added."
