# Alfy's Custom Home Assistant Add-ons

This is a custom [Home Assistant](https://www.home-assistant.io/) add-on repository containing self-maintained add-ons for use with the Home Assistant Supervisor. Add-ons extend Home Assistant with additional services and integrations.

---

## 📦 Available Add-ons

| Add-on | Description |
|---|---|
| **Honeygain** | Runs the [Honeygain](https://www.honeygain.com/) passive income client as an HA add-on |
| **Unpackerr** | Automates extraction of downloaded archives for media managers (Sonarr, Radarr, etc.) |
| **GitHub Runner** | Runs a self-hosted GitHub Actions runner as an HA add-on for CI/CD deployments |

---

## 🚀 Installation

1. Navigate to **Settings → Add-ons → Add-on Store** in your Home Assistant UI
2. Click the **⋮** menu in the top-right corner and select **Repositories**
3. Add this repository URL:
   ```
   https://github.com/Alfy1080/ha-addons
   ```
4. The add-ons will appear in the store — click any of them to install

---

## 📁 Repository Structure

```
ha-addons/
├── repository.yaml      # Repository metadata (name, maintainer, URL)
├── Honeygain/           # Honeygain add-on
├── Unpackerr/           # Unpackerr add-on
├── github-runner/       # Self-hosted GitHub Actions runner add-on
└── scripts/             # Helper scripts
```

Each add-on directory contains:
- `config.yaml` — Add-on metadata and configuration schema
- `Dockerfile` — Container image definition
- `run.sh` — Entrypoint script

---

## 🔧 Development

To develop or test an add-on locally, use the [Home Assistant Developer Tools](https://developers.home-assistant.io/docs/add-ons/tutorial) and the `ha` CLI:

```bash
# Rebuild a specific add-on
ha addons rebuild local_<addon_slug>

# View add-on logs
ha addons logs local_<addon_slug>
```

---

## 📄 License

Private repository — all rights reserved.
