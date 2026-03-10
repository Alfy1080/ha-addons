DockerProxy Add-on

About

This add-on hosts `docker-socket-proxy` directly inside your Home Assistant instance.

It acts as a security layer between your Docker socket and other applications, allowing you to restrict which API calls are allowed.

Features

Granular Control: Enable or disable access to specific Docker API endpoints (e.g., Containers, Images, Networks).

Secure Defaults: Configured to match your provided deployment, restricting dangerous operations like stopping or restarting containers by default (unless enabled).

Direct Integration: Maps the host Docker socket (requires Privileged mode).

Please read the Documentation tab for setup instructions.