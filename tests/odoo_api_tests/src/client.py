import requests
import logging
from typing import Dict, Optional
from tenacity import retry, stop_after_attempt, wait_fixed, retry_if_exception_type
import base64

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class OdooAPIClient:
    def __init__(self, config: Dict):
        self.config = config
        self.access_token = None
        self.session = requests.Session()

    @retry(stop=stop_after_attempt(2), wait=wait_fixed(1), retry=retry_if_exception_type((requests.ConnectionError, requests.Timeout)), reraise=True)
    def authenticate(self) -> bool:
        """Authenticate using OAuth2, with fallback to Basic Auth."""
        auth_endpoint = self.config.get("auth_endpoint", "/api/v2/authentication/oauth2/token")
        url = f"{self.config['server_url']}{auth_endpoint}"
        
        # OAuth2 authentication
        if auth_endpoint.endswith("/authentication/oauth2/token"):
            data = {
                "grant_type": "password",
                "username": self.config['username'],
                "password": self.config['password'],
                "client_id": self.config['client_id'],
                "client_secret": self.config['client_secret']
            }
            headers = {'Content-Type': 'application/x-www-form-urlencoded'}
            try:
                response = self.session.post(url, data=data, headers=headers, timeout=10)
                response.raise_for_status()
                token_data = response.json()
                self.access_token = token_data.get('access_token')
                logger.info(f"Authentication successful: OAuth token obtained")
                return True
            except requests.RequestException as e:
                logger.error(f"OAuth authentication failed: {e}")
                logger.error(f"Response: {response.text if 'response' in locals() else 'No response'}")
                logger.warning("Falling back to Basic Auth")
        
        # Basic Auth fallback
        auth_str = f"{self.config['username']}:{self.config['password']}"
        auth_bytes = auth_str.encode('ascii')
        auth_b64 = base64.b64encode(auth_bytes).decode('ascii')
        headers = {
            'Authorization': f'Basic {auth_b64}',
            'DATABASE': self.config['database'],
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
        test_url = f"{self.config['server_url']}/api/v2/database"
        try:
            response = self.session.get(test_url, headers=headers, timeout=10)
            response.raise_for_status()
            self.access_token = "basic_auth"  # Dummy token to indicate Basic Auth
            logger.info("Basic Auth successful")
            return True
        except requests.RequestException as e:
            logger.error(f"Basic Auth failed: {e}")
            logger.error(f"Response: {response.text if 'response' in locals() else 'No response'}")
            return False

    @retry(stop=stop_after_attempt(2), wait=wait_fixed(1), retry=retry_if_exception_type((requests.ConnectionError, requests.Timeout)), reraise=True)
    def call_endpoint(self, endpoint: str, method: str = "GET", data: Optional[Dict] = None, params: Optional[Dict] = None) -> Dict:
        """Call an Odoo API endpoint and return the response."""
        url = f"{self.config['server_url']}{endpoint}"
        auth_str = f"{self.config['username']}:{self.config['password']}"
        auth_b64 = base64.b64encode(auth_str.encode('ascii')).decode('ascii')
        headers = {
            'Authorization': f'Bearer {self.access_token}' if self.access_token and self.access_token != "basic_auth" else f'Basic {auth_b64}',
            'DATABASE': self.config['database'],
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
        try:
            response = self.session.request(method, url, headers=headers, json=data, params=params, timeout=10)
            response.raise_for_status()
            return {
                "status": "success",
                "data": response.json(),
                "duration": response.elapsed.total_seconds()
            }
        except requests.RequestException as e:
            return {
                "status": "error",
                "data": f"{str(e)}: {response.text if 'response' in locals() else 'No response'}",
                "duration": 0
            }