/**
 * ui.js - UI & Localization Module
 */
import { state } from './state.js';

export const i18n = {
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
        set_toolsbml: "Bookmarklet Panel", set_toolsbml_desc: "Quick save button in sidebar.",
        card_edit: "Edit", card_sync: "Sync", card_delete: "Delete",
        btn_update: "Update"
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
        bookmarks_linked: "相互に関連付けました", btn_quick_save: "+ アーカイブに保存",
        modal_settings_title: "設定と拡張機能",
        card_edit: "編集", card_sync: "同期", card_delete: "削除",
        btn_update: "更新"
    }
};

export function t(key) {
    const lang = state.appSettings.lang || 'ja';
    return (i18n[lang] || i18n['en'])[key] || key;
}

export function showToast(message, type = 'success') {
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

export function applyTranslations() {
    const lang = state.appSettings.lang || 'ja';
    const d = i18n[lang] || i18n['en'];
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (d[key]) el.innerText = d[key];
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (d[key]) el.placeholder = d[key];
    });
}

export function applySettings() {
    const s = state.appSettings;
    document.body.classList.toggle('theme-dim', s.theme === 'dim');
    document.body.classList.toggle('blur-mode', s.blurMode);
    document.body.classList.toggle('compact-mode', s.compactMode);
    document.body.classList.toggle('gallery-mode', state.isGalleryMode);
    
    const exp = document.getElementById('plugin-export');
    const bml = document.getElementById('plugin-bookmarklet');
    if (exp) exp.classList.toggle('hidden', !s.showExport);
    if (bml) bml.classList.toggle('hidden', !s.showBookmarklet);
    
    const mainArea = document.querySelector('.main-content-area');
    if (mainArea) mainArea.classList.toggle('gallery-width', state.isGalleryMode);

    applyTranslations();
}

// Global exposure for non-module script / inline events if needed
window.showToast = showToast;
window.applySettings = applySettings;
