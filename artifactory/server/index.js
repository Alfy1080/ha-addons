/**
 * Artifactory — Home Assistant Add-on
 * File explorer & asset manager REST API with Multi-Node Federation
 *
 * Provides file management endpoints accessible via HA Ingress proxy and REST API.
 * Supports multipart uploads, base64 JSON uploads, and in-browser text file editing.
 * Features Client/Server Federation with LLM Server Transparency & Proxying.
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const crypto = require('crypto');

const app = express();
const PORT = parseInt(process.env.PORT || '8099', 10);
const APP_VERSION = '1.1.0';

// ---------------------------------------------------------------------------
// Configuration: parse write/read paths from environment
// ---------------------------------------------------------------------------

function parsePaths(envVar) {
  const raw = process.env[envVar] || '';
  return raw
    .split(',')
    .map(p => p.trim())
    .filter(p => p.length > 0);
}

const WRITE_PATHS = parsePaths('WRITE_PATHS');
const READ_PATHS = parsePaths('READ_PATHS');

function buildRoots() {
  const roots = new Map();
  const addRoot = (absPath, writable) => {
    const resolved = path.resolve(absPath);
    const displayName = resolved.replace(/\\/g, '/');
    const cleanKey = displayName.replace(/^\/+/, '');

    if (roots.has(cleanKey)) {
      if (writable) roots.get(cleanKey).writable = true;
    } else {
      roots.set(cleanKey, {
        name: displayName,
        key: cleanKey,
        shortName: path.basename(resolved),
        absolute: resolved,
        writable,
      });
    }
  };
  for (const p of WRITE_PATHS) addRoot(p, true);
  for (const p of READ_PATHS) addRoot(p, false);
  return roots;
}

const ROOTS = buildRoots();

console.log(`[Artifactory] Configured roots:`);
for (const [key, root] of ROOTS) {
  console.log(`  ${root.name} (${key}) → ${root.absolute} (${root.writable ? 'read-write' : 'read-only'})`);
}

// ---------------------------------------------------------------------------
// Federation & Remote Server Storage
// ---------------------------------------------------------------------------

const DATA_DIR = fs.existsSync('/data') ? '/data' : path.join(__dirname, '.data');
if (!fs.existsSync(DATA_DIR)) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {}
}
const FEDERATION_FILE = path.join(DATA_DIR, 'federation.json');

function loadFederationData() {
  try {
    if (fs.existsSync(FEDERATION_FILE)) {
      const raw = fs.readFileSync(FEDERATION_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        api_keys: Array.isArray(parsed.api_keys) ? parsed.api_keys : [],
        servers: Array.isArray(parsed.servers) ? parsed.servers : []
      };
    }
  } catch (err) {
    console.warn('[Federation] Could not read federation file:', err.message);
  }
  return { api_keys: [], servers: [] };
}

function saveFederationData(data) {
  try {
    fs.writeFileSync(FEDERATION_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[Federation] Failed to save federation data:', err.message);
    throw err;
  }
}

function generateSecretKey() {
  return 'art_sec_' + crypto.randomBytes(24).toString('hex');
}

function getLocalNodeName() {
  return process.env.NODE_NAME || process.env.HOSTNAME || 'Home Assistant';
}

// ---------------------------------------------------------------------------
// Path resolution & security
// ---------------------------------------------------------------------------

function resolvePath(virtualPath, mustExist = true) {
  if (typeof virtualPath !== 'string') return null;

  const clean = virtualPath.replace(/\\/g, '/').replace(/\0/g, '').replace(/^\/+/, '').replace(/\/+$/, '');
  if (!clean) return null;

  const parts = clean.split('/').filter(p => p !== '' && p !== '.');
  if (parts.some(p => p === '..')) return null;

  let matchedRoot = null;
  let subPath = '';

  for (const [key, root] of ROOTS) {
    if (clean === key) {
      matchedRoot = root;
      subPath = '';
      break;
    }
    if (clean.startsWith(key + '/')) {
      matchedRoot = root;
      subPath = clean.slice(key.length + 1);
      break;
    }
  }

  if (!matchedRoot) {
    const firstPart = parts[0];
    for (const [, root] of ROOTS) {
      if (root.shortName === firstPart) {
        matchedRoot = root;
        subPath = parts.slice(1).join('/');
        break;
      }
    }
  }

  if (!matchedRoot) return null;

  const targetAbsolute = subPath
    ? path.join(matchedRoot.absolute, subPath)
    : matchedRoot.absolute;

  const resolved = path.resolve(targetAbsolute);
  if (resolved !== matchedRoot.absolute && !resolved.startsWith(matchedRoot.absolute + path.sep)) {
    return null;
  }

  if (mustExist && !fs.existsSync(resolved)) {
    return null;
  }

  const rootRelative = resolved === matchedRoot.absolute
    ? ''
    : resolved.slice(matchedRoot.absolute.length).replace(/^[/\\]+/, '').replace(/\\/g, '/');

  const virtualRelative = rootRelative
    ? `${matchedRoot.key}/${rootRelative}`
    : matchedRoot.key;

  return {
    absolute: resolved,
    relative: virtualRelative,
    root: matchedRoot,
    rootRelative,
  };
}

function formatBytes(bytes, precision = 2) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(Math.max(bytes, 1)) / Math.log(k));
  const val = bytes / Math.pow(k, i);
  return `${val.toFixed(precision)} ${units[Math.min(i, units.length - 1)]}`;
}

function getMime(filepath) {
  const ext = path.extname(filepath).toLowerCase().slice(1);
  const map = {
    json: 'application/json', js: 'text/javascript', css: 'text/css',
    html: 'text/html', htm: 'text/html', txt: 'text/plain', md: 'text/markdown',
    xml: 'application/xml', svg: 'image/svg+xml', png: 'image/png',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
    ico: 'image/x-icon', pdf: 'application/pdf', zip: 'application/zip',
    mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg',
    mp4: 'video/mp4', webm: 'video/webm', csv: 'text/csv',
    yaml: 'text/yaml', yml: 'text/yaml', sh: 'text/x-shellscript',
    py: 'text/x-python', log: 'text/plain', pem: 'text/plain',
    key: 'text/plain', crt: 'text/plain', cert: 'text/plain',
  };
  return map[ext] || 'application/octet-stream';
}

function getHaUrl(root, rootRelative) {
  if (root.absolute === '/config/www' || root.absolute === path.resolve('/config/www')) {
    const subPath = rootRelative || '';
    return subPath ? `/local/${subPath}` : '/local/';
  }
  return null;
}

function deleteRecursive(target) {
  const stat = fs.statSync(target);
  if (stat.isDirectory()) {
    fs.rmSync(target, { recursive: true, force: true });
  } else {
    fs.unlinkSync(target);
  }
}

// ---------------------------------------------------------------------------
// Middleware & Authentication
// ---------------------------------------------------------------------------

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Check bearer token for incoming remote API requests
app.use((req, res, next) => {
  // Allow Ingress and internal browser sessions
  const isIngress = Boolean(req.headers['x-ingress-path'] || req.headers['x-ha-access']);
  const authHeader = req.headers['authorization'] || '';
  const customKeyHeader = req.headers['x-artifactory-key'] || '';

  let token = '';
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (customKeyHeader) {
    token = customKeyHeader.trim();
  }

  // Attach auth metadata
  req.isIngress = isIngress;
  req.authToken = token;

  const fedData = loadFederationData();
  if (token && fedData.api_keys.length > 0) {
    const matched = fedData.api_keys.find(k => k.key === token);
    if (matched) {
      req.authenticatedKey = matched;
    }
  }

  next();
});

function sendIndexHtml(req, res) {
  const ingressPath = req.headers['x-ingress-path'] || '';
  const indexPath = path.join(__dirname, 'public', 'index.html');
  try {
    let html = fs.readFileSync(indexPath, 'utf8');
    if (ingressPath) {
      const scriptTag = `<script>window.__ingress_path = ${JSON.stringify(ingressPath)};</script>`;
      html = html.replace('<head>', `<head>\n    ${scriptTag}`);
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    res.status(500).send('Failed to load Artifactory UI: ' + err.message);
  }
}

// Ingress entry routes
app.get(['/', '/index.html'], sendIndexHtml);
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

const upload = multer({
  dest: '/tmp/artifactory-uploads',
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
});

// ---------------------------------------------------------------------------
// API: GET /api/info
// ---------------------------------------------------------------------------
app.get('/api/info', (req, res) => {
  const roots = [];
  for (const [key, root] of ROOTS) {
    let freeBytes = null;
    let totalBytes = null;
    try {
      if (fs.existsSync(root.absolute)) {
        const stat = fs.statSync(root.absolute);
        if (stat.isDirectory()) {
          const df = fs.statfsSync ? fs.statfsSync(root.absolute) : null;
          if (df) {
            freeBytes = df.bavail * df.bsize;
            totalBytes = df.blocks * df.bsize;
          }
        }
      }
    } catch {}

    roots.push({
      name: root.name,
      key: root.key,
      shortName: root.shortName,
      path: root.key,
      fs_path: root.absolute,
      writable: root.writable,
      exists: fs.existsSync(root.absolute),
      disk_free_bytes: freeBytes,
      disk_free_formatted: freeBytes ? formatBytes(freeBytes) : null,
      disk_total_bytes: totalBytes,
      disk_total_formatted: totalBytes ? formatBytes(totalBytes) : null,
    });
  }

  const fedData = loadFederationData();

  res.json({
    success: true,
    server: {
      name: 'Artifactory',
      version: APP_VERSION,
      platform: 'Home Assistant OS / Add-on',
      node_name: getLocalNodeName(),
      roots_count: roots.length,
      federation: {
        configured_servers: fedData.servers.length,
        active_keys: fedData.api_keys.length
      }
    },
    roots,
  });
});

// ---------------------------------------------------------------------------
// API: GET /api/list
// ---------------------------------------------------------------------------
app.get('/api/list', (req, res) => {
  const reqPath = (req.query.path || '').toString().trim();

  // Root listing: list all configured virtual roots
  if (!reqPath) {
    const items = [];
    for (const [key, root] of ROOTS) {
      const exists = fs.existsSync(root.absolute);
      let size = 0;
      let mtimeFormatted = '-';

      if (exists) {
        try {
          const stat = fs.statSync(root.absolute);
          mtimeFormatted = stat.mtime.toISOString().replace('T', ' ').slice(0, 19);
        } catch {}
      }

      items.push({
        name: root.name,
        key: root.key,
        path: root.key,
        fs_path: root.absolute,
        type: 'dir',
        writable: root.writable,
        exists,
        size,
        size_formatted: exists ? '-' : '(not created)',
        mtime_formatted: mtimeFormatted,
        mime: 'directory',
        ext: '',
        ha_url: null,
      });
    }

    return res.json({
      success: true,
      current_path: '',
      roots: items,
      breadcrumbs: [{ name: 'Root', path: '' }],
      total_items: items.length,
      items,
    });
  }

  const resolved = resolvePath(reqPath, false);
  if (!resolved) {
    return res.status(404).json({ success: false, error: 'Directory not found or invalid path.' });
  }

  if (!fs.existsSync(resolved.absolute)) {
    const parts = resolved.relative.split('/');
    const breadcrumbs = [{ name: 'Root', path: '' }];
    let accum = '';
    for (const p of parts) {
      accum = accum ? `${accum}/${p}` : p;
      breadcrumbs.push({ name: p, path: accum });
    }
    return res.json({
      success: true,
      current_path: resolved.relative,
      breadcrumbs,
      total_items: 0,
      items: [],
      writable: resolved.root.writable,
      message: `Folder "${resolved.root.name}" does not exist on disk yet. Upload a file to initialize it.`,
    });
  }

  const stat = fs.statSync(resolved.absolute);
  if (!stat.isDirectory()) {
    return res.status(400).json({ success: false, error: 'Path is not a directory.' });
  }

  let entries;
  try {
    entries = fs.readdirSync(resolved.absolute, { withFileTypes: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: `Failed to read directory: ${err.message}` });
  }

  const items = [];
  const showHidden = req.query.hidden === 'true';

  for (const entry of entries) {
    if (!showHidden && entry.name.startsWith('.')) continue;

    const fullPath = path.join(resolved.absolute, entry.name);
    let entryStat;
    try {
      entryStat = fs.statSync(fullPath);
    } catch {
      continue;
    }

    const isDir = entry.isDirectory();
    const subRel = resolved.rootRelative
      ? `${resolved.rootRelative}/${entry.name}`
      : entry.name;
    const itemVirtualPath = `${resolved.root.key}/${subRel}`;
    const ext = isDir ? '' : path.extname(entry.name).toLowerCase().slice(1);
    const mime = isDir ? 'directory' : getMime(fullPath);
    const haUrl = isDir ? null : getHaUrl(resolved.root, subRel);

    items.push({
      name: entry.name,
      path: itemVirtualPath,
      fs_path: fullPath,
      type: isDir ? 'dir' : 'file',
      size: isDir ? 0 : entryStat.size,
      size_formatted: isDir ? '-' : formatBytes(entryStat.size),
      mtime: entryStat.mtimeMs,
      mtime_formatted: entryStat.mtime.toISOString().replace('T', ' ').slice(0, 19),
      mime,
      ext,
      writable: resolved.root.writable,
      ha_url: haUrl,
    });
  }

  // Breadcrumbs
  const breadcrumbs = [{ name: 'Root', path: '' }];
  const parts = resolved.relative.split('/');
  let accum = '';
  for (const p of parts) {
    accum = accum ? `${accum}/${p}` : p;
    breadcrumbs.push({ name: p, path: accum });
  }

  items.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  res.json({
    success: true,
    current_path: resolved.relative,
    breadcrumbs,
    total_items: items.length,
    items,
  });
});

// ---------------------------------------------------------------------------
// API: POST /api/save (Direct text file save/edit)
// ---------------------------------------------------------------------------
app.post('/api/save', (req, res) => {
  const { path: filePath, content } = req.body || {};
  if (!filePath || content === undefined || content === null) {
    return res.status(400).json({ success: false, error: 'path and content are required.' });
  }

  const resolved = resolvePath(filePath, false);
  if (!resolved) {
    return res.status(400).json({ success: false, error: 'Invalid destination path.' });
  }
  if (!resolved.root.writable) {
    return res.status(403).json({ success: false, error: `Path "${resolved.root.name}" is read-only.` });
  }

  const parentDir = path.dirname(resolved.absolute);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }

  try {
    fs.writeFileSync(resolved.absolute, content, 'utf8');
    const stat = fs.statSync(resolved.absolute);
    const haUrl = getHaUrl(resolved.root, resolved.rootRelative);

    return res.json({
      success: true,
      message: 'File saved successfully.',
      file: {
        name: path.basename(resolved.absolute),
        path: resolved.relative,
        fs_path: resolved.absolute,
        size: stat.size,
        size_formatted: formatBytes(stat.size),
        mtime_formatted: stat.mtime.toISOString().replace('T', ' ').slice(0, 19),
        ha_url: haUrl,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: `Failed to save file: ${err.message}` });
  }
});

// ---------------------------------------------------------------------------
// API: POST /api/upload
// ---------------------------------------------------------------------------
app.post('/api/upload', upload.array('files'), async (req, res) => {
  const reqPath = (req.body.path || req.query.path || '').toString().trim();
  const overwrite = req.body.overwrite === 'true' || req.body.overwrite === true;

  // 1. JSON base64 upload
  if (req.body.content_base64 && req.body.filename) {
    const filename = req.body.filename.trim();
    if (/[\/\\:*?"<>|]/.test(filename)) {
      return res.status(400).json({ success: false, error: 'Invalid filename.' });
    }

    const targetVirtual = reqPath ? `${reqPath}/${filename}` : filename;
    const resolved = resolvePath(targetVirtual, false);

    if (!resolved) {
      return res.status(400).json({ success: false, error: 'Invalid target path.' });
    }
    if (!resolved.root.writable) {
      return res.status(403).json({ success: false, error: `Path "${resolved.root.name}" is read-only.` });
    }

    const destDir = path.dirname(resolved.absolute);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    if (fs.existsSync(resolved.absolute) && !overwrite) {
      return res.status(409).json({ success: false, error: 'File already exists and overwrite is false.' });
    }

    try {
      const buffer = Buffer.from(req.body.content_base64, 'base64');
      fs.writeFileSync(resolved.absolute, buffer);
      const stat = fs.statSync(resolved.absolute);
      const haUrl = getHaUrl(resolved.root, resolved.rootRelative);

      return res.json({
        success: true,
        uploaded: [{
          name: filename,
          path: resolved.relative,
          fs_path: resolved.absolute,
          size: stat.size,
          size_formatted: formatBytes(stat.size),
          ha_url: haUrl,
        }],
        count: 1,
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: `Failed to write file: ${err.message}` });
    }
  }

  // 2. Multipart file upload
  if (!reqPath) {
    return res.status(400).json({ success: false, error: 'Target path is required for upload.' });
  }

  const resolved = resolvePath(reqPath, false);
  if (!resolved) {
    return res.status(400).json({ success: false, error: 'Invalid target directory path.' });
  }
  if (!resolved.root.writable) {
    return res.status(403).json({ success: false, error: `Path "${resolved.root.name}" is read-only.` });
  }

  if (!fs.existsSync(resolved.absolute)) {
    fs.mkdirSync(resolved.absolute, { recursive: true });
  }

  const files = req.files || [];
  if (files.length === 0) {
    return res.status(400).json({ success: false, error: 'No files received for upload.' });
  }

  const uploaded = [];
  const errors = [];

  for (const f of files) {
    const filename = path.basename(f.originalname);
    const destPath = path.join(resolved.absolute, filename);
    const subRel = resolved.rootRelative ? `${resolved.rootRelative}/${filename}` : filename;
    const itemVirtual = `${resolved.root.key}/${subRel}`;

    try {
      fs.renameSync(f.path, destPath);
      const stat = fs.statSync(destPath);
      const haUrl = getHaUrl(resolved.root, subRel);

      uploaded.push({
        name: filename,
        path: itemVirtual,
        fs_path: destPath,
        size: stat.size,
        size_formatted: formatBytes(stat.size),
        ha_url: haUrl,
      });
    } catch (err) {
      try { fs.unlinkSync(f.path); } catch {}
      errors.push({ file: filename, error: err.message });
    }
  }

  if (uploaded.length === 0 && errors.length > 0) {
    return res.status(500).json({ success: false, error: 'All file uploads failed.', errors });
  }

  res.json({ success: true, uploaded, errors, count: uploaded.length });
});

// ---------------------------------------------------------------------------
// API: POST /api/mkdir
// ---------------------------------------------------------------------------
app.post('/api/mkdir', (req, res) => {
  const parentPath = (req.body.path || '').toString().trim();
  const dirname = (req.body.name || '').toString().trim();

  if (!dirname) {
    return res.status(400).json({ success: false, error: 'Directory name is required.' });
  }
  if (/[\/\\:*?"<>|]/.test(dirname)) {
    return res.status(400).json({ success: false, error: 'Directory name contains invalid characters.' });
  }

  const targetVirtual = parentPath ? `${parentPath}/${dirname}` : dirname;
  const resolved = resolvePath(targetVirtual, false);

  if (!resolved) {
    return res.status(400).json({ success: false, error: 'Invalid directory path.' });
  }
  if (!resolved.root.writable) {
    return res.status(403).json({ success: false, error: `Path "${resolved.root.name}" is read-only.` });
  }

  if (fs.existsSync(resolved.absolute)) {
    return res.status(409).json({ success: false, error: 'A file or directory with that name already exists.' });
  }

  try {
    fs.mkdirSync(resolved.absolute, { recursive: true });
    res.json({
      success: true,
      message: 'Directory created successfully.',
      path: resolved.relative,
      name: dirname,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: `Failed to create directory: ${err.message}` });
  }
});

// ---------------------------------------------------------------------------
// API: POST /api/delete
// ---------------------------------------------------------------------------
app.post('/api/delete', (req, res) => {
  let paths = req.body.paths || null;
  const singlePath = req.body.path || null;

  if (singlePath) paths = [singlePath];
  if (!paths || !Array.isArray(paths) || paths.length === 0) {
    return res.status(400).json({ success: false, error: 'No path provided for deletion.' });
  }

  const deleted = [];
  const errors = [];

  for (const p of paths) {
    const resolved = resolvePath(p, true);
    if (!resolved) {
      errors.push({ path: p, error: 'Path not found or invalid.' });
      continue;
    }
    if (!resolved.root.writable) {
      errors.push({ path: p, error: `Path "${resolved.root.name}" is read-only.` });
      continue;
    }
    if (resolved.rootRelative === '') {
      errors.push({ path: p, error: 'Cannot delete a root directory.' });
      continue;
    }

    try {
      deleteRecursive(resolved.absolute);
      deleted.push(resolved.relative);
    } catch (err) {
      errors.push({ path: resolved.relative, error: err.message });
    }
  }

  if (deleted.length === 0 && errors.length > 0) {
    return res.status(400).json({ success: false, error: 'Failed to delete items.', errors });
  }

  res.json({ success: true, deleted, errors });
});

// ---------------------------------------------------------------------------
// API: POST /api/rename
// ---------------------------------------------------------------------------
app.post('/api/rename', (req, res) => {
  const oldPath = req.body.path || req.body.old_path || '';
  const newName = (req.body.new_name || '').trim();

  if (!oldPath || !newName) {
    return res.status(400).json({ success: false, error: 'path and new_name are required.' });
  }
  if (/[\/\\:*?"<>|]/.test(newName)) {
    return res.status(400).json({ success: false, error: 'New name contains invalid characters.' });
  }

  const resolved = resolvePath(oldPath, true);
  if (!resolved) {
    return res.status(404).json({ success: false, error: 'Source path not found.' });
  }
  if (!resolved.root.writable) {
    return res.status(403).json({ success: false, error: `Path "${resolved.root.name}" is read-only.` });
  }
  if (resolved.rootRelative === '') {
    return res.status(400).json({ success: false, error: 'Cannot rename a root directory.' });
  }

  const parentDir = path.dirname(resolved.absolute);
  const newTarget = path.join(parentDir, newName);

  if (fs.existsSync(newTarget)) {
    return res.status(409).json({ success: false, error: 'An item with the new name already exists.' });
  }

  try {
    fs.renameSync(resolved.absolute, newTarget);
    const oldParts = resolved.relative.split('/');
    oldParts[oldParts.length - 1] = newName;
    const newRelPath = oldParts.join('/');

    res.json({
      success: true,
      message: 'Renamed successfully.',
      old_path: resolved.relative,
      new_path: newRelPath,
      new_name: newName,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: `Failed to rename: ${err.message}` });
  }
});

// ---------------------------------------------------------------------------
// API: GET /api/download
// ---------------------------------------------------------------------------
app.get('/api/download', (req, res) => {
  const reqPath = (req.query.path || '').toString();
  const inline = req.query.inline === 'true';

  const resolved = resolvePath(reqPath, true);
  if (!resolved) {
    return res.status(404).json({ success: false, error: 'File not found.' });
  }

  const stat = fs.statSync(resolved.absolute);
  if (stat.isDirectory()) {
    return res.status(400).json({ success: false, error: 'Cannot download a directory.' });
  }

  const mime = getMime(resolved.absolute);
  const filename = path.basename(resolved.absolute);

  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Length', stat.size);
  res.setHeader('Content-Disposition',
    inline ? `inline; filename="${filename}"` : `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'public, max-age=3600');

  const stream = fs.createReadStream(resolved.absolute);
  stream.pipe(res);
});

// ---------------------------------------------------------------------------
// Federation Management Endpoints
// ---------------------------------------------------------------------------

// List API Keys
app.get('/api/federation/keys', (req, res) => {
  const data = loadFederationData();
  const safeKeys = data.api_keys.map(k => ({
    id: k.id,
    name: k.name,
    created_at: k.created_at,
    key_preview: k.key ? `${k.key.slice(0, 12)}...${k.key.slice(-4)}` : '',
  }));
  res.json({ success: true, keys: safeKeys });
});

// Generate new API Key
app.post('/api/federation/keys', (req, res) => {
  const name = (req.body.name || 'Remote Client').toString().trim();
  const data = loadFederationData();
  const newKey = {
    id: 'key_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex'),
    name,
    key: generateSecretKey(),
    created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
  };
  data.api_keys.push(newKey);
  saveFederationData(data);

  res.json({
    success: true,
    message: 'API Key generated successfully. Save this secret token now; it will not be displayed in full again.',
    key: newKey
  });
});

// Revoke API Key
app.delete('/api/federation/keys/:id', (req, res) => {
  const { id } = req.params;
  const data = loadFederationData();
  const prevLen = data.api_keys.length;
  data.api_keys = data.api_keys.filter(k => k.id !== id);
  if (data.api_keys.length === prevLen) {
    return res.status(404).json({ success: false, error: 'Key not found.' });
  }
  saveFederationData(data);
  res.json({ success: true, message: 'Key revoked successfully.' });
});

// List Configured Remote Servers
app.get('/api/federation/servers', (req, res) => {
  const data = loadFederationData();
  const safeServers = data.servers.map(s => ({
    id: s.id,
    display_name: s.display_name,
    url: s.url,
    server_type: s.server_type || 'express',
    has_api_key: Boolean(s.api_key),
    has_cf_headers: Boolean(s.cf_client_id && s.cf_client_secret),
    created_at: s.created_at,
  }));
  res.json({ success: true, servers: safeServers });
});

// Test Connection Helper
async function testServerConnection(url, apiKey, cfId, cfSecret) {
  const cleanUrl = url.replace(/\/+$/, '');
  const headers = {};
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
    headers['X-Artifactory-Key'] = apiKey;
  }
  if (cfId) headers['CF-Access-Client-Id'] = cfId;
  if (cfSecret) headers['CF-Access-Client-Secret'] = cfSecret;

  // Try Express endpoint first
  const tryFetch = (targetUrl) => new Promise((resolve, reject) => {
    const isHttps = targetUrl.startsWith('https:');
    const client = isHttps ? https : http;
    const req = client.get(targetUrl, { headers, timeout: 8000 }, (resp) => {
      let raw = '';
      resp.on('data', chunk => raw += chunk);
      resp.on('end', () => {
        try {
          const json = JSON.parse(raw);
          resolve({ status: resp.statusCode, data: json });
        } catch {
          resolve({ status: resp.statusCode, data: null, rawText: raw });
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Connection timed out')); });
  });

  // Try /api/info
  try {
    const res1 = await tryFetch(`${cleanUrl}/api/info`);
    if (res1.status >= 200 && res1.status < 300 && res1.data && res1.data.success) {
      return { ok: true, server_type: 'express', server_info: res1.data.server || {} };
    }
  } catch {}

  // Try Synology api.php?action=info
  try {
    const targetPhp = cleanUrl.endsWith('api.php') ? `${cleanUrl}?action=info` : `${cleanUrl}/api.php?action=info`;
    const res2 = await tryFetch(targetPhp);
    if (res2.status >= 200 && res2.status < 300 && res2.data && res2.data.success) {
      return { ok: true, server_type: 'php', server_info: res2.data.server || {} };
    }
  } catch (err) {
    throw new Error(`Failed to connect to remote server: ${err.message}`);
  }

  throw new Error('Remote server responded, but Artifactory API info endpoint was not recognized.');
}

// Test server connectivity endpoint
app.post('/api/federation/servers/test', async (req, res) => {
  const { url, api_key, cf_client_id, cf_client_secret } = req.body || {};
  if (!url) {
    return res.status(400).json({ success: false, error: 'Server URL is required.' });
  }

  try {
    const result = await testServerConnection(url, api_key, cf_client_id, cf_client_secret);
    res.json({
      success: true,
      message: 'Connection successful!',
      server_type: result.server_type,
      server_info: result.server_info
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Add / Update Remote Server
app.post('/api/federation/servers', async (req, res) => {
  const { display_name, url, api_key, cf_client_id, cf_client_secret } = req.body || {};
  if (!display_name || !url) {
    return res.status(400).json({ success: false, error: 'display_name and url are required.' });
  }

  let serverType = 'express';
  try {
    const testRes = await testServerConnection(url, api_key, cf_client_id, cf_client_secret);
    serverType = testRes.server_type || 'express';
  } catch (err) {
    console.warn('[Federation] Adding server with warning:', err.message);
  }

  const data = loadFederationData();
  const cleanUrl = url.replace(/\/+$/, '');
  const serverId = 'srv_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex');

  const newServer = {
    id: serverId,
    display_name: display_name.trim(),
    url: cleanUrl,
    api_key: (api_key || '').trim(),
    cf_client_id: (cf_client_id || '').trim(),
    cf_client_secret: (cf_client_secret || '').trim(),
    server_type: serverType,
    created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
  };

  data.servers.push(newServer);
  saveFederationData(data);

  res.json({
    success: true,
    message: `Remote server "${newServer.display_name}" added successfully!`,
    server: {
      id: newServer.id,
      display_name: newServer.display_name,
      url: newServer.url,
      server_type: newServer.server_type,
      created_at: newServer.created_at
    }
  });
});

// Delete Remote Server
app.delete('/api/federation/servers/:id', (req, res) => {
  const { id } = req.params;
  const data = loadFederationData();
  const prevLen = data.servers.length;
  data.servers = data.servers.filter(s => s.id !== id);
  if (data.servers.length === prevLen) {
    return res.status(404).json({ success: false, error: 'Server not found.' });
  }
  saveFederationData(data);
  res.json({ success: true, message: 'Remote server removed successfully.' });
});

// ---------------------------------------------------------------------------
// Remote Proxy Forwarder with Dynamic LLM Transparency
// ---------------------------------------------------------------------------

function augmentRemoteResponse(remoteData, server, localHostName) {
  if (!remoteData || typeof remoteData !== 'object') return remoteData;

  const serverName = server.display_name || server.url;
  const hubName = localHostName || 'Local Artifactory Hub';

  return {
    ...remoteData,
    _artifactory_node: {
      server_id: server.id,
      display_name: server.display_name,
      url: server.url,
      is_local: false,
    },
    llm_context: {
      node_type: 'REMOTE_FEDERATED_SERVER',
      connected_hub: hubName,
      target_server_name: server.display_name,
      target_server_url: server.url,
      warning_for_llm: `ATTENTION AI AGENT: You are accessing files on the REMOTE server '${serverName}' via the proxy on '${hubName}'. Any file operations (upload, edit, save, delete, rename) will execute on the remote machine '${serverName}' (${server.url}), NOT the local server.`,
    }
  };
}

app.all('/api/remote/:serverId/:subAction(*)', (req, res) => {
  const { serverId, subAction } = req.params;
  const data = loadFederationData();
  const server = data.servers.find(s => s.id === serverId);

  if (!server) {
    return res.status(404).json({ success: false, error: `Remote server ID "${serverId}" not found.` });
  }

  const isPhp = server.server_type === 'php' || server.url.endsWith('.php');
  const targetBase = server.url.replace(/\/+$/, '');
  let targetUrlStr = '';

  const queryParams = new URLSearchParams(req.query);

  if (isPhp) {
    const action = subAction.replace(/^\/+/, '').split('/')[0] || 'list';
    queryParams.set('action', action);
    const phpFile = targetBase.endsWith('api.php') ? targetBase : `${targetBase}/api.php`;
    targetUrlStr = `${phpFile}?${queryParams.toString()}`;
  } else {
    const cleanSub = subAction.replace(/^\/+/, '');
    targetUrlStr = `${targetBase}/api/${cleanSub}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
  }

  const parsedUrl = new URL(targetUrlStr);
  const isHttps = parsedUrl.protocol === 'https:';
  const client = isHttps ? https : http;

  const headers = { ...req.headers };
  delete headers.host;
  delete headers['x-ingress-path'];

  if (server.api_key) {
    headers['authorization'] = `Bearer ${server.api_key}`;
    headers['x-artifactory-key'] = server.api_key;
  }
  if (server.cf_client_id) headers['cf-access-client-id'] = server.cf_client_id;
  if (server.cf_client_secret) headers['cf-access-client-secret'] = server.cf_client_secret;

  const proxyReq = client.request(parsedUrl, {
    method: req.method,
    headers,
    timeout: 30000,
  }, (remoteRes) => {
    const contentType = remoteRes.headers['content-type'] || '';

    if (contentType.includes('application/json')) {
      let raw = '';
      remoteRes.on('data', chunk => raw += chunk);
      remoteRes.on('end', () => {
        try {
          const json = JSON.parse(raw);
          const augmented = augmentRemoteResponse(json, server, getLocalNodeName());
          res.status(remoteRes.statusCode).json(augmented);
        } catch {
          res.status(remoteRes.statusCode).send(raw);
        }
      });
    } else {
      // Pipe stream directly for downloads, previews, media
      res.status(remoteRes.statusCode);
      Object.keys(remoteRes.headers).forEach(k => {
        res.setHeader(k, remoteRes.headers[k]);
      });
      remoteRes.pipe(res);
    }
  });

  proxyReq.on('error', (err) => {
    res.status(502).json({
      success: false,
      error: `Proxy error communicating with remote server "${server.display_name}": ${err.message}`,
      target_url: targetUrlStr
    });
  });

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    req.pipe(proxyReq);
  } else {
    proxyReq.end();
  }
});

// ---------------------------------------------------------------------------
// Fallback: serve index.html for SPA
// ---------------------------------------------------------------------------
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, error: 'Unknown API endpoint.' });
  }
  sendIndexHtml(req, res);
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Artifactory v${APP_VERSION}] Server listening on port ${PORT}`);
  console.log(`[Artifactory] ${ROOTS.size} root(s) configured`);
});
