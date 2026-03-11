#!/bin/bash
set -e

echo "Configuring Maintainerr persistence..."

PERSISTENT_DIR="/data"
APP_DATA_DIR="/opt/data"

# Ensure persistent directory exists
mkdir -p "$PERSISTENT_DIR"

# 1. Persistence Strategy: Bind Mount
# This maps /data over /opt/data so the app writes to persistence transparently.
echo "Attempting to bind mount $PERSISTENT_DIR to $APP_DATA_DIR..."
if mount --bind "$PERSISTENT_DIR" "$APP_DATA_DIR" 2>/dev/null; then
    echo "Success: Bind mount established."
else
    echo "Bind mount failed (likely permission issues). Falling back to application patching."
    
    # 2. Persistence Strategy: Patching (Fallback)
    # If /opt/data has content and /data is empty, copy defaults to /data
    if [ -d "$APP_DATA_DIR" ] && [ -z "$(ls -A $PERSISTENT_DIR)" ]; then
        echo "Initializing persistent data from image defaults..."
        cp -a $APP_DATA_DIR/. $PERSISTENT_DIR/
    fi

    echo "Searching for application files to patch..."
    # Locate main.js in common locations
    TARGET_FILES=$(find /opt/app /app /usr/src/app -name "main.js" 2>/dev/null || true)
    
    PATCHED=false
    for file in $TARGET_FILES; do
        if grep -q "$APP_DATA_DIR" "$file"; then
            echo "Patching $file..."
            sed -i "s|$APP_DATA_DIR|$PERSISTENT_DIR|g" "$file"
            PATCHED=true
        fi
    done
    
    if [ "$PATCHED" = "false" ]; then
        echo "WARNING: No files patched. Persistence may not work if bind mount also failed."
    fi
fi

echo "Fixing permissions on data directories..."
chown -R 1000:1000 "$PERSISTENT_DIR"
chown -R 1000:1000 "$APP_DATA_DIR" || true

echo "Starting Maintainerr application..."

# 4. Start the application
# We need to be in the app directory for 'npm start' or 'node dist/main' to work.
# We guess the location based on where we might have found files, or standard paths.
APP_DIR=$(find /opt/app /app /usr/src/app -name "package.json" -print -quit | xargs dirname)
if [ -n "$APP_DIR" ]; then cd "$APP_DIR"; fi

# Use npm start if available, otherwise try to run node directly
if [ -f "package.json" ]; then
    exec npm start
else
    exec node dist/main
fi
