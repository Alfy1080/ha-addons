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

# Symlink Maintainerr's default data directory to Home Assistant's persistent storage
# This ensures any hardcoded paths in the app also write to the persistent drive
if [ ! -L "/opt/data" ]; then
    echo "Linking /opt/data to persistent /data directory..."
    # Move any existing default data into the persistent folder before linking
    if [ -d "/opt/data" ]; then
        cp -r /opt/data/* "$DATA_DIR/" 2>/dev/null || true
        rm -rf /opt/data
    fi
    ln -sf "$DATA_DIR" /opt/data
fi

echo "======================================================"

# Execute the original Maintainerr start script
exec /opt/app/start.sh