import requests
import json
import logging
from retrying import retry

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

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

def get_access_token(server_url, client_id, client_secret, username, password, auth_endpoint):
    """Obtain an access token from the Odoo server."""
    try:
        auth_url = f"{server_url}{auth_endpoint}"
        payload = {
            "client_id": client_id,
            "client_secret": client_secret,
            "username": username,
            "password": password,
            "grant_type": "password"
        }
        response = requests.post(auth_url, data=payload)
        response.raise_for_status()
        return response.json().get("access_token")
    except requests.RequestException as e:
        logger.error(f"Failed to obtain access token: {e}")
        raise

@retry(stop_max_attempt_number=3, wait_fixed=2000)
def fetch_fields(server_url, access_token, model, fields=None):
    """Fetch field metadata for the specified model with retry."""
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    # Adjusted payload to match potential MuK REST API requirements
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
    try:
        # Try generic /api/v2/call endpoint as a fallback
        response = requests.post(
            f"{server_url}/api/v2/call",
            headers=headers,
            json=payload
        )
        response.raise_for_status()
        result = response.json()
        if "result" in result:
            return result["result"]
        elif result.get("status") == "success":
            return result.get("data", {})
        else:
            logger.error(f"Failed to fetch fields for {model}: {result}")
            return {}
    except requests.RequestException as e:
        logger.error(f"Error fetching fields for {model}: {e}\nResponse: {response.text if 'response' in locals() else 'No response'}")
        return {}

def main():
    # Load configuration
    config_file = "config/test_config.json"
    config = load_config(config_file)

    # Get access token
    access_token = get_access_token(
        config["server_url"],
        config["client_id"],
        config["client_secret"],
        config["username"],
        config["password"],
        config["auth_endpoint"]
    )

    # Fetch fields for each model
    schema = {"models": []}
    for model in config.get("models", ["res.partner", "sale.order"]):
        logger.info(f"Fetching fields for {model}")
        fields_data = fetch_fields(config["server_url"], access_token, model)
        schema["models"].append({
            "name": model,
            "fields": [
                {"name": name, **attrs} for name, attrs in fields_data.items()
            ]
        })

    # Save schema to file
    output_file = "test_results/relationship_schema_with_fields.json"
    with open(output_file, "w") as f:
        json.dump(schema, f, indent=2)
    logger.info(f"Saved schema to {output_file}")

if __name__ == "__main__":
    main()