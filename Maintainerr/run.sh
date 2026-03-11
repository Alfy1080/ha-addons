#!/bin/bash
set -e

CONFIG_PATH=/data/options.json

# Extract basic configuration from Home Assistant UI
export TZ=$(jq --raw-output '.timezone // "UTC"' $CONFIG_PATH)
export DEBUG=$(jq --raw-output '.debug // "false"' $CONFIG_PATH)
export BASE_PATH=$(jq --raw-output '.base_path // ""' $CONFIG_PATH)

# Use the HA OS Addon Config directory (mounted natively as /config in the container)
export DATA_DIR="/config"

echo "======================================================"
echo " Starting Maintainerr Add-on for Home Assistant"
echo " Timezone set to: $TZ"
echo " Debug mode: $DEBUG"
if [ -n "$BASE_PATH" ]; then
    echo " Base Path: $BASE_PATH"
fi
echo " Data Directory: $DATA_DIR"
echo "======================================================"

echo "Configuring persistent storage to use HA addon_config..."

# Ensure the addon config directory exists and has the correct permissions
mkdir -p "$DATA_DIR"
chown -R node:node "$DATA_DIR" || true

# Forcefully patch any hardcoded references from /opt/data to /config
# This guarantees the app writes to the persistent addon_configs directory
if [ -f "/opt/app/start.sh" ]; then
    sed -i "s|/opt/data|$DATA_DIR|g" /opt/app/start.sh || true
fi
find /opt/app -type f -name "*.js" -exec sed -i "s|/opt/data|$DATA_DIR|g" {} + 2>/dev/null || true

# Execute the original Maintainerr start script natively as the 'node' user
exec su node -s /bin/bash -c "export DATA_DIR=$DATA_DIR && /opt/app/start.sh"