import requests
import json
import logging
import time
from datetime import datetime
import os
from retrying import retry
import uuid

# Configure logging with both console and file output
timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
log_file = f"test_results/log_{timestamp}.txt"
os.makedirs("test_results", exist_ok=True)
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

# Console handler
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.INFO)
console_formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
console_handler.setFormatter(console_formatter)
logger.addHandler(console_handler)

# File handler
file_handler = logging.FileHandler(log_file)
file_handler.setLevel(logging.DEBUG)
file_formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
file_handler.setFormatter(file_formatter)
logger.addHandler(file_handler)

def load_config(config_file):
    """Load configuration from JSON file."""
    try:
        with open(config_file, 'r') as f:
            config = json.load(f)
        logger.debug(f"Config loaded: {config}")
        return config
    except Exception as e:
        logger.error(f"Failed to load config from {config_file}: {e}")
        raise

def get_access_token(config):
    """Obtain an access token from the Odoo server."""
    try:
        auth_url = f"{config['server_url']}{config['auth_endpoint']}"
        payload = {
            "client_id": config["client_id"],
            "client_secret": config["client_secret"],
            "username": config["username"],
            "password": config["password"],
            "grant_type": "password"
        }
        logger.debug(f"Requesting access token from {auth_url}")
        response = requests.post(auth_url, data=payload)
        response.raise_for_status()
        token = response.json().get("access_token")
        if not token:
            logger.error("No access token in response")
            raise ValueError("No access token received")
        logger.debug("Access token obtained successfully")
        return token
    except requests.RequestException as e:
        logger.error(f"Failed to obtain access token: {e}")
        raise

@retry(stop_max_attempt_number=3, wait_fixed=2000)
def fetch_fields_access(server_url, access_token, model, database):
    """Fetch field names using /api/v2/access/fields endpoint."""
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json",
        "DATABASE": database
    }
    url = f"{server_url}/api/v2/access/fields/{model}?operation=read"
    logger.debug(f"Fetching fields for model {model} using access endpoint: {url}")
    try:
        response = requests.get(url, headers=headers)
        logger.debug(f"HTTP status code for {model}: {response.status_code}")
        logger.debug(f"Response headers for {model}: {response.headers}")
        raw_text = response.text
        logger.debug(f"Raw API response for {model}: {raw_text}")
        
        response.raise_for_status()
        try:
            result = response.json()
            logger.debug(f"Parsed API response for {model}: {json.dumps(result, indent=2)}")
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error for {model}: {e}\nRaw response: {raw_text}")
            return {}
        
        if not isinstance(result, dict):
            logger.error(f"Unexpected response format for {model}: {result}")
            return {}
        
        # Map field names to minimal metadata
        fields_data = {}
        fallback_fields = {
            "name": {"string": "Order Reference", "type": "char", "required": True, "readonly": False, "store": True, "searchable": True, "sortable": True},
            "state": {"string": "Status", "type": "selection", "required": False, "readonly": True, "store": True, "searchable": True, "sortable": True},
            "partner_id": {"string": "Customer", "type": "many2one", "relation": "res.partner", "required": True, "readonly": False, "store": True, "searchable": True, "sortable": True}
        }
        
        for field_name, _ in result.items():
            if field_name in fallback_fields:
                fields_data[field_name] = fallback_fields[field_name]
            else:
                fields_data[field_name] = {
                    "string": field_name.replace('_', ' ').title(),
                    "type": "unknown",
                    "required": False,
                    "readonly": False,
                    "store": True,
                    "searchable": False,
                    "sortable": False
                }
        
        if not fields_data:
            logger.warning(f"No fields retrieved for {model}. Using fallback fields.")
            fields_data = fallback_fields
            logger.info(f"Applied fallback fields for {model}: {list(fields_data.keys())}")
        
        logger.info(f"Successfully fetched {len(fields_data)} fields for {model}")
        return fields_data
    except requests.RequestException as e:
        logger.error(f"Error fetching fields for {model}: {e}\nRaw response: {response.text if 'response' in locals() else 'No response'}")
        return {}
    except Exception as e:
        logger.error(f"Unexpected error fetching fields for {model}: {e}\nRaw response: {response.text if 'response' in locals() else 'No response'}")
        return {}

@retry(stop_max_attempt_number=3, wait_fixed=2000)
def fetch_fields(server_url, access_token, model, fields=None):
    """Fetch field metadata for the specified model with retry using /api/v2/call."""
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": model,
        "method": "fields_get",
        "args": [] if fields is None else [fields],
        "kwargs": {
            "attributes": [
                "string", "type", "relation", "required", "readonly", "store",
                "searchable", "sortable", "depends", "domain"
            ]
        }
    }
    logger.debug(f"Fetching fields for model {model} with payload: {json.dumps(payload, indent=2)}")
    try:
        response = requests.post(
            f"{server_url}/api/v2/call",
            headers=headers,
            json=payload
        )
        logger.debug(f"HTTP status code for {model}: {response.status_code}")
        logger.debug(f"Response headers for {model}: {response.headers}")
        raw_text = response.text
        logger.debug(f"Raw API response for {model}: {raw_text}")
        
        response.raise_for_status()
        try:
            result = response.json()
            logger.debug(f"Parsed API response for {model}: {json.dumps(result, indent=2)}")
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error for {model}: {e}\nRaw response: {raw_text}")
            return {}
        
        if "error" in result:
            logger.error(f"API error for {model}: {result['error']}")
            if "Access denied" in str(result['error']):
                logger.warning(f"Possible permission issue for {model}. Check user access rights.")
            return {}
        
        if "result" in result:
            fields_data = result["result"]
        elif result.get("status") == "success" and "data" in result:
            fields_data = result["data"]
        else:
            logger.error(f"Unexpected response format for {model}: {result}")
            return {}
        
        if not isinstance(fields_data, dict):
            logger.error(f"Fields data for {model} is not a dictionary: {fields_data}")
            return {}
        
        if not fields_data:
            logger.warning(f"No fields retrieved for {model}. Using fallback fields if available.")
            if model == "sale.order":
                # Fallback fields for sale.order
                fields_data = {
                    "name": {"string": "Order Reference", "type": "char", "required": True, "readonly": False, "store": True, "searchable": True, "sortable": True},
                    "state": {"string": "Status", "type": "selection", "required": False, "readonly": True, "store": True, "searchable": True, "sortable": True},
                    "partner_id": {"string": "Customer", "type": "many2one", "relation": "res.partner", "required": True, "readonly": False, "store": True, "searchable": True, "sortable": True}
                }
                logger.info(f"Applied fallback fields for {model}: {list(fields_data.keys())}")
        
        logger.info(f"Successfully fetched {len(fields_data)} fields for {model}")
        return fields_data
    except requests.RequestException as e:
        logger.error(f"Error fetching fields for {model}: {e}\nRaw response: {response.text if 'response' in locals() else 'No response'}")
        return {}
    except Exception as e:
        logger.error(f"Unexpected error fetching fields for {model}: {e}\nRaw response: {response.text if 'response' in locals() else 'No response'}")
        return {}

@retry(stop_max_attempt_number=3, wait_fixed=2000)
def test_endpoint(server_url, access_token, endpoint, method="get", payload=None):
    """Test an API endpoint with retry."""
    headers = {"Authorization": f"Bearer {access_token}"}
    start_time = time.time()
    try:
        if method.lower() == "post":
            headers["Content-Type"] = "application/json"
            logger.debug(f"Testing POST endpoint {endpoint} with payload: {json.dumps(payload, indent=2)}")
            response = requests.post(f"{server_url}{endpoint}", headers=headers, json=payload)
        else:
            logger.debug(f"Testing GET endpoint {endpoint}")
            response = requests.get(f"{server_url}{endpoint}", headers=headers)
        response.raise_for_status()
        result = response.json()
        duration = time.time() - start_time
        logger.debug(f"Endpoint {endpoint} succeeded with response: {json.dumps(result, indent=2)}")
        return {"status": "success", "data": result, "duration": duration}
    except requests.RequestException as e:
        duration = time.time() - start_time
        logger.error(f"Error testing {endpoint}: {e}\nResponse: {response.text if 'response' in locals() else 'No response'}")
        return {"status": "error", "data": str(e), "duration": duration}

def test_relationship(server_url, access_token, model, field):
    """Test a relationship field by reading its value."""
    start_time = time.time()
    try:
        # First, search for a record
        logger.debug(f"Searching for record in {model}")
        search_response = test_endpoint(
            server_url, access_token,
            f"/api/v2/search/{model}?limit=1"
        )
        if search_response["status"] != "success" or not search_response["data"]:
            logger.error(f"No records found for {model}")
            return {
                "status": "error",
                "data": f"No records found for {model}",
                "duration": time.time() - start_time
            }

        record_id = search_response["data"][0]
        logger.debug(f"Found record ID {record_id} for {model}")
        
        # Use search_read with explicit fields to avoid computed fields
        search_read_payload = {
            "model": model,
            "method": "search_read",
            "args": [[], [field]],
            "kwargs": {"limit": 1}
        }
        logger.debug(f"Testing search_read for {model}.{field}")
        search_read_response = test_endpoint(
            server_url, access_token,
            f"/api/v2/call",
            method="post",
            payload=search_read_payload
        )
        if search_read_response["status"] == "success":
            logger.info(f"Successfully tested {model}.{field} via search_read")
            return {
                "status": "success",
                "data": search_read_response["data"],
                "duration": time.time() - start_time
            }
        
        # Fallback to read endpoint
        logger.warning(f"Search read failed for {model}.{field}. Trying read endpoint.")
        read_payload = {
            "model": model,
            "method": "read",
            "args": [[record_id], [field]],
            "kwargs": {}
        }
        read_response = test_endpoint(
            server_url, access_token,
            f"/api/v2/call",
            method="post",
            payload=read_payload
        )
        logger.info(f"Test result for {model}.{field} via read: {read_response['status']}")
        return {
            "status": read_response["status"],
            "data": read_response["data"],
            "duration": time.time() - start_time
        }
    except Exception as e:
        logger.error(f"Error testing relationship {model}.{field}: {e}")
        return {
            "status": "error",
            "data": str(e),
            "duration": time.time() - start_time
        }

def main():
    # Load configuration
    config_file = "config/test_config.json"
    logger.info(f"Loading configuration from {config_file}")
    config = load_config(config_file)
    
    # Get access token
    logger.info("Obtaining access token")
    access_token = get_access_token(config)
    
    # Define endpoints to test
    common_endpoints = {
        "Company Information": "/api/v2/company",
        "Database": "/api/v2/database",
        "Modules": "/api/v2/modules",
        "Session Information": "/api/v2/session",
        "User": "/api/v2/user",
        "User Information": "/api/v2/userinfo"
    }
    
    # Define relationship tests
    relationship_tests = [
        ("sale.order", "name"),
        ("sale.order", "state"),
        ("res.partner", "name")
    ]
    
    # Initialize test results
    test_results = {
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "tests": {
            "common": {},
            "relationships": {}
        }
    }
    
    # Test common endpoints
    for name, endpoint in common_endpoints.items():
        logger.info(f"Testing {name}")
        result = test_endpoint(config["server_url"], access_token, endpoint)
        test_results["tests"]["common"][name] = result
    
    # Fetch fields and build schema
    schema = {"models": []}
    for model in config.get("models_to_test", ["res.partner", "sale.order"]):
        logger.info(f"Fetching fields for {model}")
        if model == "sale.order":
            fields_data = fetch_fields_access(config["server_url"], access_token, model, config["database"])
        else:
            fields_data = fetch_fields(config["server_url"], access_token, model)
        if not fields_data:
            logger.warning(f"No fields retrieved for {model} after all attempts")
        fields_list = [
            {"name": name, **attrs} for name, attrs in fields_data.items()
        ]
        logger.debug(f"Fields for {model}: {json.dumps(fields_list, indent=2)}")
        schema["models"].append({
            "name": model,
            "fields": fields_list
        })
    
    # Test relationships
    for model, field in relationship_tests:
        test_name = f"Get {model} {field}"
        logger.info(f"Testing relationship {test_name}")
        result = test_relationship(config["server_url"], access_token, model, field)
        test_results["tests"]["relationships"][test_name] = result
    
    # Save test results
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = config["output_dir"]
    os.makedirs(output_dir, exist_ok=True)
    
    summary_file = f"{output_dir}/test_summary_{timestamp}.json"
    with open(summary_file, "w") as f:
        json.dump(test_results, f, indent=2)
    logger.info(f"Saved test summary to {summary_file}")
    
    schema_file = f"{output_dir}/relationship_schema_{timestamp}.json"
    with open(schema_file, "w") as f:
        json.dump(schema, f, indent=2)
    logger.info(f"Saved schema to {schema_file}")
    
    logger.info(f"Saved log to {log_file}")
    logger.info("Test execution completed.")

if __name__ == "__main__":
    main()