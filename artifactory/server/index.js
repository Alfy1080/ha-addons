/**
 * Artifactory — Home Assistant Add-on
 * File explorer & asset manager REST API
 *
 * Provides file management endpoints accessible via HA Ingress proxy.
 * Supports multipart uploads, base64 JSON uploads, and URL-fetch downloads.
 * Designed for LLM-driven asset workflows via ha_manage_app MCP proxy.
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');

const app = express();
const PORT = parseInt(process.env.PORT || '8099', 10);

// ---------------------------------------------------------------------------
// Configuration: parse write/read paths from environment
// ---------------------------------------------------------------------------

/** Parse comma-separated path list from env var */
function parsePaths(envVar) {
  const raw = process.env[envVar] || '';
  return raw
    .split(',')
    .map(p => p.trim())
    .filter(p => p.length > 0);
}

const WRITE_PATHS = parsePaths('WRITE_PATHS');
const READ_PATHS = parsePaths('READ_PATHS');

/**
 * Build a map of virtual root name → { name, key, shortName, absolute, writable }
 * e.g. "/config/www" → { name: "/config/www", key: "config/www", shortName: "www", absolute: "/config/www", writable: true }
 */
function buildRoots() {
  const roots = new Map();
  const addRoot = (absPath, writable) => {
    const resolved = path.resolve(absPath);
    const displayName = resolved.replace(/\\/g, '/');
    const cleanKey = displayName.replace(/^\/+/, ''); // e.g. "config/www", "share", "config/share"

    if (roots.has(cleanKey)) {
      if (writable) roots.get(cleanKey).writable = true;
    } else {
      roots.set(cleanKey, {
        name: displayName,              // e.g. "/config/www", "/share", "/config/share"
        key: cleanKey,                  // e.g. "config/www", "share", "config/share"
        shortName: path.basename(resolved), // e.g. "www"
        absolute: resolved,             // "/config/www"
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
// Path resolution & security
// ---------------------------------------------------------------------------

/**
 * Resolve a virtual path (e.g. "config/www/icons/logo.png" or "/config/www/icons/logo.png" or "www/icons/logo.png")
 * to an absolute path.
 *
 * @returns {{ absolute: string, relative: string, root: object, rootRelative: string } | null}
 */
function resolvePath(virtualPath, mustExist = true) {
  if (typeof virtualPath !== 'string') return null;

  const clean = virtualPath.replace(/\\/g, '/').replace(/\0/g, '').replace(/^\/+/, '').replace(/\/+$/, '');
  if (!clean) return null; // root listing handled separately

  const parts = clean.split('/').filter(p => p !== '' && p !== '.');
  if (parts.some(p => p === '..')) return null; // traversal attempt

  // Match root by checking longest matching cleanKey first
  let matchedRoot = null;
  let subPath = '';

  // 1. Direct or prefix match against root key (e.g. "config/www" or "config/www/icons" or "share/data")
  for (const [key, root] of ROOTS) {
    if (clean === key) {
      matchedRoot = root;
      subPath = '';
      break;
    }
    if (clean.startsWith(key + '/')) {
      if (!matchedRoot || key.length > matchedRoot.key.length) {
        matchedRoot = root;
        subPath = clean.slice(key.length + 1);
      }
    }
  }

  // 2. Fallback: backwards-compatible short name match (e.g. "www/icons" matching "/config/www")
  if (!matchedRoot) {
    for (const [key, root] of ROOTS) {
      if (clean === root.shortName) {
        matchedRoot = root;
        subPath = '';
        break;
      }
      if (clean.startsWith(root.shortName + '/')) {
        matchedRoot = root;
        subPath = clean.slice(root.shortName.length + 1);
        break;
      }
    }
  }

  if (!matchedRoot) return null;

  const targetAbs = subPath
    ? path.join(matchedRoot.absolute, subPath)
    : matchedRoot.absolute;

  const resolved = path.resolve(targetAbs);
  if (resolved !== matchedRoot.absolute && !resolved.startsWith(matchedRoot.absolute + path.sep)) {
    return null; // escaped root
  }

  if (mustExist && !fs.existsSync(resolved)) return null;

  // For non-existent subpaths, verify parent exists within root
  if (!mustExist && resolved !== matchedRoot.absolute) {
    const parent = path.dirname(resolved);
    if (!fs.existsSync(parent)) return null;
    const resolvedParent = path.resolve(parent);
    if (resolvedParent !== matchedRoot.absolute && !resolvedParent.startsWith(matchedRoot.absolute + path.sep)) {
      return null;
    }
  }

  const rootRelative = resolved === matchedRoot.absolute
    ? ''
    : resolved.slice(matchedRoot.absolute.length + 1).replace(/\\/g, '/');

  const relative = subPath ? `${matchedRoot.key}/${subPath}` : matchedRoot.key;

  return {
    absolute: resolved,
    relative,
    root: matchedRoot,
    rootRelative,
  };
}

/** Format bytes to human readable string */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 2 : 0) + ' ' + units[i];
}

/** Get MIME type from extension */
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
    py: 'text/x-python', log: 'text/plain',
  };
  return map[ext] || 'application/octet-stream';
}

/**
 * Compute the Home Assistant `/local/` URL for a file if it's under /config/www.
 * Returns null if not applicable.
 */
function getHaUrl(root, rootRelative) {
  if (root.absolute === '/config/www' || root.absolute === path.resolve('/config/www')) {
    const subPath = rootRelative || '';
    return subPath ? `/local/${subPath}` : '/local/';
  }
  return null;
}

/** Recursively delete a directory */
function deleteRecursive(target) {
  const stat = fs.statSync(target);
  if (stat.isDirectory()) {
    fs.rmSync(target, { recursive: true, force: true });
  } else {
    fs.unlinkSync(target);
  }
}

// ---------------------------------------------------------------------------
// Middleware & Ingress Support
// ---------------------------------------------------------------------------

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

/** Helper to serve index.html with Ingress path injected */
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

// Serve static frontend assets (css, js, icons, etc.)
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// Multer for multipart uploads (store in /tmp temporarily)
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
    let diskFree = null, diskTotal = null;
    try {
      const stats = fs.statfsSync(root.absolute);
      diskFree = stats.bfree * stats.bsize;
      diskTotal = stats.blocks * stats.bsize;
    } catch { /* ignore */ }

    roots.push({
      name: root.name,
      key: root.key,
      path: root.absolute,
      writable: root.writable,
      disk_free: diskFree,
      disk_free_formatted: diskFree !== null ? formatBytes(diskFree) : 'Unknown',
      disk_total: diskTotal,
      disk_total_formatted: diskTotal !== null ? formatBytes(diskTotal) : 'Unknown',
    });
  }

  res.json({
    success: true,
    server: {
      name: 'Artifactory',
      version: '1.0.5',
      platform: 'Home Assistant Add-on',
      node_version: process.version,
    },
    roots,
  });
});

// ---------------------------------------------------------------------------
// API: GET /api/list
// ---------------------------------------------------------------------------
app.get('/api/list', (req, res) => {
  const reqPath = (req.query.path || '').toString();

  // Root listing — show available roots
  if (!reqPath || reqPath === '/' || reqPath === '') {
    const items = [];
    for (const [key, root] of ROOTS) {
      items.push({
        name: root.name,
        path: root.key,
        fs_path: root.absolute,
        type: 'dir',
        size: 0,
        size_formatted: '-',
        mtime: 0,
        mtime_formatted: '-',
        mime: 'directory',
        ext: '',
        writable: root.writable,
        ha_url: root.absolute === '/config/www' ? '/local/' : null,
      });
    }
    return res.json({
      success: true,
      current_path: '',
      breadcrumbs: [{ name: 'Root', path: '' }],
      total_items: items.length,
      items,
    });
  }

  const resolved = resolvePath(reqPath, false);
  if (!resolved) {
    return res.status(404).json({ success: false, error: 'Invalid path or outside allowed roots.' });
  }

  // Build breadcrumbs starting with root name
  const breadcrumbs = [{ name: 'Root', path: '' }];
  breadcrumbs.push({ name: resolved.root.name, path: resolved.root.key });
  if (resolved.rootRelative) {
    const subParts = resolved.rootRelative.split('/');
    let cumulative = resolved.root.key;
    for (const part of subParts) {
      cumulative = `${cumulative}/${part}`;
      breadcrumbs.push({ name: part, path: cumulative });
    }
  }

  // If directory does not exist on disk
  if (!fs.existsSync(resolved.absolute)) {
    if (resolved.root.writable) {
      try {
        fs.mkdirSync(resolved.absolute, { recursive: true });
      } catch (err) {
        return res.status(500).json({ success: false, error: `Failed to create directory: ${err.message}` });
      }
    } else {
      return res.json({
        success: true,
        current_path: resolved.relative,
        breadcrumbs,
        total_items: 0,
        items: [],
        exists: false,
        writable: false,
        message: `Directory "${resolved.root.absolute}" does not exist on the filesystem.`,
      });
    }
  }

  if (!fs.statSync(resolved.absolute).isDirectory()) {
    return res.status(400).json({ success: false, error: 'Target path is not a directory.' });
  }

  // List entries
  let entries;
  try {
    entries = fs.readdirSync(resolved.absolute, { withFileTypes: true });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to read directory.' });
  }

  const items = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue; // skip hidden files

    const entryAbs = path.join(resolved.absolute, entry.name);
    const entryRel = `${resolved.relative}/${entry.name}`;
    const isDir = entry.isDirectory();
    let stat;
    try { stat = fs.statSync(entryAbs); } catch { continue; }

    const ext = isDir ? '' : path.extname(entry.name).toLowerCase().slice(1);
    const haUrl = getHaUrl(resolved.root, resolved.rootRelative
      ? `${resolved.rootRelative}/${entry.name}`
      : entry.name);

    items.push({
      name: entry.name,
      path: entryRel,
      fs_path: entryAbs,
      type: isDir ? 'dir' : 'file',
      size: isDir ? 0 : stat.size,
      size_formatted: isDir ? '-' : formatBytes(stat.size),
      mtime: Math.floor(stat.mtimeMs / 1000),
      mtime_formatted: stat.mtime.toISOString().replace('T', ' ').slice(0, 19),
      mime: isDir ? 'directory' : getMime(entryAbs),
      ext,
      writable: resolved.root.writable,
      ha_url: isDir ? null : haUrl,
    });
  }

  // Sort: directories first, then alphabetical
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
// API: POST /api/upload
// ---------------------------------------------------------------------------
app.post('/api/upload', upload.array('files', 100), (req, res) => {
  // Mode 1: Base64 JSON upload
  if (req.body && req.body.content_base64) {
    const { filename, content_base64, overwrite } = req.body;
    const targetPath = req.body.path || '';

    if (!filename) {
      return res.status(400).json({ success: false, error: 'filename is required for base64 upload.' });
    }

    // Resolve destination
    const destVirtual = targetPath ? `${targetPath}/${filename}` : filename;
    const resolved = resolvePath(destVirtual, false);
    if (!resolved) {
      return res.status(400).json({ success: false, error: 'Invalid destination path.' });
    }
    if (!resolved.root.writable) {
      return res.status(403).json({ success: false, error: `Path "${resolved.root.name}" is read-only.` });
    }

    // Check if file exists
    if (fs.existsSync(resolved.absolute) && !overwrite) {
      return res.status(409).json({ success: false, error: 'File already exists. Set overwrite=true to replace.' });
    }

    // Ensure parent directory exists
    const parentDir = path.dirname(resolved.absolute);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    // Decode and write
    try {
      const buffer = Buffer.from(content_base64, 'base64');
      fs.writeFileSync(resolved.absolute, buffer);
      const haUrl = getHaUrl(resolved.root, resolved.rootRelative);

      return res.json({
        success: true,
        uploaded: [{
          name: filename,
          path: resolved.relative,
          size: buffer.length,
          size_formatted: formatBytes(buffer.length),
          ha_url: haUrl,
        }],
        count: 1,
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: `Failed to write file: ${err.message}` });
    }
  }

  // Mode 2: Multipart file upload
  if (req.files && req.files.length > 0) {
    const targetPath = req.body.path || '';
    const overwrite = req.body.overwrite === 'true' || req.body.overwrite === true;

    // Verify target directory
    const dirResolved = resolvePath(targetPath, true);
    if (!dirResolved || !fs.statSync(dirResolved.absolute).isDirectory()) {
      // Clean up temp files
      req.files.forEach(f => { try { fs.unlinkSync(f.path); } catch {} });
      return res.status(404).json({ success: false, error: 'Upload target directory does not exist.' });
    }
    if (!dirResolved.root.writable) {
      req.files.forEach(f => { try { fs.unlinkSync(f.path); } catch {} });
      return res.status(403).json({ success: false, error: `Path "${dirResolved.root.name}" is read-only.` });
    }

    const uploaded = [];
    const errors = [];

    for (const file of req.files) {
      const fname = file.originalname;
      const dest = path.join(dirResolved.absolute, fname);
      const relPath = `${dirResolved.relative}/${fname}`;

      if (fs.existsSync(dest) && !overwrite) {
        errors.push({ file: fname, error: 'File already exists. Set overwrite=true to replace.' });
        try { fs.unlinkSync(file.path); } catch {}
        continue;
      }

      try {
        fs.renameSync(file.path, dest);
        const haUrl = getHaUrl(dirResolved.root, dirResolved.rootRelative
          ? `${dirResolved.rootRelative}/${fname}` : fname);
        uploaded.push({
          name: fname,
          path: relPath,
          size: file.size,
          size_formatted: formatBytes(file.size),
          ha_url: haUrl,
        });
      } catch (err) {
        errors.push({ file: fname, error: err.message });
        try { fs.unlinkSync(file.path); } catch {}
      }
    }

    return res.json({
      success: uploaded.length > 0,
      uploaded,
      errors,
      count: uploaded.length,
    });
  }

  return res.status(400).json({ success: false, error: 'No files received. Use multipart form or base64 JSON body.' });
});

// ---------------------------------------------------------------------------
// API: POST /api/fetch — download file from URL
// ---------------------------------------------------------------------------
app.post('/api/fetch', (req, res) => {
  const { url, dest_path, overwrite } = req.body || {};

  if (!url || !dest_path) {
    return res.status(400).json({ success: false, error: 'url and dest_path are required.' });
  }

  const resolved = resolvePath(dest_path, false);
  if (!resolved) {
    return res.status(400).json({ success: false, error: 'Invalid destination path.' });
  }
  if (!resolved.root.writable) {
    return res.status(403).json({ success: false, error: `Path "${resolved.root.name}" is read-only.` });
  }
  if (fs.existsSync(resolved.absolute) && !overwrite) {
    return res.status(409).json({ success: false, error: 'File already exists. Set overwrite=true to replace.' });
  }

  // Ensure parent directory exists
  const parentDir = path.dirname(resolved.absolute);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }

  const client = url.startsWith('https') ? https : http;
  const fileStream = fs.createWriteStream(resolved.absolute);

  const fetchUrl = (targetUrl, redirectCount = 0) => {
    if (redirectCount > 5) {
      fileStream.close();
      try { fs.unlinkSync(resolved.absolute); } catch {}
      return res.status(400).json({ success: false, error: 'Too many redirects.' });
    }

    const requestFn = targetUrl.startsWith('https') ? https : http;
    requestFn.get(targetUrl, (response) => {
      // Handle redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return fetchUrl(response.headers.location, redirectCount + 1);
      }

      if (response.statusCode !== 200) {
        fileStream.close();
        try { fs.unlinkSync(resolved.absolute); } catch {}
        return res.status(502).json({
          success: false,
          error: `Remote server returned ${response.statusCode}.`,
        });
      }

      response.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        const stat = fs.statSync(resolved.absolute);
        const haUrl = getHaUrl(resolved.root, resolved.rootRelative);

        res.json({
          success: true,
          fetched: {
            name: path.basename(resolved.absolute),
            path: resolved.relative,
            size: stat.size,
            size_formatted: formatBytes(stat.size),
            source_url: url,
            ha_url: haUrl,
          },
        });
      });
    }).on('error', (err) => {
      fileStream.close();
      try { fs.unlinkSync(resolved.absolute); } catch {}
      res.status(502).json({ success: false, error: `Fetch failed: ${err.message}` });
    });
  };

  fetchUrl(url);
});

// ---------------------------------------------------------------------------
// API: POST /api/mkdir
// ---------------------------------------------------------------------------
app.post('/api/mkdir', (req, res) => {
  const parentPath = req.body.path || '';
  const dirname = (req.body.name || '').trim();

  if (!dirname) {
    return res.status(400).json({ success: false, error: 'Directory name is required.' });
  }
  if (/[\/\\:*?"<>|]/.test(dirname)) {
    return res.status(400).json({ success: false, error: 'Directory name contains invalid characters.' });
  }

  const newPath = parentPath ? `${parentPath}/${dirname}` : dirname;
  // For mkdir at root level (parentPath is empty), dirname should be within an existing root
  // For mkdir inside a root, resolve normally

  // If parentPath is empty, the dirname must be within an existing writable root
  // e.g., parentPath="" dirname="www/new-folder" → resolve "www/new-folder"
  // or parentPath="www" dirname="new-folder" → resolve "www/new-folder"

  const virtualPath = parentPath ? `${parentPath}/${dirname}` : `${dirname}`;

  // Check: if we're creating inside a root, resolve parent
  const parentResolved = resolvePath(parentPath || dirname.split('/')[0], true);
  if (!parentResolved) {
    return res.status(404).json({ success: false, error: 'Parent directory not found.' });
  }
  if (!parentResolved.root.writable) {
    return res.status(403).json({ success: false, error: `Path "${parentResolved.root.name}" is read-only.` });
  }

  const resolved = resolvePath(virtualPath, false);
  if (!resolved) {
    return res.status(400).json({ success: false, error: 'Invalid path.' });
  }

  if (fs.existsSync(resolved.absolute)) {
    return res.status(409).json({ success: false, error: 'Directory already exists.' });
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
    // Don't allow deleting a root directory itself
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
// Fallback: serve index.html for SPA
// ---------------------------------------------------------------------------
app.get('*', (req, res) => {
  // Only serve index.html for non-API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, error: 'Unknown API endpoint.' });
  }
  sendIndexHtml(req, res);
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Artifactory] Server listening on port ${PORT}`);
  console.log(`[Artifactory] ${ROOTS.size} root(s) configured`);
});
