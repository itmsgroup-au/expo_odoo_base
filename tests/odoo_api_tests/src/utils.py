import json
from datetime import datetime
from pathlib import Path

def save_results(test_results: dict, schema: dict, output_dir: str):
    """Save test results and relationship schema to JSON and text files."""
    Path(output_dir).mkdir(exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    json_file = Path(output_dir) / f"testodoo_summary_{timestamp}.json"
    txt_file = Path(output_dir) / f"testodoo_summary_{timestamp}.txt"
    schema_file = Path(output_dir) / f"relationship_schema_{timestamp}.json"

    # Save test results JSON
    with json_file.open("w") as f:
        json.dump(test_results, f, indent=2)

    # Save relationship schema JSON
    with schema_file.open("w") as f:
        json.dump(schema, f, indent=2)

    # Save test results text
    with txt_file.open("w") as f:
        f.write("==== ODOO REST API TEST SUMMARY ====\n")
        f.write(f"Timestamp: {test_results['timestamp']}\n")
        for section, tests in test_results["tests"].items():
            f.write(f"\n--- {section.upper()} ---\n")
            for test_name, result in tests.items():
                f.write(f"{test_name}:\n")
                f.write(f"  Status: {result['status'].capitalize()}\n")
                f.write(f"  Duration: {result['duration']:.2f}s\n")
                if result.get("data"):
                    f.write(f"  Data: {json.dumps(result['data'], indent=2)}\n")
