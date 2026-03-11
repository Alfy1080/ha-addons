#!/bin/bash
set -e

CONFIG_PATH=/data/options.json

# Extract basic configuration from Home Assistant UI
export TZ=$(jq --raw-output '.timezone // "UTC"' $CONFIG_PATH)
export DEBUG=$(jq --raw-output '.debug // "false"' $CONFIG_PATH)
export BASE_PATH=$(jq --raw-output '.base_path // ""' $CONFIG_PATH)

echo "======================================================"
echo " Starting Maintainerr Add-on for Home Assistant"
echo " Timezone set to: $TZ"
echo " Debug mode: $DEBUG"
if [ -n "$BASE_PATH" ]; then
    echo " Base Path: $BASE_PATH"
fi
echo "======================================================"

# The ultimate persistence fix: OS-level directory binding.
# Because /opt/data is defined as a VOLUME in the base Docker image, symlinks fail 
# and environment variables are often dropped by the start.sh script.
# By using mount --bind, we force the OS to map the persistent /data folder
# directly over /opt/data. The application requires zero modification.

echo "Binding Home Assistant persistent storage to application directory..."

# Ensure the target directory exists just in case
mkdir -p /opt/data

# Mount the persistent /data folder over the ephemeral /opt/data folder
mount --bind /data /opt/data

# Fix permissions so the internal node user can read/write to the newly bound directory
chown -R node:node /opt/data || true

# Execute the original Maintainerr start script
exec /opt/app/start.sh