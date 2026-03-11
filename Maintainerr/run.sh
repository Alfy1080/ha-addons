#!/bin/bash
set -e

CONFIG_PATH=/data/options.json

# Extract basic configuration from Home Assistant UI
export TZ=$(jq --raw-output '.timezone // "UTC"' $CONFIG_PATH)
export DEBUG=$(jq --raw-output '.debug // "false"' $CONFIG_PATH)
export BASE_PATH=$(jq --raw-output '.base_path // ""' $CONFIG_PATH)

# We use the Home Assistant share directory for persistent storage
export PERSISTENT_DIR="/share/Maintainerr"

echo "======================================================"
echo " Starting Maintainerr Add-on for Home Assistant"
echo " Timezone set to: $TZ"
echo " Debug mode: $DEBUG"
if [ -n "$BASE_PATH" ]; then
    echo " Base Path: $BASE_PATH"
fi
echo " Persistent Directory: $PERSISTENT_DIR"
echo "======================================================"

echo "Initializing persistent storage..."

# Ensure the shared directory exists on the host
mkdir -p "$PERSISTENT_DIR"

# Create the symlink at RUNTIME because the base image defines /opt/data as a VOLUME
echo "Linking /opt/data to Home Assistant /share..."
rm -rf /opt/data
ln -s "$PERSISTENT_DIR" /opt/data

# Bypass the app's native start.sh wrapper to prevent it from resetting our environment variables.
# We run directly as root to avoid Permission Denied errors when writing to Home Assistant's mapped volumes.
cd /opt/app

echo "Launching Maintainerr natively..."
# The internal app will try to write to /opt/data, which is now safely symlinked to /share/Maintainerr
exec node dist/main