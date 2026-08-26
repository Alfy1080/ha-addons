// HTML entity escaping helper
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Configuration & Base Path Resolution for HA Ingress
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

// API Helpers
const api = {
    url(endpoint) {
        const base = getBasePath();
        const ep = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        return `${base}/api${ep}`;
    },
    async fetch(endpoint, options = {}) {
        const url = this.url(endpoint);
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                let errorMsg = `HTTP ${response.status}: ${response.statusText || 'Request failed'}`;
                try {
                    const data = await response.json();
                    if (data && data.error) errorMsg = data.error;
                } catch {
                    try {
                        const text = await response.text();
                        if (text) errorMsg = text.slice(0, 150);
                    } catch {}
                }
                throw new Error(errorMsg);
            }
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                return response.json();
            }
            return response.text();
        } catch (error) {
            toast.error(error.message || 'Operation failed');
            throw error;
        }
    }
};

// State
const state = {
    currentPath: '',
    items: [],
    breadcrumbs: [],
    searchQuery: '',
    isReadOnly: false,
};

// DOM Elements
const els = {
    fileGrid: document.getElementById('fileGrid'),
    breadcrumbs: document.getElementById('breadcrumbs'),
    emptyState: document.getElementById('emptyState'),
    loadingState: document.getElementById('loadingState'),
    searchInput: document.getElementById('searchInput'),
    btnNewFolder: document.getElementById('btnNewFolder'),
    btnUpload: document.getElementById('btnUpload'),
    btnRefresh: document.getElementById('btnRefresh'),
    fileInput: document.getElementById('fileInput'),
    dropZone: document.getElementById('dropZone'),
    dragOverlay: document.getElementById('dragOverlay'),
    
    // Upload progress
    uploadProgressContainer: document.getElementById('uploadProgressContainer'),
    uploadProgressBar: document.getElementById('uploadProgressBar'),
    uploadPercent: document.getElementById('uploadPercent'),
    
    // Modals
    previewModal: document.getElementById('previewModal'),
    previewContent: document.getElementById('previewContent'),
    previewTitle: document.getElementById('previewTitle'),
    btnClosePreview: document.getElementById('btnClosePreview'),
    btnDownloadPreview: document.getElementById('btnDownloadPreview'),
    
    inputModal: document.getElementById('inputModal'),
    inputModalTitle: document.getElementById('inputModalTitle'),
    inputModalValue: document.getElementById('inputModalValue'),
    inputModalError: document.getElementById('inputModalError'),
    inputModalForm: document.getElementById('inputModalForm'),
    btnCancelInput: document.getElementById('btnCancelInput'),
    btnConfirmInput: document.getElementById('btnConfirmInput'),
    
    deleteModal: document.getElementById('deleteModal'),
    deleteItemName: document.getElementById('deleteItemName'),
    btnCancelDelete: document.getElementById('btnCancelDelete'),
    btnConfirmDelete: document.getElementById('btnConfirmDelete'),
    
    contextMenu: document.getElementById('contextMenu'),
    toastContainer: document.getElementById('toastContainer'),
};

// Toast Notifications
const toast = {
    show(message, type = 'info') {
        const text = String(message || (type === 'error' ? 'An unexpected error occurred' : '')).trim();
        if (!text) return;

        const el = document.createElement('div');
        el.className = `toast toast-${type} px-4 py-3 rounded shadow-lg flex items-center gap-2 border border-gray-700 min-w-[250px] animate-slide-in`;
        
        let icon = 'info';
        if (type === 'success') icon = 'check_circle';
        if (type === 'error') icon = 'error';
        if (type === 'warning') icon = 'warning';
        
        el.innerHTML = `
            <span class="material-icons-round text-lg">${icon}</span>
            <span class="text-sm font-medium flex-1">${escapeHtml(text)}</span>
            <button class="text-gray-400 hover:text-white ml-2"><span class="material-icons-round text-sm">close</span></button>
        `;
        
        el.querySelector('button').onclick = () => this.remove(el);
        els.toastContainer.appendChild(el);
        
        setTimeout(() => this.remove(el), 5000);
    },
    success(msg) { this.show(msg, 'success'); },
    error(msg) { this.show(msg, 'error'); },
    info(msg) { this.show(msg, 'info'); },
    remove(el) {
        el.classList.add('animate-fade-out');
        setTimeout(() => el.remove(), 300);
    }
};

// Icon Mapping
const getIconForFile = (type, ext) => {
    if (type === 'directory') return { icon: 'folder', color: 'text-blue-400' };
    
    const map = {
        'jpg': { icon: 'image', color: 'text-purple-400' },
        'jpeg': { icon: 'image', color: 'text-purple-400' },
        'png': { icon: 'image', color: 'text-purple-400' },
        'gif': { icon: 'image', color: 'text-purple-400' },
        'svg': { icon: 'image', color: 'text-purple-400' },
        'webp': { icon: 'image', color: 'text-purple-400' },
        'pdf': { icon: 'picture_as_pdf', color: 'text-red-400' },
        'txt': { icon: 'description', color: 'text-gray-300' },
        'md': { icon: 'description', color: 'text-gray-300' },
        'csv': { icon: 'table_view', color: 'text-green-400' },
        'json': { icon: 'data_object', color: 'text-yellow-400' },
        'js': { icon: 'javascript', color: 'text-yellow-400' },
        'html': { icon: 'html', color: 'text-orange-400' },
        'css': { icon: 'css', color: 'text-blue-400' },
        'mp4': { icon: 'movie', color: 'text-pink-400' },
        'webm': { icon: 'movie', color: 'text-pink-400' },
        'mp3': { icon: 'audio_file', color: 'text-teal-400' },
        'wav': { icon: 'audio_file', color: 'text-teal-400' },
        'zip': { icon: 'folder_zip', color: 'text-yellow-600' },
        'tar': { icon: 'folder_zip', color: 'text-yellow-600' },
        'gz': { icon: 'folder_zip', color: 'text-yellow-600' },
        'yaml': { icon: 'list_alt', color: 'text-blue-300' },
        'yml': { icon: 'list_alt', color: 'text-blue-300' },
    };
    
    const e = (ext || '').toLowerCase();
    return map[e] || { icon: 'insert_drive_file', color: 'text-gray-400' };
};

// API Actions
const loadDirectory = async (path = '') => {
    els.loadingState.classList.remove('hidden');
    try {
        const query = path ? `?path=${encodeURIComponent(path)}` : '';
        const data = await api.fetch(`/list${query}`);
        
        state.currentPath = data.current_path;
        state.items = data.items || [];
        state.breadcrumbs = data.breadcrumbs || [];
        
        // Determine read-only status: at root level, always read-only
        // Inside a directory, use the writable flag from the first item (all items share the same root)
        if (!state.currentPath) {
            state.isReadOnly = true;
        } else if (state.items.length > 0) {
            state.isReadOnly = !state.items[0].writable;
        } else {
            // Empty directory — check breadcrumbs to find root name and match against known root writability
            state.isReadOnly = false; // Default to writable if we can't determine
        }

        updateUI();
    } catch (e) {
        console.error("Failed to load directory", e);
    } finally {
        els.loadingState.classList.add('hidden');
    }
};

// UI Rendering
const updateUI = () => {
    renderBreadcrumbs();
    renderFiles();
    updateControls();
};

const updateControls = () => {
    const isRoot = !state.currentPath;
    const canWrite = !state.isReadOnly && !isRoot;
    
    els.btnNewFolder.disabled = !canWrite;
    els.btnUpload.disabled = !canWrite;
    
    els.btnNewFolder.classList.toggle('opacity-50', !canWrite);
    els.btnNewFolder.classList.toggle('cursor-not-allowed', !canWrite);
    els.btnUpload.classList.toggle('opacity-50', !canWrite);
    els.btnUpload.classList.toggle('cursor-not-allowed', !canWrite);
};

const renderBreadcrumbs = () => {
    els.breadcrumbs.innerHTML = '';
    
    // Home icon
    const homeEl = document.createElement('a');
    homeEl.href = '#';
    homeEl.className = `flex items-center hover:text-white transition-colors ${!state.currentPath ? 'text-white' : 'text-textSecondary'}`;
    homeEl.innerHTML = '<span class="material-icons-round text-sm">home</span>';
    homeEl.onclick = (e) => { e.preventDefault(); loadDirectory(''); };
    els.breadcrumbs.appendChild(homeEl);
    
    // Skip the first "Root" breadcrumb since we already have a home icon
    const crumbs = state.breadcrumbs.filter(c => c.path !== '' || c.name !== 'Root');
    
    crumbs.forEach((crumb, index) => {
        // Separator
        const sep = document.createElement('span');
        sep.className = 'material-icons-round text-gray-600 text-sm mx-1';
        sep.textContent = 'chevron_right';
        els.breadcrumbs.appendChild(sep);
        
        // Crumb
        const isLast = index === crumbs.length - 1;
        const crumbEl = document.createElement('a');
        crumbEl.href = '#';
        crumbEl.className = `hover:text-white transition-colors truncate max-w-[150px] ${isLast ? 'text-white font-semibold' : 'text-textSecondary'}`;
        crumbEl.textContent = crumb.name;
        
        if (!isLast) {
            crumbEl.onclick = (e) => {
                e.preventDefault();
                loadDirectory(crumb.path);
            };
        } else {
            crumbEl.onclick = (e) => e.preventDefault();
        }
        
        els.breadcrumbs.appendChild(crumbEl);
    });
};

const renderFiles = () => {
    els.fileGrid.innerHTML = '';
    const query = state.searchQuery.toLowerCase();
    
    let itemsToShow = state.items;
    
    // Sort: directories first, then by name
    itemsToShow.sort((a, b) => {
        const isDirA = a.type === 'dir' || a.type === 'directory';
        const isDirB = b.type === 'dir' || b.type === 'directory';
        if (isDirA && !isDirB) return -1;
        if (!isDirA && isDirB) return 1;
        return a.name.localeCompare(b.name);
    });

    // Filter
    if (query) {
        itemsToShow = itemsToShow.filter(item => item.name.toLowerCase().includes(query));
    }

    if (itemsToShow.length === 0) {
        els.emptyState.classList.remove('hidden');
        els.fileGrid.classList.add('hidden');
    } else {
        els.emptyState.classList.add('hidden');
        els.fileGrid.classList.remove('hidden');
        
        itemsToShow.forEach(item => {
            const isDir = item.type === 'dir' || item.type === 'directory';
            const { icon, color } = getIconForFile(isDir ? 'directory' : item.type, item.ext);
            
            const card = document.createElement('div');
            card.className = 'file-card bg-bgCard hover:bg-bgCardHover rounded-lg p-3 flex flex-col items-center justify-center cursor-pointer transition-all border border-gray-700 hover:border-gray-500 relative group min-h-[120px] text-center';
            
            // Read-only badge for roots
            let badge = '';
            if (!state.currentPath && !item.writable) {
                badge = `<span class="absolute top-2 right-2 text-xs bg-gray-700 text-gray-300 px-1.5 rounded" title="Read Only">R/O</span>`;
            } else if (state.currentPath && !item.writable && !state.isReadOnly) {
                 badge = `<span class="absolute top-2 right-2 text-xs bg-gray-700 text-gray-300 px-1.5 rounded" title="Read Only">R/O</span>`;
            }

            // Thumbnail for images (optional enhancement if supported, for now just icons)
            card.innerHTML = `
                ${badge}
                <div class="mb-2 ${color}">
                    <span class="material-icons-round text-5xl">${icon}</span>
                </div>
                <div class="w-full truncate text-sm font-medium mb-1 px-1" title="${item.name}">${item.name}</div>
                ${state.currentPath ? `<div class="text-xs text-textSecondary">${isDir ? '' : (item.size_formatted || '')}</div>` : ''}
                
                <button class="context-menu-btn absolute top-2 right-2 p-1 rounded hover:bg-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" data-path="${item.path}">
                    <span class="material-icons-round text-sm">more_vert</span>
                </button>
            `;

            // Click handling
            card.onclick = (e) => {
                if (e.target.closest('.context-menu-btn')) return; // Ignore menu clicks
                
                if (isDir) {
                    loadDirectory(item.path);
                } else {
                    openPreview(item);
                }
            };
            
            // Context menu handling
            const menuBtn = card.querySelector('.context-menu-btn');
            if (menuBtn) {
                menuBtn.onclick = (e) => {
                    e.stopPropagation();
                    showContextMenu(e, item);
                };
            }
            
            // Right click context menu
            card.oncontextmenu = (e) => {
                e.preventDefault();
                showContextMenu(e, item);
            };

            els.fileGrid.appendChild(card);
        });
    }
};

// Context Menu
const showContextMenu = (e, item) => {
    els.contextMenu.innerHTML = '';
    const isDir = item.type === 'directory';
    const canWrite = state.currentPath ? (item.writable !== false && !state.isReadOnly) : false; // basic check
    
    const addMenuItem = (icon, text, onClick, isDanger = false) => {
        const btn = document.createElement('button');
        btn.className = `w-full text-left px-4 py-2 flex items-center gap-2 hover:bg-bgCard transition-colors ${isDanger ? 'text-danger hover:bg-red-900/20' : 'text-textPrimary'}`;
        btn.innerHTML = `<span class="material-icons-round text-sm">${icon}</span> ${text}`;
        btn.onclick = () => {
            hideContextMenu();
            onClick();
        };
        els.contextMenu.appendChild(btn);
    };

    if (!isDir && state.currentPath) {
        addMenuItem('visibility', 'Preview', () => openPreview(item));
        addMenuItem('download', 'Download', () => {
            window.open(api.url(`/download?path=${encodeURIComponent(item.path)}`), '_blank');
        });
        
        if (item.ha_url) {
            addMenuItem('link', 'Copy HA URL', () => {
                navigator.clipboard.writeText(item.ha_url).then(() => toast.success('URL copied to clipboard'));
            });
        }
    }

    if (state.currentPath && canWrite) {
        els.contextMenu.appendChild(document.createElement('hr')).className = 'border-gray-700 my-1';
        addMenuItem('edit', 'Rename', () => openRenameModal(item));
        addMenuItem('delete', 'Delete', () => openDeleteModal(item), true);
    }

    if (els.contextMenu.children.length === 0) {
        addMenuItem('info', 'No actions available', () => {});
    }

    els.contextMenu.classList.remove('hidden');
    
    // Position menu
    let x = e.clientX;
    let y = e.clientY;
    
    // Adjust if goes off screen
    requestAnimationFrame(() => {
        const rect = els.contextMenu.getBoundingClientRect();
        if (x + rect.width > window.innerWidth) x = window.innerWidth - rect.width - 5;
        if (y + rect.height > window.innerHeight) y = window.innerHeight - rect.height - 5;
        
        els.contextMenu.style.left = `${x}px`;
        els.contextMenu.style.top = `${y}px`;
    });
};

const hideContextMenu = () => {
    els.contextMenu.classList.add('hidden');
};

document.addEventListener('click', hideContextMenu);
document.addEventListener('scroll', hideContextMenu, true);

// Preview
const openPreview = (item) => {
    els.previewTitle.textContent = item.name;
    els.previewContent.innerHTML = '<div class="animate-spin rounded-full h-8 w-8 border-4 border-gray-600 border-t-accent"></div>';
    
    const downloadUrl = api.url(`/download?path=${encodeURIComponent(item.path)}`);
    const previewUrl = api.url(`/download?path=${encodeURIComponent(item.path)}&inline=true`);
    
    els.btnDownloadPreview.href = downloadUrl;
    els.btnDownloadPreview.download = item.name;
    
    els.previewModal.classList.remove('hidden');
    
    const ext = (item.ext || '').toLowerCase();
    
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
        els.previewContent.innerHTML = `<img src="${previewUrl}" class="max-w-full max-h-full object-contain" alt="${item.name}">`;
    } else if (['mp4', 'webm', 'ogg'].includes(ext)) {
        els.previewContent.innerHTML = `<video src="${previewUrl}" controls class="max-w-full max-h-full"></video>`;
    } else if (['mp3', 'wav', 'ogg'].includes(ext)) {
        els.previewContent.innerHTML = `<audio src="${previewUrl}" controls class="w-full"></audio>`;
    } else if (ext === 'pdf') {
        els.previewContent.innerHTML = `<iframe src="${previewUrl}" class="w-full h-full min-h-[60vh] border-0"></iframe>`;
    } else if (['txt', 'json', 'md', 'csv', 'yaml', 'yml', 'js', 'html', 'css'].includes(ext)) {
        fetch(previewUrl)
            .then(res => res.text())
            .then(text => {
                els.previewContent.innerHTML = `<pre class="w-full h-full overflow-auto bg-[#1e1e1e] text-[#d4d4d4] p-4 text-sm font-mono rounded text-left whitespace-pre-wrap">${escapeHtml(text)}</pre>`;
            })
            .catch(() => {
                els.previewContent.innerHTML = '<div class="text-danger">Failed to load text content</div>';
            });
    } else {
        els.previewContent.innerHTML = `
            <div class="flex flex-col items-center text-textSecondary">
                <span class="material-icons-round text-6xl mb-4">insert_drive_file</span>
                <p>Preview not available for this file type.</p>
                <a href="${downloadUrl}" class="mt-4 text-accent hover:underline">Download File</a>
            </div>
        `;
    }
};

els.btnClosePreview.onclick = () => {
    els.previewModal.classList.add('hidden');
    els.previewContent.innerHTML = '';
};

const escapeHtml = (unsafe) => {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
};


// Modals (Input / Delete)
let inputModalCallback = null;

const openInputModal = (title, initialValue, callback) => {
    els.inputModalTitle.textContent = title;
    els.inputModalValue.value = initialValue;
    els.inputModalError.classList.add('hidden');
    inputModalCallback = callback;
    els.inputModal.classList.remove('hidden');
    setTimeout(() => els.inputModalValue.focus(), 50);
};

els.btnCancelInput.onclick = (e) => {
    e.preventDefault();
    els.inputModal.classList.add('hidden');
};

els.inputModalForm.onsubmit = async (e) => {
    e.preventDefault();
    const val = els.inputModalValue.value.trim();
    if (!val) return;
    
    if (inputModalCallback) {
        try {
            await inputModalCallback(val);
            els.inputModal.classList.add('hidden');
            loadDirectory(state.currentPath);
        } catch (err) {
            els.inputModalError.textContent = err.message || 'Operation failed';
            els.inputModalError.classList.remove('hidden');
        }
    }
};

let deleteModalItem = null;

const openDeleteModal = (item) => {
    deleteModalItem = item;
    els.deleteItemName.textContent = item.name;
    els.deleteModal.classList.remove('hidden');
};

els.btnCancelDelete.onclick = () => {
    els.deleteModal.classList.add('hidden');
    deleteModalItem = null;
};

els.btnConfirmDelete.onclick = async () => {
    if (!deleteModalItem) return;
    try {
        await api.fetch('/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: deleteModalItem.path })
        });
        toast.success(`Deleted ${deleteModalItem.name}`);
        els.deleteModal.classList.add('hidden');
        loadDirectory(state.currentPath);
    } catch (err) {
        // Error handled in fetch
    }
};

const openRenameModal = (item) => {
    openInputModal('Rename', item.name, async (newName) => {
        if (newName === item.name) return;
        await api.fetch('/rename', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: item.path, new_name: newName })
        });
        toast.success('Renamed successfully');
    });
};


// Actions
els.btnNewFolder.onclick = () => {
    if (!state.currentPath || state.isReadOnly) return;
    openInputModal('New Folder', 'New Folder', async (name) => {
        await api.fetch('/mkdir', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: state.currentPath, name })
        });
        toast.success(`Created folder ${name}`);
    });
};

els.btnRefresh.onclick = () => loadDirectory(state.currentPath);

els.searchInput.oninput = (e) => {
    state.searchQuery = e.target.value;
    renderFiles();
};


// Upload Handling
els.btnUpload.onclick = () => {
    if (!state.currentPath || state.isReadOnly) return;
    els.fileInput.click();
};

els.fileInput.onchange = (e) => {
    if (e.target.files.length > 0) {
        handleFilesUpload(e.target.files);
    }
    els.fileInput.value = ''; // reset
};

const handleFilesUpload = async (files) => {
    if (!state.currentPath || state.isReadOnly) {
        toast.error('Cannot upload to this directory');
        return;
    }

    const formData = new FormData();
    formData.append('path', state.currentPath);
    for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
    }

    els.uploadProgressContainer.classList.remove('hidden');
    els.uploadProgressBar.style.width = '0%';
    els.uploadPercent.textContent = '0%';

    try {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', api.url('/upload'), true);

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const percentComplete = Math.round((e.loaded / e.total) * 100);
                els.uploadProgressBar.style.width = percentComplete + '%';
                els.uploadPercent.textContent = percentComplete + '%';
            }
        };

        const result = await new Promise((resolve, reject) => {
            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(JSON.parse(xhr.responseText));
                } else {
                    let err = xhr.statusText;
                    try { err = JSON.parse(xhr.responseText).error || err; } catch(e){}
                    reject(new Error(err));
                }
            };
            xhr.onerror = () => reject(new Error('Network error during upload'));
            xhr.send(formData);
        });

        toast.success(`Successfully uploaded ${files.length} file(s)`);
        loadDirectory(state.currentPath);
    } catch (err) {
        toast.error(`Upload failed: ${err.message}`);
    } finally {
        setTimeout(() => {
            els.uploadProgressContainer.classList.add('hidden');
        }, 2000);
    }
};

// Drag and drop
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    els.dropZone.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

let dragCounter = 0;

els.dropZone.addEventListener('dragenter', (e) => {
    if (!state.currentPath || state.isReadOnly) return;
    dragCounter++;
    els.dragOverlay.classList.remove('hidden');
    els.dragOverlay.classList.add('flex');
}, false);

els.dropZone.addEventListener('dragleave', (e) => {
    if (!state.currentPath || state.isReadOnly) return;
    dragCounter--;
    if (dragCounter === 0) {
        els.dragOverlay.classList.add('hidden');
        els.dragOverlay.classList.remove('flex');
    }
}, false);

els.dropZone.addEventListener('drop', (e) => {
    if (!state.currentPath || state.isReadOnly) return;
    dragCounter = 0;
    els.dragOverlay.classList.add('hidden');
    els.dragOverlay.classList.remove('flex');
    
    const dt = e.dataTransfer;
    const files = dt.files;
    
    if (files.length > 0) {
        handleFilesUpload(files);
    }
}, false);


// Init
document.addEventListener('DOMContentLoaded', () => {
    loadDirectory('');
});
