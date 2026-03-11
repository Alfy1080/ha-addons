#!/bin/bash
set -e

CONFIG_PATH=/data/options.json

# Extract basic configuration from Home Assistant UI
export TZ=$(jq --raw-output '.timezone // "UTC"' $CONFIG_PATH)
export DEBUG=$(jq --raw-output '.debug // "false"' $CONFIG_PATH)
export BASE_PATH=$(jq --raw-output '.base_path // ""' $CONFIG_PATH)

# Enforce Home Assistant's persistent storage directory
export DATA_DIR="/data"

# Ensure the data directory exists
mkdir -p "$DATA_DIR"

echo "======================================================"
echo " Starting Maintainerr Add-on for Home Assistant"
echo " Timezone set to: $TZ"
echo " Debug mode: $DEBUG"
echo " Data Directory: $DATA_DIR"
if [ -n "$BASE_PATH" ]; then
    echo " Base Path: $BASE_PATH"
fi
echo "======================================================"

# Execute the original Maintainerr start script
exec /opt/app/start.sh