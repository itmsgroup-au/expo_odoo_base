#!/usr/bin/env python3
"""
Enhanced Odoo Model Explorer

This tool connects to the MUK REST API and explores Odoo models and their fields.
It allows you to select multiple models, analyze their relationships, export 
the data in a format suitable for LLM-assisted app development, and view sample
records with expanded relation fields.

Usage:
  python odoo_model_explorer.py --url http://your-odoo-server --db your_database --username admin --password password
"""

import argparse
import json
import logging
import os
import sys
import time
import curses
from collections import defaultdict
from typing import Dict, List, Any, Optional, Tuple, Set

import requests
from tabulate import tabulate

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class OdooModelExplorer:
    """
    Explores Odoo models and fields via MUK REST API
    """
    
    def __init__(self, base_url, database=None, username=None, password=None):
        """
        Initialize the explorer
        
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
        
        # Cache for models and fields
        self.models_cache = None
        self.fields_cache = {}
        self.models_info_cache = None
        self.record_cache = {}
        
        # Selected models for export
        self.selected_models = set()
        self.selected_fields = defaultdict(set)
        
        # Cache file paths
        self.cache_dir = os.path.join(os.path.expanduser("~"), ".odoo_explorer")
        os.makedirs(self.cache_dir, exist_ok=True)
        
        self.models_cache_file = os.path.join(self.cache_dir, "models.json")
        self.models_info_cache_file = os.path.join(self.cache_dir, "models_info.json")
        self.fields_cache_dir = os.path.join(self.cache_dir, "fields")
        os.makedirs(self.fields_cache_dir, exist_ok=True)
        
        # Sample record cache directory
        self.sample_record_cache_dir = os.path.join(self.cache_dir, "sample_records")
        os.makedirs(self.sample_record_cache_dir, exist_ok=True)
        
    def check_api_availability(self):
        """
        Check if the API is available
        
        Returns:
            bool: True if API is available, False otherwise
        """
        try:
            response = self.session.get(f"{self.api_url}/", params=self.params)
            response.raise_for_status()
            logger.info(f"API is available, version: {response.json()}")
            return True
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to connect to API: {e}")
            return False
            
    def get_models(self, use_cache=True, refresh_cache=False):
        """
        Get all model names from the API
        
        Args:
            use_cache: Whether to use cached data if available
            refresh_cache: Whether to refresh the cache
            
        Returns:
            list: List of model names
        """
        # Check if cache should be used and is available
        if use_cache and not refresh_cache and os.path.exists(self.models_cache_file):
            with open(self.models_cache_file, 'r') as f:
                self.models_cache = json.load(f)
                logger.info(f"Loaded {len(self.models_cache)} models from cache")
                return self.models_cache
                
        # Get models from API
        try:
            response = self.session.get(f"{self.api_url}/model_names", params=self.params)
            response.raise_for_status()
            self.models_cache = response.json()
            
            # Save to cache
            with open(self.models_cache_file, 'w') as f:
                json.dump(self.models_cache, f)
                
            logger.info(f"Fetched {len(self.models_cache)} models from API")
            return self.models_cache
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to get models: {e}")
            return []
            
    def get_models_info(self, use_cache=True, refresh_cache=False):
        """
        Get detailed model information
        
        Args:
            use_cache: Whether to use cached data if available
            refresh_cache: Whether to refresh the cache
            
        Returns:
            list: List of model information dictionaries
        """
        # Check if cache should be used and is available
        if use_cache and not refresh_cache and os.path.exists(self.models_info_cache_file):
            with open(self.models_info_cache_file, 'r') as f:
                self.models_info_cache = json.load(f)
                logger.info(f"Loaded {len(self.models_info_cache)} model details from cache")
                return self.models_info_cache
                
        # Get model info from API
        try:
            response = self.session.get(f"{self.api_url}/models", params=self.params)
            response.raise_for_status()
            self.models_info_cache = response.json()
            
            # Save to cache
            with open(self.models_info_cache_file, 'w') as f:
                json.dump(self.models_info_cache, f)
                
            logger.info(f"Fetched {len(self.models_info_cache)} model details from API")
            return self.models_info_cache
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to get model details: {e}")
            return []
            
    def get_fields(self, model_name, use_cache=True, refresh_cache=False):
        """
        Get fields for a model
        
        Args:
            model_name: Name of the model
            use_cache: Whether to use cached data if available
            refresh_cache: Whether to refresh the cache
            
        Returns:
            dict: Dictionary of field information
        """
        # Check if already in memory cache
        if model_name in self.fields_cache:
            return self.fields_cache[model_name]
            
        # Generate cache file path
        cache_file = os.path.join(self.fields_cache_dir, f"{model_name.replace('.', '_')}.json")
        
        # Check if cache should be used and is available
        if use_cache and not refresh_cache and os.path.exists(cache_file):
            try:
                with open(cache_file, 'r') as f:
                    self.fields_cache[model_name] = json.load(f)
                    logger.info(f"Loaded fields for {model_name} from cache")
                    return self.fields_cache[model_name]
            except Exception as e:
                logger.warning(f"Failed to load fields cache for {model_name}: {e}")
                
        # Get fields from API
        try:
            response = self.session.get(f"{self.api_url}/fields/{model_name}", params=self.params)
            response.raise_for_status()
            self.fields_cache[model_name] = response.json()
            
            # Save to cache
            with open(cache_file, 'w') as f:
                json.dump(self.fields_cache[model_name], f)
                
            logger.info(f"Fetched fields for {model_name} from API")
            return self.fields_cache[model_name]
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to get fields for {model_name}: {e}")
            return {}
    
    def get_sample_record(self, model_name, expand_relations=True, max_depth=2, use_cache=True, refresh_cache=False):
        """
        Get a sample record from a model, optionally expanding related fields
        
        Args:
            model_name: Name of the model
            expand_relations: Whether to expand relation fields
            max_depth: Maximum depth of relations to expand
            use_cache: Whether to use cached data if available
            refresh_cache: Whether to refresh the cache
            
        Returns:
            dict: A sample record with expanded relation fields
        """
        # Generate cache file path
        cache_file = os.path.join(self.sample_record_cache_dir, f"{model_name.replace('.', '_')}_sample.json")
        
        # Check if cache should be used and is available
        if use_cache and not refresh_cache and os.path.exists(cache_file):
            try:
                with open(cache_file, 'r') as f:
                    sample_record = json.load(f)
                    logger.info(f"Loaded sample record for {model_name} from cache")
                    return sample_record
            except Exception as e:
                logger.warning(f"Failed to load sample record cache for {model_name}: {e}")
        
        # Get fields for the model
        fields = self.get_fields(model_name)
        if not fields:
            logger.error(f"Could not get fields for {model_name}")
            return {}
        
        # Get relation fields that need to be expanded
        relation_fields = []
        if expand_relations:
            relation_fields = [
                field_name for field_name, field_info in fields.items()
                if field_info.get("type") in ["many2one", "one2many", "many2many"]
            ]
            
        # Get a sample record
        try:
            # Request only one record
            response = self.session.post(
                f"{self.api_url}/search_read/{model_name}",
                params=self.params,
                json={
                    "domain": [],
                    "limit": 1,
                    "order": "id desc"  # Usually gets the most recent record
                }
            )
            response.raise_for_status()
            records = response.json()
            
            if not records:
                logger.warning(f"No records found for {model_name}")
                return {}
                
            sample_record = records[0]
            
            # Expand relation fields if requested
            if expand_relations and max_depth > 0:
                sample_record = self._expand_relation_fields(sample_record, model_name, relation_fields, max_depth)
            
            # Save to cache
            with open(cache_file, 'w') as f:
                json.dump(sample_record, f, indent=2)
                
            logger.info(f"Fetched sample record for {model_name}")
            return sample_record
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to get sample record for {model_name}: {e}")
            return {}
            
    def _expand_relation_fields(self, record, model_name, relation_fields, depth_remaining):
        """
        Expand relation fields in a record
        
        Args:
            record: The record to expand
            model_name: Name of the model
            relation_fields: List of relation fields to expand
            depth_remaining: Remaining depth for expansion
            
        Returns:
            dict: The record with expanded relation fields
        """
        if depth_remaining <= 0 or not relation_fields:
            return record
            
        fields = self.get_fields(model_name)
        
        for field_name in relation_fields:
            field_info = fields.get(field_name, {})
            field_type = field_info.get("type")
            relation = field_info.get("relation")
            
            if not relation:
                continue
                
            field_value = record.get(field_name)
            if not field_value:
                continue
                
            # Handle many2one fields (ID, Name)
            if field_type == "many2one":
                try:
                    # field_value is [id, display_name]
                    rel_id = field_value[0]
                    # Expand just the essential fields for many2one
                    rel_fields = self.get_fields(relation)
                    essential_fields = ['name', 'display_name']
                    # Add fields that are required
                    for rel_field_name, rel_field_info in rel_fields.items():
                        if rel_field_info.get("required", False):
                            essential_fields.append(rel_field_name)
                    
                    # Get related record with essential fields
                    response = self.session.post(
                        f"{self.api_url}/search_read/{relation}",
                        params=self.params,
                        json={
                            "domain": [["id", "=", rel_id]],
                            "fields": essential_fields,
                            "limit": 1
                        }
                    )
                    rel_records = response.json()
                    
                    if rel_records:
                        # Replace [id, name] with the actual record data
                        record[field_name + "_expanded"] = rel_records[0]
                except Exception as e:
                    logger.warning(f"Failed to expand many2one field {field_name}: {e}")
            
            # Handle one2many and many2many fields (list of IDs)
            elif field_type in ["one2many", "many2many"]:
                try:
                    # Limit to a few records for these fields to avoid too much data
                    rel_ids = field_value[:5]  # Limit to first 5 records
                    
                    if not rel_ids:
                        continue
                        
                    # Get related records
                    response = self.session.post(
                        f"{self.api_url}/search_read/{relation}",
                        params=self.params,
                        json={
                            "domain": [["id", "in", rel_ids]],
                            "limit": 5  # Limit to 5 records
                        }
                    )
                    rel_records = response.json()
                    
                    if rel_records:
                        # Replace IDs with the actual record data
                        record[field_name + "_expanded"] = rel_records
                except Exception as e:
                    logger.warning(f"Failed to expand *2many field {field_name}: {e}")
        
        return record

    def display_sample_record(self, model_name, max_depth=2):
        """
        Display a sample record from a model in a user-friendly format
        
        Args:
            model_name: Name of the model
            max_depth: Maximum depth of relations to expand
        """
        sample_record = self.get_sample_record(model_name, expand_relations=True, max_depth=max_depth)
        if not sample_record:
            print(f"No sample record found for {model_name}")
            return
        
        fields = self.get_fields(model_name)
        
        # Print basic record info
        print(f"\n=== Sample Record for {model_name} ===\n")
        print(f"Record ID: {sample_record.get('id')}")
        
        # Print fields in a structured way
        print("\nFields:")
        
        for field_name, field_info in fields.items():
            field_type = field_info.get("type", "unknown")
            field_string = field_info.get("string", field_name)
            
            # Skip fields that don't exist in the record
            if field_name not in sample_record and field_name + "_expanded" not in sample_record:
                continue
                
            print(f"\n--- {field_string} ({field_name}, {field_type}) ---")
            
            # Handle different field types
            if field_type == "many2one":
                if field_name in sample_record:
                    value = sample_record[field_name]
                    if value and isinstance(value, (list, tuple)) and len(value) >= 2:
                        print(f"Value: {value[1]} (ID: {value[0]})")
                    else:
                        print("Value: Not set")
                    
                    # Print expanded data if available
                    if field_name + "_expanded" in sample_record:
                        expanded = sample_record[field_name + "_expanded"]
                        print("Expanded Fields:")
                        for exp_field, exp_value in expanded.items():
                            if exp_field not in ['id']:  # Skip id as it's already printed
                                print(f"  - {exp_field}: {exp_value}")
            
            elif field_type in ["one2many", "many2many"]:
                if field_name in sample_record:
                    ids = sample_record[field_name]
                    print(f"IDs: {ids}")
                    
                    # Print expanded data if available
                    if field_name + "_expanded" in sample_record:
                        expanded = sample_record[field_name + "_expanded"]
                        print(f"Expanded Records ({len(expanded)}):")
                        for i, exp_record in enumerate(expanded):
                            print(f"  Record {i+1}:")
                            for exp_field, exp_value in exp_record.items():
                                if exp_field in ['name', 'display_name']:
                                    print(f"    - {exp_field}: {exp_value}")
                            print()  # Add a blank line between records
            
            # Handle binary fields (show size rather than data)
            elif field_type == "binary" and field_name in sample_record:
                value = sample_record[field_name]
                if value:
                    print(f"Value: [Binary data, approximately {len(str(value)) // 1.37 / 1024:.2f} KB]")
                else:
                    print("Value: [No data]")
            
            # Handle other field types
            elif field_name in sample_record:
                value = sample_record[field_name]
                print(f"Value: {value}")
    
    def select_fields_for_model(self, model_name):
        """
        Interactive UI to select fields for a model
        
        Args:
            model_name: Name of the model
        """
        fields = self.get_fields(model_name)
        if not fields:
            print(f"No fields found for {model_name}")
            return
        
        # Get a sample record
        sample = self.get_sample_record(model_name, expand_relations=True, max_depth=1)
        
        # Initialize curses
        try:
            curses.wrapper(self._field_selector_ui, model_name, fields, sample)
        except Exception as e:
            logger.error(f"Error in field selector UI: {e}")
            print(f"Error in field selector UI: {e}")
    
    def _field_selector_ui(self, stdscr, model_name, fields, sample_record):
        """
        Curses-based UI for selecting fields
        
        Args:
            stdscr: Curses standard screen
            model_name: Name of the model
            fields: Dictionary of fields
            sample_record: Sample record data
        """
        # Setup curses
        curses.curs_set(0)  # Hide cursor
        stdscr.clear()
        stdscr.refresh()
        
        # Colors
        curses.start_color()
        curses.init_pair(1, curses.COLOR_WHITE, curses.COLOR_BLUE)  # Selected item
        curses.init_pair(2, curses.COLOR_BLACK, curses.COLOR_WHITE)  # Header
        curses.init_pair(3, curses.COLOR_GREEN, curses.COLOR_BLACK)  # Selected field
        curses.init_pair(4, curses.COLOR_YELLOW, curses.COLOR_BLACK)  # Relation field
        curses.init_pair(5, curses.COLOR_RED, curses.COLOR_BLACK)    # Required field
        
        # Sort fields by importance/type
        field_items = []
        for field_name, field_info in fields.items():
            field_type = field_info.get("type", "unknown")
            field_string = field_info.get("string", field_name)
            required = field_info.get("required", False)
            
            # Skip internal fields
            if field_name.startswith('_'):
                continue
            
            # Get sample value
            sample_value = sample_record.get(field_name, "")
            if field_type == "many2one" and sample_value:
                sample_value = sample_value[1] if isinstance(sample_value, (list, tuple)) and len(sample_value) >= 2 else "Not set"
            elif field_type in ["one2many", "many2many"]:
                sample_value = f"[{len(sample_value)} records]" if sample_value else "[]"
            elif field_type == "binary" and sample_value:
                sample_value = "[Binary data]"
                
            # Create field item
            field_items.append({
                "name": field_name,
                "type": field_type,
                "string": field_string,
                "required": required,
                "sample": sample_value,
                "selected": field_name in self.selected_fields[model_name] or required
            })
            
            # Auto-select required fields
            if required and field_name not in self.selected_fields[model_name]:
                self.selected_fields[model_name].add(field_name)
        
        # Sort fields: required first, then by type (put relations last)
        field_items.sort(key=lambda x: (
            0 if x["required"] else 1,  # Required fields first
            1 if x["type"] in ["many2one", "one2many", "many2many"] else 0,  # Relations last
            x["string"]  # Then alphabetical by label
        ))
        
        # Main loop
        current_pos = 0
        page_size = curses.LINES - 7  # Leave room for header and footer
        page_start = 0
        
        while True:
            stdscr.clear()
            
            # Draw header
            header = f" Field Selection for {model_name} "
            stdscr.addstr(0, 0, header.center(curses.COLS), curses.color_pair(2))
            
            # Draw column headers
            stdscr.addstr(2, 2, "[ ]", curses.A_BOLD)
            stdscr.addstr(2, 7, "Field Name", curses.A_BOLD)
            stdscr.addstr(2, 30, "Field Label", curses.A_BOLD)
            stdscr.addstr(2, 55, "Type", curses.A_BOLD)
            stdscr.addstr(2, 70, "Sample Value", curses.A_BOLD)
            
            # Draw fields
            for i, field in enumerate(field_items[page_start:page_start + page_size]):
                y = i + 3  # Start after header
                
                # Highlight current position
                if page_start + i == current_pos:
                    attr = curses.color_pair(1)
                else:
                    attr = curses.A_NORMAL
                
                # Draw selection indicator
                if field["selected"]:
                    stdscr.addstr(y, 2, "[X]", attr)
                else:
                    stdscr.addstr(y, 2, "[ ]", attr)
                
                # Draw field name with appropriate color
                name_attr = attr
                if field["required"]:
                    name_attr |= curses.color_pair(5)
                elif field["type"] in ["many2one", "one2many", "many2many"]:
                    name_attr |= curses.color_pair(4)
                elif field["selected"]:
                    name_attr |= curses.color_pair(3)
                
                stdscr.addstr(y, 7, field["name"][:20], name_attr)
                
                # Draw other fields
                stdscr.addstr(y, 30, field["string"][:20], attr)
                stdscr.addstr(y, 55, field["type"][:12], attr)
                
                # Draw sample value (truncated if necessary)
                sample_value = str(field["sample"])
                if len(sample_value) > 40:
                    sample_value = sample_value[:37] + "..."
                stdscr.addstr(y, 70, sample_value, attr)
            
            # Draw footer
            selected_count = len(self.selected_fields[model_name])
            footer = (
                " Space: Toggle Selection | Enter: Confirm | "
                "A: Select All | N: Select None | Q: Cancel"
            )
            status = f" Selected: {selected_count} fields "
            
            stdscr.addstr(curses.LINES - 2, 0, status, curses.color_pair(2))
            stdscr.addstr(curses.LINES - 1, 0, footer.center(curses.COLS), curses.color_pair(2))
            
            # Handle input
            key = stdscr.getch()
            
            if key == ord('q') or key == ord('Q'):
                # Cancel
                return
                
            elif key == ord('a') or key == ord('A'):
                # Select all fields
                for field in field_items:
                    if not field["name"].startswith('_'):  # Skip internal fields
                        field["selected"] = True
                        self.selected_fields[model_name].add(field["name"])
            
            elif key == ord('n') or key == ord('N'):
                # Select none (except required fields)
                for field in field_items:
                    if not field["required"]:
                        field["selected"] = False
                        if field["name"] in self.selected_fields[model_name]:
                            self.selected_fields[model_name].remove(field["name"])
            
            elif key == ord(' '):
                # Toggle current field
                field = field_items[current_pos]
                if not field["required"]:  # Don't toggle required fields
                    field["selected"] = not field["selected"]
                    if field["selected"]:
                        self.selected_fields[model_name].add(field["name"])
                    else:
                        if field["name"] in self.selected_fields[model_name]:
                            self.selected_fields[model_name].remove(field["name"])
            
            elif key == curses.KEY_UP:
                # Move selection up
                if current_pos > 0:
                    current_pos -= 1
                    if current_pos < page_start:
                        page_start = max(0, page_start - 1)
            
            elif key == curses.KEY_DOWN:
                # Move selection down
                if current_pos < len(field_items) - 1:
                    current_pos += 1
                    if current_pos >= page_start + page_size:
                        page_start += 1
            
            elif key == curses.KEY_PPAGE:
                # Page up
                current_pos = max(0, current_pos - page_size)
                page_start = max(0, page_start - page_size)
            
            elif key == curses.KEY_NPAGE:
                # Page down
                current_pos = min(len(field_items) - 1, current_pos + page_size)
                page_start = min(len(field_items) - page_size, page_start + page_size)
                if page_start < 0:
                    page_start = 0
            
            elif key == curses.KEY_ENTER or key == 10 or key == 13:
                # Confirm selection
                break

    def generate_react_native_field_map(self, model_name, output_file=None):
        """
        Generate React Native field mapping for a model
        
        Args:
            model_name: Name of the model
            output_file: Output file name
            
        Returns:
            str: React Native field mapping code
        """
        fields = self.get_fields(model_name)
        selected_fields = self.selected_fields.get(model_name, set())
        
        if not selected_fields:
            # If no fields are explicitly selected, use all non-internal fields
            selected_fields = {
                field_name for field_name in fields
                if not field_name.startswith('_')
            }
        
        # Get field metadata
        field_metadata = []
        for field_name in selected_fields:
            field_info = fields.get(field_name, {})
            if not field_info:
                continue
                
            field_metadata.append({
                "name": field_name,
                "label": field_info.get("string", field_name),
                "type": field_info.get("type", "char"),
                "required": field_info.get("required", False),
                "relation": field_info.get("relation", ""),
                "readonly": field_info.get("readonly", False),
                "help": field_info.get("help", ""),
                "selection": field_info.get("selection", [])
            })
        
        # Generate React Native component
        component = self._generate_react_native_component(model_name, field_metadata)
        
        # Save to file if specified
        if output_file:
            with open(output_file, 'w') as f:
                f.write(component)
            logger.info(f"Generated React Native component for {model_name} to {output_file}")
            
        return component

    def _generate_react_native_component(self, model_name, field_metadata):
        """
        Generate React Native component code for a model
        
        Args:
            model_name: Name of the model
            field_metadata: List of field metadata dictionaries
            
        Returns:
            str: React Native component code
        """
        # Get a nice component name
        component_name = "".join(part.capitalize() for part in model_name.split('.'))
        file_name = model_name.replace('.', '_').lower()
        
        # Component templates
        component_template = f"""// screens/{file_name}/{component_name}DetailsScreen.js

import React, {{ useState, useEffect, useContext }} from 'react';
import {{
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking
}} from 'react-native';
import {{ Ionicons }} from '@expo/vector-icons';
import {{ AuthContext }} from '../../context/AuthContext';
import {{ apiRequest }} from '../../api/odooApi';

const {component_name}DetailsScreen = ({{ route, navigation }}) => {{
  const {{ recordId }} = route.params;
  const {{ authToken, serverConfig }} = useContext(AuthContext);
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {{
    fetchRecordDetails();
  }}, [recordId]);

  const fetchRecordDetails = async () => {{
    try {{
      setLoading(true);
      
      // Comprehensive field list to match the form
      const fields = [
        {',\n        '.join([f"'{field['name']}'" for field in field_metadata])}
      ];
      
      // Use search_read instead of read for better compatibility
      const response = await apiRequest(
        serverConfig.baseUrl,
        serverConfig.database,
        authToken,
        `/api/v2/search_read/{model_name}`,
        'POST',
        {{
          domain: [['id', '=', recordId]],
          fields,
          limit: 1
        }}
      );
      
      console.log('Record details response:', response);
      
      if (response && response.length > 0) {{
        setRecord(response[0]);
      }} else {{
        Alert.alert('Error', 'Could not find record details');
        navigation.goBack();
      }}
    }} catch (error) {{
      console.error('Error fetching record details:', error);
      Alert.alert('Error', 'Failed to load record details');
      navigation.goBack();
    }} finally {{
      setLoading(false);
    }}
  }};

  const handleEdit = () => {{
    navigation.navigate('{component_name}Form', {{ recordId, record }});
  }};

  const handleDelete = () => {{
    Alert.alert(
      'Delete Record',
      'Are you sure you want to delete this record? This action cannot be undone.',
      [
        {{ text: 'Cancel', style: 'cancel' }},
        {{ 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {{
            try {{
              await apiRequest(
                serverConfig.baseUrl,
                serverConfig.database,
                authToken,
                `/api/v2/unlink/{model_name}`,
                'DELETE',
                {{ ids: [recordId] }}
              );
              navigation.goBack();
            }} catch (error) {{
              console.error('Error deleting record:', error);
              Alert.alert('Error', 'Failed to delete record');
            }}
          }}
        }},
      ]
    );
  }};

  // Generate initials for avatar
  const getInitials = (name) => {{
    if (!name) return '?';
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }};

  const formatDate = (dateString) => {{
    if (!dateString) return 'Not specified';
    try {{
      return new Date(dateString).toLocaleDateString();
    }} catch (e) {{
      return dateString;
    }}
  }};

  if (loading || !record) {{
    return (
      <View style={{styles.loadingContainer}}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={{styles.loadingText}}>Loading record details...</Text>
      </View>
    );
  }}

  return (
    <ScrollView style={{styles.container}}>
      // Header with basic info
      <View style={{styles.header}}>
        <View style={{styles.avatar}}>
          <Text style={{styles.avatarText}}>{{getInitials(record.name || record.display_name || "")}}</Text>
        </View>
        
        <Text style={{styles.name}}>{{record.name || record.display_name || `Record #${{record.id}}`}}</Text>
      </View>
      
      // Action buttons
      <View style={{styles.actions}}>
        <TouchableOpacity style={{styles.actionButton}} onPress={{handleEdit}}>
          <Ionicons name="create-outline" size={{22}} color="#3498db" />
          <Text style={{styles.actionText}}>Edit</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={{styles.actionButton}} onPress={{handleDelete}}>
          <Ionicons name="trash-outline" size={{22}} color="#e74c3c" />
          <Text style={{styles.actionText}}>Delete</Text>
        </TouchableOpacity>
      </View>
      
      // Record Information Section
      <View style={{styles.section}}>
        <Text style={{styles.sectionTitle}}>Record Information</Text>
        
        // Generate field rows dynamically based on field type
        {self._generate_field_rows(field_metadata)}
      </View>
    </ScrollView>
  );
}};

const styles = StyleSheet.create({{
  container: {{
    flex: 1,
    backgroundColor: '#f5f5f5',
  }},
  loadingContainer: {{
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  }},
  loadingText: {{
    marginTop: 16,
    fontSize: 16,
    color: '#333',
  }},
  header: {{
    alignItems: 'center',
    backgroundColor: 'white',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  }},
  avatar: {{
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  }},
  avatarText: {{
    color: 'white',
    fontSize: 30,
    fontWeight: 'bold',
  }},
  name: {{
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  }},
  actions: {{
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'white',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    marginBottom: 15,
  }},
  actionButton: {{
    alignItems: 'center',
  }},
  actionText: {{
    marginTop: 5,
    color: '#333',
  }},
  section: {{
    backgroundColor: 'white',
    borderRadius: 8,
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: {{ width: 0, height: 1 }},
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  }},
  sectionTitle: {{
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 10,
  }},
  infoRow: {{
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  }},
  infoIcon: {{
    marginRight: 10,
    width: 20,
  }},
  infoLabel: {{
    width: 120,
    fontSize: 16,
    color: '#333',
  }},
  infoValue: {{
    flex: 1,
    fontSize: 16,
    color: '#666',
  }},
  linkValue: {{
    flex: 1,
    fontSize: 16,
    color: '#3498db',
  }},
  infoBlock: {{
    marginBottom: 12,
  }},
  infoBlockHeader: {{
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  }},
  infoBlockLabel: {{
    fontSize: 16,
    color: '#333',
  }},
  infoBlockText: {{
    fontSize: 16,
    color: '#666',
    marginLeft: 30,
    lineHeight: 24,
  }}
}});

export default {component_name}DetailsScreen;"""

        return component_template
                
    def _generate_field_rows(self, field_metadata):
        """
        Generate React Native JSX code for field rows based on field types
        
        Args:
            field_metadata: List of field metadata dictionaries
            
        Returns:
            str: JSX code for field rows
        """
        field_rows = []
        
        for field in field_metadata:
            field_name = field["name"]
            field_label = field["label"]
            field_type = field["type"]
            
            # Skip id field
            if field_name == 'id':
                continue
            
            # Determine icon based on field type
            icon = self._get_icon_for_field_type(field_type, field_name)
            
            # Create the JSX for the field based on its type
            if field_type == "many2one":
                field_rows.append(f"""{{record.{field_name} && (
          <View style={{styles.infoRow}}>
            <Ionicons name="{icon}" size={{20}} color="#333" style={{styles.infoIcon}} />
            <Text style={{styles.infoLabel}}>{field_label}</Text>
            <Text style={{styles.infoValue}}>{{'{field_name}' === 'display_name' ? record.{field_name} : (record.{field_name} ? record.{field_name}[1] : 'Not specified')}}</Text>
          </View>
        )}}""")
            
            elif field_type in ["one2many", "many2many"]:
                field_rows.append(f"""{{record.{field_name} && (
          <View style={{styles.infoRow}}>
            <Ionicons name="{icon}" size={{20}} color="#333" style={{styles.infoIcon}} />
            <Text style={{styles.infoLabel}}>{field_label}</Text>
            <Text style={{styles.infoValue}}>{{`record.${field_name}.length + ' items'`}}</Text>
          </View>
        )}}""")
            
            elif field_type == "boolean":
                field_rows.append(f"""
        <View style={{styles.infoRow}}>
          <Ionicons name="{icon}" size={{20}} color="#333" style={{styles.infoIcon}} />
          <Text style={{styles.infoLabel}}>{field_label}</Text>
          <Text style={{styles.infoValue}}>{{record.{field_name} ? 'Yes' : 'No'}}</Text>
        </View>""")
            
            elif field_type in ["date", "datetime"]:
                field_rows.append(f"""{{record.{field_name} && (
          <View style={{styles.infoRow}}>
            <Ionicons name="{icon}" size={{20}} color="#333" style={{styles.infoIcon}} />
            <Text style={{styles.infoLabel}}>{field_label}</Text>
            <Text style={{styles.infoValue}}>{{formatDate(record.{field_name})}}</Text>
          </View>
        )}}""")
            
            elif field_type == "binary":
                field_rows.append(f"""{{record.{field_name} && (
          <View style={{styles.infoRow}}>
            <Ionicons name="{icon}" size={{20}} color="#333" style={{styles.infoIcon}} />
            <Text style={{styles.infoLabel}}>{field_label}</Text>
            <Text style={{styles.infoValue}}>[Binary data]</Text>
          </View>
        )}}""")
            
            elif field_type == "html":
                field_rows.append(f"""{{record.{field_name} && (
          <View style={{styles.infoBlock}}>
            <View style={{styles.infoBlockHeader}}>
              <Ionicons name="{icon}" size={{20}} color="#333" style={{styles.infoIcon}} />
              <Text style={{styles.infoBlockLabel}}>{field_label}</Text>
            </View>
            <Text style={{styles.infoBlockText}}>[HTML content]</Text>
          </View>
        )}}""")
            
            elif field_type == "text":
                field_rows.append(f"""{{record.{field_name} && (
          <View style={{styles.infoBlock}}>
            <View style={{styles.infoBlockHeader}}>
              <Ionicons name="{icon}" size={{20}} color="#333" style={{styles.infoIcon}} />
              <Text style={{styles.infoBlockLabel}}>{field_label}</Text>
            </View>
            <Text style={{styles.infoBlockText}}>{{record.{field_name}}}</Text>
          </View>
        )}}""")
            
            elif field_type == "selection":
                field_rows.append(f"""{{record.{field_name} && (
          <View style={{styles.infoRow}}>
            <Ionicons name="{icon}" size={{20}} color="#333" style={{styles.infoIcon}} />
            <Text style={{styles.infoLabel}}>{field_label}</Text>
            <Text style={{styles.infoValue}}>{{record.{field_name}.replace(/_/g, ' ').charAt(0).toUpperCase() + 
              record.{field_name}.replace(/_/g, ' ').slice(1)}}</Text>
          </View>
        )}}""")
            
            else:  # Default for char, integer, float, etc.
                field_rows.append(f"""{{record.{field_name} !== undefined && record.{field_name} !== false && (
          <View style={{styles.infoRow}}>
            <Ionicons name="{icon}" size={{20}} color="#333" style={{styles.infoIcon}} />
            <Text style={{styles.infoLabel}}>{field_label}</Text>
            <Text style={{styles.infoValue}}>{{record.{field_name}}}</Text>
          </View>
        )}}""")
        
        return "\n        ".join(field_rows)
    
    def _get_icon_for_field_type(self, field_type, field_name):
        """
        Get an appropriate Ionicons icon for a field type
        
        Args:
            field_type: Type of the field
            field_name: Name of the field
            
        Returns:
            str: Ionicons icon name
        """
        # Based on field name
        if "name" in field_name.lower():
            return "person-outline"
        elif "email" in field_name.lower():
            return "mail-outline"
        elif "phone" in field_name.lower() or "mobile" in field_name.lower():
            return "call-outline"
        elif "address" in field_name.lower() or "street" in field_name.lower():
            return "home-outline"
        elif "city" in field_name.lower():
            return "business-outline"
        elif "country" in field_name.lower() or "state" in field_name.lower():
            return "flag-outline"
        elif "zip" in field_name.lower() or "postal" in field_name.lower():
            return "mail-outline"
        elif "date" in field_name.lower() or "time" in field_name.lower():
            return "calendar-outline"
        elif "image" in field_name.lower() or "photo" in field_name.lower():
            return "image-outline"
        elif "active" in field_name.lower() or "state" in field_name.lower():
            return "checkmark-circle-outline"
        elif "description" in field_name.lower() or "note" in field_name.lower():
            return "document-text-outline"
        
        # Based on field type
        if field_type == "many2one":
            return "link-outline"
        elif field_type in ["one2many", "many2many"]:
            return "list-outline"
        elif field_type == "boolean":
            return "checkmark-outline"
        elif field_type in ["date", "datetime"]:
            return "calendar-outline"
        elif field_type == "binary":
            return "document-attach-outline"
        elif field_type == "html":
            return "code-outline"
        elif field_type == "text":
            return "document-text-outline"
        elif field_type == "selection":
            return "options-outline"
        elif field_type in ["integer", "float", "monetary"]:
            return "calculator-outline"
        
        # Default
        return "information-circle-outline"
            
    def search_models(self, query):
        """
        Search for models matching a query
        
        Args:
            query: Search query
            
        Returns:
            list: List of matching model names
        """
        # Get all models if not already cached
        if self.models_cache is None:
            self.get_models()
            
        # Search models
        query = query.lower()
        return [model for model in self.models_cache if query in model.lower()]
        
    def get_model_relationships(self, model_name):
        """
        Get relationships for a model
        
        Args:
            model_name: Name of the model
            
        Returns:
            dict: Dictionary of related models
        """
        fields = self.get_fields(model_name)
        relationships = {
            "many2one": [],
            "one2many": [],
            "many2many": []
        }
        
        for field_name, field_info in fields.items():
            field_type = field_info.get("type")
            if field_type in relationships:
                relation = field_info.get("relation")
                if relation:
                    relationships[field_type].append({
                        "field": field_name,
                        "model": relation,
                        "string": field_info.get("string", field_name),
                        "required": field_info.get("required", False),
                        "related": field_info.get("related", ""),
                        "relation_field": field_info.get("relation_field", "")
                    })
                    
        return relationships
        
    def analyze_model(self, model_name):
        """
        Analyze a model and its fields
        
        Args:
            model_name: Name of the model
            
        Returns:
            dict: Analysis results
        """
        fields = self.get_fields(model_name)
        relationships = self.get_model_relationships(model_name)
        
        # Get field types
        field_types = defaultdict(int)
        for field_name, field_info in fields.items():
            field_type = field_info.get("type", "unknown")
            field_types[field_type] += 1
            
        # Get required fields
        required_fields = [
            field_name for field_name, field_info in fields.items()
            if field_info.get("required", False)
        ]
        
        # Get commonly used fields (name, active, etc.)
        common_fields = {
            field_name: field_info for field_name, field_info in fields.items()
            if field_name in ["name", "active", "create_date", "write_date", "create_uid", "write_uid"]
        }
        
        # Get computed fields
        computed_fields = {
            field_name: field_info for field_name, field_info in fields.items()
            if field_info.get("compute")
        }
        
        # Get search fields
        search_fields = {
            field_name: field_info for field_name, field_info in fields.items()
            if field_info.get("index", False) or field_info.get("search", False)
        }
        
        return {
            "model": model_name,
            "field_count": len(fields),
            "field_types": dict(field_types),
            "relationships": relationships,
            "required_fields": required_fields,
            "common_fields": common_fields,
            "computed_fields": computed_fields,
            "search_fields": search_fields,
            "fields": fields
        }
    
    def select_model(self, model_name):
        """
        Add a model to the selection for export
        
        Args:
            model_name: Name of the model
        """
        if model_name in self.get_models():
            self.selected_models.add(model_name)
            logger.info(f"Added {model_name} to selected models")
        else:
            logger.warning(f"Model {model_name} not found")
            
    def deselect_model(self, model_name):
        """
        Remove a model from the selection for export
        
        Args:
            model_name: Name of the model
        """
        if model_name in self.selected_models:
            self.selected_models.remove(model_name)
            logger.info(f"Removed {model_name} from selected models")
        else:
            logger.warning(f"Model {model_name} not in selected models")
    
    def clear_selected_models(self):
        """
        Clear all selected models
        """
        self.selected_models.clear()
        logger.info("Cleared all selected models")
        
    def get_selected_models(self):
        """
        Get the list of selected models
        
        Returns:
            list: List of selected model names
        """
        return list(self.selected_models)
    
    def export_selected_models(self, output_file=None, include_relationships=True, depth=1, exclude_timezone=False, timezone_handling=False):
        """
        Export the selected models to a JSON file
        
        Args:
            output_file: Output file name
            include_relationships: Whether to include related models
            depth: Depth of relationships to include
            exclude_timezone: Whether to exclude timezone fields from output
            timezone_handling: Whether to include timezone handling recommendations
            
        Returns:
            dict: Export data
        """
        if not self.selected_models:
            logger.warning("No models selected for export")
            return {}
            
        export_data = {
            "models": {},
            "relationships": []
        }
        
        models_to_process = set(self.selected_models)
        processed_models = set()
        
        # Process models up to the specified depth
        for _ in range(depth):
            current_models = models_to_process - processed_models
            if not current_models:
                break
                
            for model_name in current_models:
                # Skip if already processed
                if model_name in processed_models:
                    continue
                    
                # Analyze model
                analysis = self.analyze_model(model_name)
                
                # Add model to export data
                export_data["models"][model_name] = {
                    "fields": {},
                    "description": self.get_model_description(model_name),
                    "transient": self.is_transient_model(model_name)
                }
                
                # Use selected fields if available
                selected_fields = self.selected_fields.get(model_name, set())
                is_field_selection_active = bool(selected_fields)
                
                # Add fields to export data
                for field_name, field_info in analysis["fields"].items():
                    # Skip if field selection is active and field is not selected
                    if is_field_selection_active and field_name not in selected_fields:
                        continue
                        
                    # Skip internal and computed fields if they're not important for app development
                    if field_name.startswith("_") or (field_info.get("compute") and not field_info.get("store", False)):
                        continue
                        
                    # Skip timezone fields if requested
                    if exclude_timezone and (field_name == 'tz' or field_info.get('string', '').lower() == 'timezone'):
                        continue
                        
                    export_data["models"][model_name]["fields"][field_name] = {
                        "type": field_info.get("type", "char"),
                        "string": field_info.get("string", field_name),
                        "required": field_info.get("required", False),
                        "readonly": field_info.get("readonly", False),
                        "help": field_info.get("help", ""),
                        "selection": field_info.get("selection", []),
                        "relation": field_info.get("relation", ""),
                        "domain": field_info.get("domain", ""),
                        "store": field_info.get("store", True)
                    }
                    
                    # Mark timezone fields if timezone handling is requested
                    if timezone_handling and (field_name == 'tz' or field_info.get('string', '').lower() == 'timezone'):
                        export_data["models"][model_name]["fields"][field_name]["is_timezone"] = True
                
                # Add relationships to export data
                if include_relationships:
                    for rel_type, relations in analysis["relationships"].items():
                        for rel in relations:
                            export_data["relationships"].append({
                                "from_model": model_name,
                                "to_model": rel["model"],
                                "field": rel["field"],
                                "type": rel_type,
                                "label": rel["string"],
                                "required": rel["required"],
                                "relation_field": rel["relation_field"]
                            })
                            
                            # Add related model to process list if within depth
                            if rel["model"] not in processed_models and depth > 1:
                                models_to_process.add(rel["model"])
                
                # Mark model as processed
                processed_models.add(model_name)
        
        # Add timezone handling recommendations if requested
        if timezone_handling:
            export_data["timezone_handling"] = {
                "recommendations": [
                    "Store all dates/times in UTC format",
                    "Convert to local timezone only for display purposes",
                    "Include user timezone in API requests if server expects local time",
                    "Use timezone-aware date libraries (moment.js, luxon, etc.)",
                    "Consider automatic timezone detection for mobile users"
                ],
                "common_issues": [
                    "Date/time comparisons across different timezones",
                    "Date filtering not accounting for timezone offset",
                    "Date displays showing incorrect time due to timezone conversion",
                    "Daylight saving time transitions affecting time calculations"
                ]
            }
        
        # Save to file if specified
        if output_file:
            with open(output_file, 'w') as f:
                json.dump(export_data, f, indent=2)
            logger.info(f"Exported {len(export_data['models'])} models to {output_file}")
            
        return export_data
    
    def export_llm_prompt(self, output_file=None, app_description="", exclude_timezone=False, timezone_handling=False):
        """
        Export selected models as a prompt suitable for LLM app development
        
        Args:
            output_file: Output file name
            app_description: Description of the app to be developed
            exclude_timezone: Whether to exclude timezone fields from output
            timezone_handling: Whether to include timezone handling recommendations
            
        Returns:
            str: LLM prompt
        """
        if not self.selected_models:
            logger.warning("No models selected for export")
            return ""
        
        # Generate export data
        export_data = self.export_selected_models(
            include_relationships=True, 
            depth=2, 
            exclude_timezone=exclude_timezone, 
            timezone_handling=timezone_handling
        )
        
        # Build the prompt
        prompt = "# Odoo App Development Specification\n\n"
        
        if app_description:
            prompt += f"## App Description\n{app_description}\n\n"
            
        prompt += "## Database Schema\n\n"
        prompt += "I need to develop an Odoo application with the following models and relationships:\n\n"
        
        # Add models
        prompt += "### Models\n\n"
        for model_name, model_info in export_data["models"].items():
            prompt += f"#### {model_name}\n"
            if model_info["description"]:
                prompt += f"Description: {model_info['description']}\n"
            if model_info["transient"]:
                prompt += "Type: Transient Model (Wizard)\n"
            prompt += "\nFields:\n"
            
            # Build field table
            field_table = []
            for field_name, field_info in model_info["fields"].items():
                field_type = field_info["type"]
                if field_info["relation"]:
                    field_type += f" -> {field_info['relation']}"
                    
                required = "Yes" if field_info["required"] else "No"
                readonly = "Yes" if field_info["readonly"] else "No"
                
                field_table.append([
                    field_name,
                    field_type,
                    field_info["string"],
                    required,
                    readonly,
                    field_info["help"]
                ])
                
            prompt += tabulate(
                field_table,
                headers=["Field Name", "Type", "Label", "Required", "Readonly", "Help"],
                tablefmt="pipe"
            )
            prompt += "\n\n"
            
        # Add relationships
        if export_data["relationships"]:
            prompt += "### Relationships\n\n"
            
            rel_table = []
            for rel in export_data["relationships"]:
                rel_table.append([
                    rel["from_model"],
                    rel["type"],
                    rel["to_model"],
                    rel["field"],
                    rel["label"],
                    "Yes" if rel["required"] else "No"
                ])
                
            prompt += tabulate(
                rel_table,
                headers=["From Model", "Relationship", "To Model", "Field", "Label", "Required"],
                tablefmt="pipe"
            )
            prompt += "\n\n"
        
        # Add timezone-specific section if requested
        if timezone_handling and "timezone_handling" in export_data:
            prompt += "## Timezone Handling\n\n"
            prompt += "This application involves date/time operations which require careful timezone handling:\n\n"
            
            prompt += "### Timezone Recommendations\n\n"
            for rec in export_data["timezone_handling"]["recommendations"]:
                prompt += f"- {rec}\n"
            prompt += "\n"
            
            prompt += "### Common Timezone Issues\n\n"
            for issue in export_data["timezone_handling"]["common_issues"]:
                prompt += f"- {issue}\n"
            prompt += "\n"
            
        # Add sample records section
        prompt += "## Sample Records\n\n"
        prompt += "Here are sample records for the selected models:\n\n"
        
        for model_name in export_data["models"]:
            sample_record = self.get_sample_record(model_name, expand_relations=True, max_depth=1)
            if sample_record:
                prompt += f"### {model_name}\n\n"
                prompt += "```json\n"
                prompt += json.dumps(sample_record, indent=2)
                prompt += "\n```\n\n"
            
        # Add task description
        prompt += "## Task\n\n"
        prompt += "Based on the above schema, please help me develop an Odoo application with the following components:\n\n"
        prompt += "1. Model definitions with appropriate fields and methods\n"
        prompt += "2. View definitions (form, tree, search)\n"
        prompt += "3. Menu items and actions\n"
        prompt += "4. Basic business logic\n"
        prompt += "5. Security rules\n\n"
        
        prompt += "Please provide the code in a way that follows Odoo best practices and conventions.\n"
        
        # Save to file if specified
        if output_file:
            with open(output_file, 'w') as f:
                f.write(prompt)
            logger.info(f"Exported LLM prompt to {output_file}")
            
        return prompt
    
    def export_mobile_app_llm_prompt(self, output_file=None, app_description="", framework="react-native", timezone_handling=True):
        """
        Export selected models as a prompt suitable for LLM mobile app development
        
        Args:
            output_file: Output file name
            app_description: Description of the app to be developed
            framework: Mobile framework to use (react-native, flutter, etc.)
            timezone_handling: Whether to include timezone handling recommendations
            
        Returns:
            str: LLM prompt
        """
        if not self.selected_models:
            logger.warning("No models selected for export")
            return ""
        
        # Get mobile app analysis
        mobile_analysis = self.analyze_for_mobile_app()
        
        # Build the prompt
        prompt = "# Odoo Mobile App Development Specification\n\n"
        
        if app_description:
            prompt += f"## App Description\n{app_description}\n\n"
            
        prompt += "## Target Platform\n"
        prompt += f"The mobile app will be built using {framework.capitalize()}.\n\n"
        
        prompt += "## Odoo REST API Integration\n\n"
        prompt += "The app will connect to an Odoo REST API with the following endpoints:\n\n"
        
        # Add API endpoints
        prompt += "### Required API Endpoints\n\n"
        for endpoint in mobile_analysis["api_endpoints"]:
            prompt += f"- **{endpoint['method']} {endpoint['path']}**\n"
            prompt += f"  - Purpose: {endpoint.get('purpose', 'General use')}\n"
            prompt += f"  - Description: {endpoint.get('description', '')}\n"
            if endpoint.get('parameters'):
                prompt += f"  - Parameters: {', '.join(endpoint['parameters'])}\n"
            prompt += "\n"
        
        # Add key workflows
        if mobile_analysis.get("key_workflows"):
            prompt += "### Key Mobile Workflows\n\n"
            for workflow in mobile_analysis["key_workflows"]:
                prompt += f"#### {workflow['name']}\n"
                prompt += f"Models involved: {', '.join(workflow['models'])}\n\n"
                prompt += "API sequence:\n"
                for step in workflow['endpoints']:
                    prompt += f"1. {step['method']} {step['path']} - {step['purpose']}\n"
                prompt += "\n"
        
        # Add mobile field recommendations
        prompt += "### Model Fields for Mobile UI\n\n"
        for model, model_data in mobile_analysis["models"].items():
            prompt += f"#### {model}\n\n"
            
            # Key fields table
            if model_data.get("key_fields"):
                prompt += "Key fields for display:\n"
                field_table = []
                for field_info in model_data["key_fields"]:
                    field_table.append([
                        field_info["name"],
                        field_info["type"],
                        field_info["string"],
                        "Yes" if field_info.get("required", False) else "No"
                    ])
                
                prompt += tabulate(
                    field_table,
                    headers=["Field Name", "Type", "Label", "Required"],
                    tablefmt="pipe"
                )
                prompt += "\n\n"
            
            # Heavy fields warning
            if model_data.get("heavy_fields"):
                prompt += "⚠️ **Fields to handle with care** (potentially heavy data):\n"
                for field_info in model_data["heavy_fields"]:
                    prompt += f"- `{field_info['name']}` ({field_info['type']}): {field_info['string']}\n"
                prompt += "\n"
                
            # Add sample records
            sample_record = self.get_sample_record(model, expand_relations=True, max_depth=1)
            if sample_record:
                prompt += "Sample Record:\n"
                prompt += "```json\n"
                prompt += json.dumps(sample_record, indent=2)
                prompt += "\n```\n\n"
        
        # Add mobile app structure
        prompt += "## Recommended App Structure\n\n"
        prompt += "The mobile app should have the following structure:\n\n"
        prompt += "1. **Authentication Module** - Login with Odoo credentials\n"
        prompt += "2. **API Service Layer** - Handle REST API communication\n"
        prompt += "3. **Data Models** - TypeScript/Dart interfaces for Odoo models\n"
        prompt += "4. **UI Components** - Reusable components for common patterns\n"
        prompt += "5. **Screens** - Main app screens based on workflows\n"
        prompt += "6. **State Management** - Global state for app data\n"
        prompt += "7. **Offline Support** - Local storage for offline operations\n\n"
        
        # Add timezone-specific section if requested
        if timezone_handling and mobile_analysis.get("recommendations", {}).get("timezone_handling"):
            prompt += "## Timezone Handling\n\n"
            prompt += "This mobile app involves date/time operations which require careful timezone handling:\n\n"
            
            prompt += "### Timezone Recommendations\n\n"
            for rec in mobile_analysis["recommendations"]["timezone_handling"]:
                prompt += f"- {rec}\n"
            prompt += "\n"
            
            # Include timezone fields found in models
            if any(model.get("timezone_fields") for model in mobile_analysis["models"].values()):
                prompt += "### Timezone Fields\n\n"
                for model_name, model_data in mobile_analysis["models"].items():
                    if model_data.get("timezone_fields"):
                        prompt += f"#### {model_name}\n"
                        for field_info in model_data["timezone_fields"]:
                            prompt += f"- `{field_info['name']}`: {field_info['string']}\n"
                        prompt += "\n"
            
            # Add sample code for timezone handling
            prompt += "### Example Timezone Handling Code\n\n"
            
            if framework.lower() == "react-native":
                prompt += "```javascript\n"
                prompt += "// Using date-fns-tz for timezone handling in React Native\n"
                prompt += "import {{ format, utcToZonedTime, zonedTimeToUtc }} from 'date-fns-tz';\n\n"
                prompt += "// Convert UTC time from server to local time for display\n"
                prompt += "const displayLocalTime = (utcTimeString, userTimezone) => {{\n"
                prompt += "  const utcDate = new Date(utcTimeString);\n"
                prompt += "  const userDate = utcToZonedTime(utcDate, userTimezone);\n"
                prompt += "  return format(userDate, 'yyyy-MM-dd HH:mm:ss', {{ timeZone: userTimezone }});\n"
                prompt += "}};\n\n"
                prompt += "// Convert local time back to UTC for sending to server\n"
                prompt += "const convertToUTC = (localTimeString, userTimezone) => {{\n"
                prompt += "  const localDate = new Date(localTimeString);\n"
                prompt += "  const utcDate = zonedTimeToUtc(localDate, userTimezone);\n"
                prompt += "  return utcDate.toISOString();\n"
                prompt += "}};\n"
                prompt += "```\n\n"
            elif framework.lower() == "flutter":
                prompt += "```dart\n"
                prompt += "// Using timezone package for Flutter\n"
                prompt += "import 'package:timezone/timezone.dart' as tz;\n"
                prompt += "import 'package:timezone/data/latest.dart' as tz_data;\n\n"
                prompt += "// Initialize timezone data\n"
                prompt += "void initializeTimeZones() {{\n"
                prompt += "  tz_data.initializeTimeZones();\n"
                prompt += "}}\n\n"
                prompt += "// Convert UTC time from server to local time for display\n"
                prompt += "String displayLocalTime(String utcTimeString, String userTimezone) {{\n"
                prompt += "  final utcTime = DateTime.parse(utcTimeString);\n"
                prompt += "  final location = tz.getLocation(userTimezone);\n"
                prompt += "  final localTime = tz.TZDateTime.from(utcTime, location);\n"
                prompt += "  return '${{localTime.year}}-${{localTime.month}}-${{localTime.day}} ${{localTime.hour}}:${{localTime.minute}}:${{localTime.second}}';\n"
                prompt += "}}\n"
                prompt += "```\n\n"
        
        # Add recommendations
        for category, recommendations in mobile_analysis["recommendations"].items():
            if category != "timezone_handling":  # Skip timezone as it's handled separately
                prompt += f"## {category.replace('_', ' ').title()} Recommendations\n\n"
                for recommendation in recommendations:
                    prompt += f"- {recommendation}\n"
                prompt += "\n"
            
        # Add task request
        prompt += "## Task\n\n"
        prompt += "Please help me build this mobile app by providing:\n\n"
        prompt += f"1. Initial project setup for {framework}\n"
        prompt += "2. API service implementation for the required endpoints\n"
        prompt += "3. TypeScript/Dart interfaces for the Odoo models\n"
        prompt += "4. UI components for common Odoo patterns\n"
        prompt += "5. Example screen implementations for key workflows\n"
        
        # Sample React Native component for one of the models
        if framework.lower() == "react-native":
            for model_name in self.selected_models:
                # Get fields
                fields = self.get_fields(model_name)
                selected_fields = self.selected_fields.get(model_name, set())
                
                # Get field metadata
                field_metadata = []
                for field_name, field_info in fields.items():
                    if not field_name.startswith('_') and (not selected_fields or field_name in selected_fields):
                        field_metadata.append({
                            "name": field_name,
                            "label": field_info.get("string", field_name),
                            "type": field_info.get("type", "char"),
                            "required": field_info.get("required", False),
                            "relation": field_info.get("relation", ""),
                            "readonly": field_info.get("readonly", False),
                            "help": field_info.get("help", ""),
                            "selection": field_info.get("selection", [])
                        })
                
                if field_metadata:
                    prompt += f"\n\n## Sample React Native Component for {model_name}\n\n"
                    prompt += "```jsx\n"
                    prompt += self._generate_react_native_component(model_name, field_metadata)
                    prompt += "\n```\n"
                    break  # Just include one sample component
        
        # Save to file if specified
        if output_file:
            with open(output_file, 'w') as f:
                f.write(prompt)
            logger.info(f"Exported mobile app LLM prompt to {output_file}")
            
        return prompt
    
    def analyze_for_mobile_app(self, output_file=None):
        """
        Analyze selected models for mobile app development and produce recommendations
        
        Args:
            output_file: Output file name
            
        Returns:
            dict: Mobile app analysis results
        """
        if not self.selected_models:
            logger.warning("No models selected for mobile app analysis")
            return {}
            
        results = {
            "models": {},
            "api_endpoints": [],
            "key_workflows": [],
            "recommendations": {
                "offline_support": [],
                "performance": [],
                "ux": []
            }
        }
        
        # Analyze each selected model
        for model_name in self.selected_models:
            fields = self.get_fields(model_name)
            
            # Skip if no fields found
            if not fields:
                continue
                
            model_result = {
                "key_fields": [],
                "heavy_fields": [],
                "required_endpoints": [],
                "timezone_fields": []
            }
            
            # Use selected fields if available
            selected_fields = self.selected_fields.get(model_name, set())
            is_field_selection_active = bool(selected_fields)
            
            # Analyze fields
            for field_name, field_info in fields.items():
                # Skip if field selection is active and field is not selected
                if is_field_selection_active and field_name not in selected_fields:
                    continue
                    
                field_type = field_info.get("type", "unknown")
                
                # Skip internal fields
                if field_name.startswith('_'):
                    continue
                    
                # Identify key fields for listing/display
                if field_name in ('name', 'display_name', 'state', 'date', 'create_date') or field_info.get("required", False):
                    model_result["key_fields"].append({
                        "name": field_name,
                        "type": field_type,
                        "string": field_info.get("string", field_name),
                        "required": field_info.get("required", False)
                    })
                    
                # Identify heavy fields (binary, HTML) that need special handling
                if field_type in ('binary', 'html'):
                    model_result["heavy_fields"].append({
                        "name": field_name,
                        "type": field_type,
                        "string": field_info.get("string", field_name)
                    })
                    
                # Identify timezone-related fields
                if field_name == 'tz' or 'timezone' in field_name.lower() or 'timezone' in field_info.get('string', '').lower():
                    model_result["timezone_fields"].append({
                        "name": field_name,
                        "type": field_type,
                        "string": field_info.get("string", field_name)
                    })
            
            # Determine required API endpoints
            model_result["required_endpoints"] = [
                {"method": "GET", "path": f"/search_read/{model_name}", "purpose": "List view"},
                {"method": "GET", "path": f"/read/{model_name}", "purpose": "Detail view"}
            ]
            
            # Check if model is writable and add create/update endpoints
            model_result["required_endpoints"].append(
                {"method": "POST", "path": f"/create/{model_name}", "purpose": "Create record"}
            )
            model_result["required_endpoints"].append(
                {"method": "PUT", "path": f"/write/{model_name}", "purpose": "Update record"}
            )
            
            # Add model-specific endpoint recommendations
            if model_name == 'hr.employee':
                model_result["required_endpoints"].append(
                    {"method": "POST", "path": "/call/hr.employee/attendance_manual", "purpose": "Check in/out"}
                )
            
            # Add to results
            results["models"][model_name] = model_result
            results["api_endpoints"].extend(model_result["required_endpoints"])
        
        # Map common workflows
        if set(["hr.employee", "hr.attendance"]).issubset(set(self.selected_models)):
            results["key_workflows"].append({
                "name": "Check In/Out",
                "models": ["hr.employee", "hr.attendance"],
                "endpoints": [
                    {"method": "GET", "path": "/search_read/hr.employee", "purpose": "Find employee"},
                    {"method": "POST", "path": "/call/hr.employee/attendance_manual", "purpose": "Check in/out"}
                ]
            })
        
        if set(["hr.employee", "project.task", "account.analytic.line"]).issubset(set(self.selected_models)):
            results["key_workflows"].append({
                "name": "Timesheet Recording",
                "models": ["hr.employee", "project.task", "account.analytic.line"],
                "endpoints": [
                    {"method": "GET", "path": "/search_read/project.task", "purpose": "List tasks"},
                    {"method": "POST", "path": "/create/account.analytic.line", "purpose": "Create timesheet entry"}
                ]
            })
        
        # Add mobile-specific recommendations
        
        # Offline support
        results["recommendations"]["offline_support"] = [
            "Implement local storage for frequently accessed data",
            "Queue API operations when offline",
            "Use optimistic UI updates with background synchronization",
            "Store user preferences and settings locally"
        ]
        
        # Performance recommendations
        results["recommendations"]["performance"] = [
            "Request only necessary fields in API calls",
            "Implement pagination for large data sets",
            "Lazy load images and heavy content",
            "Cache responses for frequently accessed data",
            "Use compression for network requests where supported"
        ]
        
        # UX recommendations
        results["recommendations"]["ux"] = [
            "Show loading states for all network operations",
            "Implement pull-to-refresh for content lists",
            "Provide offline indicators when network is unavailable",
            "Use appropriate input types for different field types",
            "Validate input on the client before sending to the server"
        ]
        
        # Timezone recommendations if timezone fields found
        has_timezone_fields = any(len(model.get("timezone_fields", [])) > 0 for model in results["models"].values())
        if has_timezone_fields:
            results["recommendations"]["timezone_handling"] = [
                "Store all date/time in UTC on the server",
                "Convert to local timezone only for display purposes",
                "Use a timezone library (moment-timezone, date-fns-tz)",
                "Consider automatic timezone detection",
                "Handle daylight saving time transitions properly"
            ]
        
        # Write results to file if specified
        if output_file:
            with open(output_file, 'w') as f:
                json.dump(results, f, indent=2)
            logger.info(f"Saved mobile app analysis to {output_file}")
        
        return results

    def generate_api_endpoints_summary(self, output_file=None):
        """
        Generate a summary of API endpoints needed for the mobile app
        
        Args:
            output_file: Output file name
            
        Returns:
            str: API endpoints summary
        """
        if not self.selected_models:
            logger.warning("No models selected for API endpoint summary")
            return ""
        
        # Get mobile app analysis
        analysis = self.analyze_for_mobile_app()
        
        # Build summary
        summary = "# API Endpoints for Mobile App\n\n"
        summary += "This document outlines the API endpoints required for the mobile application.\n\n"
        
        # Add authentication section
        summary += "## Authentication\n\n"
        summary += "The API supports the following authentication methods:\n\n"
        summary += "- **Basic Authentication**: Username and password\n"
        summary += "- **OAuth2**: Authorization code, implicit, password, and client credentials flows\n\n"
        summary += "### OAuth2 Token Endpoint\n\n"
        summary += "```\n/api/v2/authentication/oauth2/token\n```\n\n"
        
        # Add model endpoints
        summary += "## Model Endpoints\n\n"
        
        # Group endpoints by model
        model_endpoints = {}
        for endpoint in analysis["api_endpoints"]:
            # Extract model name from path (assuming last segment is the model or method name)
            path_parts = endpoint["path"].split("/")
            model = path_parts[-1] if "call" not in endpoint["path"] else path_parts[-2]
            if model not in model_endpoints:
                model_endpoints[model] = []
            model_endpoints[model].append(endpoint)
        
        # Add each model's endpoints
        for model, endpoints in model_endpoints.items():
            summary += f"### {model}\n\n"
            endpoint_table = []
            for endpoint in endpoints:
                endpoint_table.append([
                    endpoint["method"],
                    endpoint["path"],
                    endpoint.get("purpose", "General use")
                ])
            
            summary += tabulate(
                endpoint_table,
                headers=["Method", "Path", "Purpose"],
                tablefmt="pipe"
            )
            summary += "\n\n"
        
        # Add key workflows if available
        if analysis.get("key_workflows"):
            summary += "## Key Workflows\n\n"
            for workflow in analysis["key_workflows"]:
                summary += f"### {workflow['name']}\n"
                summary += f"Models involved: {', '.join(workflow['models'])}\n\n"
                summary += "API Sequence:\n"
                workflow_table = []
                for step in workflow["endpoints"]:
                    workflow_table.append([
                        step["method"],
                        step["path"],
                        step["purpose"]
                    ])
                summary += tabulate(
                    workflow_table,
                    headers=["Method", "Path", "Purpose"],
                    tablefmt="pipe"
                )
                summary += "\n\n"
        
        # Save to file if specified
        if output_file:
            with open(output_file, 'w') as f:
                f.write(summary)
            logger.info(f"Saved API endpoints summary to {output_file}")
        
        return summary

    def get_model_description(self, model_name):
        """
        Get the description of a model from models info
        
        Args:
            model_name: Name of the model
            
        Returns:
            str: Model description or empty string if not found
        """
        if self.models_info_cache is None:
            self.get_models_info()
        
        if self.models_info_cache:
            for model_info in self.models_info_cache:
                if model_info.get("model") == model_name:
                    return model_info.get("info", {}).get("string", "")
        return ""

    def is_transient_model(self, model_name):
        """
        Check if a model is transient
        
        Args:
            model_name: Name of the model
            
        Returns:
            bool: True if transient, False otherwise
        """
        if self.models_info_cache is None:
            self.get_models_info()
        
        if self.models_info_cache:
            for model_info in self.models_info_cache:
                if model_info.get("model") == model_name:
                    return model_info.get("transient", False)
        return False

    def refresh_cache(self):
        """
        Clear and refresh all caches
        """
        self.models_cache = None
        self.fields_cache.clear()
        self.models_info_cache = None
        self.record_cache.clear()
        
        # Clear file caches
        for cache_file in [self.models_cache_file, self.models_info_cache_file]:
            if os.path.exists(cache_file):
                os.remove(cache_file)
        
        for root, _, files in os.walk(self.fields_cache_dir):
            for file in files:
                os.remove(os.path.join(root, file))
                
        for root, _, files in os.walk(self.sample_record_cache_dir):
            for file in files:
                os.remove(os.path.join(root, file))
                
        logger.info("All caches have been cleared and will be refreshed on next request")
        
        # Preload models and info
        self.get_models(refresh_cache=True)
        self.get_models_info(refresh_cache=True)

    def export_mobile_app_dev_package(self, model_name, output_file=None):
        """
        Export a complete mobile app development package for a model in JSON format
        
        Args:
            model_name: Name of the model
            output_file: Output file name
            
        Returns:
            dict: Mobile app development package data
        """
        # Validate model
        if model_name not in self.get_models():
            logger.warning(f"Model {model_name} not found")
            return {}

        # Initialize package
        package = {
            "model": model_name,
            "fields": [],
            "relationships": [],
            "sample_record": {},
            "react_native_component": "",
            "next_steps": {
                "navigator": "Set up a stack navigator using react-navigation to link the list and details screens.",
                "list_screen": f"Create a list screen with FlatList to display {model_name} records and navigate to the details screen."
            },
            "sample_code": {
                "navigator": f"""import {{ NavigationContainer }} from '@react-navigation/native';
import {{ createStackNavigator }} from '@react-navigation/stack';
import {model_name.replace('.', '').capitalize()}ListScreen from './{model_name.replace('.', '').capitalize()}ListScreen';
import {model_name.replace('.', '').capitalize()}DetailsScreen from './{model_name.replace('.', '').capitalize()}DetailsScreen';

const Stack = createStackNavigator();

function App() {{
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="{model_name.replace('.', '').capitalize()}List" component={{{model_name.replace('.', '').capitalize()}ListScreen}} />
        <Stack.Screen name="{model_name.replace('.', '').capitalize()}Details" component={{{model_name.replace('.', '').capitalize()}DetailsScreen}} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}}
export default App;""",
                "list_screen": f"""import React from 'react';
import {{
  FlatList,
  TouchableOpacity,
  Text,
  StyleSheet
}} from 'react-native';

const {model_name.replace('.', '').capitalize()}ListScreen = ({{ navigation }}) => {{
  const {model_name.split('.')[1]}s = [
    {json.dumps(self.get_sample_record(model_name), indent=2)},
    // Add more records as needed
  ];
  return (
    <FlatList
      data={{{model_name.split('.')[1]}s}}
      renderItem={{({{ item }}) => (
        <TouchableOpacity 
          style={{styles.item}}
          onPress={{() => navigation.navigate('{model_name.replace('.', '').capitalize()}Details', {{ record: item }})}}>
          <Text style={{styles.itemText}}>{{item.name || item.display_name || `Record #${{item.id}}`}}</Text>
        </TouchableOpacity>
      )}}
      keyExtractor={{(item) => item.id.toString()}}
    />
  );
}};

const styles = StyleSheet.create({{
  item: {{
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  }},
  itemText: {{
    fontSize: 16,
  }},
}});

export default {model_name.replace('.', '').capitalize()}ListScreen;"""
            },
            "notes": []
        }

        # Fields
        fields = self.get_fields(model_name)
        selected_fields = self.selected_fields.get(model_name, set())
        if not selected_fields:
            selected_fields = {field_name for field_name in fields if not field_name.startswith('_')}

        for field_name in selected_fields:
            field_info = fields.get(field_name, {})
            if field_info:
                package["fields"].append({
                    "name": field_name,
                    "type": field_info.get("type", "char"),
                    "label": field_info.get("string", field_name),
                    "required": field_info.get("required", False),
                    "relation": field_info.get("relation", "") if field_info.get("type") in ["many2one", "one2many", "many2many"] else ""
                })

        # Relationships
        relationships = self.get_model_relationships(model_name)
        for rel_type, rels in relationships.items():
            for rel in rels:
                package["relationships"].append({
                    "from_model": model_name,
                    "to_model": rel["model"],
                    "field": rel["field"],
                    "type": rel_type,
                    "label": rel["string"]
                })

        # Sample Record
        package["sample_record"] = self.get_sample_record(model_name, expand_relations=True, max_depth=1)

        # React Native Component
        package["react_native_component"] = self.generate_react_native_field_map(model_name)

        # Notes for Error Prevention
        for field in package["fields"]:
            if field["type"] == "many2one":
                package["notes"].append(f"Check for False in {field['name']} to avoid 'bool object is not subscriptable' errors.")
            elif field["type"] == "binary":
                package["notes"].append(f"Optimize {field['name']} (binary) to prevent performance issues on mobile.")
            elif field["type"] in ["one2many", "many2many"]:
                package["notes"].append(f"Limit the number of records fetched for {field['name']} to avoid overloading the UI.")

        # Save to file if specified
        if output_file:
            with open(output_file, 'w') as f:
                json.dump(package, f, indent=2)
            logger.info(f"Exported mobile app development package for {model_name} to {output_file}")

        return package

    def explore(self):
        """
        Interactive exploration of models and fields
        """
        if not self.check_api_availability():
            print("API is not available. Please check your connection settings.")
            return
            
        # Check if running in non-interactive mode (e.g., via subprocess)
        import sys
        is_interactive = sys.stdin.isatty()

        print("\n=== Odoo Model Explorer for LLM-Assisted App Development ===\n")
        print("This tool helps you explore Odoo models and fields for API development.")
        print("You can select multiple models and export them for use with LLMs to build apps.")
        
        while True:
            print("\nOptions:")
            print("1. List models")
            print("2. Search models")
            print("3. View model fields")
            print("4. Analyze model")
            print("5. View sample record")
            print("6. Select models for export")
            print("7. Select fields for model")
            print("8. View selected models and fields")
            print("9. Generate model selection file")
            print("10. Generate React Native component")
            print("11. Export LLM prompt")
            print("12. Show model relationships")
            print("13. Analyze for mobile app development")
            print("14. Generate API endpoints summary")
            print("15. Export mobile app LLM prompt")
            print("16. Refresh cache")
            print("17. Exit")
            print("18. Export Mobile App Development Package")
            
            if is_interactive:
                choice = input("\nEnter your choice (1-18): ")
            else:
                # Non-interactive: Read one choice and exit after processing
                try:
                    choice = input()  # Expect choice from stdin (e.g., from Flask)
                except EOFError:
                    print("Non-interactive mode: No choice provided. Exiting.")
                    break

            if choice == "1":
                models = self.get_models()
                if models:
                    if is_interactive:
                        print(f"\nFound {len(models)} models. How many would you like to see?")
                        try:
                            limit = int(input("Enter number (0 for all): "))
                            if limit <= 0:
                                limit = len(models)
                        except ValueError:
                            limit = 20
                    else:
                        limit = 20  # Default for non-interactive
                        
                    print(f"\nListing {min(limit, len(models))} models:\n")
                    for model in models[:limit]:
                        print(model)
                else:
                    print("No models found.")
                    
            elif choice == "2":
                query = input("Enter search term: ") if is_interactive else "hr"  # Default for non-interactive
                results = self.search_models(query)
                if results:
                    print(f"\nFound {len(results)} matching models:\n")
                    for i, model in enumerate(results, 1):
                        print(f"{i:3}. {model}")
                else:
                    print("No matching models found.")
                    
            elif choice == "3":
                model_name = input("Enter model name: ") if is_interactive else input()
                fields = self.get_fields(model_name)
                if fields:
                    print(f"\nFields for {model_name}:\n")
                    field_table = []
                    for field_name, field_info in fields.items():
                        field_table.append([
                            field_name,
                            field_info.get("type", "unknown"),
                            field_info.get("string", field_name),
                            "Yes" if field_info.get("required", False) else "No"
                        ])
                    print(tabulate(field_table, headers=["Name", "Type", "Label", "Required"], tablefmt="pretty"))
                else:
                    print(f"No fields found for {model_name}")
                    
            elif choice == "4":
                model_name = input("Enter model name: ") if is_interactive else input()
                analysis = self.analyze_model(model_name)
                if analysis:
                    print(f"\nAnalysis for {model_name}:")
                    print(f"Field count: {analysis['field_count']}")
                    print("\nField types:")
                    for field_type, count in analysis["field_types"].items():
                        print(f"  - {field_type}: {count}")
                    print("\nRequired fields:")
                    for field in analysis["required_fields"]:
                        print(f"  - {field}")
                    print("\nRelationships:")
                    for rel_type, relations in analysis["relationships"].items():
                        if relations:
                            print(f"  {rel_type}:")
                            for rel in relations:
                                print(f"    - {rel['field']} -> {rel['model']} ({rel['string']})")
                else:
                    print(f"Could not analyze {model_name}")
                    
            elif choice == "5":
                model_name = input("Enter model name: ") if is_interactive else input()
                self.display_sample_record(model_name)
                
            elif choice == "6":
                if is_interactive:
                    print("\nSelect models for export:")
                    print("1. Add model to selection")
                    print("2. Remove model from selection")
                    print("3. Clear selection")
                    print("4. Search and select models")
                    print("5. Back to main menu")
                    
                    subchoice = input("\nEnter choice (1-5): ")
                    
                    if subchoice == "1":
                        model_name = input("Enter model name to add: ")
                        self.select_model(model_name)
                    elif subchoice == "2":
                        model_name = input("Enter model name to remove: ")
                        self.deselect_model(model_name)
                    elif subchoice == "3":
                        confirm = input("Are you sure you want to clear all selected models? (y/n): ")
                        if confirm.lower() == 'y':
                            self.clear_selected_models()
                    elif subchoice == "4":
                        query = input("Enter search term: ")
                        results = self.search_models(query)
                        if results:
                            print(f"\nFound {len(results)} matching models:\n")
                            for i, model in enumerate(results, 1):
                                selected = "X" if model in self.selected_models else " "
                                print(f"{i:3}. [{selected}] {model}")
                                
                            print("\nEnter the numbers of models to toggle selection (comma-separated, or 'all' to select all):")
                            selection = input("> ")
                            
                            if selection.lower() == 'all':
                                for model in results:
                                    self.select_model(model)
                            else:
                                try:
                                    for idx in selection.split(','):
                                        idx = int(idx.strip()) - 1
                                        if 0 <= idx < len(results):
                                            model = results[idx]
                                            if model in self.selected_models:
                                                self.deselect_model(model)
                                            else:
                                                self.select_model(model)
                                except ValueError:
                                    print("Invalid input. Please enter numbers separated by commas.")
                        else:
                            print("No matching models found.")
                    elif subchoice == "5":
                        continue
                else:
                    print("Option 6 requires interactive mode. Skipping.")
                    
            elif choice == "7":
                model_name = input("Enter model name: ") if is_interactive else input()
                if is_interactive:
                    self.select_fields_for_model(model_name)
                else:
                    print("Option 7 requires interactive mode (curses UI). Skipping.")
                
            elif choice == "8":
                if not self.selected_models:
                    print("\nNo models selected.")
                else:
                    print("\nSelected models:")
                    for model in sorted(self.selected_models):
                        fields = sorted(self.selected_fields.get(model, []))
                        field_str = f" ({len(fields)} fields: {', '.join(fields)})" if fields else ""
                        print(f"  - {model}{field_str}")
                        
            elif choice == "9":
                output_file = input("Enter output file name (default: selected_models.json): ") or "selected_models.json" if is_interactive else "selected_models.json"
                self.export_selected_models(output_file=output_file)
                print(f"Exported selected models to {output_file}")
                
            elif choice == "10":
                model_name = input("Enter model name: ") if is_interactive else input()
                output_file = input("Enter output file name (optional, press Enter for none): ") if is_interactive else ""
                component = self.generate_react_native_field_map(model_name, output_file or None)
                if not output_file:
                    print(f"\nGenerated React Native component for {model_name}:\n")
                    print(component)
                    
            elif choice == "11":
                output_file = input("Enter output file name (default: llm_prompt.txt): ") or "llm_prompt.txt" if is_interactive else "llm_prompt.txt"
                app_desc = input("Enter app description (optional, press Enter for none): ") if is_interactive else ""
                self.export_llm_prompt(output_file=output_file, app_description=app_desc)
                print(f"Exported LLM prompt to {output_file}")
                
            elif choice == "12":
                model_name = input("Enter model name: ") if is_interactive else input()
                relationships = self.get_model_relationships(model_name)
                if relationships:
                    print(f"\nRelationships for {model_name}:")
                    for rel_type, rels in relationships.items():
                        if rels:
                            print(f"\n{rel_type}:")
                            for rel in rels:
                                print(f"  - {rel['field']} -> {rel['model']} ({rel['string']})")
                else:
                    print(f"No relationships found for {model_name}")
                    
            elif choice == "13":
                output_file = input("Enter output file name (optional, press Enter for none): ") if is_interactive else ""
                analysis = self.analyze_for_mobile_app(output_file or None)
                if not output_file:
                    print(f"\nMobile app analysis:")
                    for model, data in analysis["models"].items():
                        print(f"\n{model}:")
                        print(f"  Key fields: {', '.join(f['name'] for f in data['key_fields'])}")
                        print(f"  Heavy fields: {', '.join(f['name'] for f in data['heavy_fields'])}")
                    
            elif choice == "14":
                output_file = input("Enter output file name (default: api_endpoints.md): ") or "api_endpoints.md" if is_interactive else "api_endpoints.md"
                summary = self.generate_api_endpoints_summary(output_file)
                print(f"Generated API endpoints summary in {output_file}")
                
            elif choice == "15":
                output_file = input("Enter output file name (default: mobile_llm_prompt.txt): ") or "mobile_llm_prompt.txt" if is_interactive else "mobile_llm_prompt.txt"
                app_desc = input("Enter app description (optional, press Enter for none): ") if is_interactive else ""
                framework = input("Enter framework (default: react-native): ") or "react-native" if is_interactive else "react-native"
                self.export_mobile_app_llm_prompt(output_file=output_file, app_description=app_desc, framework=framework)
                print(f"Exported mobile app LLM prompt to {output_file}")
                
            elif choice == "16":
                self.refresh_cache()
                print("Cache refreshed.")
                
            elif choice == "17":
                print("Exiting...")
                break
                
            elif choice == "18":
                model_name = input("Enter model name: ") if is_interactive else input()
                output_file = input("Enter output file name (default: mobile_dev_package.json): ") or "mobile_dev_package.json" if is_interactive else "mobile_dev_package.json"
                package = self.export_mobile_app_dev_package(model_name, output_file)
                if package:
                    print(f"Exported mobile app development package for {model_name} to {output_file}")
                else:
                    print(f"Failed to export package for {model_name}. Check logs for details.")
                
            else:
                print("Invalid choice. Please enter a number between 1 and 18.")
            
            # Pause only in interactive mode
            if is_interactive:
                try:
                    input("\nPress Enter to continue...")
                except EOFError:
                    print("Exiting interactive mode.")
                    break
            else:
                break  # Exit after one iteration in non-interactive mode

def main():
    """
    Main function to run the explorer
    """
    parser = argparse.ArgumentParser(description="Odoo Model Explorer")
    parser.add_argument("--url", required=True, help="Base URL of the Odoo server")
    parser.add_argument("--db", help="Database name")
    parser.add_argument("--username", help="Username for authentication")
    parser.add_argument("--password", help="Password for authentication")
    parser.add_argument("--interactive", action="store_true", help="Run in interactive mode")
    
    args = parser.parse_args()
    
    explorer = OdooModelExplorer(
        base_url=args.url,
        database=args.db,
        username=args.username,
        password=args.password
    )
    
    if args.interactive:
        explorer.explore()
    else:
        # Non-interactive mode: list models as an example
        models = explorer.get_models()
        if models:
            print("Available models:")
            for model in models[:20]:  # Limit to first 20 for brevity
                print(f" - {model}")
            if len(models) > 20:
                print(f"... and {len(models) - 20} more")
        else:
            print("No models found or API unavailable.")

if __name__ == "__main__":
    main()