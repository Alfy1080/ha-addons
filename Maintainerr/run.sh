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

# Fix permissions: Home Assistant creates /data as root, but Maintainerr runs as the 'node' user.
# If it can't write to /data, it will silently fail to save databases or crash.
chown -R node:node "$DATA_DIR" || true

echo "Patching Maintainerr to use Home Assistant's persistent storage..."
# The base Docker image defines /opt/data as a VOLUME, so symlinking the folder fails.
# Instead, we strictly patch the app's source and start script to point directly to /data.
if [ -f "/opt/app/start.sh" ]; then
    # Replace any hardcoded paths in the startup script
    sed -i 's|/opt/data|/data|g' /opt/app/start.sh || true
    # Force the environment variable inside the script just in case it drops envs
    sed -i '1s|^|export DATA_DIR="/data"\n|' /opt/app/start.sh || true
fi

# Patch compiled Javascript defaults in case process.env.DATA_DIR is ignored
find /opt/app -type f -name "*.js" -exec sed -i 's|/opt/data|/data|g' {} + 2>/dev/null || true

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