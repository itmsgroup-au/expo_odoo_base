#!/usr/bin/env python3
import requests
import json
import base64
import time
import argparse
import sys
import os
from datetime import datetime
from uuid import uuid4
import pytest
import logging
from typing import Dict, Optional
from tenacity import retry, stop_after_attempt, wait_fixed, retry_if_exception_type

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Default configuration
DEFAULT_CONFIG = {
    "ODOO_URL": "https://stairmaster18.odoo-sandbox.com",
    "USERNAME": "ptadmin",
    "PASSWORD": "++Uke52br++",
    "DB": "STAIRMASTER_18_24032025",
    "CLIENT_ID": "ZqUAbvS6PIcOobKIjz4G4OuaKgm6pK9cpcpxBz1p",
    "CLIENT_SECRET": "ZDfR6WHORSfrGSl424G9zNu5yXhfle6PRMGpC69M"
}

# Load configuration from environment variables, config.json, or defaults
CONFIG = DEFAULT_CONFIG.copy()
CONFIG_SOURCE = "defaults"
if os.environ.get("ODOO_URL"):
    CONFIG["ODOO_URL"] = os.environ.get("ODOO_URL")
    CONFIG_SOURCE = "environment variables"
if os.environ.get("ODOO_USERNAME"):
    CONFIG["USERNAME"] = os.environ.get("ODOO_USERNAME")
    CONFIG_SOURCE = "environment variables"
if os.environ.get("ODOO_PASSWORD"):
    CONFIG["PASSWORD"] = os.environ.get("ODOO_PASSWORD")
    CONFIG_SOURCE = "environment variables"
if os.environ.get("ODOO_DB"):
    CONFIG["DB"] = os.environ.get("ODOO_DB")
    CONFIG_SOURCE = "environment variables"
if os.environ.get("ODOO_CLIENT_ID"):
    CONFIG["CLIENT_ID"] = os.environ.get("ODOO_CLIENT_ID")
    CONFIG_SOURCE = "environment variables"
if os.environ.get("ODOO_CLIENT_SECRET"):
    CONFIG["CLIENT_SECRET"] = os.environ.get("ODOO_CLIENT_SECRET")
    CONFIG_SOURCE = "environment variables"

CONFIG_FILE = "config.json"
if os.path.exists(CONFIG_FILE):
    with open(CONFIG_FILE, 'r') as f:
        CONFIG.update(json.load(f))
    CONFIG_SOURCE = "config.json"

ODOO_URL = CONFIG["ODOO_URL"]
USERNAME = CONFIG["USERNAME"]
PASSWORD = CONFIG["PASSWORD"]
DB = CONFIG["DB"]
CLIENT_ID = CONFIG["CLIENT_ID"]
CLIENT_SECRET = CONFIG["CLIENT_SECRET"]

logger.info(f"Loaded configuration from {CONFIG_SOURCE}")

# Global OAuth token cache
OAUTH_TOKEN = None
OAUTH_TOKEN_COUNT = 0

# Summary dictionary for JSON output
SUMMARY = {
    "timestamp": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
    "server": ODOO_URL,
    "database": DB,
    "auth": "Pending",
    "oauth_status": "Pending",
    "basic_auth_status": "Pending",
    "configuration_source": CONFIG_SOURCE,
    "oauth_tokens_fetched": 0,
    "endpoints_loaded": 0,
    "total_duration": 0.0,
    "tests": {}
}

def get_auth_headers(token: Optional[str] = None) -> Dict[str, str]:
    """Create auth headers with database info"""
    if token:
        return {
            'Authorization': f'Bearer {token}',
            'DATABASE': DB,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
    
    auth_str = f"{USERNAME}:{PASSWORD}"
    auth_bytes = auth_str.encode('ascii')
    auth_b64 = base64.b64encode(auth_bytes).decode('ascii')

    return {
        'Authorization': f'Basic {auth_b64}',
        'DATABASE': DB,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    }

@retry(stop=stop_after_attempt(2), wait=wait_fixed(1), retry=retry_if_exception_type((requests.ConnectionError, requests.Timeout)), reraise=True)
def get_oauth_token() -> Optional[str]:
    """Get OAuth2 token using password grant type"""
    global OAUTH_TOKEN, OAUTH_TOKEN_COUNT
    if OAUTH_TOKEN:
        logger.info("Using cached OAuth token")
        return OAUTH_TOKEN
    
    token_url = f"{ODOO_URL}/api/v2/authentication/oauth2/token"
    data = {
        'grant_type': 'password',
        'username': USERNAME,
        'password': PASSWORD,
        'client_id': CLIENT_ID,
        'client_secret': CLIENT_SECRET
    }
    
    start_time = time.time()
    try:
        response = requests.post(token_url, data=data, headers={'Content-Type': 'application/x-www-form-urlencoded'}, timeout=10)
        duration = time.time() - start_time
        if response.status_code == 200:
            token_data = response.json()
            OAUTH_TOKEN = token_data.get('access_token')
            OAUTH_TOKEN_COUNT += 1
            SUMMARY['oauth_tokens_fetched'] = OAUTH_TOKEN_COUNT
            logger.info(f"Got OAuth token in {duration:.2f}s (Total tokens fetched: {OAUTH_TOKEN_COUNT})")
            return OAUTH_TOKEN
        else:
            error_msg = f"Failed to get OAuth token: {response.status_code} - {response.text}"
            logger.error(error_msg)
            raise Exception(error_msg)
    except Exception as e:
        duration = time.time() - start_time
        logger.error(f"Error getting OAuth token: {str(e)}")
        raise

def validate_credentials() -> Dict[str, bool]:
    """Validate OAuth and Basic Auth credentials"""
    result = {"oauth": False, "basic": False}
    
    # Test OAuth
    try:
        token = get_oauth_token()
        if token:
            result["oauth"] = True
            SUMMARY['oauth_status'] = "Success"
    except Exception:
        logger.warning("OAuth validation failed. Verify CLIENT_ID and CLIENT_SECRET.")
        SUMMARY['oauth_status'] = "Failed"
    
    # Test Basic Auth
    url = f"{ODOO_URL}/api/v2/database"
    headers = get_auth_headers()
    try:
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            result["basic"] = True
            SUMMARY['basic_auth_status'] = "Success"
        else:
            logger.warning(f"Basic Auth validation failed: {response.status_code} - {response.text}")
            SUMMARY['basic_auth_status'] = "Failed"
    except Exception as e:
        logger.warning(f"Basic Auth validation error: {str(e)}")
        SUMMARY['basic_auth_status'] = "Failed"
    
    return result

@retry(stop=stop_after_attempt(2), wait=wait_fixed(1), retry=retry_if_exception_type((requests.ConnectionError, requests.Timeout)), reraise=True)
def get_company_info(token: Optional[str] = None) -> Dict:
    """Get company information"""
    url = f"{ODOO_URL}/api/v2/company"
    headers = get_auth_headers(token)
    
    start_time = time.time()
    try:
        logger.info("Fetching company information...")
        response = requests.get(url, headers=headers, timeout=10)
        duration = time.time() - start_time
        if response.status_code == 200:
            company_data = response.json()
            logger.info(f"Company data fetched in {duration:.2f}s")
            return {"status": "success", "data": company_data, "duration": duration}
        else:
            error_msg = f"Failed to get company info: {response.status_code} - {response.text}"
            logger.error(error_msg)
            return {"status": "failed", "error": error_msg, "duration": duration}
    except Exception as e:
        duration = time.time() - start_time
        error_msg = f"Error fetching company info: {str(e)}"
        logger.error(error_msg)
        return {"status": "failed", "error": error_msg, "duration": duration}

@retry(stop=stop_after_attempt(2), wait=wait_fixed(1), retry=retry_if_exception_type((requests.ConnectionError, requests.Timeout)), reraise=True)
def get_database_info(token: Optional[str] = None) -> Dict:
    """Get database information"""
    url = f"{ODOO_URL}/api/v2/database"
    headers = get_auth_headers(token)
    
    start_time = time.time()
    try:
        logger.info("Fetching database information...")
        response = requests.get(url, headers=headers, timeout=10)
        duration = time.time() - start_time
        if response.status_code == 200:
            db_data = response.json()
            logger.info(f"Database data fetched in {duration:.2f}s")
            return {"status": "success", "data": db_data, "duration": duration}
        else:
            error_msg = f"Failed to get database info: {response.status_code} - {response.text}"
            logger.error(error_msg)
            return {"status": "failed", "error": error_msg, "duration": duration}
    except Exception as e:
        duration = time.time() - start_time
        error_msg = f"Error fetching database info: {str(e)}"
        logger.error(error_msg)
        return {"status": "failed", "error": error_msg, "duration": duration}

@retry(stop=stop_after_attempt(2), wait=wait_fixed(1), retry=retry_if_exception_type((requests.ConnectionError, requests.Timeout)), reraise=True)
def get_modules(token: Optional[str] = None) -> Dict:
    """Get installed modules"""
    url = f"{ODOO_URL}/api/v2/modules"
    headers = get_auth_headers(token)
    
    start_time = time.time()
    try:
        logger.info("Fetching modules...")
        response = requests.get(url, headers=headers, timeout=10)
        duration = time.time() - start_time
        if response.status_code == 200:
            modules_data = response.json()
            logger.info(f"Modules data fetched in {duration:.2f}s")
            return {"status": "success", "data": modules_data, "duration": duration}
        else:
            error_msg = f"Failed to get modules: {response.status_code} - {response.text}"
            logger.error(error_msg)
            return {"status": "failed", "error": error_msg, "duration": duration}
    except Exception as e:
        duration = time.time() - start_time
        error_msg = f"Error fetching modules: {str(e)}"
        logger.error(error_msg)
        return {"status": "failed", "error": error_msg, "duration": duration}

@retry(stop=stop_after_attempt(2), wait=wait_fixed(1), retry=retry_if_exception_type((requests.ConnectionError, requests.Timeout)), reraise=True)
def get_session_info(token: Optional[str] = None) -> Dict:
    """Get session information"""
    url = f"{ODOO_URL}/api/v2/session"
    headers = get_auth_headers(token)
    
    start_time = time.time()
    try:
        logger.info("Fetching session information...")
        response = requests.get(url, headers=headers, timeout=10)
        duration = time.time() - start_time
        if response.status_code == 200:
            session_data = response.json()
            logger.info(f"Session data fetched in {duration:.2f}s")
            return {"status": "success", "data": session_data, "duration": duration}
        else:
            error_msg = f"Failed to get session info: {response.status_code} - {response.text}"
            logger.error(error_msg)
            return {"status": "failed", "error": error_msg, "duration": duration}
    except Exception as e:
        duration = time.time() - start_time
        error_msg = f"Error fetching session info: {str(e)}"
        logger.error(error_msg)
        return {"status": "failed", "error": error_msg, "duration": duration}

@retry(stop=stop_after_attempt(2), wait=wait_fixed(1), retry=retry_if_exception_type((requests.ConnectionError, requests.Timeout)), reraise=True)
def get_user(token: Optional[str] = None) -> Dict:
    """Get user information"""
    url = f"{ODOO_URL}/api/v2/user"
    headers = get_auth_headers(token)
    
    start_time = time.time()
    try:
        logger.info("Fetching user information...")
        response = requests.get(url, headers=headers, timeout=10)
        duration = time.time() - start_time
        if response.status_code == 200:
            user_data = response.json()
            logger.info(f"User data fetched in {duration:.2f}s")
            return {"status": "success", "data": user_data, "duration": duration}
        else:
            error_msg = f"Failed to get user info: {response.status_code} - {response.text}"
            logger.error(error_msg)
            return {"status": "failed", "error": error_msg, "duration": duration}
    except Exception as e:
        duration = time.time() - start_time
        error_msg = f"Error fetching user info: {str(e)}"
        logger.error(error_msg)
        return {"status": "failed", "error": error_msg, "duration": duration}

@retry(stop=stop_after_attempt(2), wait=wait_fixed(1), retry=retry_if_exception_type((requests.ConnectionError, requests.Timeout)), reraise=True)
def get_user_info(token: Optional[str] = None) -> Dict:
    """Get detailed user information"""
    url = f"{ODOO_URL}/api/v2/userinfo"
    headers = get_auth_headers(token)
    
    start_time = time.time()
    try:
        logger.info("Fetching detailed user information...")
        response = requests.get(url, headers=headers, timeout=10)
        duration = time.time() - start_time
        if response.status_code == 200:
            user_data = response.json()
            logger.info(f"Detailed user data fetched in {duration:.2f}s")
            return {"status": "success", "data": user_data, "duration": duration}
        else:
            error_msg = f"Failed to get detailed user info: {response.status_code} - {response.text}"
            logger.error(error_msg)
            return {"status": "failed", "error": error_msg, "duration": duration}
    except Exception as e:
        duration = time.time() - start_time
        error_msg = f"Error fetching detailed user info: {str(e)}"
        logger.error(error_msg)
        return {"status": "failed", "error": error_msg, "duration": duration}

@retry(stop=stop_after_attempt(2), wait=wait_fixed(1), retry=retry_if_exception_type((requests.ConnectionError, requests.Timeout)), reraise=True)
def get_xmlid(xmlid: str, token: Optional[str] = None) -> Dict:
    """Get specific XML ID information"""
    url = f"{ODOO_URL}/api/v2/xmlid/{xmlid}"
    headers = get_auth_headers(token)
    
    start_time = time.time()
    try:
        logger.info(f"Fetching XML ID: {xmlid}...")
        response = requests.get(url, headers=headers, timeout=10)
        duration = time.time() - start_time
        if response.status_code == 200:
            xmlid_data = response.json()
            logger.info(f"XML ID data fetched in {duration:.2f}s")
            return {"status": "success", "data": xmlid_data, "duration": duration}
        else:
            error_msg = f"Failed to get XML ID {xmlid}: {response.status_code} - {response.text}"
            logger.error(error_msg)
            return {"status": "failed", "error": error_msg, "duration": duration}
    except Exception as e:
        duration = time.time() - start_time
        error_msg = f"Error fetching XML ID {xmlid}: {str(e)}"
        logger.error(error_msg)
        return {"status": "failed", "error": error_msg, "duration": duration}

@retry(stop=stop_after_attempt(2), wait=wait_fixed(1), retry=retry_if_exception_type((requests.ConnectionError, requests.Timeout)), reraise=True)
def get_all_companies(token: Optional[str] = None) -> Dict:
    """Get all companies"""
    url = f"{ODOO_URL}/api/v2/custom/contacts/companies"
    headers = get_auth_headers(token)
    
    start_time = time.time()
    try:
        logger.info("Fetching all companies...")
        response = requests.get(url, headers=headers, timeout=10)
        duration = time.time() - start_time
        if response.status_code == 200:
            companies = response.json()
            logger.info(f"Retrieved {len(companies)} companies in {duration:.2f}s")
            return {"status": "success", "data": f"Retrieved {len(companies)} companies", "duration": duration}
        else:
            error_msg = f"Failed to get companies: {response.status_code} - {response.text}"
            logger.error(error_msg)
            return {"status": "failed", "error": error_msg, "duration": duration}
    except Exception as e:
        duration = time.time() - start_time
        error_msg = f"Error fetching companies: {str(e)}"
        logger.error(error_msg)
        return {"status": "failed", "error": error_msg, "duration": duration}

@retry(stop=stop_after_attempt(2), wait=wait_fixed(1), retry=retry_if_exception_type((requests.ConnectionError, requests.Timeout)), reraise=True)
def create_contact(values: Dict, token: Optional[str] = None) -> Dict:
    """Create a contact using custom endpoint"""
    url = f"{ODOO_URL}/api/v2/custom/contacts/create"
    headers = get_auth_headers(token)
    
    start_time = time.time()
    try:
        logger.info(f"Creating contact with values: {json.dumps(values, indent=2)}")
        response = requests.post(url, json=values, headers=headers, timeout=10)
        duration = time.time() - start_time
        if response.status_code == 200:
            contact_id = response.json()
            logger.info(f"Successfully created contact with ID: {contact_id} in {duration:.2f}s")
            return {"status": "success", "data": f"Created contact with ID: {contact_id}", "duration": duration}
        else:
            error_msg = f"Failed to create contact: {response.status_code} - {response.text}"
            logger.error(error_msg)
            return {"status": "failed", "error": error_msg, "duration": duration}
    except Exception as e:
        duration = time.time() - start_time
        error_msg = f"Error creating contact: {str(e)}"
        logger.error(error_msg)
        return {"status": "failed", "error": error_msg, "duration": duration}

@retry(stop=stop_after_attempt(2), wait=wait_fixed(1), retry=retry_if_exception_type((requests.ConnectionError, requests.Timeout)), reraise=True)
def get_database_list(token: Optional[str] = None) -> Dict:
    """Get list of databases"""
    url = f"{ODOO_URL}/api/v2/database/list"
    headers = get_auth_headers(token)
    
    start_time = time.time()
    try:
        logger.info("Fetching database list...")
        response = requests.get(url, headers=headers, timeout=10)
        duration = time.time() - start_time
        if response.status_code == 200:
            db_list = response.json()
            logger.info(f"Database list fetched in {duration:.2f}s")
            return {"status": "success", "data": db_list, "duration": duration}
        else:
            error_msg = f"Failed to get database list: {response.status_code} - {response.text}"
            logger.error(error_msg)
            return {"status": "failed", "error": error_msg, "duration": duration}
    except Exception as e:
        duration = time.time() - start_time
        error_msg = f"Error fetching database list: {str(e)}"
        logger.error(error_msg)
        return {"status": "failed", "error": error_msg, "duration": duration}

@retry(stop=stop_after_attempt(2), wait=wait_fixed(1), retry=retry_if_exception_type((requests.ConnectionError, requests.Timeout)), reraise=True)
def get_models(token: Optional[str] = None) -> Dict:
    """Get list of available models"""
    url = f"{ODOO_URL}/api/v2/models"
    headers = get_auth_headers(token)
    
    start_time = time.time()
    try:
        logger.info("Fetching available models...")
        response = requests.get(url, headers=headers, timeout=10)
        duration = time.time() - start_time
        if response.status_code == 200:
            models_data = response.json()
            logger.info(f"Models data fetched in {duration:.2f}s")
            return {"status": "success", "data": models_data, "duration": duration}
        else:
            error_msg = f"Failed to get models: {response.status_code} - {response.text}"
            logger.error(error_msg)
            return {"status": "failed", "error": error_msg, "duration": duration}
    except Exception as e:
        duration = time.time() - start_time
        error_msg = f"Error fetching models: {str(e)}"
        logger.error(error_msg)
        return {"status": "failed", "error": error_msg, "duration": duration}

@retry(stop=stop_after_attempt(2), wait=wait_fixed(1), retry=retry_if_exception_type((requests.ConnectionError, requests.Timeout)), reraise=True)
def get_partner_fields(token: Optional[str] = None) -> Dict:
    """Get field attributes for res.partner"""
    url = f"{ODOO_URL}/api/v2/fields/res.partner"
    headers = get_auth_headers(token)
    
    start_time = time.time()
    try:
        logger.info("Fetching res.partner field attributes...")
        response = requests.get(url, headers=headers, timeout=10)
        duration = time.time() - start_time
        if response.status_code == 200:
            fields_data = response.json()
            logger.info(f"Partner fields data fetched in {duration:.2f}s")
            return {"status": "success", "data": f"Retrieved {len(fields_data)} fields", "duration": duration}
        else:
            error_msg = f"Failed to get partner fields: {response.status_code} - {response.text}"
            logger.error(error_msg)
            return {"status": "failed", "error": error_msg, "duration": duration}
    except Exception as e:
        duration = time.time() - start_time
        error_msg = f"Error fetching partner fields: {str(e)}"
        logger.error(error_msg)
        return {"status": "failed", "error": error_msg, "duration": duration}

@retry(stop=stop_after_attempt(2), wait=wait_fixed(1), retry=retry_if_exception_type((requests.ConnectionError, requests.Timeout)), reraise=True)
def get_partner_access(token: Optional[str] = None, partner_id: Optional[int] = None) -> Dict:
    """Check access permissions for res.partner with optional partner ID"""
    url = f"{ODOO_URL}/api/v2/access/res.partner"
    headers = get_auth_headers(token)
    params = {'context': json.dumps({'active_test': True})}
    
    if partner_id:
        params['ids'] = json.dumps([partner_id])
    
    start_time = time.time()
    try:
        logger.info(f"Checking access permissions for res.partner{' with ID: ' + str(partner_id) if partner_id else ''}...")
        response = requests.get(url, headers=headers, params=params, timeout=10)
        duration = time.time() - start_time
        if response.status_code == 200:
            access_data = response.json()
            logger.info(f"Partner access data fetched in {duration:.2f}s: {json.dumps(access_data, indent=2)}")
            note = None
            if access_data is None:
                note = "Null response received. Verify permissions or endpoint configuration."
                logger.warning(f"Received null response for partner ID {partner_id or 'None'}. Verify expected behavior.")
            return {"status": "success", "data": access_data, "duration": duration, "partner_id": partner_id, "note": note}
        else:
            error_msg = f"Failed to get partner access: {response.status_code} - {response.text}"
            logger.error(error_msg)
            return {"status": "failed", "error": error_msg, "duration": duration, "partner_id": partner_id}
    except Exception as e:
        duration = time.time() - start_time
        error_msg = f"Error fetching partner access: {str(e)}"
        logger.error(error_msg)
        return {"status": "failed", "error": error_msg, "duration": duration, "partner_id": partner_id}

@retry(stop=stop_after_attempt(2), wait=wait_fixed(1), retry=retry_if_exception_type((requests.ConnectionError, requests.Timeout)), reraise=True)
def get_countries(token: Optional[str] = None) -> Dict:
    """Get list of countries"""
    url = f"{ODOO_URL}/api/v2/countries"
    headers = get_auth_headers(token)
    
    start_time = time.time()
    try:
        logger.info("Fetching countries...")
        response = requests.get(url, headers=headers, timeout=10)
        duration = time.time() - start_time
        if response.status_code == 200:
            countries_data = response.json()
            logger.info(f"Countries data fetched in {duration:.2f}s")
            return {"status": "success", "data": f"Retrieved {len(countries_data)} countries", "duration": duration}
        else:
            error_msg = f"Failed to get countries: {response.status_code} - {response.text}"
            logger.error(error_msg)
            return {"status": "failed", "error": error_msg, "duration": duration}
    except Exception as e:
        duration = time.time() - start_time
        error_msg = f"Error fetching countries: {str(e)}"
        logger.error(error_msg)
        return {"status": "failed", "error": error_msg, "duration": duration}

@retry(stop=stop_after_attempt(2), wait=wait_fixed(1), retry=retry_if_exception_type((requests.ConnectionError, requests.Timeout)), reraise=True)
def get_partners(limit: int = 5, token: Optional[str] = None) -> Dict:
    """Get a list of partners"""
    url = f"{ODOO_URL}/api/v2/search_read"
    headers = get_auth_headers(token)
    domain = ["|", ["is_company", "=", True], ["parent_id", "=", False]]
    params = {
        'model': 'res.partner',
        'domain': json.dumps(domain),
        'fields': json.dumps(['name', 'id', 'email', 'phone']),
        'limit': limit,
        'order': 'id desc'
    }
    
    start_time = time.time()
    try:
        logger.info(f"Fetching {limit} partners...")
        response = requests.get(url, headers=headers, params=params, timeout=10)
        duration = time.time() - start_time
        if response.status_code == 200:
            partners = response.json()
            if isinstance(partners, dict):
                partners = partners.get('result', [])
            logger.info(f"Successfully retrieved {len(partners)} partners in {duration:.2f}s")
            return {"status": "success", "data": f"Retrieved {len(partners)} partners", "duration": duration, "partners": partners}
        else:
            error_msg = f"Failed to get partners: {response.status_code} - {response.text}"
            logger.error(error_msg)
            return {"status": "failed", "error": error_msg, "duration": duration}
    except Exception as e:
        duration = time.time() - start_time
        error_msg = f"Error fetching partners: {str(e)}"
        logger.error(error_msg)
        return {"status": "failed", "error": error_msg, "duration": duration}

@retry(stop=stop_after_attempt(2), wait=wait_fixed(1), retry=retry_if_exception_type((requests.ConnectionError, requests.Timeout)), reraise=True)
def create_partner(values: Dict, token: Optional[str] = None) -> Dict:
    """Create a partner record"""
    url = f"{ODOO_URL}/api/v2/create/res.partner"
    headers = get_auth_headers(token)
    params = {'values': json.dumps(values)}
    
    start_time = time.time()
    try:
        logger.info(f"Creating partner with values: {json.dumps(values, indent=2)}")
        response = requests.post(url, headers=headers, params=params, timeout=10)
        duration = time.time() - start_time
        if response.status_code == 200:
            partner_id = response.json()[0]
            logger.info(f"Successfully created partner with ID: {partner_id} in {duration:.2f}s")
            return {"status": "success", "data": partner_id, "duration": duration}
        else:
            error_msg = f"Failed to create partner: {response.status_code} - {response.text}"
            logger.error(error_msg)
            return {"status": "failed", "error": error_msg, "duration": duration}
    except Exception as e:
        duration = time.time() - start_time
        error_msg = f"Error creating partner: {str(e)}"
        logger.error(error_msg)
        return {"status": "failed", "error": error_msg, "duration": duration}

@retry(stop=stop_after_attempt(2), wait=wait_fixed(1), retry=retry_if_exception_type((requests.ConnectionError, requests.Timeout)), reraise=True)
def read_partner(partner_id: int, token: Optional[str] = None, fields: Optional[list] = None) -> Dict:
    """Read a partner record"""
    url = f"{ODOO_URL}/api/v2/read/res.partner"
    headers = get_auth_headers(token)
    params = {
        'ids': json.dumps([partner_id]),
        'fields': json.dumps(fields or ['name', 'email', 'phone', 'active', 'is_company'])
    }
    
    start_time = time.time()
    try:
        logger.info(f"Reading partner with ID: {partner_id}")
        response = requests.get(url, headers=headers, params=params, timeout=10)
        duration = time.time() - start_time
        if response.status_code == 200:
            partner_data = response.json()
            if partner_data:
                logger.info(f"Partner data fetched in {duration:.2f}s: {json.dumps(partner_data[0], indent=2)}")
                return {"status": "success", "data": partner_data[0], "duration": duration}
            else:
                error_msg = f"No data found for partner ID: {partner_id}"
                logger.error(error_msg)
                return {"status": "failed", "error": error_msg, "duration": duration}
        else:
            error_msg = f"Failed to read partner: {response.status_code} - {response.text}"
            logger.error(error_msg)
            return {"status": "failed", "error": error_msg, "duration": duration}
    except Exception as e:
        duration = time.time() - start_time
        error_msg = f"Error reading partner: {str(e)}"
        logger.error(error_msg)
        return {"status": "failed", "error": error_msg, "duration": duration}

@retry(stop=stop_after_attempt(2), wait=wait_fixed(1), retry=retry_if_exception_type((requests.ConnectionError, requests.Timeout)), reraise=True)
def update_partner(partner_id: int, values: Dict, token: Optional[str] = None) -> Dict:
    """Update a partner record"""
    url = f"{ODOO_URL}/api/v2/write/res.partner"
    headers = get_auth_headers(token)
    params = {
        'ids': json.dumps([partner_id]),
        'values': json.dumps(values)
    }
    
    start_time = time.time()
    try:
        logger.info(f"Updating partner {partner_id} with values: {json.dumps(values, indent=2)}")
        response = requests.put(url, headers=headers, params=params, timeout=10)
        duration = time.time() - start_time
        if response.status_code == 200:
            logger.info(f"Successfully updated partner in {duration:.2f}s")
            return {"status": "success", "data": f"Updated partner {partner_id}", "duration": duration}
        else:
            error_msg = f"Failed to update partner: {response.status_code} - {response.text}"
            logger.error(error_msg)
            return {"status": "failed", "error": error_msg, "duration": duration}
    except Exception as e:
        duration = time.time() - start_time
        error_msg = f"Error updating partner: {str(e)}"
        logger.error(error_msg)
        return {"status": "failed", "error": error_msg, "duration": duration}

@retry(stop=stop_after_attempt(2), wait=wait_fixed(1), retry=retry_if_exception_type((requests.ConnectionError, requests.Timeout)), reraise=True)
def delete_partner(partner_id: int, token: Optional[str] = None) -> Dict:
    """Delete a partner record"""
    url = f"{ODOO_URL}/api/v2/unlink/res.partner"
    headers = get_auth_headers(token)
    params = {'ids': json.dumps([partner_id])}
    
    start_time = time.time()
    try:
        logger.info(f"Deleting partner with ID: {partner_id}")
        response = requests.delete(url, headers=headers, params=params, timeout=10)
        duration = time.time() - start_time
        if response.status_code == 200:
            logger.info(f"Successfully deleted partner in {duration:.2f}s")
            return {"status": "success", "data": f"Deleted partner {partner_id}", "duration": duration}
        else:
            error_msg = f"Failed to delete partner: {response.status_code} - {response.text}"
            logger.error(error_msg)
            return {"status": "failed", "error": error_msg, "duration": duration}
    except Exception as e:
        duration = time.time() - start_time
        error_msg = f"Error deleting partner: {str(e)}"
        logger.error(error_msg)
        return {"status": "failed", "error": error_msg, "duration": duration}

def test_oauth() -> Dict:
    """Test OAuth token generation and API call"""
    start_time = time.time()
    token = get_oauth_token()
    if not token:
        error_msg = "OAuth token retrieval failed. Skipping OAuth test."
        logger.error(error_msg)
        return {"status": "failed", "error": error_msg, "duration": time.time() - start_time}
    
    url = f"{ODOO_URL}/api/v2/user"
    headers = get_auth_headers(token)
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        duration = time.time() - start_time
        logger.info(f"OAuth API call response: {response.status_code}")
        return {"status": "success" if response.status_code == 200 else "failed", 
                "data": f"OAuth API call response: {response.status_code}", 
                "duration": duration}
    except Exception as e:
        duration = time.time() - start_time
        error_msg = f"Error in OAuth API call: {str(e)}"
        logger.error(error_msg)
        return {"status": "failed", "error": error_msg, "duration": duration}

def load_endpoints() -> Dict:
    """Load endpoints from muk_rest_endpoints.json"""
    endpoints_file = "muk_rest_endpoints.json"
    try:
        if os.path.exists(endpoints_file):
            with open(endpoints_file, 'r') as f:
                endpoints_data = json.load(f)
            logger.info(f"Loaded {len(endpoints_data.get('paths', {}))} endpoints from {endpoints_file}")
            SUMMARY['endpoints_loaded'] = len(endpoints_data.get('paths', {}))
            return endpoints_data.get('paths', {})
        else:
            logger.warning(f"{endpoints_file} not found, using default endpoints")
            default_endpoints = {
                "/api/v2/company": {"method": "GET", "name": "Get Company Info"},
                "/api/v2/database": {"method": "GET", "name": "Get Database Info"},
                "/api/v2/modules": {"method": "GET", "name": "Get Modules"},
                "/api/v2/session": {"method": "GET", "name": "Get Session Info"},
                "/api/v2/user": {"method": "GET", "name": "Get User"},
                "/api/v2/userinfo": {"method": "GET", "name": "Get User Info"},
                "/api/v2/custom/contacts/companies": {"method": "GET", "name": "Get All Companies"},
                "/api/v2/custom/contacts/create": {"method": "POST", "name": "Create Contact"},
                "/api/v2/database/list": {"method": "GET", "name": "Get Database List"},
                "/api/v2/models": {"method": "GET", "name": "Get Models"},
                "/api/v2/fields/res.partner": {"method": "GET", "name": "Get Partner Fields"},
                "/api/v2/countries": {"method": "GET", "name": "Get Countries"},
                "/api/v2/search_read": {"method": "GET", "name": "Get Partners"},
                "/api/v2/create/res.partner": {"method": "POST", "name": "Create Partner"},
                "/api/v2/read/res.partner": {"method": "GET", "name": "Read Partner"},
                "/api/v2/write/res.partner": {"method": "PUT", "name": "Update Partner"},
                "/api/v2/unlink/res.partner": {"method": "DELETE", "name": "Delete Partner"},
                "/api/v2/access/res.partner": {"method": "GET", "name": "Get Partner Access"},
                "/api/v2/authentication/oauth2/token": {"method": "POST", "name": "OAuth Token"}
            }
            SUMMARY['endpoints_loaded'] = len(default_endpoints)
            return default_endpoints
    except Exception as e:
        logger.error(f"Error loading {endpoints_file}: {str(e)}")
        SUMMARY['endpoints_loaded'] = 0
        return {}

def write_summary(results: Dict, token_used: bool, endpoints: Dict, total_duration: float, auth_status: Dict[str, bool], json_summary: bool) -> None:
    """Write test summary to file and print to screen, with optional JSON output"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    txt_filename = f"testodoo_summary_{timestamp}.txt"
    json_filename = f"testodoo_summary_{timestamp}.json" if json_summary else None
    summary = []
    
    # Update SUMMARY dictionary
    SUMMARY['timestamp'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    SUMMARY['auth'] = 'Bearer Token' if token_used else 'Basic Auth'
    SUMMARY['total_duration'] = total_duration
    SUMMARY['tests'] = results

    # Header
    summary.append("==== ODOO REST API TEST SUMMARY ====")
    summary.append(f"Timestamp: {SUMMARY['timestamp']}")
    summary.append(f"Server: {ODOO_URL}")
    summary.append(f"Database: {DB}")
    summary.append(f"Auth: {'Bearer Token' if token_used else 'Basic Auth'}")
    summary.append(f"OAuth Status: {'Success' if auth_status['oauth'] else 'Failed'}")
    summary.append(f"Basic Auth Status: {'Success' if auth_status['basic'] else 'Failed'}")
    summary.append(f"Configuration Source: {CONFIG_SOURCE}")
    summary.append(f"OAuth Tokens Fetched: {OAUTH_TOKEN_COUNT}")
    summary.append(f"Endpoints Loaded: {len(endpoints)}")
    summary.append(f"Total Duration: {total_duration:.2f}s")
    summary.append("===================================\n")

    # Common Endpoints
    summary.append("--- 1. COMMON ENDPOINTS ---")
    for endpoint, result in results["common"].items():
        summary.append(f"{endpoint}:")
        if isinstance(result, dict) and "status" in result:
            if result["status"] == "success":
                summary.append(f"  Status: Success")
                summary.append(f"  Duration: {result['duration']:.2f}s")
                if endpoint not in ["Get Modules", "Get Session Info"]:
                    summary.append(f"  Data: {json.dumps(result['data'], indent=2)[:500]}..." if len(json.dumps(result['data'])) > 500 else f"  Data: {json.dumps(result['data'], indent=2)}")
            elif result["status"] == "skipped":
                summary.append(f"  Status: Skipped")
                summary.append(f"  Data: {result['data']}")
            else:
                summary.append(f"  Status: Failed")
                summary.append(f"  Duration: {result['duration']:.2f}s")
                summary.append(f"  Error: {result['error']}")
        else:
            summary.append(f"  Status: Failed")
            summary.append(f"  Error: Invalid result format for {endpoint}")
        summary.append("")

    # Custom Endpoints
    summary.append("--- 2. CUSTOM ENDPOINTS ---")
    for endpoint, result in results["custom"].items():
        summary.append(f"{endpoint}:")
        if isinstance(result, dict) and "status" in result:
            if result["status"] == "success":
                summary.append(f"  Status: Success")
                summary.append(f"  Duration: {result['duration']:.2f}s")
                summary.append(f"  Data: {result['data']}")
            elif result["status"] == "skipped":
                summary.append(f"  Status: Skipped")
                summary.append(f"  Data: {result['data']}")
            else:
                summary.append(f"  Status: Failed")
                summary.append(f"  Duration: {result['duration']:.2f}s")
                summary.append(f"  Error: {result['error']}")
        else:
            summary.append(f"  Status: Failed")
            summary.append(f"  Error: Invalid result format for {endpoint}")
        summary.append("")

    # Database Endpoints
    summary.append("--- 3. DATABASE ENDPOINTS ---")
    result = results["database"].get("Get Database List", {"status": "failed", "error": "Result missing", "duration": 0})
    summary.append("Get Database List:")
    if isinstance(result, dict) and "status" in result:
        if result["status"] == "success":
            summary.append(f"  Status: Success")
            summary.append(f"  Duration: {result['duration']:.2f}s")
            summary.append(f"  Data: {json.dumps(result['data'], indent=2)}")
        elif result["status"] == "skipped":
            summary.append(f"  Status: Skipped")
            summary.append(f"  Data: {result['data']}")
        else:
            summary.append(f"  Status: Failed")
            summary.append(f"  Duration: {result['duration']:.2f}s")
            summary.append(f"  Error: {result['error']}")
    else:
        summary.append(f"  Status: Failed")
        summary.append(f"  Error: Invalid result format for Get Database List")
    summary.append("")

    # System Endpoints
    summary.append("--- 4. SYSTEM ENDPOINTS ---")
    for endpoint, result in results["system"].items():
        summary.append(f"{endpoint}:")
        if isinstance(result, dict) and "status" in result:
            if result["status"] == "success":
                summary.append(f"  Status: Success")
                summary.append(f"  Duration: {result['duration']:.2f}s")
                summary.append(f"  Data: {result['data']}")
            elif result["status"] == "skipped":
                summary.append(f"  Status: Skipped")
                summary.append(f"  Data: {result['data']}")
            else:
                summary.append(f"  Status: Failed")
                summary.append(f"  Duration: {result['duration']:.2f}s")
                summary.append(f"  Error: {result['error']}")
        else:
            summary.append(f"  Status: Failed")
            summary.append(f"  Error: Invalid result format for {endpoint}")
        summary.append("")

    # Security Endpoints
    summary.append("--- 5. SECURITY ENDPOINTS ---")
    for key, result in results["security"].items():
        partner_id = result.get('partner_id', 'None')
        summary.append(f"Get Partner Access (ID: {partner_id}):")
        if isinstance(result, dict) and "status" in result:
            if result["status"] == "success":
                summary.append(f"  Status: Success")
                summary.append(f"  Duration: {result['duration']:.2f}s")
                summary.append(f"  Partner ID: {partner_id}")
                summary.append(f"  Data: {json.dumps(result['data'], indent=2)}")
                if result.get('note'):
                    summary.append(f"  Note: {result['note']}")
            elif result["status"] == "skipped":
                summary.append(f"  Status: Skipped")
                summary.append(f"  Data: {result['data']}")
            else:
                summary.append(f"  Status: Failed")
                summary.append(f"  Duration: {result['duration']:.2f}s")
                summary.append(f"  Partner ID: {partner_id}")
                summary.append(f"  Error: {result['error']}")
        else:
            summary.append(f"  Status: Failed")
            summary.append(f"  Error: Invalid result format for Get Partner Access (ID: {partner_id})")
        summary.append("")

    # Server Endpoints
    summary.append("--- 6. SERVER ENDPOINTS ---")
    result = results["server"].get("Get Countries", {"status": "failed", "error": "Result missing", "duration": 0})
    summary.append("Get Countries:")
    if isinstance(result, dict) and "status" in result:
        if result["status"] == "success":
            summary.append(f"  Status: Success")
            summary.append(f"  Duration: {result['duration']:.2f}s")
            summary.append(f"  Data: {result['data']}")
        elif result["status"] == "skipped":
            summary.append(f"  Status: Skipped")
            summary.append(f"  Data: {result['data']}")
        else:
            summary.append(f"  Status: Failed")
            summary.append(f"  Duration: {result['duration']:.2f}s")
            summary.append(f"  Error: {result['error']}")
    else:
        summary.append(f"  Status: Failed")
        summary.append(f"  Error: Invalid result format for Get Countries")
    summary.append("")

    # Partner Operations
    summary.append("--- 7. PARTNER OPERATIONS ---")
    for op, result in results["partner"].items():
        summary.append(f"{op.replace('_', ' ').title()}:")
        if isinstance(result, dict) and "status" in result:
            if result["status"] == "success":
                summary.append(f"  Status: Success")
                summary.append(f"  Duration: {result['duration']:.2f}s")
                summary.append(f"  Data: {json.dumps(result['data'], indent=2) if isinstance(result['data'], dict) else result['data']}")
                if result.get('note'):
                    summary.append(f"  Note: {result['note']}")
            elif result["status"] == "skipped":
                summary.append(f"  Status: Skipped")
                summary.append(f"  Data: {result['data']}")
            else:
                summary.append(f"  Status: Failed")
                summary.append(f"  Duration: {result['duration']:.2f}s")
                summary.append(f"  Error: {result['error']}")
        else:
            summary.append(f"  Status: Failed")
            summary.append(f"  Error: Invalid result format for {op}")
        summary.append("")

    # OAuth Test
    summary.append("--- 8. OAUTH TEST ---")
    result = results["oauth"].get("Test OAuth", {"status": "failed", "error": "Result missing", "duration": 0})
    summary.append("OAuth Token and User Info:")
    if isinstance(result, dict) and "status" in result:
        if result["status"] == "success":
            summary.append(f"  Status: Success")
            summary.append(f"  Duration: {result['duration']:.2f}s")
            summary.append(f"  Data: {result['data']}")
        elif result["status"] == "skipped":
            summary.append(f"  Status: Skipped")
            summary.append(f"  Data: {result['data']}")
        else:
            summary.append(f"  Status: Failed")
            summary.append(f"  Duration: {result['duration']:.2f}s")
            summary.append(f"  Error: {result['error']}")
    else:
        summary.append(f"  Status: Failed")
        summary.append(f"  Error: Invalid result format for OAuth test")
    summary.append("")

    # Recommendations
    summary.append("--- 9. RECOMMENDATIONS ---")
    if not auth_status["oauth"]:
        summary.append("- OAuth authentication failed. Verify CLIENT_ID and CLIENT_SECRET in Odoo OAuth settings.")
    if not auth_status["basic"]:
        summary.append("- Basic authentication failed. Verify USERNAME and PASSWORD for user 'ptadmin'.")
    null_access = any(result.get('data') is None for result in results["security"].values() if result.get('status') == "success")
    if null_access:
        summary.append("- Investigate null responses from /api/v2/access/res.partner. Check muk_rest_endpoints.json, user permissions, or contact MuK IT support.")
    if results["partner"].get("delete_partner", {}).get("status") == "skipped":
        summary.append("- Consider enabling --cleanup to delete test partners to avoid database clutter.")
    if results["partner"].get("get_partners", {}).get("status") != "success":
        summary.append("- Partner listing failed, skipping CRUD operations. Verify authentication for /api/v2/search_read.")
    if OAUTH_TOKEN_COUNT > 5:
        summary.append(f"- Excessive OAuth token requests ({OAUTH_TOKEN_COUNT}). Optimize token caching.")
    summary.append("- Use environment variables (ODOO_CLIENT_ID, ODOO_CLIENT_SECRET, etc.) for secure credential management.")
    summary.append("- Check MuK REST documentation for endpoint-specific auth requirements.")

    # Print to screen
    print("\n" + "\n".join(summary))

    # Write to text file
    try:
        logger.info(f"Writing summary to {txt_filename}")
        with open(txt_filename, 'w') as f:
            f.write("\n".join(summary))
        logger.info(f"Summary successfully written to {txt_filename}")
    except Exception as e:
        logger.error(f"Error writing summary to file: {str(e)}")

    # Write to JSON file
    if json_summary:
        try:
            logger.info(f"Writing JSON summary to {json_filename}")
            with open(json_filename, 'w') as f:
                json.dump(SUMMARY, f, indent=2)
            logger.info(f"JSON summary successfully written to {json_filename}")
        except Exception as e:
            logger.error(f"Error writing JSON summary to file: {str(e)}")

# Pytest Fixtures and Tests
@pytest.fixture(scope="session")
def token():
    return get_oauth_token()

@pytest.fixture(scope="session")
def endpoints():
    return load_endpoints()

def test_company_info(token):
    result = get_company_info(token)
    assert result["status"] == "success", f"Company info failed: {result.get('error', 'Unknown error')}"

def test_database_info(token):
    result = get_database_info(token)
    assert result["status"] == "success", f"Database info failed: {result.get('error', 'Unknown error')}"

def test_modules(token):
    result = get_modules(token)
    assert result["status"] == "success", f"Modules failed: {result.get('error', 'Unknown error')}"

def test_session_info(token):
    result = get_session_info(token)
    assert result["status"] == "success", f"Session info failed: {result.get('error', 'Unknown error')}"

def test_user(token):
    result = get_user(token)
    assert result["status"] == "success", f"User info failed: {result.get('error', 'Unknown error')}"

def test_user_info(token):
    result = get_user_info(token)
    assert result["status"] == "success", f"Detailed user info failed: {result.get('error', 'Unknown error')}"

def test_xmlid(token):
    result = get_xmlid("base.main_company", token)
    assert result["status"] == "success", f"XML ID failed: {result.get('error', 'Unknown error')}"

def test_all_companies(token):
    result = get_all_companies(token)
    assert result["status"] == "success", f"All companies failed: {result.get('error', 'Unknown error')}"

def test_create_contact(token):
    timestamp = int(time.time())
    contact_values = {
        'name': f'API Test Contact {timestamp}',
        'email': f'test{timestamp}@example.com',
        'phone': f'+1{timestamp}'[-10:],
        'is_company': False
    }
    result = create_contact(contact_values, token)
    assert result["status"] == "success", f"Create contact failed: {result.get('error', 'Unknown error')}"

def test_database_list(token):
    result = get_database_list(token)
    assert result["status"] == "success", f"Database list failed: {result.get('error', 'Unknown error')}"

def test_models(token):
    result = get_models(token)
    assert result["status"] == "success", f"Models failed: {result.get('error', 'Unknown error')}"

def test_partner_fields(token):
    result = get_partner_fields(token)
    assert result["status"] == "success", f"Partner fields failed: {result.get('error', 'Unknown error')}"

def test_partner_access(token):
    for partner_id in [1, 3]:
        result = get_partner_access(token, partner_id)
        assert result["status"] == "success", f"Partner access for ID {partner_id} failed: {result.get('error', 'Unknown error')}"

def test_countries(token):
    result = get_countries(token)
    assert result["status"] == "success", f"Countries failed: {result.get('error', 'Unknown error')}"

def test_get_partners(token):
    result = get_partners(5, token)
    assert result["status"] == "success", f"Get partners failed: {result.get('error', 'Unknown error')}"

def test_partner_crud(token):
    timestamp = int(time.time())
    test_values = {
        'name': f'API Test Partner {timestamp}',
        'email': f'test{timestamp}@example.com',
        'phone': f'+1{timestamp}'[-10:],
        'comment': 'Created via REST API test script',
        'is_company': True
    }
    
    # Create
    create_result = create_partner(test_values, token)
    assert create_result["status"] == "success", f"Create partner failed: {create_result.get('error', 'Unknown error')}"
    partner_id = create_result["data"]
    
    # Read and Validate
    read_result = read_partner(partner_id, token)
    assert read_result["status"] == "success", f"Read partner failed: {read_result.get('error', 'Unknown error')}"
    validation_errors = []
    for key, expected in test_values.items():
        if read_result["data"].get(key) != expected:
            validation_errors.append(f"Field {key}: expected {expected}, got {read_result['data'].get(key)}")
    if validation_errors:
        read_result["note"] = f"Validation failed: {'; '.join(validation_errors)}"
    
    # Update
    update_values = {
        'name': f'Updated API Test Partner {timestamp + 1}',
        'comment': f'Updated via REST API test script at {timestamp + 1}',
    }
    update_result = update_partner(partner_id, update_values, token)
    assert update_result["status"] == "success", f"Update partner failed: {update_result.get('error', 'Unknown error')}"
    
    # Read after update
    read_update_result = read_partner(partner_id, token)
    assert read_update_result["status"] == "success", f"Read updated partner failed: {read_update_result.get('error', 'Unknown error')}"
    
    # Delete (if cleanup enabled)
    if args.cleanup:
        delete_result = delete_partner(partner_id, token)
        assert delete_result["status"] == "success", f"Delete partner failed: {delete_result.get('error', 'Unknown error')}"
        read_delete_result = read_partner(partner_id, token)
        assert read_delete_result["status"] != "success" or not read_delete_result["data"].get('active', True), \
            "Partner still exists or is active after deletion"

def test_oauth_pytest(token):
    result = test_oauth()
    assert result["status"] == "success", f"OAuth test failed: {result.get('error', 'Unknown error')}"

def run_complete_test(test_partner_id: Optional[int] = None, cleanup: bool = False, skip_auth: bool = False, test_partner_access: Optional[int] = None, deep_access_test: bool = False, json_summary: bool = True) -> None:
    """Run a complete API test cycle"""
    start_time = time.time()
    auth_status = validate_credentials()
    
    if not skip_auth and not (auth_status["oauth"] or auth_status["basic"]):
        logger.error("Both OAuth and Basic Auth failed. Verify credentials and try again.")
        sys.exit(1)
    
    token = None
    if auth_status["oauth"]:
        try:
            token = get_oauth_token()
        except Exception:
            logger.warning("Failed to obtain OAuth token after validation. Falling back to Basic Auth.")
    
    token_used = token is not None
    endpoints = load_endpoints()
    results = {
        "common": {},
        "custom": {},
        "database": {},
        "system": {},
        "security": {},
        "server": {},
        "partner": {},
        "oauth": {}
    }
    
    logger.info("\n==== ODOO REST API TESTING ====")
    logger.info(f"Server: {ODOO_URL}")
    logger.info(f"Database: {DB}")
    logger.info(f"Auth: {'Bearer Token' if token_used else 'Basic Auth'}")
    logger.info(f"OAuth Status: {'Success' if auth_status['oauth'] else 'Failed'}")
    logger.info(f"Basic Auth Status: {'Success' if auth_status['basic'] else 'Failed'}")
    logger.info(f"Configuration Source: {CONFIG_SOURCE}")
    logger.info(f"Endpoints Loaded: {len(endpoints)}")
    logger.info("===============================\n")
    
    if skip_auth:
        logger.info("Running in skip-auth mode. Testing only unauthenticated endpoints.")
    
    try:
        # 1. Test Common Endpoints
        logger.info("\n--- 1. TESTING COMMON ENDPOINTS ---")
        results["common"]["Get Company Info"] = get_company_info(token) if not skip_auth else {"status": "skipped", "data": "Skipped in skip-auth mode", "duration": 0}
        results["common"]["Get Database Info"] = get_database_info(token)
        results["common"]["Get Modules"] = get_modules(token) if not skip_auth else {"status": "skipped", "data": "Skipped in skip-auth mode", "duration": 0}
        results["common"]["Get Session Info"] = get_session_info(token) if not skip_auth else {"status": "skipped", "data": "Skipped in skip-auth mode", "duration": 0}
        results["common"]["Get User"] = get_user(token) if not skip_auth else {"status": "skipped", "data": "Skipped in skip-auth mode", "duration": 0}
        results["common"]["Get User Info"] = get_user_info(token) if not skip_auth else {"status": "skipped", "data": "Skipped in skip-auth mode", "duration": 0}
        results["common"]["Get XML ID (base.main_company)"] = get_xmlid("base.main_company", token) if not skip_auth else {"status": "skipped", "data": "Skipped in skip-auth mode", "duration": 0}
        
        # 2. Test Custom Endpoints
        logger.info("\n--- 2. TESTING CUSTOM ENDPOINTS ---")
        results["custom"]["Get All Companies"] = get_all_companies(token)
        if not skip_auth:
            timestamp = int(time.time())
            contact_values = {
                'name': f'API Test Contact {timestamp}',
                'email': f'test{timestamp}@example.com',
                'phone': f'+1{timestamp}'[-10:],
                'is_company': False
            }
            results["custom"]["Create Contact"] = create_contact(contact_values, token)
        else:
            results["custom"]["Create Contact"] = {"status": "skipped", "data": "Skipped in skip-auth mode", "duration": 0}
        
        # 3. Test Database Endpoints
        logger.info("\n--- 3. TESTING DATABASE ENDPOINTS ---")
        results["database"]["Get Database List"] = get_database_list(token)
        
        # 4. Test System Endpoints
        logger.info("\n--- 4. TESTING SYSTEM ENDPOINTS ---")
        results["system"]["Get Models"] = get_models(token) if not skip_auth else {"status": "skipped", "data": "Skipped in skip-auth mode", "duration": 0}
        results["system"]["Get Partner Fields"] = get_partner_fields(token) if not skip_auth else {"status": "skipped", "data": "Skipped in skip-auth mode", "duration": 0}
        
        # 5. Test Security Endpoints
        logger.info("\n--- 5. TESTING SECURITY ENDPOINTS ---")
        partner_ids = [1, 3]
        if test_partner_access:
            partner_ids.append(test_partner_access)
        if deep_access_test and not skip_auth:
            partners_result = get_partners(5, token)
            if partners_result["status"] == "success":
                partner_ids.extend([p['id'] for p in partners_result['partners'] if p['id'] not in partner_ids])
        if not skip_auth:
            for pid in partner_ids:
                results["security"][f"Get Partner Access (ID: {pid})"] = get_partner_access(token, pid)
        else:
            for pid in partner_ids:
                results["security"][f"Get Partner Access (ID: {pid})"] = {"status": "skipped", "data": "Skipped in skip-auth mode", "duration": 0, "partner_id": pid}
        
        # 6. Test Server Endpoints
        logger.info("\n--- 6. TESTING SERVER ENDPOINTS ---")
        results["server"]["Get Countries"] = get_countries(token)
        
        # 7. Get list of partners
        logger.info("\n--- 7. LISTING PARTNERS ---")
        if not skip_auth:
            results["partner"]["Get Partners"] = get_partners(5, token)
            if results["partner"]["Get Partners"]["status"] != "success":
                logger.error("Could not fetch partners. Skipping partner CRUD operations.")
                results["partner"]["Create Partner"] = {"status": "skipped", "data": "Skipped due to get_partners failure", "duration": 0}
                results["partner"]["Read Partner Create"] = {"status": "skipped", "data": "Skipped due to get_partners failure", "duration": 0}
                results["partner"]["Update Partner"] = {"status": "skipped", "data": "Skipped due to get_partners failure", "duration": 0}
                results["partner"]["Read Partner Update"] = {"status": "skipped", "data": "Skipped due to get_partners failure", "duration": 0}
                results["partner"]["Delete Partner"] = {"status": "skipped", "data": "Skipped due to get_partners failure", "duration": 0}
        else:
            results["partner"]["Get Partners"] = {"status": "skipped", "data": "Skipped in skip-auth mode", "duration": 0}
            results["partner"]["Create Partner"] = {"status": "skipped", "data": "Skipped in skip-auth mode", "duration": 0}
            results["partner"]["Read Partner Create"] = {"status": "skipped", "data": "Skipped in skip-auth mode", "duration": 0}
            results["partner"]["Update Partner"] = {"status": "skipped", "data": "Skipped in skip-auth mode", "duration": 0}
            results["partner"]["Read Partner Update"] = {"status": "skipped", "data": "Skipped in skip-auth mode", "duration": 0}
            results["partner"]["Delete Partner"] = {"status": "skipped", "data": "Skipped in skip-auth mode", "duration": 0}
        
        # 8. Create a test partner
        if not skip_auth and not test_partner_id and results["partner"]["Get Partners"]["status"] == "success":
            logger.info("\n--- 8. CREATING TEST PARTNER ---")
            timestamp = int(time.time())
            test_values = {
                'name': f'API Test Partner {timestamp}',
                'email': f'test{timestamp}@example.com',
                'phone': f'+1{timestamp}'[-10:],
                'comment': 'Created via REST API test script',
                'is_company': True
            }
            
            create_result = create_partner(test_values, token)
            results["partner"]["Create Partner"] = create_result
            if create_result["status"] == "success":
                test_partner_id = create_result["data"]
                read_result = read_partner(test_partner_id, token)
                # Validate created fields
                validation_errors = []
                for key, expected in test_values.items():
                    if read_result["data"].get(key) != expected:
                        validation_errors.append(f"Field {key}: expected {expected}, got {read_result['data'].get(key)}")
                if validation_errors:
                    read_result["note"] = f"Validation failed: {'; '.join(validation_errors)}"
                results["partner"]["Read Partner Create"] = read_result
                # Add new partner ID to security tests
                results["security"][f"Get Partner Access (ID: {test_partner_id})"] = get_partner_access(token, test_partner_id)
            else:
                logger.error("Partner creation endpoint not available.")
                results["partner"]["Read Partner Create"] = {"status": "skipped", "data": "Skipped due to create_partner failure", "duration": 0}
                results["partner"]["Update Partner"] = {"status": "skipped", "data": "Skipped due to create_partner failure", "duration": 0}
                results["partner"]["Read Partner Update"] = {"status": "skipped", "data": "Skipped due to create_partner failure", "duration": 0}
                results["partner"]["Delete Partner"] = {"status": "skipped", "data": "Skipped due to create_partner failure", "duration": 0}
        
        # 9. Update the test partner
        if not skip_auth and test_partner_id and results["partner"].get("Create Partner", {}).get("status") == "success":
            logger.info("\n--- 9. UPDATING TEST PARTNER ---")
            timestamp = int(time.time())
            update_values = {
                'name': f'Updated API Test Partner {timestamp}',
                'comment': f'Updated via REST API test script at {timestamp}',
            }
            
            results["partner"]["Update Partner"] = update_partner(test_partner_id, update_values, token)
            if results["partner"]["Update Partner"]["status"] == "success":
                results["partner"]["Read Partner Update"] = read_partner(test_partner_id, token)
        
        # 10. Test OAuth
        logger.info("\n--- 10. TESTING OAUTH ---")
        results["oauth"]["Test OAuth"] = test_oauth() if not skip_auth else {"status": "skipped", "data": "Skipped in skip-auth mode", "duration": 0}
        
        # 11. Delete the test partner
        if not skip_auth and not args.partner_id and cleanup and results["partner"].get("Create Partner", {}).get("status") == "success":
            logger.info("\n--- 11. DELETING TEST PARTNER ---")
            test_partner_id = results["partner"]["Create Partner"]["data"]
            delete_result = delete_partner(test_partner_id, token)
            results["partner"]["Delete Partner"] = delete_result
            if delete_result["status"] == "success":
                logger.info("Verifying deletion...")
                read_delete_result = read_partner(test_partner_id, token)
                results["partner"]["Read Partner Delete"] = read_delete_result
                if read_delete_result["status"] == "success" and read_delete_result["data"].get('active', True):
                    logger.error("Partner still exists and is active after deletion.")
                    results["partner"]["Delete Partner"]["status"] = "failed"
                    results["partner"]["Delete Partner"]["error"] = "Partner still exists and is active after deletion"
                else:
                    logger.info("Partner successfully deleted or archived.")
                    if read_delete_result["status"] == "success":
                        results["partner"]["Delete Partner"]["data"] += " (archived)"
            else:
                logger.error("Failed to delete partner.")
        else:
            logger.info("Skipping deletion step.")
            results["partner"]["Delete Partner"] = {"status": "skipped", "data": "Deletion skipped by user or skip-auth mode", "duration": 0}
    
    except Exception as e:
        logger.error(f"Test run failed: {str(e)}")
        results["error"] = f"Test run failed: {str(e)}"
    
    # Write and print summary
    total_duration = time.time() - start_time
    write_summary(results, token_used, endpoints, total_duration, auth_status, json_summary)
    logger.info("\n==== TEST COMPLETE ====")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Test Odoo REST API')
    parser.add_argument('-p', '--partner-id', type=int, help='Use existing partner ID for testing')
    parser.add_argument('-c', '--create-only', action='store_true', help='Only test partner creation')
    parser.add_argument('-r', '--read-only', type=int, help='Only test reading a specific partner ID')
    parser.add_argument('-u', '--update-only', type=int, help='Only test updating a specific partner ID')
    parser.add_argument('-d', '--delete-only', type=int, help='Only test deleting a specific partner ID')
    parser.add_argument('-o', '--oauth-test', action='store_true', help='Only test OAuth token')
    parser.add_argument('--url', help=f'Odoo server URL (default: {ODOO_URL})')
    parser.add_argument('--username', help=f'Odoo username (default: {USERNAME})')
    parser.add_argument('--password', help='Odoo password')
    parser.add_argument('--db', help=f'Odoo database (default: {DB})')
    parser.add_argument('--cleanup', action='store_true', help='Automatically delete test partners after creation')
    parser.add_argument('--mock', action='store_true', help='Use WireMock for offline testing (not implemented)')
    parser.add_argument('--skip-auth', action='store_true', help='Skip authenticated endpoints and test only public ones')
    parser.add_argument('--test-partner-access', type=int, help='Test specific partner ID for /api/v2/access/res.partner')
    parser.add_argument('--deep-access-test', action='store_true', help='Test additional partner IDs from get_partners for access endpoint')
    parser.add_argument('--json-summary', action='store_true', help='Generate JSON summary file', default=True)
    
    args = parser.parse_args()
    
    # Update configuration if provided
    if args.url:
        ODOO_URL = args.url
    if args.username:
        USERNAME = args.username
    if args.password:
        PASSWORD = args.password
    if args.db:
        DB = args.db
    
    # Install tenacity if not already installed
    try:
        import tenacity
    except ImportError:
        import pip
        pip.main(['install', 'tenacity'])
        import tenacity
    
    # Run specific tests if requested
    token = None
    if not args.skip_auth:
        try:
            token = get_oauth_token()
        except Exception:
            logger.warning("OAuth token retrieval failed. Using Basic Auth.")
    
    if args.create_only:
        timestamp = int(time.time())
        test_values = {
            'name': f'API Test Partner {timestamp}',
            'email': f'test{timestamp}@example.com',
            'phone': f'+1{timestamp}'[-10:],
            'comment': 'Created via REST API test script',
            'is_company': True
        }
        result = create_partner(test_values, token)
        if result["status"] != "success":
            logger.error("Partner creation endpoint not available.")
    elif args.read_only:
        read_partner(args.read_only, token)
    elif args.update_only:
        timestamp = int(time.time())
        update_values = {
            'name': f'Updated API Test Partner {timestamp}',
            'comment': f'Updated via REST API test script at {timestamp}',
        }
        update_partner(args.update_only, update_values, token)
    elif args.delete_only:
        delete_partner(args.delete_only, token)
    elif args.oauth_test:
        test_oauth()
    else:
        run_complete_test(args.partner_id, args.cleanup, args.skip_auth, args.test_partner_access, args.deep_access_test, args.json_summary)