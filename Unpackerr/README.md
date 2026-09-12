> [!NOTE]
> **Centralized Documentation Notice**: Future documentation, architectural updates, and standards must be maintained centrally in [**`Alfy1080/life-os`**](https://github.com/Alfy1080/life-os) (local: `~/github/life-os/`). Please reference [**`life-os/standards/`**](https://github.com/Alfy1080/life-os/tree/main/standards) for authoritative ecosystem standards.

Unpackerr Add-on

About

This add-on hosts Unpackerr directly inside your Home Assistant instance.

Unpackerr is an application that checks for completed downloads and extracts them so Radarr, Sonarr, Lidarr, or Readarr may import them.

Features

Secure Configuration: Keeps your API keys out of configuration files and utilizes the Home Assistant UI for secure secret storage.

Auto-Discovery: Binds cleanly to your existing Sonarr and Radarr endpoints.

Metrics: Exposes metrics on port 5656 for your dashboards.

Path Management: Automatically maps your Home Assistant /share and /media mounts so you can point it right at your network storage.

Please read the Documentation tab for setup instructions.
