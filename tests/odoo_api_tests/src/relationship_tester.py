from typing import Dict, List
from .client import OdooAPIClient
import time
import json

class RelationshipTester:
    def __init__(self, client: OdooAPIClient):
        self.client = client
        self.results = []

    def test_relationship(self, model: str, field: str, related_model: str, relationship_type: str) -> Dict:
        """Test a specific model relationship."""
        result = {"model": model, "field": field, "related_model": related_model, "tests": []}

        # Create a record in the primary model
        create_endpoint = f"/api/v2/create/{model}"
        create_data = {"name": f"Test {model} {int(time.time())}"}
        create_result = self.client.call_endpoint(create_endpoint, "POST", data=create_data)
        result["tests"].append({"operation": "create", "result": create_result})

        if create_result["status"] == "success":
            record_id = create_result["data"][0] if isinstance(create_result["data"], list) else create_result["data"]
            if relationship_type == "many2one":
                # Create related record
                related_create_endpoint = f"/api/v2/create/{related_model}"
                related_create_data = {"name": f"Test {related_model} {int(time.time())}"}
                related_create_result = self.client.call_endpoint(related_create_endpoint, "POST", data=related_create_data)
                if related_create_result["status"] == "success":
                    related_id = related_create_result["data"][0] if isinstance(related_create_result["data"], list) else related_create_result["data"]
                    # Link related record
                    update_endpoint = f"/api/v2/write/{model}"
                    update_data = {field: related_id}
                    update_params = {"ids": json.dumps([record_id]), "values": json.dumps(update_data)}
                    update_result = self.client.call_endpoint(update_endpoint, "PUT", params=update_params)
                    result["tests"].append({"operation": "link_related", "result": update_result})

            # Verify relationship
            read_endpoint = f"/api/v2/read/{model}"
            read_params = {"ids": json.dumps([record_id]), "fields": json.dumps([field, "name"])}
            read_result = self.client.call_endpoint(read_endpoint, "GET", params=read_params)
            result["tests"].append({"operation": "verify", "result": read_result})

        self.results.append(result)
        return result