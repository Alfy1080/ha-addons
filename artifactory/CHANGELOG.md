# Changelog

## 1.1.1 — 2026-08-26

### Fixed
- Fixed modal event bindings and duplicate DOM IDs for API Keys and Remote Servers dialogs
- Sanitized input placeholders and documentation to remain strictly generic and dynamic

## 1.1.0 — 2026-08-26

### Added
- **Multi-Node Federation (Client/Server Architecture)**: Connect multiple Artifactory deployments across different machines/servers.
- **Node Switcher UI**: Switch instantly between Local Storage and registered Remote Servers in the navigation header.
- **Key Generation & Management**: Generate cryptographically secure API keys to grant remote Artifactory instances or LLMs direct authenticated access.
- **Server-to-Server Proxy Engine**: Securely browse, upload, edit, save, and download files on remote Artifactory servers via local proxy without exposing remote credentials in the browser or hitting CORS limits.
- **Dynamic LLM Server Transparency**: Every remote server response automatically injects runtime-templated `llm_context` and `warning_for_llm` safeguards ensuring AI agents always know which physical machine they are viewing and modifying.

## 1.0.6 — 2026-08-26

### Added
- **In-Browser Text File Editor**: Integrated full-featured code editor to edit `css`, `json`, `yaml`, `yml`, `pem`, `key`, `crt`, `js`, `ts`, `py`, `sh`, `txt`, `md`, `html`, `xml`, `conf`, `env`, etc., directly in the browser with line numbers gutter, tab indentation (2 spaces), word wrap toggle, and `Ctrl+S` / `Cmd+S` keyboard shortcuts.
- **REST API Endpoint**: Added `POST /api/save` for saving text files directly.
- **Transparent Backgroundless Icon & Logo**: Updated add-on icon and logo with a 3D glowing isometric digital artifact vault cube on pure transparent background.

## 1.0.5 — 2026-08-26

### Added
- **Exact Filesystem Paths**: All mapped roots and directory items now display their exact filesystem path (e.g. `/config/www`, `/share`, `/config/share`, `/config/zigbee2mqtt`) eliminating ambiguity between identically named folders across different volumes.
- **Filesystem Path Tooltips & List Subtitles**: File cards and table rows display full absolute filesystem paths.
- **Preview Modal Path Tag**: File preview modal explicitly shows the exact absolute path on the filesystem.

## 1.0.4 — 2026-08-26

### Fixed
- Fixed root directory resolution when a mapped folder does not exist on disk, enabling clean folder navigation and auto-creation for writable roots.

## 1.0.3 — 2026-08-26

### Added
- **Access Permission Badges**: Added visual indicators on folder and file cards (Eye icon for Read-Only, Pencil icon for Write access) across Grid and List views.
- **Browser History Integration**: Added HTML5 History API (`popstate` / URL hash routing) so the browser's Back and Forward buttons navigate within Artifactory without leaving the Ingress page.
- **Direct Folder Bookmarking**: Deep linking via URL hash (`#/www/sunsync`, etc.).

### Fixed
- **Non-existent Folder Resilience**: Configured paths that do not exist on disk now open cleanly with proper breadcrumbs and an informative state message, allowing seamless navigation back. Auto-creation of missing directories for writable roots.

## 1.0.2 — 2026-08-26

### Fixed
- Replaced frontend with standalone, zero-dependency File Explorer UI
- Removed external Tailwind and Google Fonts CDN dependencies for 100% offline & Ingress iframe reliability
- Added inline SVG icons, theme toggle (dark/light), grid & list view modes
- Enhanced image thumbnail rendering and responsive layout

## 1.0.1 — 2026-08-26

### Fixed
- Fixed Home Assistant Ingress base path resolution in frontend (`app.js`)
- Added Ingress `X-Ingress-Path` dynamic injection in Express server (`index.js`)
- Fixed error popup handling and HTML entity escaping
- Enabled sidebar panel by default (`ingress_panel: true`)

## 1.0.0 — 2026-08-26

### Added
- Initial release
- File browser web UI with dark theme
- REST API for file management (list, upload, download, mkdir, delete, rename)
- Base64 JSON upload support for LLM/MCP integration
- URL fetch endpoint for pulling files from external sources
- Configurable write and read-only paths
- Path traversal prevention and security hardening
- Drag-and-drop file upload
- File preview for images, video, audio, PDF, and text
