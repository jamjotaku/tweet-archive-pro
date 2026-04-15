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
        btn_batch_link: 'Link', related_title: 'Related bookmarks:'
    },
    ja: {
        nav_home: "ホーム", nav_settings: "設定", nav_batch: "一括選択", nav_gallery: "ギャラリー",
        header_title: "保存済みツイート", search_placeholder: "本文、著者、タグで検索...",
        side_categories: 'カテゴリ',
        side_timeline: 'タイムライン',
        side_export: 'エクスポート',
        side_export_desc: '全データをダウンロード',
        side_bookmarklet: 'ブックマークレット',
        side_bookmarklet_desc: 'ボタンをブックマークバーにドラッグして、ツイートを即座に保存。',
        modal_save_title: "ツイートを保存", btn_save: "保存する",
        set_group_general: "共通 UI", set_lang: "言語", set_group_view: "表示モード",
        set_compact: "リスト表示", set_thread: "スレッド展開", set_media: "メディア非表示",
        no_bookmarks: '保存されたブックマークがありません。', btn_batch_sync: "同期", btn_batch_delete: "削除",
        selected_items: "件選択中", confirm_batch_delete: "選択したアイテムを削除しますか？",
        btn_batch_link: 'リンク', related_title: '関連ブックマーク:'
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

async function buildCard(bm) {
    const wrapper = document.createElement('article');
    wrapper.className = `tweet-card border-b border-x-border relative group cursor-pointer flex flex-col`;
    wrapper.dataset.id = bm.id;
    
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
        ${bm.category && bm.category !== '未分類' ? `<span class="ml-auto bg-x-blue/10 text-x-blue text-[10px] px-2 py-0.5 rounded-full font-bold uppercase transition hover:bg-x-blue/20" onclick="event.stopPropagation(); applyCategoryFilter('${bm.category}')">${bm.category}</span>` : ''}
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
                document.getElementById('search-input').value = tag;
                document.getElementById('search-input').dispatchEvent(new Event('input'));
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

    if (bm.note) {
        const noteBox = document.createElement('div');
        noteBox.className = 'mt-3 p-3 bg-x-dark border border-x-border rounded-xl text-sm italic text-x-text-muted opacity-80';
        noteBox.innerText = bm.note;
        rightCol.appendChild(noteBox);
    }

    // Related Bookmarks Section
    try {
        const linksRes = await Auth.request(`/bookmarks/${bm.id}/links`);
        if (linksRes.ok) {
            const links = await linksRes.json();
            if (links.length > 0) {
                const linkBox = document.createElement('div');
                linkBox.className = 'mt-3 pt-2 border-t border-x-border/30 flex flex-col gap-1';
                linkBox.innerHTML = `<span class="text-[10px] font-bold text-x-text-muted uppercase tracking-wider">${t('related_title')}</span>`;
                links.forEach(l => {
                    const lA = document.createElement('a');
                    lA.className = 'text-x-blue text-xs hover:underline flex items-center gap-1';
                    lA.innerHTML = `<ion-icon name="link"></ion-icon> ${l.author_name || 'Tweet'}: ${l.tweet_text ? l.tweet_text.substring(0, 30) + '...' : l.url.substring(0, 30)}`;
                    lA.onclick = (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        const target = document.querySelector(`article[data-id="${l.id}"]`);
                        if (target) {
                            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            target.classList.add('bg-x-blue/10');
                            setTimeout(() => target.classList.remove('bg-x-blue/10'), 2000);
                        } else {
                            window.open(l.url, '_blank');
                        }
                    };
                    linkBox.appendChild(lA);
                });
                rightCol.appendChild(linkBox);
            }
        }
    } catch(e){}

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
    if (!bookmarks.length) {
        container.innerHTML = `<div class="py-20 text-center text-x-text-muted flex flex-col items-center gap-4"><p class="text-xl font-bold">${t('no_bookmarks')}</p></div>`;
        return;
    }
    // buildCard is now async, so we must await all of them
    for (const bm of bookmarks) {
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
    document.getElementById('url').value = '';
    // ID in index.html is bookmark-modal
    document.getElementById('bookmark-modal').classList.remove('hidden');
};
window.closeModal = () => {
    document.getElementById('bookmark-modal').classList.add('hidden');
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

        // Logout
        document.getElementById('logout-btn')?.addEventListener('click', () => {
            Auth.logout();
        });

        // User Profile Info
        Auth.request('/users/me').then(r => r.json()).then(user => {
            if (user.username) {
                document.getElementById('user-display-name').innerText = user.username;
                document.getElementById('username-handle').innerText = user.username.toLowerCase();
            }
        }).catch(() => {});

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
