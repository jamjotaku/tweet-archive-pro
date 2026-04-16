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
    
    // Sidebar Plugins visibility
    const exp = document.getElementById('plugin-export');
    const bml = document.getElementById('plugin-bookmarklet');
    if (exp) exp.classList.toggle('hidden', !appSettings.showExport);
    if (bml) bml.classList.toggle('hidden', !appSettings.showBookmarklet);

    applyTranslations();
}

// ----------------------------------------------------
// 2. i18n
// ----------------------------------------------------
const i18n = {
    en: {
        nav_home: "Home", nav_settings: "Settings", nav_batch: "Selection", nav_gallery: "Gallery", nav_profile: "Profile",
        header_title: "Bookmarks", search_placeholder: "Content, author, tags...",
        side_categories: "Categories", side_timeline: "Timeline", side_export: "Export Data",
        modal_save_title: "Save a Tweet", btn_save: "Save",
        set_group_general: "General UI", set_lang: "Language", set_group_view: "Tweet View",
        set_compact: "Compact Mode", set_thread: "Show Thread (Unroll)", set_media: "Hide Media",
        no_bookmarks: "No bookmarks found", btn_batch_sync: "Sync", btn_batch_delete: "Delete",
        selected_items: "selected", confirm_batch_delete: "Delete selected items?",
        btn_batch_link: 'Link', related_title: 'Related bookmarks:',
        btn_bookmark: "Bookmark", select_at_least_two: "Select at least 2 items",
        bookmarks_linked: "Bookmarks linked", btn_quick_save: "+ Save to Archive",
        modal_settings_title: "Settings & Extensions",
        set_group_general: "General UI", set_lang: "Language", set_lang_desc: "Interface language.",
        set_theme: "Theme Mode", set_theme_desc: "Change contrast levels.",
        set_blur: "Privacy Blur", set_blur_desc: "Blur card content.",
        set_group_view: "Content Display", set_media: "Hide Media", set_media_desc: "Save data in cards.",
        set_thread: "Show Thread", set_thread_desc: "Unroll parent tweets.",
        set_group_advanced: "Advanced Tools",
        set_autofetch: "Auto-Fetch Metadata", set_autofetch_desc: "Auto-fill missing details.",
        set_toolsexp: "Export Data Panel", set_toolsexp_desc: "Show export in sidebar.",
        set_toolsbml: "Bookmarklet Panel", set_toolsbml_desc: "Quick save button in sidebar."
    },
    ja: {
        nav_home: "ホーム", nav_settings: "設定", nav_batch: "一括選択", nav_gallery: "ギャラリー", nav_profile: "プロフィール",
        header_title: "保存済みツイート", search_placeholder: "本文、著者、タグで検索...",
        side_categories: 'カテゴリ', side_timeline: 'タイムライン', side_export: 'エクスポート', side_export_desc: '全データをダウンロード',
        side_bookmarklet: 'ブックマークレット', side_bookmarklet_desc: 'ボタンをブックマークバーにドラッグして、ツイートを即座に保存。',
        modal_save_title: "ツイートを保存", btn_save: "保存する",
        modal_settings_title: "設定と拡張機能",
        set_group_general: "共通 UI", set_lang: "言語", set_lang_desc: "インターフェースの言語",
        set_theme: "テーマ", set_theme_desc: "ダークモードのコントラストを調整",
        set_blur: "プライバシーぼかし", set_blur_desc: "ホバーした時のみ表示",
        set_group_view: "表示モード", set_media: "メディア非表示", set_media_desc: "画像の読み込みを制限",
        set_thread: "スレッド展開", set_thread_desc: "親ツイートも表示",
        set_group_advanced: "高度な設定",
        set_autofetch: "自動メタデータ取得", set_autofetch_desc: "保存時に著者名を自動補完",
        set_toolsexp: "データエクスポート", set_toolsexp_desc: "サイドバーに表示",
        set_toolsbml: "ブックマークレット", set_toolsbml_desc: "サイドバーに表示",
        no_bookmarks: '保存されたブックマークがありません。', btn_batch_sync: "一括同期", btn_batch_delete: "一括削除",
        selected_items: "件選択中", confirm_batch_delete: "選択したアイテムを削除しますか？",
        btn_batch_link: 'リンク', related_title: '関連ブックマーク:',
        btn_bookmark: "保存", select_at_least_two: "2つ以上のアイテムを選択してください",
        bookmarks_linked: "相互に関連付けました", btn_quick_save: "+ アーカイブに保存"
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
    const res = await Auth.request('/bookmarks/batch/delete', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ ids })
    });
    if (res.ok) {
        showToast(appSettings.lang === 'ja' ? "一括削除完了" : "Batch Deleted");
        allBookmarks = allBookmarks.filter(b => !selectedIds.has(b.id));
        totalBookmarks -= selectedIds.size;
        toggleBatchMode();
        renderBookmarks(allBookmarks, totalBookmarks);
        fetchTimelineStats();
    }
}

async function batchSync() {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    showToast(appSettings.lang === 'ja' ? "同期開始..." : "Syncing started...");
    for (const id of ids) {
        await Auth.request(`/bookmarks/${id}/sync`, { method: 'POST' });
    }
    showToast(appSettings.lang === 'ja' ? "一括同期完了" : "Batch Sync Done");
    fetchBookmarks();
}

async function exportData(format) {
    const res = await Auth.request(`/bookmarks/export?format=${format}`);
    if (res.ok) {
        if (format === 'csv') {
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `bookmarks_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
        } else {
            const data = await res.json();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `bookmarks_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
        }
    }
}

window.batchDelete = batchDelete;
window.batchSync = batchSync;
window.exportData = exportData;

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
    wrapper.dataset.id = bm.id;
    
    // Main Body Wrapper
    const bodyWrapper = document.createElement('div');
    bodyWrapper.className = 'flex relative w-full';

    bodyWrapper.onclick = (e) => {
        if (isBatchMode) {
            const cb = wrapper.querySelector('.batch-checkbox');
            if (cb) {
                cb.checked = !cb.checked;
                cb.dispatchEvent(new Event('change'));
            }
            return;
        }
        if (!e.target.closest('button') && !e.target.closest('a') && !e.target.closest('img')) {
            window.open(bm.url, '_blank');
        }
    };

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

    const avatarCol = document.createElement('div');
    avatarCol.className = 'shrink-0 z-10';
    avatarCol.innerHTML = `<div class="w-12 h-12 rounded-full avatar-placeholder flex items-center justify-center text-white font-bold text-lg">${(bm.author_name || 'T').charAt(0).toUpperCase()}</div>`;
    
    const rightCol = document.createElement('div');
    rightCol.className = 'flex-1 min-w-0 z-10';
    
    const hRow = document.createElement('div');
    hRow.className = 'flex items-center gap-1 mb-0.5 flex-wrap';
    const authorName = bm.author_name || (bm.url.split('/')[2] || 'Tweet');
    const dateStr = new Date(bm.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    hRow.innerHTML = `
        <span class="font-bold text-[15px] hover:underline truncate max-w-[150px]">${authorName}</span>
        <span class="text-x-text-muted text-[15px]">@${bm.author_handle || 'user'} · ${dateStr}</span>
        ${bm.category && bm.category !== '未分類' ? `<span class="ml-auto bg-x-blue/10 text-x-blue text-[10px] px-2 py-0.5 rounded-full font-bold uppercase transition hover:bg-x-blue/20" onclick="event.stopPropagation(); window.applyCategoryFilter('${bm.category}')">${bm.category}</span>` : ''}
    `;
    rightCol.appendChild(hRow);

    const txt = document.createElement('div');
    txt.className = 'text-[15px] leading-normal text-x-text mt-1 break-words';
    txt.innerText = bm.tweet_text || '';
    rightCol.appendChild(txt);

    if (bm.tags) {
        const tagBox = document.createElement('div');
        tagBox.className = 'flex flex-wrap gap-1 mt-2';
        bm.tags.split(',').forEach(tag => {
            if (!tag) return;
            const tSpan = document.createElement('span');
            tSpan.className = 'text-x-text-muted text-[12px] hover:text-x-blue transition cursor-pointer';
            tSpan.innerText = `#${tag}`;
            tSpan.onclick = (e) => {
                e.stopPropagation();
                const si = document.getElementById('search-input');
                if (si) { si.value = tag; si.dispatchEvent(new Event('input')); }
            };
            tagBox.appendChild(tSpan);
        });
        rightCol.appendChild(tagBox);
    }
    
    const mediaHtml = renderMedia(bm.media_url);
    if (mediaHtml) {
        const mDiv = document.createElement('div');
        mDiv.innerHTML = mediaHtml;
        rightCol.appendChild(mDiv);
    }

    if (bm.note_html || bm.note) {
        const noteBox = document.createElement('div');
        noteBox.className = 'mt-3 p-3 bg-x-dark border border-x-border rounded-xl text-[15px] prose prose-invert prose-sm max-w-none text-x-text opacity-90 markdown-body';
        if (bm.note_html) noteBox.innerHTML = bm.note_html;
        else noteBox.innerText = bm.note;
        if (window.hljs) noteBox.querySelectorAll('pre code').forEach((block) => hljs.highlightElement(block));
        rightCol.appendChild(noteBox);
    }

    contentArea.appendChild(avatarCol);
    contentArea.appendChild(rightCol);
    bodyWrapper.appendChild(contentArea);
    wrapper.appendChild(bodyWrapper);
    return wrapper;
}

async function renderBookmarks(bookmarks, total, isSearch = false) {
    const container = document.getElementById('tweets-container');
    if (!container) return;
    container.innerHTML = '';
    
    const loadingSpinner = document.getElementById('loading-spinner');
    if (loadingSpinner) loadingSpinner.style.display = 'none';

    if (!bookmarks.length) {
        container.innerHTML = `<div class="py-20 text-center text-x-text-muted flex flex-col items-center gap-4"><p class="text-xl font-bold">${t('no_bookmarks')}</p></div>`;
        return;
    }
    
    // パフォーマンス改善: すべてを非同期で待ってからではなく、生成された順にDOMに追加
    for (const bm of bookmarks) {
        // buildCard() が同期関数になったので await は不要（もし非同期のままなら順次 append する）
        const card = await buildCard(bm);
        container.appendChild(card);
    }
}

// ----------------------------------------------------
// Data Handlers
// ----------------------------------------------------
async function fetchBookmarks() {
    if (isLoading) return; isLoading = true;
    try {
        let url = `/bookmarks?skip=${currentPage * PAGE_SIZE}&limit=${PAGE_SIZE}`;
        if (currentFilter.type === 'category') url += `&category=${encodeURIComponent(currentFilter.value)}`;
        if (currentFilter.type === 'month') url += `&month=${encodeURIComponent(currentFilter.value)}`;
        
        const res = await Auth.request(url);
        const data = await res.json();
        totalBookmarks = data.total;
        allBookmarks = currentPage === 0 ? data.bookmarks : [...allBookmarks, ...data.bookmarks];
        renderBookmarks(allBookmarks, totalBookmarks);
        fetchTimelineStats();
        fetchCategories();
    } finally { isLoading = false; }
}

async function fetchCategories() {
    try {
        const res = await Auth.request('/bookmarks/categories');
        const data = await res.json();
        const box = document.getElementById('categories-list');
        if (!box) return;
        box.innerHTML = data.map(cat => `
            <div class="flex justify-between items-center py-2 px-3 hover:bg-x-dark rounded-lg cursor-pointer transition text-[15px] ${currentFilter.type === 'category' && currentFilter.value === cat.name ? 'text-x-blue bg-x-dark/50' : ''}" 
                 onclick="applyCategoryFilter('${cat.name}')">
                <span class="font-medium">${cat.name}</span>
                <span class="bg-x-border px-2 py-0.5 rounded-full text-[10px]">${cat.count}</span>
            </div>
        `).join('');
    } catch(e){}
}

window.applyCategoryFilter = (cat) => {
    if (currentFilter.type === 'category' && currentFilter.value === cat) {
        currentFilter = { type: null, value: null };
    } else {
        currentFilter = { type: 'category', value: cat };
    }
    currentPage = 0;
    fetchBookmarks();
};

async function fetchTimelineStats() {
    try {
        const res = await Auth.request('/bookmarks/stats/timeline');
        const data = await res.json();
        const box = document.getElementById('timeline-list');
        if (!box) return;
        box.innerHTML = data.map(item => `
            <div class="flex justify-between items-center py-2 px-3 hover:bg-x-dark rounded-lg cursor-pointer transition text-sm ${currentFilter.type === 'month' && currentFilter.value === item.month ? 'text-x-blue bg-x-dark/50' : ''}" 
                 onclick="applyMonthFilter('${item.month}')">
                <span class="font-medium">${item.month}</span>
                <span class="bg-x-border px-2 py-0.5 rounded-full text-[10px]">${item.count}</span>
            </div>
        `).join('');
    } catch(e){}
}

window.applyMonthFilter = (month) => {
    if (currentFilter.type === 'month' && currentFilter.value === month) {
        currentFilter = { type: null, value: null };
    } else {
        currentFilter = { type: 'month', value: month };
    }
    currentPage = 0;
    fetchBookmarks();
};

window.batchLink = async () => {
    if (selectedIds.size < 2) {
        showToast(t('select_at_least_two'), 'error');
        return;
    }
    const res = await Auth.request('/bookmarks/batch/link', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ ids: Array.from(selectedIds) })
    });
    if (res.ok) {
        showToast(t('bookmarks_linked'), 'success');
        toggleBatchMode();
        fetchBookmarks();
    }
};

// ----------------------------------------------------
// Init & Modals
// ----------------------------------------------------
window.openModal = () => {
    const urlEl = document.getElementById('url');
    if (urlEl) urlEl.value = '';
    document.getElementById('bookmark-modal')?.classList.remove('hidden');
};
window.closeModal = () => {
    document.getElementById('bookmark-modal')?.classList.add('hidden');
};

window.openSettingsModal = () => {
    const s = appSettings;
    const ids = {
        'set-lang': s.lang, 'set-theme': s.theme || 'lights-out',
        'set-blur': s.blurMode, 'set-media': s.hideMedia,
        'set-thread': s.showThread, 'set-autofetch': s.autoFetch,
        'set-toolsexp': s.showExport, 'set-toolsbml': s.showBookmarklet
    };
    for (const [id, val] of Object.entries(ids)) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.type === 'checkbox') el.checked = val;
        else el.value = val;
    }
    document.getElementById('settings-modal')?.classList.remove('hidden');
};

window.closeSettingsModal = () => {
    const s = appSettings;
    const mapping = {
        'set-lang': 'lang', 'set-theme': 'theme',
        'set-blur': 'blurMode', 'set-media': 'hideMedia',
        'set-thread': 'showThread', 'set-autofetch': 'autoFetch',
        'set-toolsexp': 'showExport', 'set-toolsbml': 'showBookmarklet'
    };
    for (const [id, key] of Object.entries(mapping)) {
        const el = document.getElementById(id);
        if (!el) continue;
        s[key] = el.type === 'checkbox' ? el.checked : el.value;
    }
    saveSettings();
    if (window.location.pathname === '/') fetchBookmarks();
    document.getElementById('settings-modal')?.classList.add('hidden');
};

window.openEditModal = (id) => {
    const bm = allBookmarks.find(b => b.id === id);
    if (!bm) return;
    const modal = document.getElementById('edit-modal');
    if (!modal) return;
    modal.dataset.id = id;
    const catEl = document.getElementById('edit-category');
    const tagEl = document.getElementById('edit-tags');
    const noteEl = document.getElementById('edit-note');
    if (catEl) catEl.value = bm.category || '';
    if (tagEl) tagEl.value = bm.tags || '';
    if (noteEl) noteEl.value = bm.note || '';
    modal.classList.remove('hidden');
};

window.closeEditModal = () => {
    document.getElementById('edit-modal')?.classList.add('hidden');
};

document.addEventListener('DOMContentLoaded', () => {
    // 共通初期化
    applySettings();
    
    // ブックマークレット URL の動的生成
    const bmlBtn = document.getElementById('bookmarklet-btn');
    if (bmlBtn) {
        const origin = window.location.origin;
        bmlBtn.href = `javascript:(function(){window.open('${origin}/?quick_save='+encodeURIComponent(location.href),'_blank','width=600,height=500');})();`;
    }

    // パスに関わらずユーザー情報を取得
    Auth.request('/users/me').then(r => r.json()).then(user => {
        if (user.username) {
            const elements = [
                'user-display-name', 'username-handle', 
                'profile-name', 'profile-handle', 'header-name'
            ];
            elements.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerText = id.includes('handle') ? user.username.toLowerCase() : user.username;
            });
        }
    }).catch(() => {});

    // ホームページ専用の初期化
    if (window.location.pathname === '/') {
        if (!Auth.getToken()) window.location.href = '/login';
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

        // Edit Form
        document.getElementById('edit-bookmark-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('edit-modal').dataset.id;
            const data = {
                category: document.getElementById('edit-category').value,
                tags: document.getElementById('edit-tags').value,
                note: document.getElementById('edit-note').value
            };
            const res = await Auth.request(`/bookmarks/${id}`, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(data)
            });
            if (res.ok) { window.closeEditModal(); fetchBookmarks(); }
        });

        // Logout
        document.getElementById('logout-btn')?.addEventListener('click', () => {
            Auth.logout();
        });
    }
});
