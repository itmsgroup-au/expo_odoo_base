from typing import Dict, List
from .client import OdooAPIClient

class ModelRelationshipExtractor:
    def __init__(self, client: OdooAPIClient):
        self.client = client

    def get_model_relationships(self, model: str) -> List[Dict]:
        """Query ir.model.fields to get relationship fields for a model."""
        endpoint = "/api/v2/custom/ir.model.fields/search_read"
        data = {
            "domain": [["model", "=", model], ["ttype", "in", ["many2one", "one2many", "many2many"]]],
            "fields": ["name", "ttype", "relation", "relation_field"]
        }
        result = self.client.call_endpoint(endpoint, "POST", data)
        return result["data"] if result["status"] == "success" else []

    def generate_relationship_schema(self, models: List[str]) -> Dict:
        """Generate a JSON schema of model relationships."""
        schema = {"models": []}
        for model in models:
            relationships = self.get_model_relationships(model)
            schema["models"].append({
                "name": model,
                "fields": relationships
            })
        return schema
