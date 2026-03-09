GitHub Actions Runner Add-on

About

This add-on hosts a self-registered, local GitHub Actions Runner directly inside your Home Assistant instance.

By keeping the runner local, you can automate deployments, configuration backups, and GitOps workflows without exposing your Home Assistant SSH port to the public internet.

Features

Auto-Registration: The add-on dynamically requests an ephemeral token and registers itself with GitHub on startup.

Auto-Cleanup: Gracefully removes itself from your GitHub repository runners list when the add-on is stopped or restarted.

SSH Integration: Shares the host's /config/.ssh keys, allowing seamless Git pulling and pushing over SSH.

Please read the Documentation tab for setup instructions.
