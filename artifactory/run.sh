#!/command/with-contenv bashio
# shellcheck shell=bash
set +e

bashio::log.info "Starting Artifactory..."

# Ensure /data exists for persistent federation store
if [ ! -d "/data" ]; then
    mkdir -p /data
fi

# Ensure default www directory exists
if [ ! -d "/config/www" ]; then
    mkdir -p /config/www
    bashio::log.info "Created /config/www directory"
fi

export PORT=8099
bashio::log.info "Listening on port ${PORT}"

# Start the Node.js server
exec node /app/index.js
