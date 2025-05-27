#!/bin/bash
# generate-api.sh - Generate API file for a model

echo "// API for $ODOO_MODEL model

import { createModelAPI } from './modelApiTemplate';

export const ${MODEL_NAME}API = createModelAPI('$ODOO_MODEL');

// Add any custom methods for this specific model
export const getAll${MODEL_NAME^} = (limit = 50, offset = 0, forceRefresh = false) => {
  return ${MODEL_NAME}API.getList(
    [], // Domain
    ['id', 'name', 'display_name'], // Basic fields - customize as needed
    limit,
    offset,
    forceRefresh
  );
};

export default ${MODEL_NAME}API;
" > "$MODELS_DIR/${MODEL_NAME}Api.js"

echo "Created model API at $MODELS_DIR/${MODEL_NAME}Api.js"