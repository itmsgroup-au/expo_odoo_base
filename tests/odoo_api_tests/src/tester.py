from datetime import datetime
from typing import Dict
from .client import OdooAPIClient
from .relationship_tester import RelationshipTester
from .models import ModelRelationshipExtractor
from .utils import save_results

class OdooAPITester:
    def __init__(self, config: Dict):
        self.config = config
        self.client = OdooAPIClient(config)
        self.relationship_tester = RelationshipTester(self.client)
        self.model_extractor = ModelRelationshipExtractor(self.client)
        self.results = {"timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"), "tests": {}}

    def run_common_tests(self):
        """Run tests for common endpoints."""
        common_endpoints = [
            ("/api/v2/company", "Get Company Info"),
            ("/api/v2/database", "Get Database Info"),
            ("/api/v2/modules", "Get Modules"),
            ("/api/v2/session", "Get Session Info"),
            ("/api/v2/user", "Get User"),
            ("/api/v2/userinfo", "Get User Info"),
        ]
        self.results["tests"]["common"] = {}
        for endpoint, name in common_endpoints:
            result = self.client.call_endpoint(endpoint)
            self.results["tests"]["common"][name] = result

    def run_relationship_tests(self):
        """Run tests for discovered relationships."""
        self.results["tests"]["relationships"] = {}
        for model in self.config["models_to_test"]:
            relationships = self.model_extractor.get_model_relationships(model)
            for rel in relationships:
                result = self.relationship_tester.test_relationship(
                    model=model,
                    field=rel["name"],
                    related_model=rel["relation"],
                    relationship_type=rel["ttype"]
                )
                self.results["tests"]["relationships"][f"{model}.{rel['name']}"] = result

    def save_results(self):
        """Save test results and relationship schema."""
        schema = self.model_extractor.generate_relationship_schema(self.config["models_to_test"])
        save_results(self.results, schema, self.config["output_dir"])