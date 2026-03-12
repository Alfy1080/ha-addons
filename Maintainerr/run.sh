#!/bin/bash
set -e

CONFIG_PATH=/data/options.json

# Extract basic configuration from Home Assistant UI
export TZ=$(jq --raw-output '.timezone // "UTC"' $CONFIG_PATH)
export DEBUG=$(jq --raw-output '.debug // "false"' $CONFIG_PATH)
export BASE_PATH=$(jq --raw-output '.base_path // ""' $CONFIG_PATH)

# We use the native Home Assistant Add-on /data directory for persistent storage
export PERSISTENT_DIR="/data/maintainerr"

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

# Ensure the persistent directory exists
mkdir -p "$PERSISTENT_DIR"

# Provide common environment variables just in case the app respects them natively
export DATA_DIR="$PERSISTENT_DIR"
export DATADIR="$PERSISTENT_DIR"

echo "Attempting to bind-mount persistent directory..."
# Try to overlay the anonymous volume with our persistent directory.
if mount --bind "$PERSISTENT_DIR" /opt/data 2>/dev/null; then
    echo "Successfully bind-mounted persistent storage!"
    cd /opt/app
    exec node dist/main
fi

echo "Bind mount not permitted. Applying App Relocation workaround..."
# Docker prevents removing the /opt/data VOLUME mount point, and unprivileged Add-ons cannot mount.
# We relocate the app to /tmp so that relative path traversals (../../data) point to our symlink instead.
APP_DIR="/tmp/maintainerr_app"
rm -rf "$APP_DIR"
mkdir -p "$APP_DIR"

echo "Copying application files to workspace..."
cp -a /opt/app/. "$APP_DIR/"

# The app looks for data in ../../data (relative to dist/main).
# By putting the app in /tmp/maintainerr_app, ../../data resolves to /tmp/data.
rm -rf /tmp/data 2>/dev/null || true
ln -s "$PERSISTENT_DIR" /tmp/data

cd "$APP_DIR"
echo "Launching Maintainerr..."
exec node dist/main