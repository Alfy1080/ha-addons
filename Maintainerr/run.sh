#!/bin/bash
set -e

CONFIG_PATH=/data/options.json

# Extract basic configuration from Home Assistant UI
export TZ=$(jq --raw-output '.timezone // "UTC"' $CONFIG_PATH)
export DEBUG=$(jq --raw-output '.debug // "false"' $CONFIG_PATH)
export BASE_PATH=$(jq --raw-output '.base_path // ""' $CONFIG_PATH)

# Critical: Force Node to listen on all interfaces so HA can map the port
export HOST=0.0.0.0

# We use the Home Assistant share directory for persistent storage
export PERSISTENT_DIR="/share/Maintainerr"
export APP_DATA_DIR="/opt/data"
export APP_DIR="/opt/app"

echo "======================================================"
echo " Starting Maintainerr Add-on for Home Assistant"
echo " Timezone set to: $TZ"
echo " Host: $HOST"
echo " Debug mode: $DEBUG"
if [ -n "$BASE_PATH" ]; then
    echo " Base Path: $BASE_PATH"
fi
echo " Persistent Directory: $PERSISTENT_DIR"
echo "======================================================"

echo "Initializing persistent storage..."

# Ensure the shared directory exists on the host
mkdir -p "$PERSISTENT_DIR"

# Copy initial data if persistent storage is empty
if [ -z "$(ls -A "$PERSISTENT_DIR")" ] && [ -d "$APP_DATA_DIR" ]; then
    echo "First run detected: Populating $PERSISTENT_DIR with default data..."
    cp -a "$APP_DATA_DIR/." "$PERSISTENT_DIR/"
fi

# Strategy 1: Bind Mount (Preferred)
echo "Attempting to bind mount storage..."
if mount --bind "$PERSISTENT_DIR" "$APP_DATA_DIR" 2>/dev/null; then
    echo "Success: Storage mounted."
else
    # Strategy 2: Patch Application (Fallback if Volume is locked)
    echo "Mount failed (Volume locked). Patching application to use $PERSISTENT_DIR directly..."
    find "$APP_DIR" -type f -name "*.js" -exec grep -l "$APP_DATA_DIR" {} + | while read -r file; do
        echo "Patching: $file"
        sed -i "s|$APP_DATA_DIR|$PERSISTENT_DIR|g" "$file"
    done
    
    # Ensure the original path is writable just in case
    chmod 777 "$APP_DATA_DIR" || true
fi

cd "$APP_DIR"

echo "Launching Maintainerr natively..."
# The internal app will try to write to /opt/data, which is now safely symlinked to /share/Maintainerr
exec node dist/main