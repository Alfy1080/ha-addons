#!/bin/bash
set -e

CONFIG_PATH=/data/options.json

# Extract configuration from Home Assistant UI
EMAIL=$(jq --raw-output '.email // empty' $CONFIG_PATH)
PASSWORD=$(jq --raw-output '.password // empty' $CONFIG_PATH)
DEVICE_NAME=$(jq --raw-output '.device_name // "HomeAssistantOS"' $CONFIG_PATH)

echo "======================================================"
echo " Starting Honeygain Add-on for Home Assistant"
echo " Device Name: $DEVICE_NAME"
echo " Email: $EMAIL"
echo "======================================================"

if [ -z "$EMAIL" ] || [ -z "$PASSWORD" ]; then
    echo "[ERROR] Email and Password must be provided in the add-on Configuration tab!"
    # Exit with a failure code so the user sees it stopped in the logs
    exit 1
fi

echo "Accepting Terms of Use and starting Honeygain process..."

# Execute replaces the bash process, passing signals properly to the Honeygain binary
exec /app/honeygain -tou-accept -email "$EMAIL" -pass "$PASSWORD" -device "$DEVICE_NAME"