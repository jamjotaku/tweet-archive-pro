/**
 * app.js - X.com風フロントエンドのロジック + Extensions
 */

const API_BASE = window.location.origin;

// ----------------------------------------------------
// 1. Settings & Extensions Manager
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

function saveSettings() {
    localStorage.setItem('appSettings', JSON.stringify(appSettings));
    applySettings();
}

function applySettings() {
    // Theme
    document.body.classList.toggle('theme-dim', appSettings.theme === 'dim');
    // Blur
    document.body.classList.toggle('blur-mode', appSettings.blurMode);
    // Compact
    document.body.classList.toggle('compact-mode', appSettings.compactMode);
    
    // Tools panels
    const expPlugin = document.getElementById('plugin-export');
    const bmPlugin = document.getElementById('plugin-bookmarklet');
    if(expPlugin) expPlugin.style.display = appSettings.showExport ? 'block' : 'none';
    if(bmPlugin) bmPlugin.style.display = appSettings.showBookmarklet ? 'block' : 'none';

    // UI Language
    applyTranslations();
}

// ----------------------------------------------------
// 2. i18n Translation Dictionary
// ----------------------------------------------------
const i18n = {
    en: {
        nav_home: "Home", nav_settings: "Settings", btn_bookmark: "Bookmark",
        header_title: "Bookmarks", search_placeholder: "Search notes, tags...",
        side_categories: "Categories", side_export: "Export Data", side_export_desc: "Download all your bookmarks.",
        side_bookmarklet: "Quick Save", side_bookmarklet_desc: "Drag this button to your bookmarks bar to save tweets instantly.",
        btn_quick_save: "+ Save to Archive",
        modal_save_title: "Save a Tweet", input_url: "Tweet URL *", input_category: "Category",
        input_tags: "Tags (comma separated)", input_note: "Note / Memo", btn_save: "Save",
        modal_settings_title: "Extensions & Settings",
        set_group_general: "General UI", set_lang: "Language", set_lang_desc: "Switch interface language.",
        set_theme: "Theme Mode", set_theme_desc: "Lights Out or Dim.", set_blur: "Privacy Blur Mode", set_blur_desc: "Blur all content until hovered.",
        set_group_view: "Tweet View", set_compact: "Compact View", set_compact_desc: "Hide heavy widgets, show basic text list.",
        set_media: "Hide Media (Data Saver)", set_media_desc: "Do not load images or videos in cards.",
        set_thread: "Show Conversation", set_thread_desc: "Show parent tweet if it's a reply.",
        set_group_advanced: "Advanced / Tools", set_autofetch: "Auto-Fetch Metadata", set_autofetch_desc: "Auto-fill notes with tweet author name.",
        set_toolsexp: "Export Tool Panel", set_toolsexp_desc: "Show data export options in sidebar.",
        set_toolsbm: "Bookmarklet Panel", set_toolsbm_desc: "Show quick save bookmarklet."
    },
    ja: {
        nav_home: "ホーム", nav_settings: "設定＆拡張", btn_bookmark: "ブックマークする",
        header_title: "保存済みツイート", search_placeholder: "メモやタグで検索...",
        side_categories: "カテゴリ", side_export: "データ出力", side_export_desc: "すべてのデータをバックアップします",
        side_bookmarklet: "クイック保存", side_bookmarklet_desc: "このボタンをブックマークバーにドラッグすると、1クリック保存が使えるようになります",
        btn_quick_save: "+ Archiveに保存",
        modal_save_title: "ツイートを保存", input_url: "ツイートURL *", input_category: "カテゴリ",
        input_tags: "タグ (カンマ区切り)", input_note: "メモ / メタデータ", btn_save: "保存する",
        modal_settings_title: "設定 ＆ 拡張機能",
        set_group_general: "共通 UI", set_lang: "言語 (Language)", set_lang_desc: "表示言語を切り替えます。",
        set_theme: "テーマ", set_theme_desc: "画面全体の暗さを切り替えます", set_blur: "プライバシー ぼかしモード", set_blur_desc: "ホバーするまで内容をぼかして隠します",
        set_group_view: "表示モード", set_compact: "コンパクト表示", set_compact_desc: "公式ウィジェットを無効にし、軽量・高速なリスト表示にします",
        set_media: "メディア・カード非表示", set_media_desc: "ツイート付属の画像や動画を極力読み込みません",
        set_thread: "会話スレッドを表示", set_thread_desc: "リプライ元などの親ツイートも表示します",
        set_group_advanced: "高度な機能・ツール", set_autofetch: "自動メタデータ取得", set_autofetch_desc: "URLのみで保存時、投稿者名などを自動でメモに入力します",
        set_toolsexp: "エクスポートツール", set_toolsexp_desc: "サイドバーにCSV/JSON出力パネルを表示します",
        set_toolsbm: "ブックマークレット", set_toolsbm_desc: "サイドバーに1クリック保存ツールを表示します"
    }
};

function applyTranslations() {
    const d = i18n[appSettings.lang] || i18n['en'];
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (d[key]) {
            if(el.tagName === 'INPUT' && el.type === 'button') el.value = d[key];
            else el.innerText = d[key];
        }
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (d[key]) el.placeholder = d[key];
    });
}


// ----------------------------------------------------
// Toast Notifications
// ----------------------------------------------------
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    const bgColor = type === 'error' ? 'bg-x-error' : 'bg-x-blue';
    toast.className = `toast-animate ${bgColor} text-white px-6 py-3 rounded-full shadow-lg font-medium text-sm flex items-center gap-2`;
    toast.innerHTML = `<ion-icon name="${type === 'error' ? 'alert-circle' : 'checkmark-circle'}" class="text-xl"></ion-icon> ${message}`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.remove('toast-animate');
        toast.classList.add('toast-exit');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ----------------------------------------------------
// Authentication Manager
// ----------------------------------------------------
const Auth = {
    getToken() { return localStorage.getItem('token'); },
    setToken(token) { localStorage.setItem('token', token); },
    logout() {
        localStorage.removeItem('token');
        window.location.href = '/login';
    },
    async request(endpoint, options = {}) {
        const token = this.getToken();
        const headers = options.headers || {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const config = { ...options, headers };
        const response = await fetch(`${API_BASE}${endpoint}`, config);
        if (response.status === 401 && endpoint.indexOf('/token') === -1) {
            this.logout();
            throw new Error('Unauthorized');
        }
        return response;
    }
};

// ----------------------------------------------------
// Login / Registration Page Logic
// ----------------------------------------------------
if (window.location.pathname === '/login') {
    if (Auth.getToken()) window.location.href = '/';

    const authForm = document.getElementById('auth-form');
    let isLoginMode = true;

    document.getElementById('toggle-mode-btn')?.addEventListener('click', (e) => {
        isLoginMode = !isLoginMode;
        document.getElementById('form-title').innerText = isLoginMode ? 'Log in to Archive' : 'Create your account';
        document.getElementById('submit-btn').innerText = isLoginMode ? 'Log in' : 'Sign up';
        e.target.innerText = isLoginMode ? 'Sign up' : 'Log in';
        e.target.parentElement.firstChild.textContent = isLoginMode ? "Don't have an account? " : "Already have an account? ";
    });

    authForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(authForm));
        const submitBtn = document.getElementById('submit-btn');
        submitBtn.disabled = true;

        try {
            if (isLoginMode) {
                const body = new URLSearchParams({ username: data.username, password: data.password });
                const res = await fetch(`${API_BASE}/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
                if (!res.ok) throw new Error('Invalid credentials');
                Auth.setToken((await res.json()).access_token);
                localStorage.setItem('username', data.username);
                window.location.href = '/';
            } else {
                const res = await fetch(`${API_BASE}/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
                if (!res.ok) throw new Error('Username already exists');
                showToast('Account created! Please log in.', 'success');
                document.getElementById('toggle-mode-btn').click();
            }
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            submitBtn.disabled = false;
        }
    });
}

// ----------------------------------------------------
// Main App Page Logic
// ----------------------------------------------------
if (window.location.pathname === '/') {
    if (!Auth.getToken()) window.location.href = '/login';

    applySettings(); // Initialize UI based on extensions
    
    // Quick Save bookmarklet receiver logic
    const urlParams = new URLSearchParams(window.location.search);
    if(urlParams.has('quick_save')) {
        setTimeout(() => {
            window.openModal();
            document.getElementById('url').value = urlParams.get('quick_save');
        }, 500);
        // clean url
        window.history.replaceState({}, document.title, "/");
    }

    const username = localStorage.getItem('username') || 'User';
    if(document.getElementById('user-display-name')) document.getElementById('user-display-name').innerText = username;
    if(document.getElementById('username-handle')) document.getElementById('username-handle').innerText = username.toLowerCase();

    document.getElementById('logout-btn')?.addEventListener('click', () => Auth.logout());

    // Search logic
    let searchTimeout;
    document.getElementById('search-input')?.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        searchTimeout = setTimeout(() => {
            if (query.length > 0) searchBookmarks(query);
            else fetchBookmarks();
        }, 500);
    });

    // Modals
    const modal = document.getElementById('bookmark-modal');
    window.openModal = () => { modal.classList.remove('hidden'); document.body.style.overflow = 'hidden'; };
    window.closeModal = () => { modal.classList.add('hidden'); document.body.style.overflow = 'auto'; document.getElementById('add-bookmark-form').reset(); };

    const setModal = document.getElementById('settings-modal');
    window.openSettingsModal = () => {
        // Populate inputs
        document.getElementById('set-lang').value = appSettings.lang;
        document.getElementById('set-theme').value = appSettings.theme;
        document.getElementById('set-blur').checked = appSettings.blurMode;
        document.getElementById('set-compact').checked = appSettings.compactMode;
        document.getElementById('set-media').checked = appSettings.hideMedia;
        document.getElementById('set-thread').checked = appSettings.showThread;
        document.getElementById('set-autofetch').checked = appSettings.autoFetch;
        document.getElementById('set-toolsexp').checked = appSettings.showExport;
        document.getElementById('set-toolsbm').checked = appSettings.showBookmarklet;
        
        setModal.classList.remove('hidden'); 
        document.body.style.overflow = 'hidden'; 
    };
    
    window.closeSettingsModal = () => {
        // Save inputs
        appSettings.lang = document.getElementById('set-lang').value;
        appSettings.theme = document.getElementById('set-theme').value;
        appSettings.blurMode = document.getElementById('set-blur').checked;
        appSettings.compactMode = document.getElementById('set-compact').checked;
        appSettings.hideMedia = document.getElementById('set-media').checked;
        appSettings.showThread = document.getElementById('set-thread').checked;
        appSettings.autoFetch = document.getElementById('set-autofetch').checked;
        appSettings.showExport = document.getElementById('set-toolsexp').checked;
        appSettings.showBookmarklet = document.getElementById('set-toolsbm').checked;
        
        saveSettings();
        setModal.classList.add('hidden'); 
        document.body.style.overflow = 'auto';
        
        // Refresh UI
        const query = document.getElementById('search-input').value.trim();
        if (query.length > 0) searchBookmarks(query);
        else fetchBookmarks();
    };

    // Export Plugin logic
    window.exportData = async (format) => {
        try {
            const res = await Auth.request(`/bookmarks/export?format=${format}`);
            if(!res.ok) throw new Error('Export failed');
            
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `bookmarks.${format}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            showToast('Export successful!');
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    // Add Bookmark flow
    document.getElementById('add-bookmark-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('save-btn');
        submitBtn.disabled = true;
        const data = {
            url: document.getElementById('url').value,
            category: document.getElementById('category').value || '未分類',
            tags: document.getElementById('tags').value,
            note: document.getElementById('note').value
        };
        try {
            const urlPar = appSettings.autoFetch ? '?auto_fetch=true' : '';
            const res = await Auth.request(`/bookmarks${urlPar}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error((await res.json()).detail || 'Failed to save');
            showToast('Bookmark Saved!');
            closeModal();
            fetchBookmarks();
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            submitBtn.disabled = false;
        }
    });

    // Render Logic
    async function fetchBookmarks() {
        showLoading();
        try { const data = await (await Auth.request('/bookmarks?limit=50')).json(); renderBookmarks(data.bookmarks); generateCategoriesMap(data.bookmarks); } catch (e) {}
    }
    async function searchBookmarks(query) {
        showLoading();
        try { const data = await (await Auth.request(`/bookmarks/search?q=${encodeURIComponent(query)}`)).json(); renderBookmarks(data); } catch (e) {}
    }

    function showLoading() {
        const container = document.getElementById('tweets-container');
        if(container) container.innerHTML = `<div class="py-12 flex justify-center text-x-blue"><ion-icon name="sync" class="animate-spin text-3xl"></ion-icon></div>`;
    }
    
    function generateCategoriesMap(bookmarks) {
        const catBox = document.getElementById('categories-list');
        if(!catBox || !bookmarks) return;
        const counts = {};
        bookmarks.forEach(b => { counts[b.category] = (counts[b.category]||0)+1; });
        let html = '';
        Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,10).forEach(([cat, count]) => {
            html += `<div class="flex justify-between items-center py-2 px-3 hover:bg-x-black rounded-lg cursor-pointer transition" onclick="document.getElementById('search-input').value='${cat}'; document.getElementById('search-input').dispatchEvent(new Event('input'))">
                        <span class="font-medium truncate">${cat}</span>
                        <span class="text-xs bg-x-border text-x-text-muted px-2 py-1 rounded-full">${count}</span>
                     </div>`;
        });
        catBox.innerHTML = html;
    }

    function renderBookmarks(bookmarks) {
        const container = document.getElementById('tweets-container');
        if (!container) return;
        container.innerHTML = '';
        if (!bookmarks || bookmarks.length === 0) {
            container.innerHTML = `<div class="py-16 px-8 text-center flex flex-col items-center"><h3 class="text-3xl font-bold mb-2">No bookmarks found</h3></div>`;
            return;
        }

        bookmarks.forEach(bm => {
            const wrapper = document.createElement('article');
            wrapper.className = 'border-b border-x-border p-4 hover:bg-[rgba(255,255,255,0.03)] transition-colors relative group';
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'absolute top-4 right-4 text-x-text-muted hover:text-x-error opacity-0 group-hover:opacity-100 transition-opacity z-10';
            deleteBtn.innerHTML = '<ion-icon name="trash" class="text-xl"></ion-icon>';
            deleteBtn.onclick = () => deleteBookmark(bm.id);
            wrapper.appendChild(deleteBtn);

            let metaHtml = `<div class="flex flex-wrap items-center gap-2 mb-3 text-sm blur-target">
                <span class="bg-x-border px-2 py-0.5 rounded text-x-text-muted cursor-pointer hover:bg-gray-700" onclick="document.getElementById('search-input').value='${bm.category}'; document.getElementById('search-input').dispatchEvent(new Event('input'))">${bm.category || '未分類'}</span>`;
            if (bm.tags) bm.tags.split(',').forEach(tag => {
                const t = tag.trim();
                if(t) metaHtml += `<span class="text-x-blue cursor-pointer hover:underline" onclick="document.getElementById('search-input').value='${t}'; document.getElementById('search-input').dispatchEvent(new Event('input'))">#${t}</span>`;
            });
            metaHtml += `</div>`;
            if (bm.note) metaHtml += `<p class="mb-3 whitespace-pre-wrap blur-target font-medium">${bm.note}</p>`;
            
            const metaDiv = document.createElement('div');
            metaDiv.innerHTML = metaHtml;
            wrapper.appendChild(metaDiv);

            // Compact layout alternate link
            const cpDiv = document.createElement('a');
            cpDiv.href = bm.url; cpDiv.target = "_blank";
            cpDiv.className = 'compact-link text-x-text-muted hover:text-x-blue hover:underline text-sm truncate block pt-1';
            cpDiv.innerText = `🔗 ${bm.url}`;
            wrapper.appendChild(cpDiv);

            // oEmbed container
            const tweetDiv = document.createElement('div');
            tweetDiv.className = 'tweet-container pt-2';
            tweetDiv.id = `tweet-${bm.id}`;
            wrapper.appendChild(tweetDiv);
            container.appendChild(wrapper);

            // Render Official Widget based on extensions
            if (window.twttr && window.twttr.widgets && !appSettings.compactMode) {
                window.twttr.widgets.createTweet(
                    bm.tweet_id,
                    tweetDiv,
                    {
                        theme: appSettings.theme === 'dim' ? 'dark' : 'dark', // the official only has light/dark. Dim is handled by custom CSS.
                        conversation: appSettings.showThread ? 'all' : 'none',
                        cards: appSettings.hideMedia ? 'hidden' : 'visible',
                        dnt: true
                    }
                );
            }
        });
    }

    async function deleteBookmark(id) {
        if (!confirm('Are you sure you want to delete this bookmark?')) return;
        try {
            await Auth.request(`/bookmarks/${id}`, { method: 'DELETE' });
            showToast('Deleted', 'success');
            const query = document.getElementById('search-input').value.trim();
            if (query) searchBookmarks(query); else fetchBookmarks();
        } catch (err) { showToast(err.message, 'error'); }
    }

    fetchBookmarks();
}
