/**
 * state.js - Global App State
 */

export const defaultSettings = {
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

export const state = {
    appSettings: { ...defaultSettings },
    isBatchMode: false,
    isGalleryMode: false,
    selectedIds: new Set(),
    currentPage: 0,
    totalBookmarks: 0,
    allBookmarks: [],
    isLoading: false,
    currentFilter: { type: null, value: null },
    PAGE_SIZE: 20
};

// Initialize settings from localStorage
try {
    const saved = localStorage.getItem('appSettings');
    if (saved) state.appSettings = { ...state.appSettings, ...JSON.parse(saved) };
} catch(e) {
    console.error('[State] Failed to load settings:', e);
}

export function saveSettings() {
    localStorage.setItem('appSettings', JSON.stringify(state.appSettings));
}
