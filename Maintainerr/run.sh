#!/bin/bash
set -e

echo "Configuring Maintainerr persistence..."

# 1. Handle the /opt/data directory
# Maintainerr expects data in /opt/data. We must link this to the persistent /data volume.
# If /opt/data exists (as a dir or wrong link), remove it so we can link it correctly.
if [ "$(readlink /opt/data)" != "/data" ]; then
    # Try to remove /opt/data. If it's a Docker volume, this will fail with "Resource busy".
    if rm -rf /opt/data 2>/dev/null; then
        echo "Configuring /opt/data to point to persistent /data storage"
        ln -s /data /opt/data
    else
        echo "Unable to replace /opt/data (Volume detected). Patching application to use /data directly..."
        
        # If /opt/data has content and /data is empty, copy the default content to /data
        if [ -d "/opt/data" ] && [ -z "$(ls -A /data)" ]; then
            echo "Initializing persistent data from image defaults..."
            cp -a /opt/data/. /data/
        fi

        # Patch the application source code to use /data instead of /opt/data
        # We search recursively in the current directory (.) to find all occurrences
        echo "Searching for files to patch..."
        grep -rl "/opt/data" . 2>/dev/null | while read -r file; do
            echo "Patching $file"
            sed -i 's|/opt/data|/data|g' "$file"
        done || echo "Patching complete (or no files found)."
        
        # Safety: Ensure the original volume is also writable, just in case patching missed something
        # and the app still tries to write there.
        chown -R 1000:1000 /opt/data || true
    fi
fi

# 3. Ensure permissions are correct
# Maintainerr typically runs as user 1000. Ensure the persistent data is writable by them.
echo "Fixing permissions on /data"
chown -R 1000:1000 /data

echo "Starting Maintainerr application..."

# 4. Start the application
# Note: You should check the base Maintainerr Dockerfile for the exact startup command.
# It is often 'node dist/main' or a specific start script.
# Assuming the base image adds the cmd to path or sets a working directory:
exec /usr/local/bin/docker-entrypoint.sh "$@"
# OR if you know the direct command:
# cd /app && exec node apps/server/dist/main.js
