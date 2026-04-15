/**
 * app.js - Refined X-like Frontend with Batch Mode & Image Support
 */

const API_BASE = window.location.origin;

// ----------------------------------------------------
// 1. Settings & State
// ----------------------------------------------------
const defaultSettings = {
    lang: 'en',
    theme: 'lights-out',
    blurMode: false,
    compactMode: false,
    hideMedia: false,
    showThread: false,
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
let selectedIds = new Set();
let currentPage = 0;
let totalBookmarks = 0;
let allBookmarks = [];
let isLoading = false;
const PAGE_SIZE = 20;

function saveSettings() {
    localStorage.setItem('appSettings', JSON.stringify(appSettings));
    applySettings();
}

function applySettings() {
    document.body.classList.toggle('theme-dim', appSettings.theme === 'dim');
    document.body.classList.toggle('blur-mode', appSettings.blurMode);
    document.body.classList.toggle('compact-mode', appSettings.compactMode);
    
    const expPlugin = document.getElementById('plugin-export');
    const bmPlugin = document.getElementById('plugin-bookmarklet');
    if(expPlugin) expPlugin.style.display = appSettings.showExport ? 'block' : 'none';
    if(bmPlugin) bmPlugin.style.display = appSettings.showBookmarklet ? 'block' : 'none';
    
    applyTranslations();
}

// ----------------------------------------------------
// 2. i18n
// ----------------------------------------------------
const i18n = {
    en: {
        nav_home: "Home", nav_settings: "Settings", nav_batch: "Selection", btn_bookmark: "Bookmark",
        header_title: "Bookmarks", search_placeholder: "Search notes, tags...",
        side_categories: "Categories", side_export: "Export Data", side_export_desc: "Download all your bookmarks.",
        side_bookmarklet: "Quick Save", side_bookmarklet_desc: "Drag this button to your bookmarks bar.",
        btn_quick_save: "+ Save to Archive",
        modal_save_title: "Save a Tweet", input_url: "Tweet URL *", input_category: "Category",
        input_tags: "Tags (comma separated)", input_note: "Note / Memo", btn_save: "Save",
        modal_settings_title: "Extensions & Settings",
        set_group_general: "General UI", set_lang: "Language", set_theme: "Theme", set_blur: "Privacy Blur",
        set_group_view: "Tweet View", set_compact: "Compact Mode", set_media: "Hide Media", set_thread: "Show Conversation",
        set_group_advanced: "Advanced / Tools", set_autofetch: "Auto-Fetch Metadata", set_toolsexp: "Export Panel", set_toolsbm: "Bookmarklet",
        no_bookmarks: "No bookmarks yet", edit_modal_title: "Edit Bookmark", btn_update: "Update",
        confirm_delete: "Delete this bookmark?", load_more: "Load more",
        btn_batch_sync: "Sync", btn_batch_delete: "Delete", selected_items: "selected", confirm_batch_delete: "Delete selected bookmarks?",
    },
    ja: {
        nav_home: "ホーム", nav_settings: "設定", nav_batch: "一括選択", btn_bookmark: "ブックマークする",
        header_title: "保存済みツイート", search_placeholder: "メモやタグで検索...",
        side_categories: "カテゴリ", side_export: "データ出力", side_export_desc: "全データをダウンロード",
        side_bookmarklet: "クイック保存", side_bookmarklet_desc: "ブラウザのブックマークバーに登録",
        btn_quick_save: "+ Archiveに保存",
        modal_save_title: "ツイートを保存", input_url: "ツイートURL *", input_category: "カテゴリ",
        input_tags: "タグ (カンマ区切り)", input_note: "メモ / メタデータ", btn_save: "保存する",
        modal_settings_title: "設定 ＆ 拡張機能",
        set_group_general: "共通 UI", set_lang: "言語", set_theme: "テーマ", set_blur: "プライバシーぼかし",
        set_group_view: "表示モード", set_compact: "リスト表示", set_media: "メディア非表示", set_thread: "スレッド表示",
        set_group_advanced: "高度な機能", set_autofetch: "自動データ取得", set_toolsexp: "エクスポート", set_toolsbm: "管理ツール",
        no_bookmarks: "保存済みツイートがありません", edit_modal_title: "ブックマークを編集", btn_update: "更新",
        confirm_delete: "削除しますか？", load_more: "もっと読む",
        btn_batch_sync: "同期", btn_batch_delete: "削除", selected_items: "件選択中", confirm_batch_delete: "選択したツイートをすべて削除しますか？",
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
    if (btn) btn.classList.toggle('text-x-blue', isBatchMode);
    updateBatchCount();
    renderBookmarks(allBookmarks, totalBookmarks, false);
}

function updateBatchCount() {
    const countEl = document.getElementById('selected-count');
    if (countEl) countEl.innerText = `${selectedIds.size} ${t('selected_items')}`;
}

async function syncBookmark(id, buttonEl = null) {
    if (buttonEl) { buttonEl.disabled = true; buttonEl.classList.add('animate-spin'); }
    try {
        const res = await Auth.request(`/bookmarks/${id}/sync`, { method: 'POST' });
        if (res.ok) {
            showToast(t('ja' ? "同期完了" : "Synced"));
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

async function batchSync() {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    showToast(t('ja' ? "一括同期を開始します..." : "Starting batch sync..."));
    for (const id of ids) { await syncBookmark(id); }
    toggleBatchMode();
}

async function batchDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(t('confirm_batch_delete'))) return;
    const ids = Array.from(selectedIds);
    for (const id of ids) { await Auth.request(`/bookmarks/${id}`, { method: 'DELETE' }); }
    showToast(t('ja' ? "一括削除完了" : "Batch delete completed"));
    allBookmarks = allBookmarks.filter(b => !selectedIds.has(b.id));
    totalBookmarks -= selectedIds.size;
    toggleBatchMode();
    renderBookmarks(allBookmarks, totalBookmarks);
}

// ----------------------------------------------------
// Card Builder (The "X" Look)
// ----------------------------------------------------
function buildCard(bm) {
    const wrapper = document.createElement('article');
    wrapper.className = 'tweet-card border-b border-x-border relative group cursor-pointer flex';
    wrapper.onclick = (e) => {
        if (isBatchMode) {
            const cb = wrapper.querySelector('.batch-checkbox');
            cb.checked = !cb.checked;
            cb.dispatchEvent(new Event('change'));
            return;
        }
        if (!e.target.closest('button') && !e.target.closest('a') && !e.target.closest('.media-preview')) {
            window.open(bm.url, '_blank');
        }
    };

    // 1. Batch Checkbox (Selection Mode)
    if (isBatchMode) {
        const checkArea = document.createElement('div');
        checkArea.className = 'pl-4 pt-4 flex flex-col items-center z-10';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'batch-checkbox';
        checkbox.checked = selectedIds.has(bm.id);
        checkbox.onclick = (e) => { e.stopPropagation(); };
        checkbox.onchange = (e) => {
            if (e.target.checked) selectedIds.add(bm.id);
            else selectedIds.delete(bm.id);
            updateBatchCount();
        };
        checkArea.appendChild(checkbox);
        wrapper.appendChild(checkArea);
    }

    const mainContent = document.createElement('div');
    mainContent.className = 'flex-1 p-4 flex gap-3 min-w-0';

    // 2. Avatar Placeholder
    const avatarCol = document.createElement('div');
    avatarCol.className = 'shrink-0';
    avatarCol.innerHTML = `<div class="w-12 h-12 rounded-full avatar-placeholder flex items-center justify-center text-white font-bold text-lg">${(bm.author_name || 'U').charAt(0).toUpperCase()}</div>`;
    mainContent.appendChild(avatarCol);

    // 3. Right Side (Text & Media)
    const rightCol = document.createElement('div');
    rightCol.className = 'flex-1 min-w-0';
    
    // Header Row: User Name & Handle + Date
    const hRow = document.createElement('div');
    hRow.className = 'flex items-center gap-1 mb-0.5 flex-wrap';
    const dateStr = new Date(bm.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    
    // Fallback name logic
    const authorName = bm.author_name || (bm.url.split('/')[2] || 'Tweet');
    const authorHandle = bm.author_handle || `@${bm.tweet_id}`;

    hRow.innerHTML = `
        <span class="font-bold text-[15px] hover:underline truncate max-w-[150px]">${authorName}</span>
        <span class="text-x-text-muted text-[15px] truncate max-w-[100px]">${authorHandle}</span>
        <span class="text-x-text-muted text-[15px]">·</span>
        <span class="text-x-text-muted text-[15px] hover:underline">${dateStr}</span>
    `;
    
    // Actions Tooltip
    const actionBox = document.createElement('div');
    actionBox.className = 'ml-auto flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity';
    if (!isBatchMode) {
        const syncBtn = document.createElement('button');
        syncBtn.className = 'p-2 hover:bg-x-blue hover:bg-opacity-10 rounded-full text-x-text-muted hover:text-x-blue transition';
        syncBtn.innerHTML = '<ion-icon name="sync-outline"></ion-icon>';
        syncBtn.title = "Sync Metadata";
        syncBtn.onclick = (e) => { e.stopPropagation(); syncBookmark(bm.id, syncBtn); };
        
        const editBtn = document.createElement('button');
        editBtn.className = 'p-2 hover:bg-x-blue hover:bg-opacity-10 rounded-full text-x-text-muted hover:text-x-blue transition';
        editBtn.innerHTML = '<ion-icon name="create-outline"></ion-icon>';
        editBtn.onclick = (e) => { e.stopPropagation(); window.openEditModal(bm); };
        
        const delBtn = document.createElement('button');
        delBtn.className = 'p-2 hover:bg-red-500 hover:bg-opacity-10 rounded-full text-x-text-muted hover:text-red-500 transition';
        delBtn.innerHTML = '<ion-icon name="trash-outline"></ion-icon>';
        delBtn.onclick = (e) => { e.stopPropagation(); deleteBookmark(bm.id); };
        
        actionBox.appendChild(syncBtn);
        actionBox.appendChild(editBtn);
        actionBox.appendChild(delBtn);
        hRow.appendChild(actionBox);
    }
    
    rightCol.appendChild(hRow);

    // Tweet Text
    if (bm.tweet_text && !appSettings.compactMode) {
        const textP = document.createElement('div');
        textP.className = 'text-[15px] leading-relaxed break-words whitespace-pre-wrap blur-target';
        textP.innerText = bm.tweet_text;
        rightCol.appendChild(textP);
    } else if (!bm.tweet_text && !appSettings.compactMode) {
        const link = document.createElement('a');
        link.href = bm.url; link.target = "_blank";
        link.className = "text-x-blue hover:underline text-sm break-all";
        link.innerText = bm.url;
        rightCol.appendChild(link);
    }

    // Media Preview
    if (bm.media_url && !appSettings.hideMedia && !appSettings.compactMode) {
        // media_url might be a pic.twitter.com link (not direct img)
        // If it looks like fxtwitter mosaic or direct img, show it
        const isDirect = bm.media_url.match(/\.(jpg|jpeg|png|webp|gif)$/i) || bm.media_url.includes('mosaic');
        const mediaDiv = document.createElement('div');
        mediaDiv.className = 'media-preview';
        if (isDirect) {
            mediaDiv.innerHTML = `<img src="${bm.media_url}" loading="lazy" onclick="event.stopPropagation(); window.open('${bm.url}', '_blank')">`;
        } else {
            // It's a pic link, we can't show it directly but we show a placeholder box
            mediaDiv.innerHTML = `<div class="h-32 flex flex-col items-center justify-center text-x-text-muted gap-2 bg-x-dark">
                <ion-icon name="image-outline" class="text-3xl"></ion-icon>
                <span class="text-xs">Click to view image on X</span>
            </div>`;
        }
        rightCol.appendChild(mediaDiv);
    }

    // Note Area (Internal)
    if (bm.note) {
        const noteDiv = document.createElement('div');
        noteDiv.className = 'mt-3 text-sm text-x-text-muted border-l-2 border-x-blue pl-3 py-0.5 italic';
        noteDiv.innerText = bm.note;
        rightCol.appendChild(noteDiv);
    }

    // Bottom Row: Tags & Category
    const bRow = document.createElement('div');
    bRow.className = 'flex flex-wrap gap-2 mt-3 items-center';
    bRow.innerHTML = `<span class="bg-x-dark border border-x-border px-2 py-0.5 rounded text-[12px] text-x-text-muted">${bm.category}</span>`;
    if (bm.tags) {
        bm.tags.split(',').forEach(t => {
            const v = t.trim();
            if (v) bRow.innerHTML += `<span class="text-x-blue text-[13px] hover:underline">#${v}</span>`;
        });
    }
    rightCol.appendChild(bRow);

    mainContent.appendChild(rightCol);
    wrapper.appendChild(mainContent);
    return wrapper;
}

function renderBookmarks(bookmarks, total, isSearch = false) {
    const container = document.getElementById('tweets-container');
    if (!container) return;
    container.innerHTML = '';
    
    if (!bookmarks || bookmarks.length === 0) {
        container.innerHTML = `<div class="py-20 text-center text-x-text-muted flex flex-col items-center gap-4">
            <ion-icon name="search-outline" class="text-5xl opacity-50"></ion-icon>
            <p class="text-xl font-bold">${t('no_bookmarks')}</p>
        </div>`;
        return;
    }

    bookmarks.forEach(bm => container.appendChild(buildCard(bm)));

    // Infinite Scroll Sentinel
    if (!isSearch && bookmarks.length < total) {
        const sen = document.createElement('div');
        sen.id = 'scroll-sentinel';
        sen.className = 'py-10 flex justify-center border-b border-x-border h-20';
        sen.innerHTML = `<ion-icon name="sync" class="animate-spin text-2xl text-x-blue"></ion-icon>`;
        container.appendChild(sen);
        
        const obs = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && !isLoading) {
                currentPage++;
                fetchBookmarks(true);
                obs.disconnect();
            }
        }, { threshold: 0.1 });
        obs.observe(sen);
    }
}

// ----------------------------------------------------
// Data Handlers
// ----------------------------------------------------
async function fetchBookmarks(append = false) {
    if (isLoading) return;
    isLoading = true;
    try {
        const res = await Auth.request(`/bookmarks?skip=${currentPage * PAGE_SIZE}&limit=${PAGE_SIZE}`);
        const data = await res.json();
        totalBookmarks = data.total;
        allBookmarks = append ? [...allBookmarks, ...data.bookmarks] : data.bookmarks;
        renderBookmarks(allBookmarks, totalBookmarks, false);
        generateCategoriesMap(allBookmarks);
    } finally { isLoading = false; }
}

async function searchBookmarks(query) {
    if (isLoading) return;
    isLoading = true;
    try {
        const data = await (await Auth.request(`/bookmarks/search?q=${encodeURIComponent(query)}`)).json();
        allBookmarks = Array.isArray(data) ? data : [];
        renderBookmarks(allBookmarks, allBookmarks.length, true);
    } finally { isLoading = false; }
}

async function deleteBookmark(id) {
    if (!confirm(t('confirm_delete'))) return;
    await Auth.request(`/bookmarks/${id}`, { method: 'DELETE' });
    allBookmarks = allBookmarks.filter(b => b.id !== id);
    totalBookmarks--;
    renderBookmarks(allBookmarks, totalBookmarks);
}

function generateCategoriesMap(bookmarks) {
    const box = document.getElementById('categories-list');
    if (!box) return;
    const cats = {};
    bookmarks.forEach(b => cats[b.category] = (cats[b.category] || 0) + 1);
    box.innerHTML = Object.entries(cats).sort((a,b) => b[1]-a[1]).slice(0, 10).map(([c, count]) => `
        <div class="flex justify-between items-center py-2 px-3 hover:bg-x-dark rounded-lg cursor-pointer transition" 
             onclick="document.getElementById('search-input').value='${c}'; document.getElementById('search-input').dispatchEvent(new Event('input'))">
            <span class="font-medium truncate text-[15px]">${c}</span>
            <span class="text-xs bg-x-border text-x-text-muted px-2 py-0.5 rounded-full">${count}</span>
        </div>
    `).join('');
}

// ----------------------------------------------------
// Init
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname === '/') {
        if (!Auth.getToken()) window.location.href = '/login';
        applySettings();
        fetchBookmarks();
        
        let st;
        document.getElementById('search-input')?.addEventListener('input', (e) => {
            clearTimeout(st);
            st = setTimeout(() => {
                const q = e.target.value.trim();
                currentPage = 0;
                q ? searchBookmarks(q) : fetchBookmarks();
            }, 600);
        });

        // Modals & Button bindings
        document.getElementById('logout-btn')?.addEventListener('click', () => Auth.logout());
        document.getElementById('add-bookmark-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                url: document.getElementById('url').value,
                category: document.getElementById('category').value || '未分類',
                tags: document.getElementById('tags').value,
                note: document.getElementById('note').value
            };
            const res = await Auth.request('/bookmarks?auto_fetch=true', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)});
            if (res.ok) { window.closeModal(); fetchBookmarks(); }
        });
        
        window.openModal = () => document.getElementById('bookmark-modal').classList.remove('hidden');
        window.closeModal = () => document.getElementById('bookmark-modal').classList.add('hidden');
        window.openSettingsModal = () => {
            // Load settings into UI
            document.getElementById('set-lang').value = appSettings.lang;
            document.getElementById('set-theme').value = appSettings.theme;
            document.getElementById('set-blur').checked = appSettings.blurMode;
            document.getElementById('set-compact').checked = appSettings.compactMode;
            document.getElementById('settings-modal').classList.remove('hidden');
        };
        window.closeSettingsModal = () => {
            appSettings.lang = document.getElementById('set-lang').value;
            appSettings.theme = document.getElementById('set-theme').value;
            appSettings.blurMode = document.getElementById('set-blur').checked;
            appSettings.compactMode = document.getElementById('set-compact').checked;
            saveSettings();
            document.getElementById('settings-modal').classList.add('hidden');
            fetchBookmarks();
        };

        // Edit Flow
        let editingId = null;
        window.openEditModal = (bm) => {
            editingId = bm.id;
            document.getElementById('edit-category').value = bm.category;
            document.getElementById('edit-tags').value = bm.tags || '';
            document.getElementById('edit-note').value = bm.note || '';
            document.getElementById('edit-modal').classList.remove('hidden');
        };
        window.closeEditModal = () => document.getElementById('edit-modal').classList.add('hidden');
        document.getElementById('edit-bookmark-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                category: document.getElementById('edit-category').value,
                tags: document.getElementById('edit-tags').value,
                note: document.getElementById('edit-note').value
            };
            await Auth.request(`/bookmarks/${editingId}`, { method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)});
            closeEditModal();
            fetchBookmarks();
        });
    }
});
