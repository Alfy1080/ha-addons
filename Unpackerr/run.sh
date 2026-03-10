#!/bin/bash
set -e

CONFIG_PATH=/data/options.json

# Extract basic configuration
export TZ=$(jq --raw-output '.timezone // "UTC"' $CONFIG_PATH)
WEB_IP=$(jq --raw-output '.webserver.ip // "0.0.0.0"' $CONFIG_PATH)
WEB_PORT=$(jq --raw-output '.webserver.port // "5656"' $CONFIG_PATH)
export UN_WEBSERVER_LISTEN_ADDR="${WEB_IP}:${WEB_PORT}"
export UN_WEBSERVER_URLBASE=$(jq --raw-output '.webserver.url_base // ""' $CONFIG_PATH)
export UN_WEBSERVER_METRICS="true"

echo "======================================================"
echo " Starting Unpackerr Add-on for Home Assistant"
echo " Timezone set to: $TZ"
echo "======================================================"

# Function to dynamically map UI config to Unpackerr Environment Variables
configure_app() {
    local app_name=$1
    local prefix=$2

    APP_URL=$(jq --raw-output ".${app_name}.url // empty" $CONFIG_PATH)
    APP_API_KEY=$(jq --raw-output ".${app_name}.api_key // empty" $CONFIG_PATH)

    if [ -n "$APP_URL" ] && [ "$APP_URL" != "null" ]; then
        if [ -z "$APP_API_KEY" ] || [ "$APP_API_KEY" == "null" ]; then
            echo "[WARNING] URL provided for $app_name but API Key is missing in Configuration!"
        else
            echo "✔ Configuring $app_name integration..."
            export "${prefix}_0_URL=$APP_URL"
            export "${prefix}_0_API_KEY=$APP_API_KEY"

            # Parse the array of paths and set UN_<APP>_0_PATHS_X
            PATHS=$(jq -r ".${app_name}.paths[]? // empty" $CONFIG_PATH)
            i=0
            if [ -n "$PATHS" ]; then
                while IFS= read -r path; do
                    if [ -n "$path" ]; then
                        export "${prefix}_0_PATHS_${i}=$path"
                        i=$((i+1))
                    fi
                done <<< "$PATHS"
            fi
        fi
    fi
}

# Configure defined applications
configure_app "sonarr" "UN_SONARR"
configure_app "radarr" "UN_RADARR"

echo "Starting Unpackerr process..."
# Execute replaces the bash process, passing signals properly to Unpackerr
exec /usr/local/bin/unpackerr