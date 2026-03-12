# Configuration & Setup

This add-on runs a secure proxy for the Docker Socket, allowing you to expose the Docker API to other containers or services with granular permission control.

## Configuration Options

### `log_level` (Optional)

The logging level for HAProxy.
Default: `info`

### Permissions (Boolean Options)

The add-on exposes various boolean flags to enable or disable specific Docker API endpoints.

**Enabled by default** (based on your inspect file):
`services`, `post`, `info`, `exec`, `containers`, `nodes`, `networks`, `commit`, `plugins`, `images`, `swarm`, `distribution`, `build`, `configs`, `events`, `ping`, `version_api`.

**Disabled by default**:
`session`, `allow_restarts`, `allow_stop`, `allow_start`, `auth`, `disable_ipv6`, `grpc`, `secrets`, `system`, `tasks`, `volumes`.

## Troubleshooting

If the add-on fails to start, check the logs.
Ensure that the add-on has the necessary privileges to access the Docker socket.