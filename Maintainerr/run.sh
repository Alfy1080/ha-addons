#!/usr/bin/with-contenv bashio

bashio::log.info "Configuring Maintainerr persistence..."

# 1. Handle the /opt/data directory
# Maintainerr expects data in /opt/data. We must link this to the persistent /data volume.
# If /opt/data exists (as a dir or wrong link), remove it so we can link it correctly.
if [ "$(readlink /opt/data)" != "/data" ]; then
    bashio::log.info "Configuring /opt/data to point to persistent /data storage"
    rm -rf /opt/data
    ln -s /data /opt/data
fi

# 3. Ensure permissions are correct
# Maintainerr typically runs as user 1000. Ensure the persistent data is writable by them.
bashio::log.info "Fixing permissions on /data"
chown -R 1000:1000 /data

bashio::log.info "Starting Maintainerr application..."

# 4. Start the application
# Note: You should check the base Maintainerr Dockerfile for the exact startup command.
# It is often 'node dist/main' or a specific start script.
# Assuming the base image adds the cmd to path or sets a working directory:
exec /usr/local/bin/docker-entrypoint.sh  # Example: use the base image's entrypoint if available
# OR if you know the direct command:
# cd /app && exec node apps/server/dist/main.js
