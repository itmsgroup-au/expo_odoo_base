#!/usr/bin/env python3
"""
MUK REST API Swagger Generator

This script generates a Swagger/OpenAPI specification file for the MUK REST API.
It queries the MUK REST API to discover endpoints and schemas, and generates a
swagger.json file that can be used with Swagger UI or other OpenAPI tools.

Usage:
  python generate_swagger.py --url http://your-odoo-server --db your_database --username admin --password password

Required packages:
  - requests
  - pyyaml
"""

import argparse
import json
import logging
import os
import re
import sys
from collections import defaultdict

import requests
import yaml

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class MukRestSwaggerGenerator:
    """
    Generator for Swagger/OpenAPI specification for MUK REST API
    """
    
    def __init__(self, base_url, database=None, username=None, password=None):
        """
        Initialize the generator
        
        Args:
            base_url: Base URL of the Odoo server (e.g., http://localhost:8069)
            database: Optional database name
            username: Optional username for authentication
            password: Optional password for authentication
        """
        self.base_url = base_url.rstrip('/')
        self.database = database
        self.username = username
        self.password = password
        self.api_url = f"{self.base_url}/api/v2"
        self.session = requests.Session()
        
        # Prepare auth if provided
        if username and password:
            self.session.auth = (username, password)
        
        # Add database parameter if provided
        self.params = {}
        if database:
            self.params['db'] = database
            
        # OpenAPI spec template
        self.spec = {
            "openapi": "3.0.0",
            "info": {
                "title": "MUK REST API",
                "description": "REST API for Odoo provided by MUK IT",
                "version": "2.0.0",
                "contact": {
                    "name": "MUK IT",
                    "url": "https://www.mukit.at"
                },
                "license": {
                    "name": "MUK Proprietary License v1.0"
                }
            },
            "servers": [
                {
                    "url": self.api_url,
                    "description": "Odoo Server"
                }
            ],
            "tags": [],
            "paths": {},
            "components": {
                "schemas": {},
                "securitySchemes": {
                    "basicAuth": {
                        "type": "http",
                        "scheme": "basic",
                        "description": "Basic authentication with username and password or access key"
                    },
                    "oauth2": {
                        "type": "oauth2",
                        "flows": {
                            "password": {
                                "tokenUrl": f"{self.api_url}/authentication/oauth2/token",
                                "scopes": {}
                            },
                            "clientCredentials": {
                                "tokenUrl": f"{self.api_url}/authentication/oauth2/token",
                                "scopes": {}
                            },
                            "authorizationCode": {
                                "authorizationUrl": f"{self.api_url}/authentication/oauth2/authorize",
                                "tokenUrl": f"{self.api_url}/authentication/oauth2/token",
                                "scopes": {}
                            },
                            "implicit": {
                                "authorizationUrl": f"{self.api_url}/authentication/oauth2/authorize",
                                "scopes": {}
                            }
                        }
                    }
                }
            },
            "security": [
                {"basicAuth": []},
                {"oauth2": []}
            ]
        }
        
        # Known schemas from the documentation
        self.predefined_schemas = {
            "Domain": {
                "type": "array",
                "description": "A domain item consists either of a single operator or a tuple.",
                "items": {
                    "oneOf": [
                        {"type": "string"},
                        {
                            "$ref": "#/components/schemas/DomainTuple"
                        }
                    ]
                }
            },
            "DomainTuple": {
                "type": "array",
                "description": "A domain tuple consists of a field name, an operator and a value.",
                "minItems": 3,
                "maxItems": 3,
                "items": {
                    "oneOf": [
                        {"type": "string"},
                        {"type": "boolean"},
                        {"type": "number"},
                        {"type": "array"}
                    ]
                }
            },
            "RecordIDs": {
                "type": "array",
                "description": "A list of record IDs.",
                "items": {
                    "type": "integer"
                }
            },
            "RecordFields": {
                "type": "array",
                "description": "A list of field names.",
                "items": {
                    "type": "string"
                }
            },
            "RecordValues": {
                "type": "object",
                "description": "A map of field names and their corresponding values."
            },
            "RecordData": {
                "type": "object",
                "description": "A map of field names and their corresponding values.",
                "properties": {
                    "id": {
                        "type": "integer"
                    }
                }
            },
            "RecordTuple": {
                "type": "array",
                "description": "A record tuple consists of the id and the display name of the record.",
                "minItems": 2,
                "maxItems": 2,
                "items": {
                    "oneOf": [
                        {"type": "integer"},
                        {"type": "string"}
                    ]
                }
            },
            "RecordTuples": {
                "type": "array",
                "description": "A list of record tuples.",
                "items": {
                    "$ref": "#/components/schemas/RecordTuple"
                }
            },
            "UserContext": {
                "type": "object",
                "description": "The current user context.",
                "properties": {
                    "lang": {
                        "type": "string"
                    },
                    "tz": {
                        "type": "string"
                    },
                    "uid": {
                        "type": "integer"
                    }
                }
            }
        }
        
        # Add predefined schemas to the spec
        self.spec["components"]["schemas"].update(self.predefined_schemas)
        
        # Tag categories
        self.tag_categories = [
            "Common", "Database", "File", "Model", "Report", "Security", 
            "Server", "System", "Authentication"
        ]
        
        # Initialize tags
        for category in self.tag_categories:
            self.spec["tags"].append({
                "name": category,
                "description": f"{category} operations"
            })
            
    def generate(self):
        """
        Generate the Swagger/OpenAPI specification
        
        Returns:
            dict: The generated specification
        """
        logger.info("Generating Swagger specification...")
        
        # Check API availability
        self.check_api_availability()
        
        # Generate paths
        self.generate_paths()
        
        # Return the spec
        return self.spec
    
    def check_api_availability(self):
        """
        Check if the API is available and get version information
        """
        try:
            response = self.session.get(f"{self.api_url}/", params=self.params)
            response.raise_for_status()
            logger.info(f"API is available, version: {response.json()}")
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to connect to API: {e}")
            sys.exit(1)
            
    def generate_paths(self):
        """
        Generate the paths section of the spec
        """
        # Define API endpoint patterns
        endpoint_patterns = [
            # Common
            {"path": "/user", "method": "get", "tag": "Common", "summary": "User", "description": "Returns the current user."},
            {"path": "/userinfo", "method": "get", "tag": "Common", "summary": "User Information", "description": "Returns detailed information about the current user."},
            {"path": "/session", "method": "get", "tag": "Common", "summary": "Session Information", "description": "Returns information about the current session."},
            {"path": "/company", "method": "get", "tag": "Common", "summary": "Company Information", "description": "Returns information about the current company."},
            {"path": "/database", "method": "get", "tag": "Common", "summary": "Database", "description": "Returns information about the current database."},
            {"path": "/modules", "method": "get", "tag": "Common", "summary": "Modules", "description": "Returns information about installed modules."},
            {"path": "/xmlid", "method": "get", "tag": "Common", "summary": "XML ID", "description": "Returns information about XML IDs."},
            {"path": "/xmlid/{xmlid}", "method": "get", "tag": "Common", "summary": "XML ID", "description": "Returns information about a specific XML ID.", "parameters": [
                {"name": "xmlid", "in": "path", "required": True, "schema": {"type": "string"}}
            ]},
            
            # Database
            {"path": "/database/list", "method": "get", "tag": "Database", "summary": "Database List", "description": "Lists all available databases."},
            {"path": "/database/size", "method": "get", "tag": "Database", "summary": "Database Size", "description": "Returns the size of the current database."},
            {"path": "/database/size/{database_name}", "method": "get", "tag": "Database", "summary": "Database Size", "description": "Returns the size of a specific database.", "parameters": [
                {"name": "database_name", "in": "path", "required": True, "schema": {"type": "string"}}
            ]},
            {"path": "/database/backup", "method": "post", "tag": "Database", "summary": "Backup Database", "description": "Creates a backup of a database."},
            {"path": "/database/restore", "method": "post", "tag": "Database", "summary": "Restore Database", "description": "Restores a database from a backup."},
            {"path": "/database/create", "method": "post", "tag": "Database", "summary": "Create Database", "description": "Creates a new database."},
            {"path": "/database/drop", "method": "post", "tag": "Database", "summary": "Drop Database", "description": "Drops a database."},
            {"path": "/database/duplicate", "method": "post", "tag": "Database", "summary": "Duplicate Database", "description": "Duplicates a database."},
            
            # File operations
            {"path": "/download/{model}/{id}/{field}", "method": "get", "tag": "File", "summary": "File Download", "description": "Downloads a file from a record.", "parameters": [
                {"name": "model", "in": "path", "required": True, "schema": {"type": "string"}},
                {"name": "id", "in": "path", "required": True, "schema": {"type": "integer"}},
                {"name": "field", "in": "path", "required": True, "schema": {"type": "string"}}
            ]},
            {"path": "/image/{model}/{id}/{field}", "method": "get", "tag": "File", "summary": "Image Download", "description": "Downloads an image from a record.", "parameters": [
                {"name": "model", "in": "path", "required": True, "schema": {"type": "string"}},
                {"name": "id", "in": "path", "required": True, "schema": {"type": "integer"}},
                {"name": "field", "in": "path", "required": True, "schema": {"type": "string"}}
            ]},
            {"path": "/upload/{model}/{id}/{field}", "method": "post", "tag": "File", "summary": "File Upload", "description": "Uploads a file to a record.", "parameters": [
                {"name": "model", "in": "path", "required": True, "schema": {"type": "string"}},
                {"name": "id", "in": "path", "required": True, "schema": {"type": "integer"}},
                {"name": "field", "in": "path", "required": True, "schema": {"type": "string"}}
            ]},
            
            # Model operations
            {"path": "/search/{model}", "method": "get", "tag": "Model", "summary": "Search", "description": "Searches for records.", "parameters": [
                {"name": "model", "in": "path", "required": True, "schema": {"type": "string"}}
            ]},
            {"path": "/search_read/{model}", "method": "get", "tag": "Model", "summary": "Search Read", "description": "Searches for records and returns their data.", "parameters": [
                {"name": "model", "in": "path", "required": True, "schema": {"type": "string"}}
            ]},
            {"path": "/read/{model}", "method": "get", "tag": "Model", "summary": "Read", "description": "Reads record data.", "parameters": [
                {"name": "model", "in": "path", "required": True, "schema": {"type": "string"}}
            ]},
            {"path": "/read_group/{model}", "method": "get", "tag": "Model", "summary": "Read Group", "description": "Reads grouped records.", "parameters": [
                {"name": "model", "in": "path", "required": True, "schema": {"type": "string"}}
            ]},
            {"path": "/create/{model}", "method": "post", "tag": "Model", "summary": "Create", "description": "Creates a new record.", "parameters": [
                {"name": "model", "in": "path", "required": True, "schema": {"type": "string"}}
            ]},
            {"path": "/write/{model}", "method": "put", "tag": "Model", "summary": "Write", "description": "Updates a record.", "parameters": [
                {"name": "model", "in": "path", "required": True, "schema": {"type": "string"}}
            ]},
            {"path": "/unlink/{model}", "method": "delete", "tag": "Model", "summary": "Delete", "description": "Deletes records.", "parameters": [
                {"name": "model", "in": "path", "required": True, "schema": {"type": "string"}}
            ]},
            {"path": "/call/{model}/{method}", "method": "post", "tag": "Model", "summary": "Call", "description": "Calls a model method.", "parameters": [
                {"name": "model", "in": "path", "required": True, "schema": {"type": "string"}},
                {"name": "method", "in": "path", "required": True, "schema": {"type": "string"}}
            ]},
            
            # Model inspection
            {"path": "/field_names/{model}", "method": "get", "tag": "System", "summary": "Field Names", "description": "Returns the field names of a model.", "parameters": [
                {"name": "model", "in": "path", "required": True, "schema": {"type": "string"}}
            ]},
            {"path": "/fields/{model}", "method": "get", "tag": "System", "summary": "Field Attributes", "description": "Returns the field attributes of a model.", "parameters": [
                {"name": "model", "in": "path", "required": True, "schema": {"type": "string"}}
            ]},
            {"path": "/model_names", "method": "get", "tag": "System", "summary": "Model Names", "description": "Returns all model names."},
            {"path": "/models", "method": "get", "tag": "System", "summary": "Models", "description": "Returns information about all models."},
            
            # Reports
            {"path": "/reports", "method": "get", "tag": "Report", "summary": "Reports List", "description": "Lists all available reports."},
            {"path": "/report/{report}", "method": "get", "tag": "Report", "summary": "Report Download", "description": "Generates and downloads a report.", "parameters": [
                {"name": "report", "in": "path", "required": True, "schema": {"type": "string"}}
            ]},
            {"path": "/report/{report}/{type}", "method": "get", "tag": "Report", "summary": "Report Download", "description": "Generates and downloads a report in a specific format.", "parameters": [
                {"name": "report", "in": "path", "required": True, "schema": {"type": "string"}},
                {"name": "type", "in": "path", "required": True, "schema": {"type": "string"}}
            ]},
            
            # Security
            {"path": "/access/{model}", "method": "get", "tag": "Security", "summary": "Access", "description": "Checks access to a model.", "parameters": [
                {"name": "model", "in": "path", "required": True, "schema": {"type": "string"}}
            ]},
            {"path": "/access/{model}/{operation}", "method": "get", "tag": "Security", "summary": "Access", "description": "Checks access to a model operation.", "parameters": [
                {"name": "model", "in": "path", "required": True, "schema": {"type": "string"}},
                {"name": "operation", "in": "path", "required": True, "schema": {"type": "string"}}
            ]},
            {"path": "/access/fields/{model}", "method": "get", "tag": "Security", "summary": "Access Fields", "description": "Checks field access for a model.", "parameters": [
                {"name": "model", "in": "path", "required": True, "schema": {"type": "string"}}
            ]},
            {"path": "/access/rights/{model}", "method": "get", "tag": "Security", "summary": "Access Rights", "description": "Gets access rights for a model.", "parameters": [
                {"name": "model", "in": "path", "required": True, "schema": {"type": "string"}}
            ]},
            {"path": "/groups", "method": "get", "tag": "Security", "summary": "Access Groups", "description": "Returns information about access groups."},
            {"path": "/has_group", "method": "get", "tag": "Security", "summary": "Access Group", "description": "Checks if the current user has a specific group.", "parameters": [
                {"name": "group", "in": "query", "required": True, "schema": {"type": "string"}}
            ]},
            
            # Server info
            {"path": "/", "method": "get", "tag": "Server", "summary": "Version Information", "description": "Returns version information about the API."},
            {"path": "/countries", "method": "get", "tag": "Server", "summary": "Countries", "description": "Returns a list of countries."},
            {"path": "/languages", "method": "get", "tag": "Server", "summary": "Languages", "description": "Returns a list of languages."}
        ]
        
        # Add the paths to the spec
        for endpoint in endpoint_patterns:
            path = endpoint["path"]
            method = endpoint["method"]
            tag = endpoint["tag"]
            summary = endpoint["summary"]
            description = endpoint.get("description", "")
            parameters = endpoint.get("parameters", [])
            
            # Add path if it doesn't exist
            if path not in self.spec["paths"]:
                self.spec["paths"][path] = {}
                
            # Add method to path
            self.spec["paths"][path][method] = {
                "tags": [tag],
                "summary": summary,
                "description": description,
                "parameters": parameters,
                "responses": {
                    "200": {
                        "description": "Successful operation"
                    },
                    "400": {
                        "description": "Bad request"
                    },
                    "401": {
                        "description": "Unauthorized"
                    },
                    "500": {
                        "description": "Server error"
                    }
                },
                "security": [
                    {"basicAuth": []},
                    {"oauth2": []}
                ]
            }
            
        # Discover models
        self.discover_models()
        
    def discover_models(self):
        """
        Discover available models and their fields
        """
        try:
            logger.info("Discovering models...")
            response = self.session.get(f"{self.api_url}/model_names", params=self.params)
            response.raise_for_status()
            models = response.json()
            
            # Add model schemas
            for model_name in models[:3000]:  # Limit to 30 models to avoid too large spec
                try:
                    logger.info(f"Getting fields for model {model_name}...")
                    fields_response = self.session.get(
                        f"{self.api_url}/fields/{model_name}", 
                        params=self.params
                    )
                    fields_response.raise_for_status()
                    fields = fields_response.json()
                    
                    # Create model schema
                    schema_name = model_name.replace(".", "_")
                    self.spec["components"]["schemas"][schema_name] = {
                        "type": "object",
                        "description": f"{model_name} record",
                        "properties": {
                            "id": {
                                "type": "integer",
                                "description": "Record ID"
                            }
                        }
                    }
                    
                    # Add field properties
                    for field_name, field_info in fields.items():
                        field_type = field_info.get("type", "char")
                        field_desc = {
                            "description": field_info.get("string", field_name)
                        }
                        
                        # Map Odoo field types to OpenAPI types
                        if field_type in ["char", "text", "html", "selection"]:
                            field_desc["type"] = "string"
                        elif field_type in ["integer", "float", "monetary"]:
                            field_desc["type"] = "number"
                        elif field_type == "boolean":
                            field_desc["type"] = "boolean"
                        elif field_type == "date":
                            field_desc["type"] = "string"
                            field_desc["format"] = "date"
                        elif field_type == "datetime":
                            field_desc["type"] = "string"
                            field_desc["format"] = "date-time"
                        elif field_type == "binary":
                            field_desc["type"] = "string"
                            field_desc["format"] = "binary"
                        elif field_type in ["many2one", "reference"]:
                            field_desc["oneOf"] = [
                                {"type": "integer"},
                                {"$ref": "#/components/schemas/RecordTuple"}
                            ]
                        elif field_type in ["one2many", "many2many"]:
                            field_desc["type"] = "array"
                            field_desc["items"] = {
                                "oneOf": [
                                    {"type": "integer"},
                                    {"$ref": "#/components/schemas/RecordTuple"}
                                ]
                            }
                        else:
                            field_desc["type"] = "string"
                            
                        self.spec["components"]["schemas"][schema_name]["properties"][field_name] = field_desc
                        
                except Exception as e:
                    logger.warning(f"Failed to get fields for model {model_name}: {e}")
                    continue
                    
        except Exception as e:
            logger.error(f"Failed to discover models: {e}")
    
    def save_to_file(self, filename="swagger.json"):
        """
        Save the specification to a file
        
        Args:
            filename: Output filename
        """
        with open(filename, 'w') as f:
            json.dump(self.spec, f, indent=2)
        logger.info(f"Saved specification to {filename}")
            
    def save_yaml_to_file(self, filename="swagger.yaml"):
        """
        Save the specification to a YAML file
        
        Args:
            filename: Output filename
        """
        with open(filename, 'w') as f:
            yaml.dump(self.spec, f, sort_keys=False)
        logger.info(f"Saved YAML specification to {filename}")
            
def main():
    """
    Main function
    """
    parser = argparse.ArgumentParser(description="Generate Swagger/OpenAPI specification for MUK REST API")
    parser.add_argument("--url", required=True, help="Base URL of the Odoo server (e.g., http://localhost:8069)")
    parser.add_argument("--db", help="Database name")
    parser.add_argument("--username", help="Username for authentication")
    parser.add_argument("--password", help="Password for authentication")
    parser.add_argument("--output", default="swagger.json", help="Output filename")
    parser.add_argument("--yaml", action="store_true", help="Output as YAML instead of JSON")
    args = parser.parse_args()
    
    # Create generator
    generator = MukRestSwaggerGenerator(
        base_url=args.url,
        database=args.db,
        username=args.username,
        password=args.password
    )
    
    # Generate specification
    generator.generate()
    
    # Save to file
    if args.yaml:
        generator.save_yaml_to_file(args.output)
    else:
        generator.save_to_file(args.output)
    
if __name__ == "__main__":
    main()