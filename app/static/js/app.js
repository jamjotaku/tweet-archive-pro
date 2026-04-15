/**
 * app.js - Deep Unroll & Search Update
 */

const API_BASE = window.location.origin;

// ----------------------------------------------------
// 1. Settings & State
// ----------------------------------------------------
const defaultSettings = {
    lang: 'ja',
    theme: 'lights-out',
    blurMode: false,
    compactMode: false,
    hideMedia: false,
    showThread: true,
    autoFetch: true,
    showExport: false,
    showBookmarklet: false,
};

let appSettings = { ...defaultSettings };
try {
    const saved = localStorage.getItem('appSettings');
    if (saved) appSettings = { ...appSettings, ...JSON.parse(saved) };
} catch(e) {}

let isBatchMode = false;
let isGalleryMode = false;
let selectedIds = new Set();
let currentPage = 0;
let totalBookmarks = 0;
let allBookmarks = [];
let isLoading = false;
let currentFilter = { type: null, value: null }; // {type: 'month'|'category', value: '2024-10'}
const PAGE_SIZE = 20;

function saveSettings() {
    localStorage.setItem('appSettings', JSON.stringify(appSettings));
    applySettings();
}

function applySettings() {
    document.body.classList.toggle('theme-dim', appSettings.theme === 'dim');
    document.body.classList.toggle('blur-mode', appSettings.blurMode);
    document.body.classList.toggle('compact-mode', appSettings.compactMode);
    document.body.classList.toggle('gallery-mode', isGalleryMode);
    
    applyTranslations();
}

// ----------------------------------------------------
// 2. i18n
// ----------------------------------------------------
const i18n = {
    en: {
        nav_home: "Home", nav_settings: "Settings", nav_batch: "Selection", nav_gallery: "Gallery",
        header_title: "Bookmarks", search_placeholder: "Content, author, tags...",
        side_categories: "Categories", side_timeline: "Timeline", side_export: "Export Data",
        modal_save_title: "Save a Tweet", btn_save: "Save",
        set_group_general: "General UI", set_lang: "Language", set_group_view: "Tweet View",
        set_compact: "Compact Mode", set_thread: "Show Thread (Unroll)", set_media: "Hide Media",
        no_bookmarks: "No bookmarks found", btn_batch_sync: "Sync", btn_batch_delete: "Delete",
        selected_items: "selected", confirm_batch_delete: "Delete selected items?",
    },
    ja: {
        nav_home: "ホーム", nav_settings: "設定", nav_batch: "一括選択", nav_gallery: "ギャラリー",
        header_title: "保存済みツイート", search_placeholder: "本文、著者、タグで検索...",
        side_categories: "カテゴリ", side_timeline: "タイムライン", side_export: "データ出力",
        modal_save_title: "ツイートを保存", btn_save: "保存する",
        set_group_general: "共通 UI", set_lang: "言語", set_group_view: "表示モード",
        set_compact: "リスト表示", set_thread: "スレッド展開", set_media: "メディア非表示",
        no_bookmarks: "データが見つかりません", btn_batch_sync: "同期", btn_batch_delete: "削除",
        selected_items: "件選択中", confirm_batch_delete: "選択したアイテムを削除しますか？",
    }
};

function t(key) { return (i18n[appSettings.lang] || i18n['en'])[key] || key; }

function applyTranslations() {
    const d = i18n[appSettings.lang] || i18n['en'];
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (d[key]) el.innerText = d[key];
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (d[key]) el.placeholder = d[key];
    });
    updateBatchCount();
}

// ----------------------------------------------------
// UI Logic
// ----------------------------------------------------
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    const bgColor = type === 'error' ? 'bg-red-500' : 'bg-x-blue';
    toast.className = `${bgColor} text-white px-6 py-3 rounded-full shadow-lg font-medium text-sm flex items-center gap-2 toast-enter z-[100]`;
    toast.innerHTML = `<ion-icon name="${type === 'error' ? 'alert-circle' : 'checkmark-circle'}" class="text-xl"></ion-icon> ${message}`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.replace('toast-enter', 'toast-exit');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

const Auth = {
    getToken() { return localStorage.getItem('token'); },
    logout() { localStorage.removeItem('token'); window.location.href = '/login'; },
    async request(endpoint, options = {}) {
        const token = this.getToken();
        const headers = { ...(options.headers || {}) };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
        if (response.status === 401 && !endpoint.includes('/token')) { this.logout(); }
        return response;
    }
};

// ----------------------------------------------------
// Core Functions
// ----------------------------------------------------
function toggleBatchMode() {
    isBatchMode = !isBatchMode;
    selectedIds.clear();
    const toolbar = document.getElementById('batch-toolbar');
    const btn = document.getElementById('toggle-batch-btn');
    if (toolbar) toolbar.classList.toggle('show', isBatchMode);
    if (toolbar) toolbar.style.display = isBatchMode ? 'flex' : 'none';
    if (btn) btn.classList.toggle('text-x-blue', isBatchMode);
    updateBatchCount();
    renderBookmarks(allBookmarks, totalBookmarks, false);
}

window.toggleBatchMode = toggleBatchMode;

function toggleViewMode() {
    isGalleryMode = !isGalleryMode;
    const btn = document.getElementById('toggle-gallery-btn');
    if (btn) btn.classList.toggle('text-x-blue', isGalleryMode);
    applySettings();
    renderBookmarks(allBookmarks, totalBookmarks, false);
}
window.toggleViewMode = toggleViewMode;

function updateBatchCount() {
    const countEl = document.getElementById('selected-count');
    if (countEl) countEl.innerText = `${selectedIds.size} ${t('selected_items')}`;
}

async function syncBookmark(id, buttonEl = null) {
    if (buttonEl) { buttonEl.disabled = true; buttonEl.classList.add('animate-spin'); }
    try {
        const res = await Auth.request(`/bookmarks/${id}/sync`, { method: 'POST' });
        if (res.ok) {
            showToast(appSettings.lang === 'ja' ? "同期完了" : "Synced");
            const updated = await res.json();
            const idx = allBookmarks.findIndex(b => b.id === id);
            if (idx !== -1) {
                allBookmarks[idx] = updated;
                renderBookmarks(allBookmarks, totalBookmarks, false);
            }
        }
    } catch (e) { showToast("Sync failed", "error"); }
    finally { if (buttonEl) { buttonEl.disabled = false; buttonEl.classList.remove('animate-spin'); } }
}

async function batchDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(t('confirm_batch_delete'))) return;
    const ids = Array.from(selectedIds);
    for (const id of ids) { await Auth.request(`/bookmarks/${id}`, { method: 'DELETE' }); }
    showToast(appSettings.lang === 'ja' ? "一括削除完了" : "Deleted");
    allBookmarks = allBookmarks.filter(b => !selectedIds.has(b.id));
    totalBookmarks -= selectedIds.size;
    toggleBatchMode();
    renderBookmarks(allBookmarks, totalBookmarks);
    fetchTimelineStats();
}

// ----------------------------------------------------
// Card Builder (Advanced)
// ----------------------------------------------------
function renderMedia(urlStr) {
    if (!urlStr || appSettings.hideMedia) return '';
    const urls = urlStr.split(',').filter(u => u.trim());
    if (urls.length === 0) return '';

    let html = `<div class="media-grid" data-count="${urls.length}">`;
    urls.forEach(u => {
        html += `<div class="media-item"><img src="${u}" loading="lazy" onclick="event.stopPropagation(); window.open('${u}', '_blank')"></div>`;
    });
    html += `</div>`;
    return html;
}

function buildCard(bm) {
    const wrapper = document.createElement('article');
    wrapper.className = `tweet-card border-b border-x-border relative group cursor-pointer flex flex-col`;
    
    // Main Body Wrapper (to handle thread line)
    const bodyWrapper = document.createElement('div');
    bodyWrapper.className = 'flex relative w-full';

    bodyWrapper.onclick = (e) => {
        if (isBatchMode) {
            const cb = wrapper.querySelector('.batch-checkbox');
            cb.checked = !cb.checked;
            cb.dispatchEvent(new Event('change'));
            return;
        }
        if (!e.target.closest('button') && !e.target.closest('a') && !e.target.closest('img')) {
            window.open(bm.url, '_blank');
        }
    };

    // 1. Batch Checkbox
    if (isBatchMode) {
        const checkArea = document.createElement('div');
        checkArea.className = 'pl-4 pt-4 flex flex-col items-center z-10';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'batch-checkbox';
        checkbox.checked = selectedIds.has(bm.id);
        checkbox.onclick = e => e.stopPropagation();
        checkbox.onchange = (e) => {
            if (e.target.checked) selectedIds.add(bm.id);
            else selectedIds.delete(bm.id);
            updateBatchCount();
        };
        checkArea.appendChild(checkbox);
        bodyWrapper.appendChild(checkArea);
    }

    const contentArea = document.createElement('div');
    contentArea.className = 'flex-1 p-4 flex gap-3 min-w-0';

    // 2. Thread Context (Rendered before the main tweet)
    let threadHtml = '';
    const threadData = JSON.parse(bm.thread_json || '[]');
    if (appSettings.showThread && threadData.length > 0 && !isGalleryMode) {
        const line = document.createElement('div');
        line.className = 'thread-connector';
        contentArea.appendChild(line);

        threadData.forEach(pt => {
            threadHtml += `
                <div class="thread-item flex gap-3 mb-4">
                    <div class="shrink-0">
                        <div class="w-10 h-10 rounded-full avatar-placeholder flex items-center justify-center text-xs font-bold text-white">${(pt.author_name || 'U').charAt(0)}</div>
                    </div>
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-1 text-sm">
                            <span class="font-bold truncate">${pt.author_name}</span>
                            <span class="text-x-text-muted truncate">${pt.author_handle}</span>
                        </div>
                        <div class="text-[14px] leading-tight text-x-text mt-1 opacity-80">${pt.text}</div>
                        ${renderMedia(pt.media)}
                    </div>
                </div>
            `;
        });
    }

    // 3. Main Tweet
    const avatarCol = document.createElement('div');
    avatarCol.className = 'shrink-0 z-10';
    avatarCol.innerHTML = `<div class="w-12 h-12 rounded-full avatar-placeholder flex items-center justify-center text-white font-bold text-lg">${(bm.author_name || 'T').charAt(0).toUpperCase()}</div>`;
    
    const rightCol = document.createElement('div');
    rightCol.className = 'flex-1 min-w-0 z-10';
    
    const hRow = document.createElement('div');
    hRow.className = 'flex items-center gap-1 mb-0.5 flex-wrap';
    const authorName = bm.author_name || (bm.url.split('/')[2] || 'Tweet');
    const dateStr = new Date(bm.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    hRow.innerHTML = `<span class="font-bold text-[15px] hover:underline truncate max-w-[150px]">${authorName}</span>
                      <span class="text-x-text-muted text-[15px] truncate max-w-[100px]">${bm.author_handle || '@user'}</span>
                      <span class="text-x-text-muted text-[15px]">·</span>
                      <span class="text-x-text-muted text-[15px] hover:underline">${dateStr}</span>`;

    const bodyText = (bm.tweet_text && !appSettings.compactMode) ? `<div class="text-[15px] leading-relaxed break-words whitespace-pre-wrap blur-target mb-2">${bm.tweet_text}</div>` : '';
    const mediaHtml = renderMedia(bm.media_url);
    const noteHtml = bm.note ? `<div class="mt-3 text-sm text-x-text-muted border-l-2 border-x-blue pl-3 py-0.5 italic">${bm.note}</div>` : '';
    
    rightCol.appendChild(hRow);
    if (threadHtml && !appSettings.compactMode) {
        const tBox = document.createElement('div');
        tBox.innerHTML = threadHtml;
        rightCol.appendChild(tBox);
    }
    rightCol.innerHTML += bodyText + mediaHtml + noteHtml;

    contentArea.appendChild(avatarCol);
    contentArea.appendChild(rightCol);
    bodyWrapper.appendChild(contentArea);
    wrapper.appendChild(bodyWrapper);
    return wrapper;
}

function renderBookmarks(bookmarks, total, isSearch = false) {
    const container = document.getElementById('tweets-container');
    if (!container) return;
    container.innerHTML = '';
    if (!bookmarks.length) {
        container.innerHTML = `<div class="py-20 text-center text-x-text-muted flex flex-col items-center gap-4"><p class="text-xl font-bold">${t('no_bookmarks')}</p></div>`;
        return;
    }
    bookmarks.forEach(bm => container.appendChild(buildCard(bm)));
}

// ----------------------------------------------------
// Data Handlers
// ----------------------------------------------------
async function fetchBookmarks() {
    if (isLoading) return; isLoading = true;
    try {
        const res = await Auth.request(`/bookmarks?skip=${currentPage * PAGE_SIZE}&limit=${PAGE_SIZE}`);
        const data = await res.json();
        totalBookmarks = data.total;
        allBookmarks = currentPage === 0 ? data.bookmarks : [...allBookmarks, ...data.bookmarks];
        renderBookmarks(allBookmarks, totalBookmarks);
        fetchTimelineStats();
    } finally { isLoading = false; }
}

async function fetchTimelineStats() {
    try {
        const res = await Auth.request('/bookmarks/stats/timeline');
        const data = await res.json();
        const box = document.getElementById('timeline-list');
        if (!box) return;
        box.innerHTML = data.map(item => `
            <div class="flex justify-between items-center py-2 px-3 hover:bg-x-dark rounded-lg cursor-pointer transition text-sm" 
                 onclick="document.getElementById('search-input').value='${item.month}'; document.getElementById('search-input').dispatchEvent(new Event('input'))">
                <span class="font-medium">${item.month}</span>
                <span class="bg-x-border px-2 py-0.5 rounded-full text-[10px]">${item.count}</span>
            </div>
        `).join('');
    } catch(e){}
}

// ----------------------------------------------------
// Init & Modals
// ----------------------------------------------------
window.openModal = () => {
    document.getElementById('url').value = '';
    document.getElementById('save-modal').classList.remove('hidden');
};
window.closeModal = () => {
    document.getElementById('save-modal').classList.add('hidden');
};

document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname === '/') {
        if (!Auth.getToken()) window.location.href = '/login';
        applySettings();
        fetchBookmarks();
        
        document.getElementById('search-input')?.addEventListener('input', (e) => {
            const q = e.target.value.trim();
            currentPage = 0;
            if (q) {
                // Perform Deep Search (FTS5) - author_name, tweet_text are handled by backend
                Auth.request(`/bookmarks/search?q=${encodeURIComponent(q)}`).then(r => r.json()).then(d => {
                    allBookmarks = d;
                    renderBookmarks(allBookmarks, d.length, true);
                });
            } else { fetchBookmarks(); }
        });

        document.getElementById('add-bookmark-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                url: document.getElementById('url').value,
                category: document.getElementById('category').value || '未分類',
                tags: document.getElementById('tags').value,
                note: document.getElementById('note').value
            };
            const btn = e.target.querySelector('button[type="submit"]');
            btn.disabled = true; btn.innerText = "...";
            // Deep Unroll & Search Update: auto_fetch / fetch_thread is true by default in API
            const res = await Auth.request('/bookmarks?auto_fetch=true&fetch_thread=true', { 
                method: 'POST', 
                headers: {'Content-Type': 'application/json'}, 
                body: JSON.stringify(data)
            });
            if (res.ok) { window.closeModal(); fetchBookmarks(); fetchTimelineStats(); }
            btn.disabled = false; btn.innerText = t('btn_save');
        });

        window.openSettingsModal = () => {
            document.getElementById('set-lang').value = appSettings.lang;
            document.getElementById('set-compact').checked = appSettings.compactMode;
            document.getElementById('set-thread').checked = appSettings.showThread;
            document.getElementById('set-media').checked = appSettings.hideMedia;
            document.getElementById('settings-modal').classList.remove('hidden');
        };
        window.closeSettingsModal = () => {
            appSettings.lang = document.getElementById('set-lang').value;
            appSettings.compactMode = document.getElementById('set-compact').checked;
            appSettings.showThread = document.getElementById('set-thread').checked;
            appSettings.hideMedia = document.getElementById('set-media').checked;
            saveSettings();
            fetchBookmarks();
            document.getElementById('settings-modal').classList.add('hidden');
        };
    }
});
