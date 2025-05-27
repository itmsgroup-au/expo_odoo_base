import argparse
import json
import logging
import sys
from abc import ABC, abstractmethod
from collections import deque, defaultdict
from typing import Dict, List, Optional, Set, Union

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Constants
DEFAULT_RELATIONSHIP_DEPTH = 1
DEFAULT_FRAMEWORK = "react-native"
SUPPORTED_FRAMEWORKS = ["react-native", "flutter"]

class DiagramRenderer(ABC):
    """Base class for rendering diagrams in different formats."""
    @abstractmethod
    def start_diagram(self) -> str:
        pass

    @abstractmethod
    def end_diagram(self) -> str:
        pass

    @abstractmethod
    def render(self, field_type: str, model_name: str, relation: str, field_name: str) -> str:
        pass

    @abstractmethod
    def apply_style(self, style_config: Dict) -> List[str]:
        pass

class DiagramFormatter:
    """Formats relationships into diagram syntax for specific field types."""
    def __init__(self):
        self.formatters = {
            "many2one": self.format_many2one,
            "one2many": self.format_one2many,
            "many2many": self.format_many2many,
            "one2one": self.format_one2one,
        }

    def format(self, field_type: str, model_name: str, relation: str, field_name: str) -> str:
        """Formats a relationship based on the field type."""
        formatter = self.formatters.get(field_type, self.format_default)
        return formatter(model_name, relation, field_name)

    def format_many2one(self, model_name: str, relation: str, field_name: str) -> str:
        return f'{model_name.replace(".", "_")} "n" --> "1" "{relation}" : {field_name}'

    def format_one2many(self, model_name: str, relation: str, field_name: str) -> str:
        return f'{model_name.replace(".", "_")} "1" --o "n" "{relation}" : {field_name}'

    def format_many2many(self, model_name: str, relation: str, field_name: str) -> str:
        return f'{model_name.replace(".", "_")} "n" --* "n" "{relation}" : {field_name}'

    def format_one2one(self, model_name: str, relation: str, field_name: str) -> str:
        return f'{model_name.replace(".", "_")} "1" --> "1" "{relation}" : {field_name}'

    def format_default(self, model_name: str, relation: str, field_name: str) -> str:
        logger.warning(f"Unknown field type for {field_name}, using default formatting")
        return f'{model_name.replace(".", "_")} --> "{relation}" : {field_name} (unknown type)'

class PlantUMLRenderer(DiagramRenderer):
    """Renders diagrams in PlantUML format."""
    def __init__(self):
        self.formatter = DiagramFormatter()

    def start_diagram(self) -> str:
        return "@startuml"

    def end_diagram(self) -> str:
        return "@enduml"

    def render(self, field_type: str, model_name: str, relation: str, field_name: str) -> str:
        return self.formatter.format(field_type, model_name, relation, field_name)

    def apply_style(self, style_config: Dict) -> List[str]:
        lines = []
        if style_config.get("monochrome", False):
            lines.append("skinparam monochrome true")
        if "background_color" in style_config:
            lines.append(f"skinparam backgroundColor {style_config['background_color']}")
        return lines

class MermaidRenderer(DiagramRenderer):
    """Renders diagrams in Mermaid format."""
    def __init__(self):
        self.formatter = DiagramFormatter()

    def start_diagram(self) -> str:
        return "graph TD"

    def end_diagram(self) -> str:
        return ""

    def render(self, field_type: str, model_name: str, relation: str, field_name: str) -> str:
        model_clean = model_name.replace(".", "_")
        if field_type == "many2one":
            return f"{model_clean} -->|{field_name}| {relation}"
        elif field_type == "one2many":
            return f"{model_clean} -->o {relation} : {field_name}"
        elif field_type == "many2many":
            return f"{model_clean} -->* {relation} : {field_name}"
        else:
            return f"{model_clean} --> {relation} : {field_name}"

    def apply_style(self, style_config: Dict) -> List[str]:
        return []

def save_to_file(lines: List[str], output_file: str) -> None:
    """Saves lines to a file and handles errors."""
    try:
        with open(output_file, "w") as f:
            f.write("\n".join(lines))
        logger.info(f"Saved output to {output_file}")
    except OSError as e:
        logger.error(f"Failed to write to {output_file}: {e}")
        raise

class OdooDiagramGenerator:
    """Generates diagrams for Odoo models and their relationships."""
    def __init__(self, renderer: DiagramRenderer):
        self.renderer = renderer

    def export_model_diagram(
        self,
        model_name: str,
        fields: List[Dict],
        depth: int = 1,
        output_file: Optional[str] = None,
        style_config: Optional[Dict] = None
    ) -> str:
        """
        Generates a diagram for the specified Odoo model and its relationships using BFS.

        Args:
            model_name (str): The name of the Odoo model (e.g., 'res.partner').
            fields (List[Dict]): List of field definitions for the model.
            depth (int, optional): The depth of relationships to include. Defaults to 1.
            output_file (str, optional): Path to save the diagram. If None, returns as string.
            style_config (dict, optional): Configuration for diagram styling.

        Returns:
            str: The diagram as a string.

        Raises:
            ValueError: If model_name is invalid or empty.
            OSError: If writing to output_file fails.
        """
        if not model_name or not isinstance(model_name, str):
            raise ValueError("Model name must be a non-empty string")
        if depth <= 0:
            logger.warning(f"Depth limit reached for model {model_name}")
            return ""

        style_config = style_config or {}
        lines = [self.renderer.start_diagram()]
        lines.extend(self.renderer.apply_style(style_config))

        queue = deque([(model_name, depth)])
        processed_models: Set[str] = set()

        while queue:
            current_model, current_depth = queue.popleft()
            if current_model in processed_models or current_depth <= 0:
                continue

            processed_models.add(current_model)
            related_models: Set[str] = set()

            # Fetch fields for the current model (in real implementation, this would query the API)
            current_fields = fields if current_model == model_name else []
            for field in current_fields:
                field_type = field.get("type")
                field_name = field.get("field_name")
                relation = field.get("relation")

                if field_type and field_name and relation:
                    line = self.renderer.render(field_type, current_model, relation, field_name)
                    lines.append(line)
                    related_models.add(relation)

            if current_depth > 1:
                for related_model in related_models:
                    if related_model != current_model:
                        queue.append((related_model, current_depth - 1))

        lines.append(self.renderer.end_diagram())

        if output_file:
            save_to_file(lines, output_file)

        return "\n".join(lines)

class OdooModelExplorer:
    """Mock implementation of OdooModelExplorer to interact with Odoo models."""
    def __init__(self, base_url: str, database: str, username: str, password: str):
        if not all([base_url, database, username, password]):
            raise ValueError("All connection parameters must be provided")
        self.base_url = base_url
        self.database = database
        self.username = username
        self.password = password
        self.selected_models: Set[str] = set()
        self.model_cache = self._mock_model_data()

    def _mock_model_data(self) -> Dict[str, List[Dict]]:
        """Mock data for Odoo models and fields."""
        return {
            "res.partner": [
                {"field_name": "country_id", "type": "many2one", "relation": "res.country", "string": "Country", "required": False},
                {"field_name": "user_ids", "type": "one2many", "relation": "res.users", "string": "Users", "required": False},
                {"field_name": "name", "type": "char", "string": "Name", "required": True},
            ],
            "res.country": [
                {"field_name": "name", "type": "char", "string": "Country Name", "required": True},
            ],
            "res.users": [
                {"field_name": "login", "type": "char", "string": "Login", "required": True},
                {"field_name": "partner_id", "type": "many2one", "relation": "res.partner", "string": "Partner", "required": True},
            ],
        }

    def check_api_availability(self) -> bool:
        """Mock check for API availability."""
        return True

    def get_selected_models(self) -> Set[str]:
        """Returns the set of selected models."""
        return self.selected_models

    def select_model(self, model: str) -> None:
        """Selects a model for analysis."""
        if model in self.model_cache:
            self.selected_models.add(model)
        else:
            logger.warning(f"Model {model} not found in cache")

    def search_models(self, query: str) -> List[str]:
        """Searches for models matching the query."""
        return [model for model in self.model_cache.keys() if query.lower() in model.lower()]

    def analyze_model(self, model_name: str) -> Dict:
        """Analyzes a model and returns field types, relationships, and required fields."""
        if model_name not in self.model_cache:
            raise ValueError(f"Model {model_name} not found")

        fields = self.model_cache[model_name]
        analysis = {
            "field_count": len(fields),
            "field_types": defaultdict(int),
            "relationships": defaultdict(list),
            "required_fields": [],
        }

        for field in fields:
            field_type = field["type"]
            analysis["field_types"][field_type] += 1

            if field.get("required"):
                analysis["required_fields"].append(field["field_name"])

            if field_type in ("many2one", "one2many", "many2many"):
                analysis["relationships"][field_type].append({
                    "field": field["field_name"],
                    "string": field["string"],
                    "model": field.get("relation", ""),
                })

        return analysis

    def export_model_diagram(self, model_name: str, depth: int = 1, output_file: Optional[str] = None, style_config: Optional[Dict] = None) -> str:
        """Exports a diagram for the specified model."""
        if model_name not in self.model_cache:
            raise ValueError(f"Model {model_name} not found")
        
        renderer = PlantUMLRenderer()  # Default renderer; could be parameterized
        diagram_generator = OdooDiagramGenerator(renderer)
        fields = self.model_cache[model_name]
        return diagram_generator.export_model_diagram(model_name, fields, depth, output_file, style_config)

    def export_llm_prompt(self, output_file: str, app_description: str, exclude_timezone: bool = False, timezone_handling: bool = False) -> None:
        """Exports an LLM prompt based on selected models."""
        if not self.selected_models:
            raise ValueError("No models selected for LLM export")

        prompt_lines = [f"App Description: {app_description}", "\nModels and Fields:"]
        for model in self.selected_models:
            prompt_lines.append(f"\nModel: {model}")
            fields = self.model_cache.get(model, [])
            for field in fields:
                if exclude_timezone and "tz" in field["field_name"].lower():
                    continue
                prompt_lines.append(f"  - {field['field_name']}: {field['type']}")
        
        if timezone_handling:
            prompt_lines.append("\nTimezone Handling Recommendations:")
            prompt_lines.append("  - Use UTC for all timestamps.")
            prompt_lines.append("  - Convert to local timezone on display.")

        save_to_file(prompt_lines, output_file)

    def export_mobile_app_llm_prompt(self, output_file: str, app_description: str, framework: str, timezone_handling: bool = False) -> None:
        """Exports an LLM prompt for a mobile app."""
        if framework not in SUPPORTED_FRAMEWORKS:
            raise ValueError(f"Unsupported framework: {framework}")

        prompt_lines = [f"Mobile App ({framework}) Description: {app_description}", "\nModels and Fields:"]
        for model in self.selected_models:
            prompt_lines.append(f"\nModel: {model}")
            fields = self.model_cache.get(model, [])
            for field in fields:
                prompt_lines.append(f"  - {field['field_name']}: {field['type']}")

        if timezone_handling:
            prompt_lines.append("\nTimezone Handling Recommendations:")
            prompt_lines.append("  - Use device's local timezone for display.")
            prompt_lines.append("  - Sync with server in UTC.")

        save_to_file(prompt_lines, output_file)

    def generate_api_endpoints_summary(self, output_file: str) -> None:
        """Generates a summary of API endpoints for selected models."""
        if not self.selected_models:
            raise ValueError("No models selected for API endpoints")

        lines = ["API Endpoints Summary:"]
        for model in self.selected_models:
            lines.append(f"\nModel: {model}")
            lines.append(f"  - GET /api/{model}/: List all records")
            lines.append(f"  - GET /api/{model}/{{id}}/: Retrieve a record")
            lines.append(f"  - POST /api/{model}/: Create a record")
            lines.append(f"  - PUT /api/{model}/{{id}}/: Update a record")
            lines.append(f"  - DELETE /api/{model}/{{id}}/: Delete a record")

        save_to_file(lines, output_file)

    def analyze_for_mobile_app(self, output_file: str) -> None:
        """Analyzes selected models for mobile app development."""
        if not self.selected_models:
            raise ValueError("No models selected for mobile analysis")

        lines = ["Mobile App Analysis:"]
        for model in self.selected_models:
            lines.append(f"\nModel: {model}")
            analysis = self.analyze_model(model)
            lines.append(f"  Total Fields: {analysis['field_count']}")
            lines.append("  Field Types:")
            for field_type, count in analysis["field_types"].items():
                lines.append(f"    - {field_type}: {count}")
            lines.append("  Recommendations:")
            lines.append("    - Use lazy loading for large datasets.")
            lines.append("    - Implement offline caching for critical fields.")

        save_to_file(lines, output_file)

    def explore(self) -> None:
        """Interactive mode for exploring models."""
        print("Entering interactive mode...")
        while True:
            cmd = input("Enter command (search <query>, select <model>, analyze <model>, exit): ").strip().split()
            if not cmd:
                continue
            action = cmd[0].lower()
            if action == "exit":
                break
            elif action == "search" and len(cmd) > 1:
                results = self.search_models(cmd[1])
                print(f"Found {len(results)} models:")
                for model in results:
                    print(f"  - {model}")
            elif action == "select" and len(cmd) > 1:
                self.select_model(cmd[1])
                print(f"Selected model: {cmd[1]}")
            elif action == "analyze" and len(cmd) > 1:
                try:
                    analysis = self.analyze_model(cmd[1])
                    print(f"\nAnalysis of {cmd[1]}:")
                    print(f"Total fields: {analysis['field_count']}")
                    print("Field types:")
                    for field_type, count in analysis['field_types'].items():
                        print(f"  - {field_type}: {count}")
                except ValueError as e:
                    print(f"Error: {e}")
            else:
                print("Invalid command")

def main():
    """
    Main function for the Odoo Diagram Generator CLI.
    """
    parser = argparse.ArgumentParser(
        description="Explore Odoo models and fields via MUK REST API"
    )
    parser.add_argument(
        "--url",
        required=True,
        help="Base URL of the Odoo server (e.g., http://localhost:8069)",
    )
    parser.add_argument("--db", help="Database name")
    parser.add_argument("--username", help="Username for authentication")
    parser.add_argument("--password", help="Password for authentication")
    parser.add_argument("--model", help="Model to analyze")
    parser.add_argument("--diagram", action="store_true", help="Generate diagram")
    parser.add_argument(
        "--diagram-format",
        choices=["plantuml", "mermaid"],
        default="plantuml",
        help="Diagram format to generate (plantuml or mermaid)"
    )
    parser.add_argument(
        "--diagram-style",
        help="JSON string for diagram styling (e.g., '{\"monochrome\": true}')",
        type=json.loads,
        default="{}"
    )
    parser.add_argument(
        "--depth", type=int, default=DEFAULT_RELATIONSHIP_DEPTH, help="Depth of diagram relationships"
    )
    parser.add_argument("--output", help="Output file for diagram")
    parser.add_argument("--search", help="Search for models matching a query")
    parser.add_argument(
        "--interactive", action="store_true", help="Interactive mode"
    )
    parser.add_argument(
        "--refresh-cache", action="store_true", help="Refresh cache"
    )
    parser.add_argument(
        "--select-models", help="Comma-separated list of models to select"
    )
    parser.add_argument("--export-llm", help="Export LLM prompt to file")
    parser.add_argument(
        "--export-mobile-llm", help="Export mobile app LLM prompt to file"
    )
    parser.add_argument(
        "--app-description", help="App description for LLM prompt"
    )
    parser.add_argument(
        "--framework",
        default=DEFAULT_FRAMEWORK,
        choices=SUPPORTED_FRAMEWORKS,
        help="Target framework for mobile app (react-native, flutter)",
    )
    parser.add_argument(
        "--api-endpoints", help="Generate API endpoints summary to file"
    )
    parser.add_argument(
        "--mobile-analysis", help="Generate mobile app analysis to file"
    )
    parser.add_argument(
        "--exclude-timezone",
        action="store_true",
        help="Exclude timezone fields from output",
    )
    parser.add_argument(
        "--timezone-handling",
        action="store_true",
        help="Include timezone handling recommendations",
    )
    args = parser.parse_args()

    # Create explorer
    try:
        explorer = OdooModelExplorer(
            base_url=args.url,
            database=args.db,
            username=args.username,
            password=args.password,
        )
    except ValueError as e:
        print(f"Error: {e}")
        sys.exit(1)

    # Check API availability
    if not explorer.check_api_availability():
        print("API is not available. Please check your connection settings.")
        sys.exit(1)

    # Interactive mode
    if args.interactive:
        explorer.explore()
        return

    # Select models if specified
    if args.select_models:
        for model in args.select_models.split(','):
            explorer.select_model(model.strip())
        print(f"Selected {len(explorer.get_selected_models())} models")

    # Process commands
    if args.search:
        results = explorer.search_models(args.search)
        if results:
            print(f"Found {len(results)} matching models:")
            for model in results:
                print(model)
        else:
            print("No matching models found.")

    elif args.model:
        print(f"Analyzing model {args.model}...")
        if args.diagram:
            try:
                diagram = explorer.export_model_diagram(
                    model_name=args.model,
                    depth=args.depth,
                    output_file=args.output,
                    style_config=args.diagram_style
                )
                if not args.output:
                    print(diagram)
            except (ValueError, OSError) as e:
                print(f"Error generating diagram: {e}")
                sys.exit(1)
        else:
            try:
                analysis = explorer.analyze_model(args.model)
                print(f"\n=== Analysis of {args.model} ===\n")
                print(f"Total fields: {analysis['field_count']}")

                print("\nField types:")
                for field_type, count in analysis['field_types'].items():
                    print(f"  - {field_type}: {count}")

                print("\nRelationships:")
                for rel_type, relations in analysis['relationships'].items():
                    print(f"\n  {rel_type.upper()} relationships ({len(relations)}):")
                    if relations:
                        for rel in relations:
                            print(f"    - {rel['field']} ({rel['string']}) -> {rel['model']}")
                    else:
                        print("    None")

                print("\nRequired fields:")
                if analysis['required_fields']:
                    for field in analysis['required_fields']:
                        print(f"  - {field}")
                else:
                    print("  None")
            except ValueError as e:
                print(f"Error analyzing model: {e}")
                sys.exit(1)

    # Export LLM prompt if specified
    if args.export_llm:
        if not explorer.get_selected_models():
            print("No models selected for export. Use --select-models to select models.")
        else:
            try:
                explorer.export_llm_prompt(
                    args.export_llm,
                    args.app_description or "",
                    exclude_timezone=args.exclude_timezone,
                    timezone_handling=args.timezone_handling,
                )
                print(f"Exported LLM prompt to {args.export_llm}")
            except (ValueError, OSError) as e:
                print(f"Error exporting LLM prompt: {e}")
                sys.exit(1)

    # Export mobile app LLM prompt if specified
    if args.export_mobile_llm:
        if not explorer.get_selected_models():
            print("No models selected for export. Use --select-models to select models.")
        else:
            try:
                explorer.export_mobile_app_llm_prompt(
                    args.export_mobile_llm,
                    args.app_description or "",
                    framework=args.framework,
                    timezone_handling=args.timezone_handling,
                )
                print(f"Exported mobile app LLM prompt to {args.export_mobile_llm}")
            except (ValueError, OSError) as e:
                print(f"Error exporting mobile app LLM prompt: {e}")
                sys.exit(1)

    # Generate API endpoints summary if specified
    if args.api_endpoints:
        if not explorer.get_selected_models():
            print("No models selected for API endpoints. Use --select-models to select models.")
        else:
            try:
                explorer.generate_api_endpoints_summary(args.api_endpoints)
                print(f"Generated API endpoints summary to {args.api_endpoints}")
            except (ValueError, OSError) as e:
                print(f"Error generating API endpoints summary: {e}")
                sys.exit(1)

    # Generate mobile app analysis if specified
    if args.mobile_analysis:
        if not explorer.get_selected_models():
            print("No models selected for mobile analysis. Use --select-models to select models.")
        else:
            try:
                explorer.analyze_for_mobile_app(args.mobile_analysis)
                print(f"Generated mobile app analysis to {args.mobile_analysis}")
            except (ValueError, OSError) as e:
                print(f"Error generating mobile app analysis: {e}")
                sys.exit(1)

if __name__ == "__main__":
    main()