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

echo "Enforcing Home Assistant's persistent storage natively..."

# Method 1: Inject the environment variable natively into the Node runtime.
# This guarantees process.env.DATA_DIR is always correct, even if startup shells drop it.
cat << 'EOF' > /opt/app/ha_override.js
process.env.DATA_DIR = '/data';
EOF
export NODE_OPTIONS="--require /opt/app/ha_override.js"

# Method 2: Ensure a local .env file reflects the change for dotenv-based parsers
echo "DATA_DIR=/data" > /opt/app/.env

# Method 3: Safely patch any hardcoded shell paths without breaking the shebang header
if [ -f "/opt/app/start.sh" ]; then
    sed -i 's|/opt/data|/data|g' /opt/app/start.sh || true
fi

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