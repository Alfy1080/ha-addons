#!/bin/bash
set -e

CONFIG_PATH=/data/options.json

# Extract basic configuration from Home Assistant UI
export TZ=$(jq --raw-output '.timezone // "UTC"' $CONFIG_PATH)
export DEBUG=$(jq --raw-output '.debug // "false"' $CONFIG_PATH)
export BASE_PATH=$(jq --raw-output '.base_path // ""' $CONFIG_PATH)

# Use the Home Assistant share directory for persistent storage
export DATA_DIR="/share/Maintainerr"

echo "======================================================"
echo " Starting Maintainerr Add-on for Home Assistant"
echo " Timezone set to: $TZ"
echo " Debug mode: $DEBUG"
if [ -n "$BASE_PATH" ]; then
    echo " Base Path: $BASE_PATH"
fi
echo " Data Directory: $DATA_DIR"
echo "======================================================"

echo "Initializing persistent storage..."

# Ensure the shared directory exists
mkdir -p "$DATA_DIR"

# Bypass the app's native start.sh wrapper to prevent it from resetting our environment variables.
# We run directly as root to avoid Permission Denied errors when writing to Home Assistant's mapped volumes.
cd /opt/app

echo "Launching Maintainerr natively..."
exec env DATA_DIR="$DATA_DIR" node dist/main