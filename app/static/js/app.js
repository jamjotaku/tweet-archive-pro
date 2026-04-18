/**
 * app.js - Main Entry Point (Refactored to ES Modules)
 */
import { Auth } from './modules/api.js';
import { state, saveSettings } from './modules/state.js';
import { showToast, t, applySettings } from './modules/ui.js';
import { buildCard } from './modules/components.js';

// --- Page & Data Loading ---

async function fetchBookmarks(skip = 0, append = false) {
    if (state.isLoading) return;
    state.isLoading = true;
    const spinner = document.getElementById('loading-spinner');
    if (spinner && !append) spinner.classList.remove('hidden');

    try {
        let url = `/bookmarks?skip=${skip}&limit=${state.PAGE_SIZE}`;
        if (state.currentFilter.type === 'category') url += `&category=${encodeURIComponent(state.currentFilter.value)}`;
        if (state.currentFilter.type === 'month') url += `&month=${state.currentFilter.value}`;

        const res = await Auth.request(url);
        if (res.ok) {
            const data = await res.json();
            state.totalBookmarks = data.total;
            if (append) state.allBookmarks = [...state.allBookmarks, ...data.bookmarks];
            else state.allBookmarks = data.bookmarks;
            
            renderBookmarks(state.allBookmarks, state.totalBookmarks, append);
        }
    } catch (err) {
        console.error('[App] Fetch error:', err);
        showToast(t('error_fetch'), 'error');
    } finally {
        state.isLoading = false;
        if (spinner) spinner.classList.add('hidden');
    }
}

function renderBookmarks(bookmarks, total, append = false) {
    const container = document.getElementById('tweets-container');
    if (!container) return;
    if (!append) container.innerHTML = '';

    if (bookmarks.length === 0 && !append) {
        container.innerHTML = `<div class="py-20 text-center text-x-text-muted"><ion-icon name="bookmarks-outline" class="text-6xl mb-4 opacity-20"></ion-icon><p>${t('no_bookmarks')}</p></div>`;
        return;
    }

    const fragment = document.createDocumentFragment();
    bookmarks.slice(append ? state.allBookmarks.length - bookmarks.length : 0).forEach(bm => {
        fragment.appendChild(buildCard(bm));
    });
    container.appendChild(fragment);

    // Update load more button
    const loadMoreBtn = document.getElementById('load-more-container');
    if (loadMoreBtn) {
        loadMoreBtn.classList.toggle('hidden', state.allBookmarks.length >= total);
    }
}

// --- Interaction Handlers ---

window.toggleBatchMode = () => {
    state.isBatchMode = !state.isBatchMode;
    state.selectedIds.clear();
    const toolbar = document.getElementById('batch-toolbar');
    const btn = document.getElementById('toggle-batch-btn');
    if (toolbar) toolbar.classList.toggle('show', state.isBatchMode);
    if (toolbar) toolbar.style.display = state.isBatchMode ? 'flex' : 'none';
    if (btn) btn.classList.toggle('text-x-blue', state.isBatchMode);
    document.getElementById('selected-count').innerText = `0 ${t('selected_items')}`;
    renderBookmarks(state.allBookmarks, state.totalBookmarks, false);
};

window.toggleViewMode = () => {
    state.isGalleryMode = !state.isGalleryMode;
    const btn = document.getElementById('toggle-gallery-btn');
    if (btn) btn.classList.toggle('text-x-blue', state.isGalleryMode);
    applySettings();
    renderBookmarks(state.allBookmarks, state.totalBookmarks, false);
};

window.toggleSelect = (id, el) => {
    if (state.selectedIds.has(id)) {
        state.selectedIds.delete(id);
        el.classList.remove('selected');
    } else {
        state.selectedIds.add(id);
        el.classList.add('selected');
    }
    document.getElementById('selected-count').innerText = `${state.selectedIds.size} ${t('selected_items')}`;
};

// --- Initialization ---

document.addEventListener('DOMContentLoaded', () => {
    const token = Auth.getToken();
    if (!token && window.location.pathname !== '/login') {
        window.location.href = '/login';
        return;
    }

    applySettings();
    fetchBookmarks();
    refreshSidebar();

    // Event Listeners
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(async (e) => {
            const q = e.target.value.trim();
            if (!q) { fetchBookmarks(); return; }
            const res = await Auth.request(`/bookmarks/search?q=${encodeURIComponent(q)}`);
            if (res.ok) {
                const data = await res.json();
                state.allBookmarks = data;
                renderBookmarks(data, data.length, false);
            }
        }, 300));
    }
});

// Helper: Debounce
function debounce(fn, delay) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), delay);
    };
}

async function refreshSidebar() {
    const catList = document.getElementById('categories-list');
    const timeList = document.getElementById('timeline-list');
    
    // User Profile Info
    try {
        const uRes = await Auth.request('/users/me');
        if (uRes.ok) {
            const user = await uRes.json();
            const dnEl = document.getElementById('user-display-name');
            const unEl = document.getElementById('username-handle');
            if (dnEl) dnEl.innerText = user.display_name || user.username;
            if (unEl) unEl.innerText = user.username.toLowerCase();
        }
    } catch (err) {
        console.error('[App] User fetch error:', err);
    }

    // Categories
    const cRes = await Auth.request('/bookmarks/categories');
    if (cRes.ok && catList) {
        const cats = await cRes.json();
        catList.innerHTML = cats.map(c => `<button onclick="window.applyCategoryFilter('${c.name}')" class="w-full text-left px-4 py-2 hover:bg-x-dark rounded-xl flex items-center justify-between group transition-colors"><span class="truncate">${c.name}</span><span class="text-x-text-muted text-xs group-hover:text-x-blue">${c.count}</span></button>`).join('');
    }

    // Timeline
    const tRes = await Auth.request('/bookmarks/stats/timeline');
    if (tRes.ok && timeList) {
        const months = await tRes.json();
        timeList.innerHTML = months.map(m => `<button onclick="window.applyMonthFilter('${m.month}')" class="w-full text-left px-4 py-2 hover:bg-x-dark rounded-xl flex items-center justify-between group transition-colors"><span>${m.month}</span><span class="text-x-text-muted text-xs group-hover:text-x-blue">${m.count}</span></button>`).join('');
    }
}

// Final Exports to Window
window.applyCategoryFilter = (cat) => { state.currentFilter = {type: 'category', value: cat}; fetchBookmarks(); };
window.applyMonthFilter = (m) => { state.currentFilter = {type: 'month', value: m}; fetchBookmarks(); };
window.loadMore = () => fetchBookmarks(state.allBookmarks.length, true);
window.syncBookmark = async (id, iconEl) => {
    if (iconEl) iconEl.classList.add('animate-spin');
    const res = await Auth.request(`/bookmarks/${id}/sync`, { method: 'POST' });
    if (res.ok) {
        showToast(t('sync_success') || 'Synced!');
        fetchBookmarks(0, false);
    }
    if (iconEl) iconEl.classList.remove('animate-spin');
};

// Settings Modal
window.openSettingsModal = () => {
    const modal = document.getElementById('settings-modal');
    if (modal) {
        document.getElementById('set-compact').checked = state.appSettings.compactMode;
        document.getElementById('set-blur').checked = state.appSettings.blurMode;
        document.getElementById('set-media').checked = state.appSettings.hideMedia;
        document.getElementById('set-thread').checked = state.appSettings.showThread;
        document.getElementById('set-autofetch').checked = state.appSettings.autoFetch;
        document.getElementById('set-toolsexp').checked = state.appSettings.showExport;
        document.getElementById('set-toolsbml').checked = state.appSettings.showBookmarklet;
        document.getElementById('set-lang').value = state.appSettings.lang;
        document.getElementById('set-theme').value = state.appSettings.theme;
        modal.classList.remove('hidden');
    }
};

window.closeSettingsModal = () => document.getElementById('settings-modal').classList.add('hidden');

window.updateSettings = (key, val) => {
    state.appSettings[key] = val;
    saveSettings();
    applySettings();
};
