/**
 * Artifactory — File & Asset Manager
 * Client-side Controller & UI Logic with Multi-Node Federation & Live Text Editing
 *
 * Zero external dependencies, pure vanilla JS.
 * Compatible with Home Assistant Ingress iframe embedding and History API.
 */

(function () {
  "use strict";

  const IMAGE_EXTS = ["jpg", "jpeg", "png", "gif", "webp", "ico", "bmp", "svg", "avif", "apng"];
  const VIDEO_EXTS = ["mp4", "webm", "mov", "ogv", "mkv", "avi"];
  const AUDIO_EXTS = ["mp3", "wav", "ogg", "flac", "m4a", "aac", "opus"];
  const TEXT_EXTS = [
    "txt", "md", "json", "yaml", "yml", "css", "scss", "js", "ts", "jsx", "tsx",
    "html", "htm", "py", "sh", "bash", "pem", "key", "crt", "cert", "csr", "pub",
    "xml", "svg", "conf", "ini", "cfg", "env", "sql", "csv", "tsv", "log", "toml",
    "dockerfile", "gitignore"
  ];

  function getBasePath() {
    if (window.__ingress_path) {
      return window.__ingress_path.replace(/\/+$/, "");
    }
    const path = window.location.pathname;
    const clean = path.replace(/\/+$/, "");
    return clean === "" || clean.endsWith(".html") ? "" : clean;
  }

  function parseHash() {
    const hash = window.location.hash || "";
    if (hash.startsWith("#@")) {
      const parts = hash.slice(2).split("/");
      const serverId = decodeURIComponent(parts[0]);
      const path = parts.slice(1).join("/");
      return { serverId, path: decodeURIComponent(path) };
    }
    if (hash.startsWith("#/")) {
      return { serverId: "local", path: decodeURIComponent(hash.slice(2)) };
    }
    if (hash.startsWith("#") && hash.length > 1) {
      return { serverId: "local", path: decodeURIComponent(hash.slice(1)) };
    }
    return { serverId: "local", path: "" };
  }

  // Application State
  const state = {
    activeServerId: "local",
    remoteServers: [],
    currentPath: "",
    items: [],
    breadcrumbs: [{ name: "Root", path: "" }],
    viewMode: localStorage.getItem("artifactory_view_mode") || "grid",
    theme: localStorage.getItem("artifactory_theme") || "dark",
    searchQuery: "",
    sortKey: "name",
    sortOrder: "asc",
    serverInfo: null,
    previewItem: null,
    activeDeletePath: null,
    activeRenamePath: null,
    isReadOnly: false,
    editorMode: false,
    editorOriginalContent: "",
    editorCurrentText: ""
  };

  // DOM Elements
  const el = {
    app: document.getElementById("app"),
    hostBadge: document.getElementById("hostBadge"),
    serverSelect: document.getElementById("serverSelect"),
    serversManagerBtn: document.getElementById("serversManagerBtn"),
    keysManagerBtn: document.getElementById("keysManagerBtn"),
    remoteServerBanner: document.getElementById("remoteServerBanner"),
    remoteServerBannerName: document.getElementById("remoteServerBannerName"),
    remoteServerBannerUrl: document.getElementById("remoteServerBannerUrl"),
    exitRemoteServerBtn: document.getElementById("exitRemoteServerBtn"),
    searchInput: document.getElementById("searchInput"),
    clearSearchBtn: document.getElementById("clearSearchBtn"),
    uploadBtn: document.getElementById("uploadBtn"),
    fileInput: document.getElementById("fileInput"),
    newFileBtn: document.getElementById("newFileBtn"),
    newFolderBtn: document.getElementById("newFolderBtn"),
    refreshBtn: document.getElementById("refreshBtn"),
    gridViewBtn: document.getElementById("gridViewBtn"),
    listViewBtn: document.getElementById("listViewBtn"),
    themeToggleBtn: document.getElementById("themeToggleBtn"),
    themeIconSun: document.getElementById("themeIconSun"),
    themeIconMoon: document.getElementById("themeIconMoon"),
    navUpBtn: document.getElementById("navUpBtn"),
    breadcrumbs: document.getElementById("breadcrumbs"),
    copyCurrentPathBtn: document.getElementById("copyCurrentPathBtn"),
    dropOverlay: document.getElementById("dropOverlay"),
    uploadProgressContainer: document.getElementById("uploadProgressContainer"),
    uploadStatusTitle: document.getElementById("uploadStatusTitle"),
    uploadProgressBar: document.getElementById("uploadProgressBar"),
    uploadItemsList: document.getElementById("uploadItemsList"),
    closeUploadProgressBtn: document.getElementById("closeUploadProgressBtn"),
    explorerMain: document.getElementById("explorerMain"),
    filesContainer: document.getElementById("filesContainer"),
    loadingState: document.getElementById("loadingState"),
    emptyState: document.getElementById("emptyState"),
    itemsSummary: document.getElementById("itemsSummary"),
    storageInfo: document.getElementById("storageInfo"),
    // Preview & Editor Modal
    previewModal: document.getElementById("previewModal"),
    previewTitle: document.getElementById("previewTitle"),
    previewBody: document.getElementById("previewBody"),
    previewPath: document.getElementById("previewPath"),
    previewSize: document.getElementById("previewSize"),
    previewMtime: document.getElementById("previewMtime"),
    previewMime: document.getElementById("previewMime"),
    previewDirectLinkInput: document.getElementById("previewDirectLinkInput"),
    previewCopyUrlBtn: document.getElementById("previewCopyUrlBtn"),
    previewCopyInputBtn: document.getElementById("previewCopyInputBtn"),
    previewDownloadBtn: document.getElementById("previewDownloadBtn"),
    previewEditBtn: document.getElementById("previewEditBtn"),
    previewEditBtnText: document.getElementById("previewEditBtnText"),
    previewSaveBtn: document.getElementById("previewSaveBtn"),
    closePreviewModalBtn: document.getElementById("closePreviewModalBtn"),
    // Remote Servers Modal
    serversModal: document.getElementById("serversModal"),
    closeServersModalBtn: document.getElementById("closeServersModalBtn"),
    serversListContainer: document.getElementById("serversListContainer"),
    addServerForm: document.getElementById("addServerForm"),
    serverDisplayNameInput: document.getElementById("serverDisplayNameInput"),
    serverUrlInput: document.getElementById("serverUrlInput"),
    serverApiKeyInput: document.getElementById("serverApiKeyInput"),
    cfClientIdInput: document.getElementById("cfClientIdInput"),
    cfClientSecretInput: document.getElementById("cfClientSecretInput"),
    testServerBtn: document.getElementById("testServerBtn"),
    submitServerBtn: document.getElementById("submitServerBtn"),
    // API Keys Modal
    keysModal: document.getElementById("keysModal"),
    closeKeysModalBtn: document.getElementById("closeKeysModalBtn"),
    keysListContainer: document.getElementById("keysListContainer"),
    generateKeyForm: document.getElementById("generateKeyForm"),
    keyNameInput: document.getElementById("keyNameInput"),
    newKeyAlertBox: document.getElementById("newKeyAlertBox"),
    newKeyDisplayInput: document.getElementById("newKeyDisplayInput"),
    copyNewKeyBtn: document.getElementById("copyNewKeyBtn"),
    // New File Modal
    newFileModal: document.getElementById("newFileModal"),
    newFileForm: document.getElementById("newFileForm"),
    newFileNameInput: document.getElementById("newFileNameInput"),
    cancelNewFileBtn: document.getElementById("cancelNewFileBtn"),
    closeNewFileModalBtn: document.getElementById("closeNewFileModalBtn"),
    submitNewFileBtn: document.getElementById("submitNewFileBtn"),
    // New Folder Modal
    newFolderModal: document.getElementById("newFolderModal"),
    newFolderForm: document.getElementById("newFolderForm"),
    newFolderNameInput: document.getElementById("newFolderNameInput"),
    cancelNewFolderBtn: document.getElementById("cancelNewFolderBtn"),
    closeNewFolderModalBtn: document.getElementById("closeNewFolderModalBtn"),
    // Rename Modal
    renameModal: document.getElementById("renameModal"),
    renameForm: document.getElementById("renameForm"),
    renameInput: document.getElementById("renameInput"),
    cancelRenameBtn: document.getElementById("cancelRenameBtn"),
    closeRenameModalBtn: document.getElementById("closeRenameModalBtn"),
    // Delete Modal
    deleteModal: document.getElementById("deleteModal"),
    deleteConfirmMessage: document.getElementById("deleteConfirmMessage"),
    cancelDeleteBtn: document.getElementById("cancelDeleteBtn"),
    confirmDeleteBtn: document.getElementById("confirmDeleteBtn"),
    closeDeleteModalBtn: document.getElementById("closeDeleteModalBtn"),
    // Toast Container
    toastContainer: document.getElementById("toastContainer")
  };

  // API Client Helper
  function getApiUrl(endpoint, params = {}) {
    const base = getBasePath();
    const isPhp = window.location.pathname.endsWith(".php") || !window.__ingress_path;
    let url = "";

    if (state.activeServerId === "local") {
      if (isPhp) {
        url = base + "/api.php?action=" + encodeURIComponent(endpoint);
      } else {
        url = base + "/api/" + endpoint;
      }
    } else {
      if (isPhp) {
        url = base + "/api.php?action=remote&server_id=" + encodeURIComponent(state.activeServerId) + "&sub_action=" + encodeURIComponent(endpoint);
      } else {
        url = base + "/api/remote/" + encodeURIComponent(state.activeServerId) + "/" + endpoint;
      }
    }

    const queryParams = new URLSearchParams();
    Object.keys(params).forEach(k => {
      if (params[k] !== undefined && params[k] !== null && params[k] !== "") {
        queryParams.append(k, params[k]);
      }
    });

    const queryString = queryParams.toString();
    if (!queryString) return url;
    return url.includes("?") ? (url + "&" + queryString) : (url + "?" + queryString);
  }

  async function apiRequest(endpoint, options = {}) {
    const method = options.method || "GET";
    const url = getApiUrl(endpoint, options.params || {});
    const fetchOptions = {
      method,
      headers: options.headers || {}
    };

    if (options.body) {
      if (options.body instanceof FormData) {
        fetchOptions.body = options.body;
      } else {
        fetchOptions.headers["Content-Type"] = "application/json";
        fetchOptions.body = JSON.stringify(options.body);
      }
    }

    try {
      const response = await fetch(url, fetchOptions);
      const data = await response.json();
      if (!response.ok || data.success === false) {
        throw new Error(data.error || ("Request failed with status " + response.status));
      }
      return data;
    } catch (err) {
      console.error("API Error [" + endpoint + "]:", err);
      throw err;
    }
  }

  // Toast Notifications
  function showToast(message, type = "info", duration = 3500) {
    if (!el.toastContainer) return;
    const msgText = String(message || (type === "error" ? "An error occurred" : "")).trim();
    if (!msgText) return;

    const toast = document.createElement("div");
    toast.className = "toast " + type;

    let iconSvg = "";
    if (type === "success") {
      iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
    } else if (type === "error") {
      iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
    } else {
      iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
    }

    toast.innerHTML = iconSvg + "<span>" + escapeHtml(msgText) + "</span>";
    el.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(100%)";
      toast.style.transition = "all 0.25s ease";
      setTimeout(() => toast.remove(), 250);
    }, duration);
  }

  function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = String(text);
    return div.innerHTML;
  }

  function copyToClipboard(text, successMsg = "Copied to clipboard!") {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => {
        showToast(successMsg, "success");
      }).catch(() => fallbackCopy(text, successMsg));
    } else {
      fallbackCopy(text, successMsg);
    }
  }

  function fallbackCopy(text, successMsg) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand("copy");
      showToast(successMsg, "success");
    } catch (err) {
      showToast("Failed to copy link", "error");
    }
    document.body.removeChild(textArea);
  }

  function isTextFile(item) {
    if (!item || item.type === "dir" || item.type === "directory") return false;
    const ext = (item.ext || "").toLowerCase();
    const mime = (item.mime || "").toLowerCase();
    return TEXT_EXTS.includes(ext) || mime.startsWith("text/") || mime === "application/json" || mime === "application/yaml" || mime === "application/javascript" || mime === "image/svg+xml";
  }

  function getFileIconSvg(item) {
    const isDir = item.type === "dir" || item.type === "directory";
    if (isDir) {
      return '<svg class="folder-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>';
    }

    const ext = (item.ext || "").toLowerCase();
    const mime = (item.mime || "").toLowerCase();

    if (IMAGE_EXTS.includes(ext) || mime.startsWith("image/")) {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>';
    }
    if (VIDEO_EXTS.includes(ext) || mime.startsWith("video/")) {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>';
    }
    if (AUDIO_EXTS.includes(ext) || mime.startsWith("audio/")) {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>';
    }
    if (["js", "ts", "py", "sh", "css", "html", "json", "yaml", "yml", "sql", "xml", "pem", "toml", "conf"].includes(ext)) {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>';
    }
    if (["zip", "tar", "gz", "bz2", "7z", "rar"].includes(ext) || mime.includes("zip") || mime.includes("compressed")) {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"></polyline><line x1="1" y1="3" x2="23" y2="3"></line><line x1="10" y1="12" x2="14" y2="12"></line></svg>';
    }
    if (ext === "pdf" || mime === "application/pdf") {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>';
    }

    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>';
  }

  function getAccessBadgeHtml(item) {
    const isWritable = item.writable === true || (item.writable === undefined && !item.is_protected);
    if (isWritable) {
      return '<span class="access-badge badge-write" title="Write access (Upload, Edit, Delete)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg><span>Write</span></span>';
    }
    return '<span class="access-badge badge-read" title="Read-only access (Browse, Preview, Download)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg><span>Read</span></span>';
  }

  function getAccessPillHtml(item) {
    const isWritable = item.writable === true || (item.writable === undefined && !item.is_protected);
    if (isWritable) {
      return '<span class="access-pill pill-write" title="Write access (Upload, Edit, Delete)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg><span>Write</span></span>';
    }
    return '<span class="access-pill pill-read" title="Read-only access (Browse, Preview, Download)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg><span>Read</span></span>';
  }

  // Load Folder Content
  async function loadDirectory(path = "", pushHistory = true) {
    path = (path || "").replace(/^\/+/, "").replace(/\/+$/, "");
    state.currentPath = path;

    if (pushHistory) {
      let newHash = "";
      if (state.activeServerId === "local") {
        newHash = path ? ("#/" + path) : "#";
      } else {
        newHash = path ? ("#@" + state.activeServerId + "/" + path) : ("#@" + state.activeServerId);
      }
      if (window.location.hash !== newHash) {
        history.pushState({ serverId: state.activeServerId, path }, "", newHash);
      }
    }

    if (el.loadingState) el.loadingState.style.display = "flex";
    if (el.emptyState) el.emptyState.style.display = "none";
    if (el.filesContainer) el.filesContainer.style.display = "none";

    try {
      const data = await apiRequest("list", { params: { path } });
      state.items = data.items || [];
      state.breadcrumbs = data.breadcrumbs || [{ name: "Root", path: "" }];

      if (!state.currentPath && state.activeServerId === "local") {
        state.isReadOnly = false;
      } else if (state.items.length > 0) {
        state.isReadOnly = state.items[0].writable === false || state.items[0].is_protected;
      } else if (data.writable !== undefined) {
        state.isReadOnly = !data.writable;
      } else {
        state.isReadOnly = false;
      }

      renderBreadcrumbs();
      renderItems(data.message);
      updateActionButtons();
    } catch (err) {
      showToast(err.message, "error");

      if (!state.breadcrumbs || state.breadcrumbs.length === 0 || state.breadcrumbs[state.breadcrumbs.length - 1].path !== path) {
        const parts = path.split("/").filter(Boolean);
        const fallbackBcs = [{ name: "Root", path: "" }];
        let accum = "";
        parts.forEach(p => {
          accum = accum ? (accum + "/" + p) : p;
          fallbackBcs.push({ name: p, path: accum });
        });
        state.breadcrumbs = fallbackBcs;
      }
      renderBreadcrumbs();
      renderErrorState(err.message);
    } finally {
      if (el.loadingState) el.loadingState.style.display = "none";
    }
  }

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
        <p>${escapeHtml(errorMessage || "This folder could not be found or opened.")}</p>
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
    el.filesContainer.style.display = "block";
    if (el.emptyState) el.emptyState.style.display = "none";
  }

  window.__artifactory_loadRoot = function () {
    loadDirectory("");
  };

  async function loadServerInfo() {
    try {
      const data = await apiRequest("info");
      state.serverInfo = data;
      if (el.storageInfo && data.storage && data.storage.free_formatted) {
        el.storageInfo.textContent = "Storage: Free " + data.storage.free_formatted + " / " + data.storage.total_formatted;
      }
      if (el.hostBadge && data.server) {
        el.hostBadge.textContent = (data.server.name || "Artifactory") + " v" + (data.server.version || "1.1.5");
      }
    } catch (err) {
      console.warn("Could not load server info:", err);
    }
  }

  function updateActionButtons() {
    const canWrite = !state.isReadOnly;

    if (el.newFileBtn) {
      el.newFileBtn.disabled = !canWrite;
      el.newFileBtn.style.opacity = canWrite ? "1" : "0.4";
      el.newFileBtn.style.cursor = canWrite ? "pointer" : "not-allowed";
    }
    if (el.newFolderBtn) {
      el.newFolderBtn.disabled = !canWrite;
      el.newFolderBtn.style.opacity = canWrite ? "1" : "0.4";
      el.newFolderBtn.style.cursor = canWrite ? "pointer" : "not-allowed";
    }
    if (el.uploadBtn) {
      el.uploadBtn.disabled = !canWrite;
      el.uploadBtn.style.opacity = canWrite ? "1" : "0.4";
      el.uploadBtn.style.cursor = canWrite ? "pointer" : "not-allowed";
    }
  }

  function renderBreadcrumbs() {
    if (!el.breadcrumbs) return;
    el.breadcrumbs.innerHTML = "";
    state.breadcrumbs.forEach((bc, idx) => {
      if (idx > 0) {
        const sep = document.createElement("span");
        sep.className = "breadcrumb-sep";
        sep.textContent = "/";
        el.breadcrumbs.appendChild(sep);
      }

      const item = document.createElement("div");
      item.className = "breadcrumb-item " + (idx === state.breadcrumbs.length - 1 ? "active" : "");
      item.textContent = bc.name;
      if (idx !== state.breadcrumbs.length - 1) {
        item.addEventListener("click", () => loadDirectory(bc.path));
      }
      el.breadcrumbs.appendChild(item);
    });

    if (el.navUpBtn) {
      el.navUpBtn.disabled = state.breadcrumbs.length <= 1;
    }
  }

  function getProcessedItems() {
    let list = [...state.items];

    if (state.searchQuery.trim() !== "") {
      const query = state.searchQuery.toLowerCase();
      list = list.filter(item => item.name.toLowerCase().includes(query));
    }

    list.sort((a, b) => {
      const isDir = (a.type === "dir" || a.type === "directory");
      const isDirB = (b.type === "dir" || b.type === "directory");
      if (isDir && !isDirB) return -1;
      if (!isDir && isDirB) return 1;

      let valA = a[state.sortKey] || "";
      let valB = b[state.sortKey] || "";
      if (typeof valA === "string") {
        const cmp = valA.localeCompare(valB, undefined, { sensitivity: "base" });
        return state.sortOrder === "asc" ? cmp : -cmp;
      }
      const cmp = valA < valB ? -1 : (valA > valB ? 1 : 0);
      return state.sortOrder === "asc" ? cmp : -cmp;
    });

    return list;
  }

  function renderItems(customMessage = null) {
    if (!el.filesContainer) return;
    const items = getProcessedItems();
    el.filesContainer.innerHTML = "";

    const dirCount = items.filter(i => i.type === "dir" || i.type === "directory").length;
    const fileCount = items.filter(i => i.type === "file").length;
    if (el.itemsSummary) {
      el.itemsSummary.textContent = items.length + " items (" + dirCount + " folders, " + fileCount + " files)";
    }

    if (items.length === 0) {
      if (el.emptyState) {
        el.emptyState.style.display = "flex";
        const p = el.emptyState.querySelector("p");
        if (p) p.textContent = customMessage || "Drag and drop files here, or click the Upload or New File button to host resources.";
      }
      el.filesContainer.style.display = "none";
      return;
    }

    if (el.emptyState) el.emptyState.style.display = "none";
    el.filesContainer.style.display = state.viewMode === "grid" ? "grid" : "flex";
    el.filesContainer.className = "files-container " + state.viewMode + "-view";

    if (state.viewMode === "grid") {
      renderGridView(items);
    } else {
      renderListView(items);
    }
  }

  function renderGridView(items) {
    items.forEach(item => {
      const isDir = item.type === "dir" || item.type === "directory";
      const card = document.createElement("div");
      card.className = "file-card";
      card.title = item.fs_path || item.path || item.name;

      const ext = (item.ext || "").toLowerCase();
      const mime = (item.mime || "").toLowerCase();
      const isImage = !isDir && (IMAGE_EXTS.includes(ext) || mime.startsWith("image/"));
      let previewHtml = "";

      const downloadUrl = getApiUrl("download", { path: item.path, inline: "true" });

      if (isImage) {
        previewHtml = '<div class="file-card-preview"><img src="' + downloadUrl + '" alt="' + escapeHtml(item.name) + '" loading="lazy"></div>';
      } else {
        previewHtml = '<div class="file-card-preview"><div class="file-card-icon ' + (isDir ? "folder-icon" : "") + '">' + getFileIconSvg(item) + '</div></div>';
      }

      const canWrite = item.writable !== false && !item.is_protected && !state.isReadOnly;
      const canEdit = !isDir && isTextFile(item) && canWrite;
      const badgeHtml = getAccessBadgeHtml(item);

      card.innerHTML = `
        ${badgeHtml}
        ${previewHtml}
        <div class="file-card-info">
          <div class="file-card-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
          <div class="file-card-meta">
            <span>${item.size_formatted || ""}</span>
            <span>${item.mtime_formatted ? item.mtime_formatted.split(" ")[0] : ""}</span>
          </div>
        </div>
        <div class="file-card-actions">
          ${item.ha_url ? `
          <button class="btn-icon small copy-ha-btn" title="Copy HA /local/ URL">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          </button>` : ""}
          ${canEdit ? `
          <button class="btn-icon small edit-file-btn" title="Edit in browser">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>` : ""}
          ${!isDir ? `
          <button class="btn-icon small download-btn" title="Download">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          </button>` : ""}
          ${canWrite ? `
          <button class="btn-icon small rename-btn" title="Rename">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
          <button class="btn-icon small delete-btn" title="Delete">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>` : ""}
        </div>
      `;

      card.addEventListener("click", (e) => {
        if (e.target.closest(".file-card-actions") || e.target.closest(".access-badge")) return;
        if (isDir) {
          loadDirectory(item.path);
        } else {
          openPreview(item);
        }
      });

      const copyHaBtn = card.querySelector(".copy-ha-btn");
      if (copyHaBtn) copyHaBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const link = item.ha_url || getApiUrl("download", { path: item.path });
        copyToClipboard(link, "HA URL copied: \"" + link + "\"");
      });

      const editFileBtn = card.querySelector(".edit-file-btn");
      if (editFileBtn) editFileBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openPreview(item, true);
      });

      const downloadBtn = card.querySelector(".download-btn");
      if (downloadBtn) downloadBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        triggerDownload(item);
      });

      const renameBtn = card.querySelector(".rename-btn");
      if (renameBtn) renameBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openRenameModal(item);
      });

      const deleteBtn = card.querySelector(".delete-btn");
      if (deleteBtn) deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openDeleteModal(item);
      });

      el.filesContainer.appendChild(card);
    });
  }

  function renderListView(items) {
    const table = document.createElement("table");
    table.className = "list-table";
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

    const tbody = table.querySelector("tbody");

    items.forEach(item => {
      const isDir = item.type === "dir" || item.type === "directory";
      const tr = document.createElement("tr");
      const canWrite = item.writable !== false && !item.is_protected && !state.isReadOnly;
      const canEdit = !isDir && isTextFile(item) && canWrite;
      const accessPill = getAccessPillHtml(item);

      tr.innerHTML = `
        <td>
          <div class="list-item-name-cell">
            <div class="list-item-icon ${isDir ? "folder-icon" : ""}">${getFileIconSvg(item)}</div>
            <div style="min-width: 0;">
              <div style="font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
            </div>
          </div>
        </td>
        <td>${accessPill}</td>
        <td>${item.size_formatted || "-"}</td>
        <td>${item.mtime_formatted || "-"}</td>
        <td class="list-actions-cell">
          <div class="btn-group">
            ${item.ha_url ? `
            <button class="btn-icon small copy-ha-btn" title="Copy HA /local/ URL">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </button>` : ""}
            ${canEdit ? `
            <button class="btn-icon small edit-file-btn" title="Edit in browser">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>` : ""}
            ${!isDir ? `
            <button class="btn-icon small download-btn" title="Download">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            </button>` : ""}
            ${canWrite ? `
            <button class="btn-icon small rename-btn" title="Rename">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <button class="btn-icon small delete-btn" title="Delete">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>` : ""}
          </div>
        </td>
      `;

      tr.addEventListener("click", (e) => {
        if (e.target.closest(".btn-group") || e.target.closest(".btn-icon")) return;
        if (isDir) {
          loadDirectory(item.path);
        } else {
          openPreview(item);
        }
      });

      const copyHaBtn = tr.querySelector(".copy-ha-btn");
      if (copyHaBtn) copyHaBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const link = item.ha_url || getApiUrl("download", { path: item.path });
        copyToClipboard(link, "HA URL copied: \"" + link + "\"");
      });

      const editFileBtn = tr.querySelector(".edit-file-btn");
      if (editFileBtn) editFileBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openPreview(item, true);
      });

      const downloadBtn = tr.querySelector(".download-btn");
      if (downloadBtn) downloadBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        triggerDownload(item);
      });

      const renameBtn = tr.querySelector(".rename-btn");
      if (renameBtn) renameBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openRenameModal(item);
      });

      const deleteBtn = tr.querySelector(".delete-btn");
      if (deleteBtn) deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openDeleteModal(item);
      });

      tbody.appendChild(tr);
    });

    table.querySelectorAll("th[data-sort]").forEach(th => {
      th.addEventListener("click", () => {
        const key = th.getAttribute("data-sort");
        if (state.sortKey === key) {
          state.sortOrder = state.sortOrder === "asc" ? "desc" : "asc";
        } else {
          state.sortKey = key;
          state.sortOrder = "asc";
        }
        renderItems();
      });
    });

    el.filesContainer.appendChild(table);
  }

  function triggerDownload(item) {
    const downloadUrl = getApiUrl("download", { path: item.path });
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = item.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function enterEditorMode(initialText) {
    state.editorMode = true;
    state.editorCurrentText = initialText;
    if (el.previewEditBtnText) el.previewEditBtnText.textContent = "View Preview";
    if (el.previewSaveBtn) el.previewSaveBtn.style.display = "inline-flex";

    el.previewBody.innerHTML = `
      <div class="code-editor-container">
        <div class="code-editor-toolbar">
          <span class="code-editor-status" id="editorStatus">Line 1, Col 1</span>
          <div class="code-editor-tools">
            <label class="wrap-label"><input type="checkbox" id="editorWrapToggle"> Wrap Lines</label>
            <span class="editor-shortcut-hint">Ctrl+S / ⌘S to save</span>
          </div>
        </div>
        <div class="code-editor-wrapper">
          <div class="code-editor-gutter" id="editorGutter">1</div>
          <textarea id="codeEditorTextarea" class="code-editor-textarea" spellcheck="false" autocomplete="off" autocapitalize="off"></textarea>
        </div>
      </div>
    `;

    const textarea = document.getElementById("codeEditorTextarea");
    const gutter = document.getElementById("editorGutter");
    const status = document.getElementById("editorStatus");
    const wrapToggle = document.getElementById("editorWrapToggle");

    if (!textarea) return;

    textarea.value = initialText;

    function updateGutter() {
      const lineCount = (textarea.value.match(/\n/g) || []).length + 1;
      const lines = [];
      for (let i = 1; i <= lineCount; i++) lines.push(i);
      gutter.textContent = lines.join("\n");
    }

    function updateCursorStatus() {
      const selStart = textarea.selectionStart;
      const val = textarea.value.slice(0, selStart);
      const line = (val.match(/\n/g) || []).length + 1;
      const col = selStart - val.lastIndexOf("\n");
      status.textContent = "Line " + line + ", Col " + col;
    }

    updateGutter();
    updateCursorStatus();

    textarea.addEventListener("input", () => {
      updateGutter();
      updateCursorStatus();
      state.editorCurrentText = textarea.value;
    });

    textarea.addEventListener("click", updateCursorStatus);
    textarea.addEventListener("keyup", updateCursorStatus);

    textarea.addEventListener("scroll", () => {
      gutter.scrollTop = textarea.scrollTop;
    });

    textarea.addEventListener("keydown", (e) => {
      if (e.key === "Tab") {
        e.preventDefault();
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        textarea.value = textarea.value.substring(0, start) + "  " + textarea.value.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + 2;
        updateGutter();
        updateCursorStatus();
        state.editorCurrentText = textarea.value;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveEditorContent();
      }
    });

    if (wrapToggle) {
      wrapToggle.addEventListener("change", () => {
        textarea.classList.toggle("wrap-text", wrapToggle.checked);
      });
    }

    textarea.focus();
  }

  function exitEditorModeToPreview() {
    state.editorMode = false;
    if (el.previewEditBtnText) el.previewEditBtnText.textContent = "Edit";
    if (el.previewSaveBtn) el.previewSaveBtn.style.display = "none";

    if (state.previewItem) {
      const ext = (state.previewItem.ext || "").toLowerCase();
      if (ext === "svg") {
        el.previewBody.innerHTML = `<div class="svg-live-preview" style="max-width: 100%; max-height: 50vh; display: flex; align-items: center; justify-content: center;">${state.editorCurrentText}</div>`;
        return;
      }
    }
    el.previewBody.innerHTML = "<pre class=\"preview-media-text\">" + escapeHtml(state.editorCurrentText) + "</pre>";
  }

  async function saveEditorContent() {
    if (!state.previewItem) return;
    const textarea = document.getElementById("codeEditorTextarea");
    const content = textarea ? textarea.value : state.editorCurrentText;

    if (el.previewSaveBtn) {
      el.previewSaveBtn.disabled = true;
      el.previewSaveBtn.innerHTML = "<span>Saving...</span>";
    }

    try {
      const res = await apiRequest("save", {
        method: "POST",
        body: { path: state.previewItem.path, content }
      });

      showToast("File saved successfully!", "success");
      state.editorOriginalContent = content;
      state.editorCurrentText = content;

      if (res.file) {
        state.previewItem.size = res.file.size;
        state.previewItem.size_formatted = res.file.size_formatted;
        state.previewItem.mtime_formatted = res.file.mtime_formatted;
        if (el.previewSize) el.previewSize.textContent = "Size: " + res.file.size_formatted;
        if (el.previewMtime) el.previewMtime.textContent = "Date: " + res.file.mtime_formatted;
      }

      loadDirectory(state.currentPath, false);
    } catch (err) {
      showToast("Failed to save file: " + err.message, "error");
    } finally {
      if (el.previewSaveBtn) {
        el.previewSaveBtn.disabled = false;
        el.previewSaveBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
            <polyline points="17 21 17 13 7 13 7 21"></polyline>
            <polyline points="7 3 7 8 15 8"></polyline>
          </svg>
          <span>Save</span>
        `;
      }
    }
  }

  async function openPreview(item, autoEdit = false) {
    state.previewItem = item;
    state.editorMode = false;
    state.editorOriginalContent = "";
    state.editorCurrentText = "";

    el.previewTitle.textContent = item.name;
    if (el.previewPath) el.previewPath.textContent = "Path: /" + item.path;
    el.previewSize.textContent = "Size: " + (item.size_formatted || "0 B");
    el.previewMtime.textContent = "Date: " + (item.mtime_formatted || "-");
    el.previewMime.textContent = "MIME: " + (item.mime || "unknown");

    const directUrl = item.ha_url || getApiUrl("download", { path: item.path });
    el.previewDirectLinkInput.value = directUrl;

    const previewUrl = getApiUrl("download", { path: item.path, inline: "true" });
    const ext = (item.ext || "").toLowerCase();
    const mime = (item.mime || "").toLowerCase();
    const isImage = IMAGE_EXTS.includes(ext) || mime.startsWith("image/");
    const isVideo = VIDEO_EXTS.includes(ext) || mime.startsWith("video/");
    const isAudio = AUDIO_EXTS.includes(ext) || mime.startsWith("audio/");
    const isPdf = ext === "pdf" || mime === "application/pdf";
    const isText = isTextFile(item);
    const canWrite = item.writable !== false && !item.is_protected && !state.isReadOnly;

    if (isText) {
      if (el.previewEditBtn) {
        el.previewEditBtn.style.display = "inline-flex";
        el.previewEditBtn.disabled = !canWrite;
        el.previewEditBtn.title = canWrite ? "Edit file in browser" : "File is read-only";
      }
      if (el.previewEditBtnText) el.previewEditBtnText.textContent = "Edit";
      if (el.previewSaveBtn) el.previewSaveBtn.style.display = "none";
    } else {
      if (el.previewEditBtn) el.previewEditBtn.style.display = "none";
      if (el.previewSaveBtn) el.previewSaveBtn.style.display = "none";
    }

    el.previewBody.innerHTML = "<div class=\"spinner\"></div>";
    el.previewModal.style.display = "flex";

    if (autoEdit && isText && canWrite) {
      try {
        const response = await fetch(previewUrl);
        const text = await response.text();
        state.editorOriginalContent = text;
        state.editorCurrentText = text;
        enterEditorMode(text);
      } catch (err) {
        el.previewBody.innerHTML = `<p class="warning-text">Failed to load text for editing: ${escapeHtml(err.message)}</p>`;
      }
      return;
    }

    if (isImage) {
      el.previewBody.innerHTML = `<img src="${previewUrl}" class="preview-media-img" alt="${escapeHtml(item.name)}">`;
    } else if (isVideo) {
      el.previewBody.innerHTML = `<video src="${previewUrl}" controls autoplay class="preview-media-video"></video>`;
    } else if (isAudio) {
      el.previewBody.innerHTML = `<audio src="${previewUrl}" controls autoplay class="preview-media-audio"></audio>`;
    } else if (isPdf) {
      el.previewBody.innerHTML = `<iframe src="${previewUrl}" class="preview-media-pdf"></iframe>`;
    } else if (isText) {
      try {
        const response = await fetch(previewUrl);
        const text = await response.text();
        state.editorOriginalContent = text;
        state.editorCurrentText = text;
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
    el.previewModal.style.display = "none";
    el.previewBody.innerHTML = "";
    state.previewItem = null;
    state.editorMode = false;
  }

  async function handleFilesUpload(files) {
    if (!files || files.length === 0) return;

    const formData = new FormData();
    formData.append("path", state.currentPath);

    for (let i = 0; i < files.length; i++) {
      formData.append("files", files[i]);
    }

    el.uploadProgressContainer.style.display = "block";
    el.uploadProgressBar.style.width = "0%";
    el.uploadStatusTitle.textContent = "Uploading " + files.length + " file(s)...";
    el.uploadItemsList.innerHTML = "";

    for (let i = 0; i < files.length; i++) {
      const row = document.createElement("div");
      row.className = "upload-item-row";
      row.innerHTML = `<span class="name">${escapeHtml(files[i].name)}</span><span class="status">Uploading...</span>`;
      el.uploadItemsList.appendChild(row);
    }

    try {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", getApiUrl("upload"), true);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          el.uploadProgressBar.style.width = percent + "%";
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
            let errMsg = "Upload failed";
            try {
              errMsg = JSON.parse(xhr.responseText).error || errMsg;
            } catch {}
            reject(new Error(errMsg));
          }
        };
        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.send(formData);
      });

      showToast("Uploaded " + files.length + " file(s) successfully!", "success");
      el.uploadStatusTitle.textContent = "Upload complete!";
      el.uploadProgressBar.style.width = "100%";
      loadDirectory(state.currentPath);
    } catch (err) {
      showToast(err.message, "error");
      el.uploadStatusTitle.textContent = "Upload failed";
    } finally {
      setTimeout(() => {
        el.uploadProgressContainer.style.display = "none";
      }, 3500);
    }
  }

  // Federation & Server Selector
  async function loadFederationServers() {
    try {
      const isPhp = window.location.pathname.endsWith(".php") || !window.__ingress_path;
      const url = isPhp ? (getBasePath() + "/api.php?action=servers_list") : (getBasePath() + "/api/federation/servers");
      const res = await fetch(url);
      const data = await res.json();
      if (data && data.servers) {
        state.remoteServers = data.servers;
        renderServerSelectOptions();
      }
    } catch (err) {
      console.warn("Could not load federation servers:", err);
    }
  }

  function renderServerSelectOptions() {
    if (!el.serverSelect) return;
    el.serverSelect.innerHTML = '<option value="local">📍 Local Server</option>';
    state.remoteServers.forEach(srv => {
      const opt = document.createElement("option");
      opt.value = srv.id;
      opt.textContent = "🌐 " + srv.display_name;
      el.serverSelect.appendChild(opt);
    });
    el.serverSelect.value = state.activeServerId;
  }

  function setActiveServer(serverId) {
    state.activeServerId = serverId;
    if (el.serverSelect) el.serverSelect.value = serverId;

    if (serverId === "local") {
      if (el.remoteServerBanner) el.remoteServerBanner.style.display = "none";
      loadDirectory("", true);
    } else {
      const srv = state.remoteServers.find(s => s.id === serverId);
      if (srv) {
        if (el.remoteServerBanner) {
          el.remoteServerBanner.style.display = "flex";
          if (el.remoteServerBannerName) el.remoteServerBannerName.textContent = srv.display_name;
          if (el.remoteServerBannerUrl) el.remoteServerBannerUrl.textContent = srv.url;
        }
      }
      loadDirectory("", true);
    }
  }

  // Modals: Servers Management
  async function openServersModal() {
    if (!el.serversModal) return;
    el.serversModal.style.display = "flex";
    loadServersModalList();
  }

  function closeServersModal() {
    if (el.serversModal) el.serversModal.style.display = "none";
  }

  async function loadServersModalList() {
    if (!el.serversListContainer) return;
    el.serversListContainer.innerHTML = '<div class="spinner"></div>';
    try {
      const isPhp = window.location.pathname.endsWith(".php") || !window.__ingress_path;
      const url = isPhp ? (getBasePath() + "/api.php?action=servers_list") : (getBasePath() + "/api/federation/servers");
      const res = await fetch(url);
      const data = await res.json();
      state.remoteServers = data.servers || [];
      renderServerSelectOptions();

      if (state.remoteServers.length === 0) {
        el.serversListContainer.innerHTML = '<p class="fed-empty">No remote servers added yet.</p>';
        return;
      }

      el.serversListContainer.innerHTML = "";
      state.remoteServers.forEach(srv => {
        const card = document.createElement("div");
        card.className = "fed-item-card";
        card.innerHTML = `
          <div class="fed-item-info">
            <span class="fed-item-name">🌐 ${escapeHtml(srv.display_name)}</span>
            <span class="fed-item-sub">${escapeHtml(srv.url)}</span>
          </div>
          <div class="fed-item-actions">
            <button class="btn btn-secondary small test-btn">Test</button>
            <button class="btn-icon small delete-btn" title="Remove server">&times;</button>
          </div>
        `;

        card.querySelector(".test-btn").addEventListener("click", async () => {
          showToast("Testing connection to " + srv.display_name + "...", "info");
          try {
            const isPhp = window.location.pathname.endsWith(".php") || !window.__ingress_path;
            const tUrl = isPhp ? (getBasePath() + "/api.php?action=server_test") : (getBasePath() + "/api/federation/servers/test");
            const tRes = await fetch(tUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ url: srv.url, api_key: srv.api_key, cf_client_id: srv.cf_client_id, cf_client_secret: srv.cf_client_secret })
            });
            const tData = await tRes.json();
            if (tData.success) {
              showToast("Connected to " + srv.display_name + " successfully!", "success");
            } else {
              showToast("Connection failed: " + tData.error, "error");
            }
          } catch (e) {
            showToast("Connection error: " + e.message, "error");
          }
        });

        card.querySelector(".delete-btn").addEventListener("click", async () => {
          if (!confirm("Remove server \"" + srv.display_name + "\"?")) return;
          try {
            const isPhp = window.location.pathname.endsWith(".php") || !window.__ingress_path;
            const delUrl = isPhp ? (getBasePath() + "/api.php?action=server_remove") : (getBasePath() + "/api/federation/servers/" + encodeURIComponent(srv.id));
            const delRes = await fetch(delUrl, {
              method: isPhp ? "POST" : "DELETE",
              headers: { "Content-Type": "application/json" },
              body: isPhp ? JSON.stringify({ id: srv.id }) : undefined
            });
            const delData = await delRes.json();
            if (delData.success) {
              showToast("Server removed", "success");
              if (state.activeServerId === srv.id) {
                setActiveServer("local");
              }
              loadServersModalList();
            }
          } catch (e) {
            showToast(e.message, "error");
          }
        });

        el.serversListContainer.appendChild(card);
      });
    } catch (err) {
      el.serversListContainer.innerHTML = "<p class=\"warning-text\">" + err.message + "</p>";
    }
  }

  // Modals: API Keys Management
  async function openKeysModal() {
    if (!el.keysModal) return;
    if (el.newKeyAlertBox) el.newKeyAlertBox.style.display = "none";
    el.keysModal.style.display = "flex";
    loadKeysModalList();
  }

  function closeKeysModal() {
    if (el.keysModal) el.keysModal.style.display = "none";
  }

  async function loadKeysModalList() {
    if (!el.keysListContainer) return;
    el.keysListContainer.innerHTML = '<div class="spinner"></div>';
    try {
      const isPhp = window.location.pathname.endsWith(".php") || !window.__ingress_path;
      const url = isPhp ? (getBasePath() + "/api.php?action=federation_keys_list") : (getBasePath() + "/api/federation/keys");
      const res = await fetch(url);
      const data = await res.json();
      const keys = data.keys || [];

      if (keys.length === 0) {
        el.keysListContainer.innerHTML = '<p class="fed-empty">No API keys generated yet.</p>';
        return;
      }

      el.keysListContainer.innerHTML = "";
      keys.forEach(k => {
        const card = document.createElement("div");
        card.className = "fed-item-card";
        card.innerHTML = `
          <div class="fed-item-info">
            <span class="fed-item-name">🔑 ${escapeHtml(k.name)}</span>
            <span class="fed-item-sub">${escapeHtml(k.key_preview)} &bull; Created ${k.created_at}</span>
          </div>
          <div class="fed-item-actions">
            <button class="btn btn-danger small revoke-btn">Revoke</button>
          </div>
        `;

        card.querySelector(".revoke-btn").addEventListener("click", async () => {
          if (!confirm("Revoke key for \"" + k.name + "\"? Remote clients using this key will immediately lose access.")) return;
          try {
            const isPhp = window.location.pathname.endsWith(".php") || !window.__ingress_path;
            const delUrl = isPhp ? (getBasePath() + "/api.php?action=federation_key_revoke") : (getBasePath() + "/api/federation/keys/" + encodeURIComponent(k.id));
            const delRes = await fetch(delUrl, {
              method: isPhp ? "POST" : "DELETE",
              headers: { "Content-Type": "application/json" },
              body: isPhp ? JSON.stringify({ id: k.id }) : undefined
            });
            const delData = await delRes.json();
            if (delData.success) {
              showToast("Key revoked", "success");
              loadKeysModalList();
            }
          } catch (e) {
            showToast(e.message, "error");
          }
        });

        el.keysListContainer.appendChild(card);
      });
    } catch (err) {
      el.keysListContainer.innerHTML = "<p class=\"warning-text\">" + err.message + "</p>";
    }
  }

  // Modals: New File
  function openNewFileModal() {
    if (state.isReadOnly) return;
    el.newFileNameInput.value = "";
    el.newFileModal.style.display = "flex";
    el.newFileNameInput.focus();
  }

  function closeNewFileModal() {
    el.newFileModal.style.display = "none";
  }

  // Modals: New Folder
  function openNewFolderModal() {
    if (state.isReadOnly) return;
    el.newFolderNameInput.value = "";
    el.newFolderModal.style.display = "flex";
    el.newFolderNameInput.focus();
  }

  function closeNewFolderModal() {
    el.newFolderModal.style.display = "none";
  }

  function openRenameModal(item) {
    state.activeRenamePath = item.path;
    el.renameInput.value = item.name;
    el.renameModal.style.display = "flex";
    el.renameInput.focus();
  }

  function closeRenameModal() {
    el.renameModal.style.display = "none";
    state.activeRenamePath = null;
  }

  function openDeleteModal(item) {
    state.activeDeletePath = item.path;
    el.deleteConfirmMessage.textContent = "Are you sure you want to delete \"" + item.name + "\"?";
    el.deleteModal.style.display = "flex";
  }

  function closeDeleteModal() {
    el.deleteModal.style.display = "none";
    state.activeDeletePath = null;
  }

  function setupEventListeners() {
    if (el.serverSelect) {
      el.serverSelect.addEventListener("change", (e) => {
        setActiveServer(e.target.value);
      });
    }

    if (el.exitRemoteServerBtn) {
      el.exitRemoteServerBtn.addEventListener("click", () => {
        setActiveServer("local");
      });
    }

    if (el.serversManagerBtn) el.serversManagerBtn.addEventListener("click", openServersModal);
    if (el.closeServersModalBtn) el.closeServersModalBtn.addEventListener("click", closeServersModal);

    if (el.testServerBtn) {
      el.testServerBtn.addEventListener("click", async () => {
        const url = el.serverUrlInput.value.trim();
        const apiKey = el.serverApiKeyInput.value.trim();
        const cfId = el.cfClientIdInput ? el.cfClientIdInput.value.trim() : "";
        const cfSecret = el.cfClientSecretInput ? el.cfClientSecretInput.value.trim() : "";

        if (!url) {
          showToast("Please enter a server URL", "error");
          return;
        }

        el.testServerBtn.disabled = true;
        el.testServerBtn.textContent = "Testing...";

        try {
          const isPhp = window.location.pathname.endsWith(".php") || !window.__ingress_path;
          const tUrl = isPhp ? (getBasePath() + "/api.php?action=server_test") : (getBasePath() + "/api/federation/servers/test");
          const res = await fetch(tUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url, api_key: apiKey, cf_client_id: cfId, cf_client_secret: cfSecret })
          });
          const data = await res.json();
          if (data.success) {
            showToast("Connection verified successfully!", "success");
          } else {
            showToast("Connection test failed: " + data.error, "error");
          }
        } catch (err) {
          showToast("Test error: " + err.message, "error");
        } finally {
          el.testServerBtn.disabled = false;
          el.testServerBtn.textContent = "Test Connection";
        }
      });
    }

    if (el.addServerForm) {
      el.addServerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const displayName = el.serverDisplayNameInput.value.trim();
        const url = el.serverUrlInput.value.trim();
        const apiKey = el.serverApiKeyInput.value.trim();
        const cfId = el.cfClientIdInput ? el.cfClientIdInput.value.trim() : "";
        const cfSecret = el.cfClientSecretInput ? el.cfClientSecretInput.value.trim() : "";

        if (!displayName || !url) return;

        if (el.submitServerBtn) {
          el.submitServerBtn.disabled = true;
          el.submitServerBtn.textContent = "Adding...";
        }

        try {
          const isPhp = window.location.pathname.endsWith(".php") || !window.__ingress_path;
          const sUrl = isPhp ? (getBasePath() + "/api.php?action=server_add") : (getBasePath() + "/api/federation/servers");
          const res = await fetch(sUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              display_name: displayName,
              url,
              api_key: apiKey,
              cf_client_id: cfId,
              cf_client_secret: cfSecret
            })
          });
          const data = await res.json();
          if (data.success) {
            showToast("Remote server \"" + displayName + "\" added!", "success");
            el.serverDisplayNameInput.value = "";
            el.serverUrlInput.value = "";
            el.serverApiKeyInput.value = "";
            if (el.cfClientIdInput) el.cfClientIdInput.value = "";
            if (el.cfClientSecretInput) el.cfClientSecretInput.value = "";
            loadServersModalList();
          } else {
            showToast(data.error || "Failed to add server", "error");
          }
        } catch (err) {
          showToast(err.message, "error");
        } finally {
          if (el.submitServerBtn) {
            el.submitServerBtn.disabled = false;
            el.submitServerBtn.textContent = "Add Server";
          }
        }
      });
    }

    if (el.keysManagerBtn) el.keysManagerBtn.addEventListener("click", openKeysModal);
    if (el.closeKeysModalBtn) el.closeKeysModalBtn.addEventListener("click", closeKeysModal);

    if (el.generateKeyForm) {
      el.generateKeyForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = el.keyNameInput.value.trim();
        if (!name) return;

        try {
          const isPhp = window.location.pathname.endsWith(".php") || !window.__ingress_path;
          const kUrl = isPhp ? (getBasePath() + "/api.php?action=federation_key_generate") : (getBasePath() + "/api/federation/keys");
          const res = await fetch(kUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name })
          });
          const data = await res.json();
          if (data.success && data.key) {
            showToast("API Key created!", "success");
            el.keyNameInput.value = "";
            if (el.newKeyAlertBox && el.newKeyDisplayInput) {
              el.newKeyDisplayInput.value = data.key.key;
              el.newKeyAlertBox.style.display = "block";
            }
            loadKeysModalList();
          } else {
            showToast(data.error || "Failed to generate key", "error");
          }
        } catch (err) {
          showToast(err.message, "error");
        }
      });
    }

    if (el.copyNewKeyBtn && el.newKeyDisplayInput) {
      el.copyNewKeyBtn.addEventListener("click", () => {
        copyToClipboard(el.newKeyDisplayInput.value, "API Key copied to clipboard");
      });
    }

    if (el.navUpBtn) {
      el.navUpBtn.addEventListener("click", () => {
        if (state.breadcrumbs.length > 1) {
          const parentBc = state.breadcrumbs[state.breadcrumbs.length - 2];
          loadDirectory(parentBc.path);
        }
      });
    }

    if (el.copyCurrentPathBtn) {
      el.copyCurrentPathBtn.addEventListener("click", () => {
        const fullUrl = window.location.href;
        copyToClipboard(fullUrl, "Folder URL copied to clipboard");
      });
    }

    if (el.searchInput) {
      el.searchInput.addEventListener("input", (e) => {
        state.searchQuery = e.target.value;
        if (el.clearSearchBtn) {
          el.clearSearchBtn.style.display = state.searchQuery ? "block" : "none";
        }
        renderItems();
      });
    }

    if (el.clearSearchBtn) {
      el.clearSearchBtn.addEventListener("click", () => {
        el.searchInput.value = "";
        state.searchQuery = "";
        el.clearSearchBtn.style.display = "none";
        renderItems();
      });
    }

    if (el.refreshBtn) {
      el.refreshBtn.addEventListener("click", () => {
        loadDirectory(state.currentPath);
        loadServerInfo();
      });
    }

    if (el.gridViewBtn && el.listViewBtn) {
      el.gridViewBtn.addEventListener("click", () => {
        state.viewMode = "grid";
        localStorage.setItem("artifactory_view_mode", "grid");
        el.gridViewBtn.classList.add("active");
        el.listViewBtn.classList.remove("active");
        renderItems();
      });

      el.listViewBtn.addEventListener("click", () => {
        state.viewMode = "list";
        localStorage.setItem("artifactory_view_mode", "list");
        el.listViewBtn.classList.add("active");
        el.gridViewBtn.classList.remove("active");
        renderItems();
      });
    }

    if (el.themeToggleBtn) {
      el.themeToggleBtn.addEventListener("click", () => {
        state.theme = state.theme === "dark" ? "light" : "dark";
        document.body.setAttribute("data-theme", state.theme);
        localStorage.setItem("artifactory_theme", state.theme);
        if (el.themeIconSun && el.themeIconMoon) {
          el.themeIconSun.style.display = state.theme === "dark" ? "block" : "none";
          el.themeIconMoon.style.display = state.theme === "dark" ? "none" : "block";
        }
      });
    }

    if (el.uploadBtn && el.fileInput) {
      el.uploadBtn.addEventListener("click", () => {
        el.fileInput.click();
      });

      el.fileInput.addEventListener("change", (e) => {
        handleFilesUpload(e.target.files);
        el.fileInput.value = "";
      });
    }

    window.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (el.dropOverlay) {
        el.dropOverlay.classList.add("active");
      }
    });

    window.addEventListener("dragleave", (e) => {
      if (e.relatedTarget === null && el.dropOverlay) {
        el.dropOverlay.classList.remove("active");
      }
    });

    window.addEventListener("drop", (e) => {
      e.preventDefault();
      if (el.dropOverlay) el.dropOverlay.classList.remove("active");
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFilesUpload(e.dataTransfer.files);
      }
    });

    if (el.closeUploadProgressBtn) {
      el.closeUploadProgressBtn.addEventListener("click", () => {
        el.uploadProgressContainer.style.display = "none";
      });
    }

    // New File Form wiring
    if (el.newFileBtn) el.newFileBtn.addEventListener("click", openNewFileModal);
    if (el.cancelNewFileBtn) el.cancelNewFileBtn.addEventListener("click", closeNewFileModal);
    if (el.closeNewFileModalBtn) el.closeNewFileModalBtn.addEventListener("click", closeNewFileModal);
    if (el.newFileForm) {
      el.newFileForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const filename = el.newFileNameInput.value.trim();
        if (!filename) return;

        const targetPath = state.currentPath ? (state.currentPath + "/" + filename) : filename;

        if (el.submitNewFileBtn) {
          el.submitNewFileBtn.disabled = true;
          el.submitNewFileBtn.textContent = "Creating...";
        }

        try {
          const res = await apiRequest("save", {
            method: "POST",
            body: { path: targetPath, content: "" }
          });

          showToast("File \"" + filename + "\" created successfully!", "success");
          closeNewFileModal();
          await loadDirectory(state.currentPath, false);

          const ext = filename.split(".").pop().toLowerCase();
          const newItem = (res && res.file) ? {
            name: filename,
            path: targetPath,
            ext: ext,
            mime: res.file.mime || "text/plain",
            type: "file",
            size_formatted: res.file.size_formatted || "0 B",
            mtime_formatted: res.file.mtime_formatted || "Just now",
            writable: true
          } : {
            name: filename,
            path: targetPath,
            ext: ext,
            mime: "text/plain",
            type: "file",
            writable: true
          };

          openPreview(newItem, true);
        } catch (err) {
          showToast(err.message, "error");
        } finally {
          if (el.submitNewFileBtn) {
            el.submitNewFileBtn.disabled = false;
            el.submitNewFileBtn.textContent = "Create & Edit";
          }
        }
      });
    }

    if (el.newFolderBtn) el.newFolderBtn.addEventListener("click", openNewFolderModal);
    if (el.cancelNewFolderBtn) el.cancelNewFolderBtn.addEventListener("click", closeNewFolderModal);
    if (el.closeNewFolderModalBtn) el.closeNewFolderModalBtn.addEventListener("click", closeNewFolderModal);
    if (el.newFolderForm) {
      el.newFolderForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = el.newFolderNameInput.value.trim();
        if (!name) return;

        try {
          await apiRequest("mkdir", {
            method: "POST",
            body: { path: state.currentPath, name }
          });
          showToast("Folder \"" + name + "\" created!", "success");
          closeNewFolderModal();
          loadDirectory(state.currentPath);
        } catch (err) {
          showToast(err.message, "error");
        }
      });
    }

    if (el.cancelRenameBtn) el.cancelRenameBtn.addEventListener("click", closeRenameModal);
    if (el.closeRenameModalBtn) el.closeRenameModalBtn.addEventListener("click", closeRenameModal);
    if (el.renameForm) {
      el.renameForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const newName = el.renameInput.value.trim();
        if (!newName || !state.activeRenamePath) return;

        try {
          await apiRequest("rename", {
            method: "POST",
            body: { path: state.activeRenamePath, new_name: newName }
          });
          showToast("Renamed successfully!", "success");
          closeRenameModal();
          loadDirectory(state.currentPath);
        } catch (err) {
          showToast(err.message, "error");
        }
      });
    }

    if (el.cancelDeleteBtn) el.cancelDeleteBtn.addEventListener("click", closeDeleteModal);
    if (el.closeDeleteModalBtn) el.closeDeleteModalBtn.addEventListener("click", closeDeleteModal);
    if (el.confirmDeleteBtn) {
      el.confirmDeleteBtn.addEventListener("click", async () => {
        if (!state.activeDeletePath) return;

        try {
          await apiRequest("delete", {
            method: "POST",
            body: { path: state.activeDeletePath }
          });
          showToast("Item deleted successfully!", "success");
          closeDeleteModal();
          loadDirectory(state.currentPath);
        } catch (err) {
          showToast(err.message, "error");
        }
      });
    }

    if (el.closePreviewModalBtn) el.closePreviewModalBtn.addEventListener("click", closePreview);
    if (el.previewDownloadBtn) {
      el.previewDownloadBtn.addEventListener("click", () => {
        if (state.previewItem) triggerDownload(state.previewItem);
      });
    }
    if (el.previewCopyUrlBtn) {
      el.previewCopyUrlBtn.addEventListener("click", () => {
        if (state.previewItem) {
          const url = state.previewItem.ha_url || getApiUrl("download", { path: state.previewItem.path });
          copyToClipboard(url, "Direct URL copied: \"" + url + "\"");
        }
      });
    }
    if (el.previewCopyInputBtn) {
      el.previewCopyInputBtn.addEventListener("click", () => {
        copyToClipboard(el.previewDirectLinkInput.value, "Direct link copied");
      });
    }

    if (el.previewEditBtn) {
      el.previewEditBtn.addEventListener("click", () => {
        if (state.editorMode) {
          exitEditorModeToPreview();
        } else {
          enterEditorMode(state.editorCurrentText || state.editorOriginalContent);
        }
      });
    }

    if (el.previewSaveBtn) {
      el.previewSaveBtn.addEventListener("click", () => {
        saveEditorContent();
      });
    }

    window.addEventListener("popstate", (e) => {
      const parsed = e.state ? { serverId: e.state.serverId || "local", path: e.state.path || "" } : parseHash();
      if (parsed.serverId !== state.activeServerId) {
        state.activeServerId = parsed.serverId;
        if (el.serverSelect) el.serverSelect.value = parsed.serverId;
        if (parsed.serverId === "local") {
          if (el.remoteServerBanner) el.remoteServerBanner.style.display = "none";
        } else {
          const srv = state.remoteServers.find(s => s.id === parsed.serverId);
          if (srv && el.remoteServerBanner) {
            el.remoteServerBanner.style.display = "flex";
            if (el.remoteServerBannerName) el.remoteServerBannerName.textContent = srv.display_name;
            if (el.remoteServerBannerUrl) el.remoteServerBannerUrl.textContent = srv.url;
          }
        }
      }
      loadDirectory(parsed.path, false);
    });

    window.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        if (!state.editorMode) {
          e.preventDefault();
          if (el.searchInput) {
            el.searchInput.focus();
            el.searchInput.select();
          }
        }
      }
      if (e.key === "Escape") {
        closePreview();
        closeServersModal();
        closeKeysModal();
        closeNewFileModal();
        closeNewFolderModal();
        closeRenameModal();
        closeDeleteModal();
      }
      if (e.key === "Backspace" && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
        if (state.breadcrumbs.length > 1) {
          e.preventDefault();
          const parentBc = state.breadcrumbs[state.breadcrumbs.length - 2];
          loadDirectory(parentBc.path);
        }
      }
    });
  }

  async function init() {
    document.body.setAttribute("data-theme", state.theme);
    if (el.themeIconSun && el.themeIconMoon) {
      el.themeIconSun.style.display = state.theme === "dark" ? "block" : "none";
      el.themeIconMoon.style.display = state.theme === "dark" ? "none" : "block";
    }

    if (el.gridViewBtn && el.listViewBtn) {
      if (state.viewMode === "grid") {
        el.gridViewBtn.classList.add("active");
        el.listViewBtn.classList.remove("active");
      } else {
        el.listViewBtn.classList.add("active");
        el.gridViewBtn.classList.remove("active");
      }
    }

    setupEventListeners();

    await loadFederationServers();

    const initial = parseHash();
    if (initial.serverId !== "local") {
      setActiveServer(initial.serverId);
    } else {
      loadDirectory(initial.path, false);
    }
    loadServerInfo();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
