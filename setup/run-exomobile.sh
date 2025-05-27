#!/bin/bash
# run-exomobile.sh - Master script to run all ExoMobile setup and configuration

set -e  # Exit on error

echo "================== ExoMobile Setup =================="
echo "This script will set up and configure the ExoMobile app"
echo "======================================================"
echo

# Make scripts executable
chmod +x scripts/setup_project.sh
chmod +x scripts/create-home-screen.sh
chmod +x scripts/configure-odoo.sh
chmod +x scripts/generate-model.sh
chmod +x scripts/templates/*.sh

# Run setup script
echo "Setting up project structure..."
bash scripts/setup_project.sh

# Configure Odoo connection
echo 
echo "Configuring Odoo connection..."
bash scripts/configure-odoo.sh --url "http://localhost:8018" --db "OCR" --username "admin" --password "admin"

# Create home screen
echo
echo "Creating home screen..."
bash scripts/create-home-screen.sh

# Generate partner model
echo
echo "Generating partner model..."
bash scripts/generate-model.sh --name "partner" --label "Partner" --odoo-model "res.partner"

# Generate product model
echo
echo "Generating product model..."
bash scripts/generate-model.sh --name "product" --label "Product" --odoo-model "product.product"

echo
echo "ExoMobile setup complete!"
echo "You can now run 'npm start' to start the app"
echo "To generate more models, use: scripts/generate-model.sh --name MODEL_NAME --odoo-model ODOO_MODEL"
