# Changelog

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
- Replaced frontend with standalone, zero-dependency File Explorer UI (matching Yggdrasil Artifactory)
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
