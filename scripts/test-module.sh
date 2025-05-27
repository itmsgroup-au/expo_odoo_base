#!/bin/bash
# test-module.sh

MODULE_NAME=$1
COVERAGE_THRESHOLD=80

if [ -z "$MODULE_NAME" ]; then
  echo "Error: Please provide a module name"
  echo "Usage: ./scripts/test-module.sh <module-name>"
  exit 1
fi

echo "Testing module: $MODULE_NAME"

# Run Jest with module-specific pattern
npx jest --testPathPattern=src/features/$MODULE_NAME --coverage

# Check coverage threshold
COVERAGE=$(cat coverage/coverage-summary.json | grep -o '"pct": [0-9]*.[0-9]*' | head -1 | grep -o '[0-9]*.[0-9]*')

if (( $(echo "$COVERAGE < $COVERAGE_THRESHOLD" | bc -l) )); then
  echo "❌ Test coverage ($COVERAGE%) is below threshold ($COVERAGE_THRESHOLD%)"
  exit 1
else
  echo "✅ Test coverage ($COVERAGE%) meets threshold ($COVERAGE_THRESHOLD%)"
fi
