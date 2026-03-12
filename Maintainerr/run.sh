#!/bin/bash
set -e

CONFIG_PATH=/data/options.json

# Safely extract configuration from Home Assistant UI (fallback to defaults if missing)
export TZ=$(jq --raw-output '.timezone // "UTC"' $CONFIG_PATH 2>/dev/null || echo "UTC")
export DEBUG=$(jq --raw-output '.debug // "false"' $CONFIG_PATH 2>/dev/null || echo "false")
export BASE_PATH=$(jq --raw-output '.base_path // ""' $CONFIG_PATH 2>/dev/null || echo "")

# Define the physical bind mount directory provided by Home Assistant OS
export DATA_DIR="/data/maintainerr"

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
# Ensure the Home Assistant persistent directory actually exists
mkdir -p "$DATA_DIR"

# Launch the app natively.
# Because of the scratch build + symlink in the Dockerfile, 
# EVERY write to /opt/data is now physically written to /data/maintainerr on the Host OS.
cd /opt/app
echo "Launching Maintainerr natively..."
exec node dist/main