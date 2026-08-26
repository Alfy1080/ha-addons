# Changelog

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
