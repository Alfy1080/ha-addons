# Artifactory

File explorer & asset manager for Home Assistant. Upload, browse, and manage static assets via a web UI and REST API.

## Overview

Artifactory provides a file management interface for your Home Assistant server, accessible via the sidebar (Ingress) or programmatically through its REST API. It is designed to enable LLM-driven workflows — an AI agent can generate images, upload them to `/config/www/`, and reference them in dashboards using `/local/` URLs.

## Configuration

### Option: `write_paths`

List of filesystem paths with full read-write access (upload, create, delete, rename).

**Default:** `["/config/www"]`

Files uploaded to `/config/www/` are automatically served by Home Assistant at `/local/<filename>`.

### Option: `read_paths`

List of filesystem paths with read-only access (browse, preview, and download only).

**Default:** `["/media", "/share"]`

### Supported Path Locations

Because the add-on has volume access to `/config`, `/media`, and `/share`, you can add any of the following to `write_paths` or `read_paths`:

| Path | Purpose |
|---|---|
| `/config/www` | Static assets served by HA at `/local/` |
| `/config/custom_components` | Custom integrations (HACS) |
| `/config/blueprints` | Automation & script blueprints |
| `/config/python_scripts` | Python scripts integration |
| `/config/zigbee2mqtt` | Zigbee2MQTT configuration & devices |
| `/share/zigbee2mqtt` | Zigbee2MQTT shared data (if using `/share`) |
| `/media` | Local media storage |
| `/share` | Shared add-on files |

## REST API

The API is accessible via Home Assistant's Ingress proxy. When interacting via MCP or the Home Assistant API, call endpoints through your Home Assistant add-on proxy:

```
ha_manage_app(slug="<prefix>_artifactory", path="/api/list?path=www")
```

### Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/info` | GET | Server info and disk usage |
| `/api/list?path=<path>` | GET | List directory contents |
| `/api/upload` | POST | Upload files (multipart or base64 JSON) |
| `/api/fetch` | POST | Download file from URL to local path |
| `/api/mkdir` | POST | Create directory |
| `/api/delete` | POST | Delete file or directory |
| `/api/rename` | POST | Rename file or directory |
| `/api/download?path=<path>` | GET | Download a file |

### Upload Examples

**Base64 JSON upload (for LLM/MCP use):**
```json
POST /api/upload
{
  "path": "www/icons",
  "filename": "logo.png",
  "content_base64": "<base64-encoded data>",
  "overwrite": true
}
```

**URL fetch (pull from external source):**
```json
POST /api/fetch
{
  "url": "https://example.com/image.png",
  "dest_path": "www/icons/image.png",
  "overwrite": true
}
```

## Path Model

The API uses virtual root names derived from configured paths:
- `www` → `/config/www` (writable, served at `/local/`)
- `media` → `/media` (read-only by default)
- `share` → `/share` (read-only by default)

## Security

The add-on is protected by Home Assistant's Ingress authentication. No additional credentials are needed. All file operations are restricted to configured paths with strict path traversal prevention.
