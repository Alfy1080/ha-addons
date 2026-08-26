/**
 * Artifactory — Home Assistant Add-on
 * Client-side Controller & UI Logic
 *
 * Zero external dependencies, pure vanilla JS.
 * Ingress-compatible with dynamic path resolution.
 * Supports Browser History (Back/Forward), Access Badges (Read/Write), and Graceful Error Handling.
 */

(function () {
  'use strict';

  // Base path resolution for Home Assistant Ingress
  function getBasePath() {
    if (window.__ingress_path) {
      return window.__ingress_path.replace(/\/+$/, '');
    }
    const pathname = window.location.pathname || '';
    const ingressMatch = pathname.match(/^(\/api\/hassio_ingress\/[^/]+)/);
    if (ingressMatch) {
      return ingressMatch[1];
    }
    return pathname.replace(/\/[^/]*$/, '').replace(/\/+$/, '');
  }

  function getPathFromHash() {
    const hash = window.location.hash || '';
    if (hash.startsWith('#/')) {
      return decodeURIComponent(hash.slice(2));
    }
    if (hash.startsWith('#') && hash.length > 1) {
      return decodeURIComponent(hash.slice(1));
    }
    return '';
  }

  // Application State
  const state = {
    currentPath: '',
    items: [],
    breadcrumbs: [{ name: 'Root', path: '' }],
    viewMode: localStorage.getItem('artifactory_view_mode') || 'grid',
    theme: localStorage.getItem('artifactory_theme') || 'dark',
    searchQuery: '',
    sortKey: 'name',
    sortOrder: 'asc',
    serverInfo: null,
    previewItem: null,
    activeDeletePath: null,
    activeRenamePath: null,
    isReadOnly: false
  };

  // DOM Elements
  const el = {
    app: document.getElementById('app'),
    hostBadge: document.getElementById('hostBadge'),
    searchInput: document.getElementById('searchInput'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    uploadBtn: document.getElementById('uploadBtn'),
    fileInput: document.getElementById('fileInput'),
    newFolderBtn: document.getElementById('newFolderBtn'),
    refreshBtn: document.getElementById('refreshBtn'),
    gridViewBtn: document.getElementById('gridViewBtn'),
    listViewBtn: document.getElementById('listViewBtn'),
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    themeIconSun: document.getElementById('themeIconSun'),
    themeIconMoon: document.getElementById('themeIconMoon'),
    navUpBtn: document.getElementById('navUpBtn'),
    breadcrumbs: document.getElementById('breadcrumbs'),
    copyCurrentPathBtn: document.getElementById('copyCurrentPathBtn'),
    dropOverlay: document.getElementById('dropOverlay'),
    uploadProgressContainer: document.getElementById('uploadProgressContainer'),
    uploadStatusTitle: document.getElementById('uploadStatusTitle'),
    uploadProgressBar: document.getElementById('uploadProgressBar'),
    uploadItemsList: document.getElementById('uploadItemsList'),
    closeUploadProgressBtn: document.getElementById('closeUploadProgressBtn'),
    explorerMain: document.getElementById('explorerMain'),
    filesContainer: document.getElementById('filesContainer'),
    loadingState: document.getElementById('loadingState'),
    emptyState: document.getElementById('emptyState'),
    itemsSummary: document.getElementById('itemsSummary'),
    storageInfo: document.getElementById('storageInfo'),
    uploadLimitInfo: document.getElementById('uploadLimitInfo'),
    // Preview Modal
    previewModal: document.getElementById('previewModal'),
    previewTitle: document.getElementById('previewTitle'),
    previewBody: document.getElementById('previewBody'),
    previewPath: document.getElementById('previewPath'),
    previewSize: document.getElementById('previewSize'),
    previewMtime: document.getElementById('previewMtime'),
    previewMime: document.getElementById('previewMime'),
    previewDirectLinkInput: document.getElementById('previewDirectLinkInput'),
    previewCopyUrlBtn: document.getElementById('previewCopyUrlBtn'),
    previewCopyInputBtn: document.getElementById('previewCopyInputBtn'),
    previewDownloadBtn: document.getElementById('previewDownloadBtn'),
    closePreviewModalBtn: document.getElementById('closePreviewModalBtn'),
    // New Folder Modal
    newFolderModal: document.getElementById('newFolderModal'),
    newFolderForm: document.getElementById('newFolderForm'),
    newFolderNameInput: document.getElementById('newFolderNameInput'),
    cancelNewFolderBtn: document.getElementById('cancelNewFolderBtn'),
    closeNewFolderModalBtn: document.getElementById('closeNewFolderModalBtn'),
    // Rename Modal
    renameModal: document.getElementById('renameModal'),
    renameForm: document.getElementById('renameForm'),
    renameInput: document.getElementById('renameInput'),
    cancelRenameBtn: document.getElementById('cancelRenameBtn'),
    closeRenameModalBtn: document.getElementById('closeRenameModalBtn'),
    // Delete Modal
    deleteModal: document.getElementById('deleteModal'),
    deleteConfirmMessage: document.getElementById('deleteConfirmMessage'),
    cancelDeleteBtn: document.getElementById('cancelDeleteBtn'),
    confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
    closeDeleteModalBtn: document.getElementById('closeDeleteModalBtn'),
    // Toast Container
    toastContainer: document.getElementById('toastContainer')
  };

  // API Client Helper
  function getApiUrl(endpoint, params = {}) {
    const base = getBasePath();
    const ep = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = new URL(`${base}/api${ep}`, window.location.origin);
    Object.keys(params).forEach(k => {
      if (params[k] !== undefined && params[k] !== null && params[k] !== '') {
        url.searchParams.set(k, params[k]);
      }
    });
    return url.toString();
  }

  async function apiRequest(endpoint, options = {}) {
    const method = options.method || 'GET';
    const url = getApiUrl(endpoint, options.params || {});
    const fetchOptions = {
      method,
      headers: options.headers || {}
    };

    if (options.body) {
      if (options.body instanceof FormData) {
        fetchOptions.body = options.body;
      } else {
        fetchOptions.headers['Content-Type'] = 'application/json';
        fetchOptions.body = JSON.stringify(options.body);
      }
    }

    try {
      const response = await fetch(url, fetchOptions);
      const data = await response.json();
      if (!response.ok || data.success === false) {
        throw new Error(data.error || `Request failed with status ${response.status}`);
      }
      return data;
    } catch (err) {
      console.error(`API Error [${endpoint}]:`, err);
      throw err;
    }
  }

  // Toast Notifications
  function showToast(message, type = 'info', duration = 3500) {
    if (!el.toastContainer) return;
    const msgText = String(message || (type === 'error' ? 'An error occurred' : '')).trim();
    if (!msgText) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let iconSvg = '';
    if (type === 'success') {
      iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
    } else if (type === 'error') {
      iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
    } else {
      iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
    }

    toast.innerHTML = `${iconSvg}<span>${escapeHtml(msgText)}</span>`;
    el.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, duration);
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }

  function copyToClipboard(text, successMsg = 'Copied to clipboard!') {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => {
        showToast(successMsg, 'success');
      }).catch(() => fallbackCopy(text, successMsg));
    } else {
      fallbackCopy(text, successMsg);
    }
  }

  function fallbackCopy(text, successMsg) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      showToast(successMsg, 'success');
    } catch (err) {
      showToast('Failed to copy link', 'error');
    }
    document.body.removeChild(textArea);
  }

  // Icons & Badges Helpers
  function getFileIconSvg(item) {
    const isDir = item.type === 'dir' || item.type === 'directory';
    if (isDir) {
      return '<svg class="folder-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>';
    }

    const ext = (item.ext || '').toLowerCase();
    const mime = item.mime || '';

    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico', 'bmp'].includes(ext) || mime.startsWith('image/')) {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>';
    }
    if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext) || mime.startsWith('video/')) {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>';
    }
    if (['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext) || mime.startsWith('audio/')) {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>';
    }
    if (['js', 'ts', 'php', 'py', 'sh', 'css', 'html', 'json', 'yaml', 'yml', 'sql', 'xml'].includes(ext)) {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>';
    }
    if (['zip', 'tar', 'gz', 'bz2', '7z', 'rar'].includes(ext) || mime.includes('zip') || mime.includes('compressed')) {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"></polyline><line x1="1" y1="3" x2="23" y2="3"></line><line x1="10" y1="12" x2="14" y2="12"></line></svg>';
    }
    if (['pdf'].includes(ext) || mime === 'application/pdf') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>';
    }

    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>';
  }

  // Access Badge (Eye for Read-Only, Pencil for Write)
  function getAccessBadgeHtml(item) {
    const isWritable = item.writable === true;
    if (isWritable) {
      return `
        <span class="access-badge badge-write" title="Write access (Upload, Edit, Delete)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
          <span>Write</span>
        </span>
      `;
    }
    return `
      <span class="access-badge badge-read" title="Read-only access (Browse, Preview, Download)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
        <span>Read</span>
      </span>
    `;
  }

  function getAccessPillHtml(item) {
    const isWritable = item.writable === true;
    if (isWritable) {
      return `
        <span class="access-pill pill-write" title="Write access (Upload, Edit, Delete)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
          <span>Write</span>
        </span>
      `;
    }
    return `
      <span class="access-pill pill-read" title="Read-only access (Browse, Preview, Download)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
        <span>Read</span>
      </span>
    `;
  }

  // Load Folder Content with History support
  async function loadDirectory(path = '', pushHistory = true) {
    path = (path || '').replace(/^\/+/, '').replace(/\/+$/, '');
    state.currentPath = path;

    // Push to browser history so Back/Forward buttons navigate within Artifactory
    if (pushHistory) {
      const newHash = path ? `#/${path}` : '#';
      if (window.location.hash !== newHash) {
        history.pushState({ path }, '', newHash);
      }
    }

    if (el.loadingState) el.loadingState.style.display = 'flex';
    if (el.emptyState) el.emptyState.style.display = 'none';
    if (el.filesContainer) el.filesContainer.style.display = 'none';

    try {
      const data = await apiRequest('list', { params: { path } });
      state.items = data.items || [];
      state.breadcrumbs = data.breadcrumbs || [{ name: 'Root', path: '' }];

      if (!state.currentPath) {
        state.isReadOnly = true;
      } else if (state.items.length > 0) {
        state.isReadOnly = !state.items[0].writable;
      } else if (data.writable !== undefined) {
        state.isReadOnly = !data.writable;
      } else {
        state.isReadOnly = false;
      }

      renderBreadcrumbs();
      renderItems(data.message);
      updateActionButtons();
    } catch (err) {
      showToast(err.message, 'error');

      // Fallback breadcrumbs so user is NEVER stuck and can always click Root or parent
      if (!state.breadcrumbs || state.breadcrumbs.length === 0 || state.breadcrumbs[state.breadcrumbs.length - 1].path !== path) {
        const parts = path.split('/').filter(Boolean);
        const fallbackBcs = [{ name: 'Root', path: '' }];
        let accum = '';
        parts.forEach(p => {
          accum = accum ? `${accum}/${p}` : p;
          fallbackBcs.push({ name: p, path: accum });
        });
        state.breadcrumbs = fallbackBcs;
      }
      renderBreadcrumbs();
      renderErrorState(err.message);
    } finally {
      if (el.loadingState) el.loadingState.style.display = 'none';
    }
  }

  // Render Error State with Go Back / Return to Root button
  function renderErrorState(errorMessage) {
    if (!el.filesContainer) return;
    el.filesContainer.innerHTML = `
      <div class="state-container" style="grid-column: 1 / -1; width: 100%;">
        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <h3>Folder Unavailable</h3>
        <p>${escapeHtml(errorMessage || 'This folder could not be found or opened.')}</p>
        <div style="display: flex; gap: 0.75rem; margin-top: 0.5rem;">
          <button class="btn btn-secondary" onclick="window.history.back()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
            <span>Go Back</span>
          </button>
          <button class="btn btn-primary" onclick="window.__artifactory_loadRoot()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>
            <span>Return to Root</span>
          </button>
        </div>
      </div>
    `;
    el.filesContainer.style.display = 'block';
    if (el.emptyState) el.emptyState.style.display = 'none';
  }

  window.__artifactory_loadRoot = function () {
    loadDirectory('');
  };

  // Load Server Info
  async function loadServerInfo() {
    try {
      const data = await apiRequest('info');
      state.serverInfo = data;
      if (data.roots && data.roots.length > 0) {
        const root = data.roots[0];
        if (el.storageInfo && root.disk_free_formatted) {
          el.storageInfo.textContent = `Storage: Free ${root.disk_free_formatted} / ${root.disk_total_formatted}`;
        }
      }
      if (el.hostBadge && data.server) {
        el.hostBadge.textContent = `${data.server.name} v${data.server.version}`;
      }
    } catch (err) {
      console.warn('Could not load server info:', err);
    }
  }

  // Update Action Buttons
  function updateActionButtons() {
    const isRoot = !state.currentPath;
    const canWrite = !state.isReadOnly && !isRoot;

    if (el.newFolderBtn) {
      el.newFolderBtn.disabled = !canWrite;
      el.newFolderBtn.style.opacity = canWrite ? '1' : '0.4';
      el.newFolderBtn.style.cursor = canWrite ? 'pointer' : 'not-allowed';
    }
    if (el.uploadBtn) {
      el.uploadBtn.disabled = !canWrite;
      el.uploadBtn.style.opacity = canWrite ? '1' : '0.4';
      el.uploadBtn.style.cursor = canWrite ? 'pointer' : 'not-allowed';
    }
  }

  // Render Breadcrumbs
  function renderBreadcrumbs() {
    if (!el.breadcrumbs) return;
    el.breadcrumbs.innerHTML = '';
    state.breadcrumbs.forEach((bc, idx) => {
      if (idx > 0) {
        const sep = document.createElement('span');
        sep.className = 'breadcrumb-sep';
        sep.textContent = '/';
        el.breadcrumbs.appendChild(sep);
      }

      const item = document.createElement('div');
      item.className = `breadcrumb-item ${idx === state.breadcrumbs.length - 1 ? 'active' : ''}`;
      item.textContent = bc.name;
      if (idx !== state.breadcrumbs.length - 1) {
        item.addEventListener('click', () => loadDirectory(bc.path));
      }
      el.breadcrumbs.appendChild(item);
    });

    if (el.navUpBtn) {
      el.navUpBtn.disabled = state.breadcrumbs.length <= 1;
    }
  }

  // Filter and Sort Items
  function getProcessedItems() {
    let list = [...state.items];

    if (state.searchQuery.trim() !== '') {
      const query = state.searchQuery.toLowerCase();
      list = list.filter(item => item.name.toLowerCase().includes(query));
    }

    list.sort((a, b) => {
      const isDirA = a.type === 'dir' || a.type === 'directory';
      const isDirB = b.type === 'dir' || b.type === 'directory';
      if (isDirA && !isDirB) return -1;
      if (!isDirA && isDirB) return 1;

      let valA = a[state.sortKey] || '';
      let valB = b[state.sortKey] || '';
      if (typeof valA === 'string') {
        const cmp = valA.localeCompare(valB, undefined, { sensitivity: 'base' });
        return state.sortOrder === 'asc' ? cmp : -cmp;
      }
      const cmp = valA < valB ? -1 : (valA > valB ? 1 : 0);
      return state.sortOrder === 'asc' ? cmp : -cmp;
    });

    return list;
  }

  // Render Items (Grid or List)
  function renderItems(customMessage = null) {
    if (!el.filesContainer) return;
    const items = getProcessedItems();
    el.filesContainer.innerHTML = '';

    const dirCount = items.filter(i => i.type === 'dir' || i.type === 'directory').length;
    const fileCount = items.filter(i => i.type === 'file').length;
    if (el.itemsSummary) {
      el.itemsSummary.textContent = `${items.length} items (${dirCount} folders, ${fileCount} files)`;
    }

    if (items.length === 0) {
      if (el.emptyState) {
        el.emptyState.style.display = 'flex';
        if (customMessage) {
          const p = el.emptyState.querySelector('p');
          if (p) p.textContent = customMessage;
        } else {
          const p = el.emptyState.querySelector('p');
          if (p) p.textContent = 'Drag and drop files here, or click the Upload button to host resources.';
        }
      }
      el.filesContainer.style.display = 'none';
      return;
    }

    if (el.emptyState) el.emptyState.style.display = 'none';
    el.filesContainer.style.display = state.viewMode === 'grid' ? 'grid' : 'flex';
    el.filesContainer.className = `files-container ${state.viewMode}-view`;

    if (state.viewMode === 'grid') {
      renderGridView(items);
    } else {
      renderListView(items);
    }
  }

  // Render Grid View
  function renderGridView(items) {
    items.forEach(item => {
      const isDir = item.type === 'dir' || item.type === 'directory';
      const card = document.createElement('div');
      card.className = 'file-card';
      card.title = item.name;

      const isImage = !isDir && (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(item.ext) || (item.mime && item.mime.startsWith('image/')));
      let previewHtml = '';

      const downloadUrl = getApiUrl('download', { path: item.path, inline: 'true' });

      if (isImage) {
        previewHtml = `<div class="file-card-preview"><img src="${downloadUrl}" alt="${escapeHtml(item.name)}" loading="lazy"></div>`;
      } else {
        previewHtml = `<div class="file-card-preview"><div class="file-card-icon ${isDir ? 'folder-icon' : ''}">${getFileIconSvg(item)}</div></div>`;
      }

      const canWrite = state.currentPath && item.writable !== false && !state.isReadOnly;
      const badgeHtml = getAccessBadgeHtml(item);

      card.title = item.fs_path || item.name;

      card.innerHTML = `
        ${badgeHtml}
        ${previewHtml}
        <div class="file-card-info">
          <div class="file-card-name" title="${escapeHtml(item.fs_path || item.name)}">${escapeHtml(item.name)}</div>
          ${item.fs_path && item.fs_path !== item.name && !state.currentPath ? `
          <div style="font-size: 0.7rem; color: var(--text-muted); font-family: var(--font-mono); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(item.fs_path)}">${escapeHtml(item.fs_path)}</div>` : ''}
          <div class="file-card-meta">
            <span>${item.size_formatted || ''}</span>
            <span>${item.mtime_formatted ? item.mtime_formatted.split(' ')[0] : ''}</span>
          </div>
        </div>
        <div class="file-card-actions">
          ${item.ha_url ? `
          <button class="btn-icon small copy-ha-btn" title="Copy HA URL (${item.ha_url})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          </button>` : ''}
          ${!isDir ? `
          <button class="btn-icon small download-btn" title="Download">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          </button>` : ''}
          ${canWrite ? `
          <button class="btn-icon small rename-btn" title="Rename">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
          <button class="btn-icon small delete-btn" title="Delete">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>` : ''}
        </div>
      `;

      // Click card to open folder or preview file
      card.addEventListener('click', (e) => {
        if (e.target.closest('.file-card-actions') || e.target.closest('.access-badge')) return;
        if (isDir) {
          loadDirectory(item.path);
        } else {
          openPreview(item);
        }
      });

      // Action Handlers
      const copyHaBtn = card.querySelector('.copy-ha-btn');
      if (copyHaBtn) copyHaBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        copyToClipboard(item.ha_url, `HA URL copied: "${item.ha_url}"`);
      });

      const downloadBtn = card.querySelector('.download-btn');
      if (downloadBtn) downloadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        triggerDownload(item);
      });

      const renameBtn = card.querySelector('.rename-btn');
      if (renameBtn) renameBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openRenameModal(item);
      });

      const deleteBtn = card.querySelector('.delete-btn');
      if (deleteBtn) deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openDeleteModal(item);
      });

      el.filesContainer.appendChild(card);
    });
  }

  // Render List View
  function renderListView(items) {
    const table = document.createElement('table');
    table.className = 'list-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th data-sort="name">Name</th>
          <th>Access</th>
          <th data-sort="size">Size</th>
          <th data-sort="mtime">Modified</th>
          <th style="text-align:right;">Actions</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    const tbody = table.querySelector('tbody');

    items.forEach(item => {
      const isDir = item.type === 'dir' || item.type === 'directory';
      const tr = document.createElement('tr');
      const canWrite = state.currentPath && item.writable !== false && !state.isReadOnly;
      const accessPill = getAccessPillHtml(item);

      tr.innerHTML = `
        <td>
          <div class="list-item-name-cell">
            <div class="list-item-icon ${isDir ? 'folder-icon' : ''}">${getFileIconSvg(item)}</div>
            <div style="min-width: 0;">
              <div style="font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(item.fs_path || item.name)}">${escapeHtml(item.name)}</div>
              ${item.fs_path && item.fs_path !== item.name ? `<div style="font-size: 0.72rem; color: var(--text-muted); font-family: var(--font-mono); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(item.fs_path)}">${escapeHtml(item.fs_path)}</div>` : ''}
            </div>
          </div>
        </td>
        <td>${accessPill}</td>
        <td>${item.size_formatted || '-'}</td>
        <td>${item.mtime_formatted || '-'}</td>
        <td class="list-actions-cell">
          <div class="btn-group">
            ${item.ha_url ? `
            <button class="btn-icon small copy-ha-btn" title="Copy HA URL (${item.ha_url})">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </button>` : ''}
            ${!isDir ? `
            <button class="btn-icon small download-btn" title="Download">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            </button>` : ''}
            ${canWrite ? `
            <button class="btn-icon small rename-btn" title="Rename">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <button class="btn-icon small delete-btn" title="Delete">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>` : ''}
          </div>
        </td>
      `;

      tr.addEventListener('click', (e) => {
        if (e.target.closest('.btn-group') || e.target.closest('.btn-icon')) return;
        if (isDir) {
          loadDirectory(item.path);
        } else {
          openPreview(item);
        }
      });

      const copyHaBtn = tr.querySelector('.copy-ha-btn');
      if (copyHaBtn) copyHaBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        copyToClipboard(item.ha_url, `HA URL copied: "${item.ha_url}"`);
      });

      const downloadBtn = tr.querySelector('.download-btn');
      if (downloadBtn) downloadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        triggerDownload(item);
      });

      const renameBtn = tr.querySelector('.rename-btn');
      if (renameBtn) renameBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openRenameModal(item);
      });

      const deleteBtn = tr.querySelector('.delete-btn');
      if (deleteBtn) deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openDeleteModal(item);
      });

      tbody.appendChild(tr);
    });

    // Column Header Sorting
    table.querySelectorAll('th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.getAttribute('data-sort');
        if (state.sortKey === key) {
          state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc';
        } else {
          state.sortKey = key;
          state.sortOrder = 'asc';
        }
        renderItems();
      });
    });

    el.filesContainer.appendChild(table);
  }

  // Trigger Download
  function triggerDownload(item) {
    const downloadUrl = getApiUrl('download', { path: item.path });
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = item.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // Preview Modal
  async function openPreview(item) {
    state.previewItem = item;
    el.previewTitle.textContent = item.name;
    if (el.previewPath) el.previewPath.textContent = `Path: ${item.fs_path || item.path}`;
    el.previewSize.textContent = `Size: ${item.size_formatted || '0 B'}`;
    el.previewMtime.textContent = `Date: ${item.mtime_formatted || '-'}`;
    el.previewMime.textContent = `MIME: ${item.mime || 'unknown'}`;

    const haUrl = item.ha_url || getApiUrl('download', { path: item.path });
    el.previewDirectLinkInput.value = haUrl;

    const previewUrl = getApiUrl('download', { path: item.path, inline: 'true' });
    const ext = (item.ext || '').toLowerCase();
    const mime = item.mime || '';

    el.previewBody.innerHTML = '<div class="spinner"></div>';
    el.previewModal.style.display = 'flex';

    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico', 'bmp'].includes(ext) || mime.startsWith('image/')) {
      el.previewBody.innerHTML = `<img src="${previewUrl}" class="preview-media-img" alt="${escapeHtml(item.name)}">`;
    } else if (['mp4', 'webm', 'mov'].includes(ext) || mime.startsWith('video/')) {
      el.previewBody.innerHTML = `<video src="${previewUrl}" controls autoplay class="preview-media-video"></video>`;
    } else if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext) || mime.startsWith('audio/')) {
      el.previewBody.innerHTML = `<audio src="${previewUrl}" controls autoplay class="preview-media-audio"></audio>`;
    } else if (ext === 'pdf' || mime === 'application/pdf') {
      el.previewBody.innerHTML = `<iframe src="${previewUrl}" class="preview-media-pdf"></iframe>`;
    } else if (['txt', 'md', 'json', 'yaml', 'yml', 'js', 'ts', 'html', 'css', 'py', 'sh', 'csv', 'xml', 'log'].includes(ext) || mime.startsWith('text/')) {
      try {
        const response = await fetch(previewUrl);
        const text = await response.text();
        el.previewBody.innerHTML = `<pre class="preview-media-text">${escapeHtml(text)}</pre>`;
      } catch (err) {
        el.previewBody.innerHTML = '<p class="warning-text">Failed to load text preview</p>';
      }
    } else {
      el.previewBody.innerHTML = `
        <div class="state-container">
          <div class="file-card-icon">${getFileIconSvg(item)}</div>
          <h3>Preview not available</h3>
          <p>This file type cannot be rendered directly in the browser.</p>
        </div>
      `;
    }
  }

  function closePreview() {
    el.previewModal.style.display = 'none';
    el.previewBody.innerHTML = '';
    state.previewItem = null;
  }

  // Upload Management
  async function handleFilesUpload(files) {
    if (!files || files.length === 0) return;
    if (!state.currentPath || state.isReadOnly) {
      showToast('Cannot upload to this directory', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('path', state.currentPath);
    formData.append('overwrite', 'true');

    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    el.uploadProgressContainer.style.display = 'block';
    el.uploadProgressBar.style.width = '0%';
    el.uploadStatusTitle.textContent = `Uploading ${files.length} file(s)...`;
    el.uploadItemsList.innerHTML = '';

    for (let i = 0; i < files.length; i++) {
      const row = document.createElement('div');
      row.className = 'upload-item-row';
      row.innerHTML = `<span class="name">${escapeHtml(files[i].name)}</span><span class="status">Uploading...</span>`;
      el.uploadItemsList.appendChild(row);
    }

    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', getApiUrl('upload'), true);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          el.uploadProgressBar.style.width = `${percent}%`;
        }
      };

      await new Promise((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const res = JSON.parse(xhr.responseText);
              resolve(res);
            } catch (err) {
              resolve({});
            }
          } else {
            let errMsg = 'Upload failed';
            try {
              errMsg = JSON.parse(xhr.responseText).error || errMsg;
            } catch {}
            reject(new Error(errMsg));
          }
        };
        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.send(formData);
      });

      showToast(`Uploaded ${files.length} file(s) successfully!`, 'success');
      el.uploadStatusTitle.textContent = 'Upload complete!';
      el.uploadProgressBar.style.width = '100%';
      loadDirectory(state.currentPath);
    } catch (err) {
      showToast(err.message, 'error');
      el.uploadStatusTitle.textContent = 'Upload failed';
    } finally {
      setTimeout(() => {
        el.uploadProgressContainer.style.display = 'none';
      }, 3500);
    }
  }

  // Modals Management
  function openNewFolderModal() {
    if (!state.currentPath || state.isReadOnly) return;
    el.newFolderNameInput.value = '';
    el.newFolderModal.style.display = 'flex';
    el.newFolderNameInput.focus();
  }

  function closeNewFolderModal() {
    el.newFolderModal.style.display = 'none';
  }

  function openRenameModal(item) {
    state.activeRenamePath = item.path;
    el.renameInput.value = item.name;
    el.renameModal.style.display = 'flex';
    el.renameInput.focus();
  }

  function closeRenameModal() {
    el.renameModal.style.display = 'none';
    state.activeRenamePath = null;
  }

  function openDeleteModal(item) {
    state.activeDeletePath = item.path;
    el.deleteConfirmMessage.textContent = `Are you sure you want to delete "${item.name}"?`;
    el.deleteModal.style.display = 'flex';
  }

  function closeDeleteModal() {
    el.deleteModal.style.display = 'none';
    state.activeDeletePath = null;
  }

  // Event Listeners Registration
  function setupEventListeners() {
    // Navigation Up Button
    if (el.navUpBtn) {
      el.navUpBtn.addEventListener('click', () => {
        if (state.breadcrumbs.length > 1) {
          const parentBc = state.breadcrumbs[state.breadcrumbs.length - 2];
          loadDirectory(parentBc.path);
        }
      });
    }

    // Copy Current Path
    if (el.copyCurrentPathBtn) {
      el.copyCurrentPathBtn.addEventListener('click', () => {
        const fullUrl = window.location.href;
        copyToClipboard(fullUrl, 'Folder URL copied to clipboard');
      });
    }

    // Search Input
    if (el.searchInput) {
      el.searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        if (el.clearSearchBtn) {
          el.clearSearchBtn.style.display = state.searchQuery ? 'block' : 'none';
        }
        renderItems();
      });
    }

    if (el.clearSearchBtn) {
      el.clearSearchBtn.addEventListener('click', () => {
        el.searchInput.value = '';
        state.searchQuery = '';
        el.clearSearchBtn.style.display = 'none';
        renderItems();
      });
    }

    // Refresh Button
    if (el.refreshBtn) {
      el.refreshBtn.addEventListener('click', () => {
        loadDirectory(state.currentPath);
        loadServerInfo();
      });
    }

    // View Toggle
    if (el.gridViewBtn && el.listViewBtn) {
      el.gridViewBtn.addEventListener('click', () => {
        state.viewMode = 'grid';
        localStorage.setItem('artifactory_view_mode', 'grid');
        el.gridViewBtn.classList.add('active');
        el.listViewBtn.classList.remove('active');
        renderItems();
      });

      el.listViewBtn.addEventListener('click', () => {
        state.viewMode = 'list';
        localStorage.setItem('artifactory_view_mode', 'list');
        el.listViewBtn.classList.add('active');
        el.gridViewBtn.classList.remove('active');
        renderItems();
      });
    }

    // Theme Toggle
    if (el.themeToggleBtn) {
      el.themeToggleBtn.addEventListener('click', () => {
        state.theme = state.theme === 'dark' ? 'light' : 'dark';
        document.body.setAttribute('data-theme', state.theme);
        localStorage.setItem('artifactory_theme', state.theme);
        if (el.themeIconSun && el.themeIconMoon) {
          el.themeIconSun.style.display = state.theme === 'dark' ? 'block' : 'none';
          el.themeIconMoon.style.display = state.theme === 'dark' ? 'none' : 'block';
        }
      });
    }

    // Upload Button & File Input
    if (el.uploadBtn && el.fileInput) {
      el.uploadBtn.addEventListener('click', () => {
        if (!state.currentPath || state.isReadOnly) return;
        el.fileInput.click();
      });

      el.fileInput.addEventListener('change', (e) => {
        handleFilesUpload(e.target.files);
        el.fileInput.value = '';
      });
    }

    // Drag & Drop
    window.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (state.currentPath && !state.isReadOnly && el.dropOverlay) {
        el.dropOverlay.classList.add('active');
      }
    });

    window.addEventListener('dragleave', (e) => {
      if (e.relatedTarget === null && el.dropOverlay) {
        el.dropOverlay.classList.remove('active');
      }
    });

    window.addEventListener('drop', (e) => {
      e.preventDefault();
      if (el.dropOverlay) el.dropOverlay.classList.remove('active');
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFilesUpload(e.dataTransfer.files);
      }
    });

    // Close Upload Progress
    if (el.closeUploadProgressBtn) {
      el.closeUploadProgressBtn.addEventListener('click', () => {
        el.uploadProgressContainer.style.display = 'none';
      });
    }

    // New Folder Modal
    if (el.newFolderBtn) el.newFolderBtn.addEventListener('click', openNewFolderModal);
    if (el.cancelNewFolderBtn) el.cancelNewFolderBtn.addEventListener('click', closeNewFolderModal);
    if (el.closeNewFolderModalBtn) el.closeNewFolderModalBtn.addEventListener('click', closeNewFolderModal);
    if (el.newFolderForm) {
      el.newFolderForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = el.newFolderNameInput.value.trim();
        if (!name) return;

        try {
          await apiRequest('mkdir', {
            method: 'POST',
            body: { path: state.currentPath, name }
          });
          showToast(`Folder "${name}" created!`, 'success');
          closeNewFolderModal();
          loadDirectory(state.currentPath);
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    }

    // Rename Modal
    if (el.cancelRenameBtn) el.cancelRenameBtn.addEventListener('click', closeRenameModal);
    if (el.closeRenameModalBtn) el.closeRenameModalBtn.addEventListener('click', closeRenameModal);
    if (el.renameForm) {
      el.renameForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newName = el.renameInput.value.trim();
        if (!newName || !state.activeRenamePath) return;

        try {
          await apiRequest('rename', {
            method: 'POST',
            body: { path: state.activeRenamePath, new_name: newName }
          });
          showToast('Renamed successfully!', 'success');
          closeRenameModal();
          loadDirectory(state.currentPath);
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    }

    // Delete Modal
    if (el.cancelDeleteBtn) el.cancelDeleteBtn.addEventListener('click', closeDeleteModal);
    if (el.closeDeleteModalBtn) el.closeDeleteModalBtn.addEventListener('click', closeDeleteModal);
    if (el.confirmDeleteBtn) {
      el.confirmDeleteBtn.addEventListener('click', async () => {
        if (!state.activeDeletePath) return;

        try {
          await apiRequest('delete', {
            method: 'POST',
            body: { path: state.activeDeletePath }
          });
          showToast('Item deleted successfully!', 'success');
          closeDeleteModal();
          loadDirectory(state.currentPath);
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    }

    // Preview Modal Buttons
    if (el.closePreviewModalBtn) el.closePreviewModalBtn.addEventListener('click', closePreview);
    if (el.previewDownloadBtn) {
      el.previewDownloadBtn.addEventListener('click', () => {
        if (state.previewItem) triggerDownload(state.previewItem);
      });
    }
    if (el.previewCopyUrlBtn) {
      el.previewCopyUrlBtn.addEventListener('click', () => {
        if (state.previewItem) {
          const url = state.previewItem.ha_url || getApiUrl('download', { path: state.previewItem.path });
          copyToClipboard(url, 'HA URL copied to clipboard');
        }
      });
    }
    if (el.previewCopyInputBtn) {
      el.previewCopyInputBtn.addEventListener('click', () => {
        copyToClipboard(el.previewDirectLinkInput.value, 'Direct link copied');
      });
    }

    // Browser Back / Forward History Navigation
    window.addEventListener('popstate', (e) => {
      const path = (e.state && e.state.path !== undefined)
        ? e.state.path
        : getPathFromHash();
      loadDirectory(path, false);
    });

    window.addEventListener('hashchange', () => {
      const path = getPathFromHash();
      if (path !== state.currentPath) {
        loadDirectory(path, false);
      }
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        if (el.searchInput) {
          el.searchInput.focus();
          el.searchInput.select();
        }
      }
      if (e.key === 'Escape') {
        closePreview();
        closeNewFolderModal();
        closeRenameModal();
        closeDeleteModal();
      }
      if (e.key === 'Backspace' && document.activeElement.tagName !== 'INPUT') {
        if (state.breadcrumbs.length > 1) {
          e.preventDefault();
          const parentBc = state.breadcrumbs[state.breadcrumbs.length - 2];
          loadDirectory(parentBc.path);
        }
      }
    });
  }

  // Initialization
  function init() {
    // Restore Theme
    document.body.setAttribute('data-theme', state.theme);
    if (el.themeIconSun && el.themeIconMoon) {
      el.themeIconSun.style.display = state.theme === 'dark' ? 'block' : 'none';
      el.themeIconMoon.style.display = state.theme === 'dark' ? 'none' : 'block';
    }

    // Restore View Mode
    if (el.gridViewBtn && el.listViewBtn) {
      if (state.viewMode === 'grid') {
        el.gridViewBtn.classList.add('active');
        el.listViewBtn.classList.remove('active');
      } else {
        el.listViewBtn.classList.add('active');
        el.gridViewBtn.classList.remove('active');
      }
    }

    setupEventListeners();

    // Check initial path from URL hash or start at root
    const initialPath = getPathFromHash();
    loadDirectory(initialPath, false);
    loadServerInfo();
  }

  // Start immediately or on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
