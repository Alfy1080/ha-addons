#!/bin/bash
set -e

CONFIG_PATH=/data/options.json

# Safely extract configuration from Home Assistant UI (fallback to defaults if missing)
export TZ=$(jq --raw-output '.timezone // "UTC"' $CONFIG_PATH 2>/dev/null || echo "UTC")
export DEBUG=$(jq --raw-output '.debug // "false"' $CONFIG_PATH 2>/dev/null || echo "false")
export BASE_PATH=$(jq --raw-output '.base_path // ""' $CONFIG_PATH 2>/dev/null || echo "")

# Point to Home Assistant's mapped Host OS directory
export DATA_DIR="/config"

echo "======================================================"
echo " Starting Maintainerr Add-on for Home Assistant"
echo " Timezone set to: $TZ"
echo " Debug mode: $DEBUG"
if [ -n "$BASE_PATH" ]; then
    echo " Base Path: $BASE_PATH"
fi
echo " Persistent Host Directory: $DATA_DIR"
echo "======================================================"

echo "Initializing persistent storage..."
# Ensure the Home Assistant mapped directory actually exists
mkdir -p "$DATA_DIR"

cd /opt/app

echo "Launching Maintainerr natively..."
# Using the native script ensures all required database migrations run.
if [ -f "start.sh" ]; then
    exec bash start.sh
else
    exec npm start
fi