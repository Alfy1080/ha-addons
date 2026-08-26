#!/command/with-contenv bashio
# shellcheck shell=bash
set -e

bashio::log.info "Starting Artifactory..."

# Read configuration from options using jq
WRITE_PATHS=$(jq -r '.write_paths // [] | join(",")' /data/options.json)
READ_PATHS=$(jq -r '.read_paths // [] | join(",")' /data/options.json)

# Ensure default www directory exists
if [ ! -d "/config/www" ]; then
    mkdir -p /config/www
    bashio::log.info "Created /config/www directory"
fi

# Export configuration
export PORT=8099
export WRITE_PATHS="${WRITE_PATHS}"
export READ_PATHS="${READ_PATHS}"

bashio::log.info "Write paths: ${WRITE_PATHS}"
bashio::log.info "Read paths: ${READ_PATHS}"
bashio::log.info "Listening on port ${PORT}"

# Start the server
exec node /app/index.js
