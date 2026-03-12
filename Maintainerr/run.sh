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

cd /opt/app

# Since the Docker volume persistence issue is solved via the /opt/data symlink,
# we no longer need to bypass the native app startup logic. 
# Using the native script or npm start ensures we hit the correct entrypoint 
# for Maintainerr v3.0+ and that any database migrations run automatically.
if [ -f "start.sh" ]; then
    echo "Launching Maintainerr via native start.sh..."
    exec bash start.sh
else
    echo "Launching Maintainerr via npm..."
    exec npm start
fi