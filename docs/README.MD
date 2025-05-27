# ExoMobile: Odoo Mobile App Automation Project

ExoMobile is a powerful toolkit designed to automate the creation of mobile applications that integrate with Odoo ERP systems. The project analyzes Odoo server data models and automatically generates code for React Native mobile applications, significantly reducing development time for custom Odoo mobile clients.

## Project Overview

ExoMobile streamlines the development of domain-specific mobile apps for customized Odoo installations. Whether your organization has renamed standard Odoo modules or created entirely custom modules, ExoMobile can generate a tailored mobile experience that accurately reflects your Odoo instance.

## Core Features

- **Odoo Model Analysis:** Automatically extract and analyze Odoo model structures, relationships, and field types
- **Complete App Generation:** Create production-ready React Native applications with screens, API integration, and offline support
- **Template-Based System:** Use Jinja2 templates for consistent, customizable code generation
- **RESTful API Integration:** Pre-built services for seamless interaction with Odoo's REST API
- **Offline-First Design:** Built-in mechanisms for offline operation, data caching, and synchronization
- **LLM Integration:** Generate prompts for Large Language Models to assist with further app customization
- **Data Visualization:** Generate model relationship diagrams for better understanding of data structures

## Project Components

### Analysis Tools
- `odoo-model-explorer.py`: Main script for connecting to Odoo, exploring models, and generating code
- `odoo_diagram_generator.py`: Generate visual diagrams of Odoo models and relationships
- `odoo-api-swagger-generator.py`: Create Swagger/OpenAPI documentation for Odoo REST API endpoints

### Code Generation
- `field_selector.py`: Interactive UI for selecting which fields to include in the mobile app
- `generator.py`: Core template rendering engine using Jinja2 templates
- `mock_generator.py`: Create mock data for testing generated apps
- Template files (`.j2`) for React Native components, services, and screens

### User Interface
- `app.py`: Flask web application providing a user-friendly interface for the tools
- Web templates for interacting with the model explorer and code generation

## Generated Mobile App Architecture

The output is a complete React Native application with:

### Core Architecture
- Navigation structure using React Navigation
- API services for seamless data access
- Authentication with multiple methods (Basic, OAuth2)
- Robust offline data handling and synchronization
- State management with Context API
- Error handling and recovery

### Module-Based Design
- Each Odoo model gets its own dedicated module (e.g., hr, company, product, users)
- Consistent pattern of List, Form, and Detail screens for each entity
- Reusable components customized for Odoo field types

### Advanced Features
- Offline mode with intelligent request queuing
- Sophisticated caching system with TTL and manual invalidation
- Document upload/download capabilities
- Push notification integration
- Performance optimizations for large datasets

## Usage Examples

### Using the Web Interface
```
python app.py
```
Then visit http://localhost:5000 in your browser.

### Interactive Model Exploration
```
python odoo-model-explorer.py --url http://localhost:8069 --db your_database --username admin --password password --interactive
```

### Generate a Complete Mobile App
```
python odoo-model-explorer.py --url http://localhost:8069 --db your_database --username admin --password password --select-models "hr.employee,hr.attendance,account.analytic.line" --export-mobile-llm mobile_app.md --app-description "A mobile app for time and attendance tracking" --framework react-native
```

### Generate API Documentation
```
python odoo-model-explorer.py --url http://localhost:8069 --db your_database --username admin --password password --select-models "hr.employee,hr.attendance" --api-endpoints api_docs.md
```

### Generate Model Relationship Diagram
```
python odoo_diagram_generator.py --url http://localhost:8069 --db your_database --username admin --password password --model res.partner --diagram --depth 2 --output diagram.mmd --diagram-format mermaid
```

## Industry-Specific Applications

ExoMobile is particularly valuable for creating domain-specific mobile applications for Odoo instances that have been customized for particular industries:

- **Healthcare:** When "Contacts" have been renamed to "Patients"
- **Construction:** When custom modules track builders, projects, and materials
- **Education:** When tracking students, courses, and enrollment
- **Manufacturing:** For custom production workflows and quality control

The generated applications maintain the custom terminology and business logic of your specific Odoo implementation.

## Technical Requirements

### For Code Generation Tools
- Python 3.7+
- Flask
- Requests
- Jinja2
- Tabulate

### For Generated Applications
- Node.js 14+
- React Native environment
- Expo CLI (recommended)

## Getting Started

1. Clone this repository
2. Install requirements: `pip install -r requirements.txt` (requirements file to be added)
3. Run the web interface or use the command-line tools as shown in the examples above
4. Generated mobile app code will be placed in the output directory

## Documentation

- See `odoo-api-guide.md` for detailed information on using the Odoo REST API
- Sample models and generated code available in the `/demo` directory

## Future Development

See `DEVELOPMENT.md` for information on the project roadmap and contribution guidelines.

## License
[Your license here]
