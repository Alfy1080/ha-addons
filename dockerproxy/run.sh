#!/bin/bash
set -e

CONFIG_PATH=/data/options.json

# Parse options and set ENV vars
export LOG_LEVEL=$(jq --raw-output '.log_level' $CONFIG_PATH)

# Function to map bool to 0/1
set_env_bool() {
    local key=$1
    local env_name=$2
    local val=$(jq --raw-output ".$key" $CONFIG_PATH)
    if [ "$val" == "true" ]; then
        export $env_name=1
    else
        export $env_name=0
    fi
}

set_env_bool "services" "SERVICES"
set_env_bool "post" "POST"
set_env_bool "info" "INFO"
set_env_bool "exec" "EXEC"
set_env_bool "containers" "CONTAINERS"
set_env_bool "nodes" "NODES"
set_env_bool "networks" "NETWORKS"
set_env_bool "commit" "COMMIT"
set_env_bool "plugins" "PLUGINS"
set_env_bool "images" "IMAGES"
set_env_bool "swarm" "SWARM"
set_env_bool "distribution" "DISTRIBUTION"
set_env_bool "build" "BUILD"
set_env_bool "configs" "CONFIGS"
set_env_bool "session" "SESSION"
set_env_bool "allow_restarts" "ALLOW_RESTARTS"
set_env_bool "allow_stop" "ALLOW_STOP"
set_env_bool "allow_start" "ALLOW_START"
set_env_bool "auth" "AUTH"
set_env_bool "disable_ipv6" "DISABLE_IPV6"
set_env_bool "events" "EVENTS"
set_env_bool "grpc" "GRPC"
set_env_bool "ping" "PING"
set_env_bool "secrets" "SECRETS"
set_env_bool "system" "SYSTEM"
set_env_bool "tasks" "TASKS"
set_env_bool "version_api" "VERSION"
set_env_bool "volumes" "VOLUMES"

echo "Starting DockerProxy..."
# Execute the upstream image's original entrypoint to handle config generation
exec /docker-entrypoint.sh haproxy -f /tmp/haproxy.cfg