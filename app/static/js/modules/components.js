/**
 * components.js - UI Components Module
 */
import { state } from './state.js';

export function renderExternalLinks(text) {
    if (!text) return '';
    const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const ytMatch = text.match(youtubeRegex);

    if (ytMatch) {
        const videoId = ytMatch[1];
        const thumbUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
        const linkUrl = `https://www.youtube.com/watch?v=${videoId}`;
        return `
            <div class="external-link-card cursor-pointer mb-3" onclick="event.stopPropagation(); window.open('${linkUrl}', '_blank')">
                <div class="link-thumb relative">
                    <img src="${thumbUrl}" class="w-full h-full object-cover">
                    <div class="absolute inset-0 flex items-center justify-center">
                        <div class="bg-red-600 text-white p-2 rounded-xl flex items-center shadow-lg">
                            <ion-icon name="logo-youtube" class="text-3xl"></ion-icon>
                        </div>
                    </div>
                </div>
                <div class="link-info">
                    <div class="text-x-text font-bold text-sm truncate">YouTube Video</div>
                    <div class="text-x-text-muted text-xs truncate">${linkUrl}</div>
                </div>
            </div>
        `;
    }
    return '';
}

export function renderMedia(bm) {
    const urlStr = bm.media_url;
    if (!urlStr || state.appSettings.hideMedia) return '';
    const urls = urlStr.split(',').filter(u => u.trim());
    if (urls.length === 0) return '';

    const isVideo = (url) => url.toLowerCase().match(/\.(mp4|mov|webm|m3u8|mpd)($|\?)/);

    if (state.isGalleryMode) {
        const u = urls[0];
        if (isVideo(u)) {
            return `<div class="media-preview-gallery relative">
                <video src="${u}" class="w-full h-full object-cover"></video>
                <div class="absolute inset-0 flex items-center justify-center bg-black/20">
                    <ion-icon name="play-circle" class="text-white text-5xl opacity-80"></ion-icon>
                </div>
                <div class="absolute inset-0 cursor-pointer" onclick="event.stopPropagation(); window.openLightboxForBookmark(${bm.id})"></div>
            </div>`;
        }
        return `<div class="media-preview-gallery"><img src="${u}" loading="lazy" onclick="event.stopPropagation(); window.openLightboxForBookmark(${bm.id})"></div>`;
    }

    let html = `<div class="media-grid" data-count="${urls.length}">`;
    urls.forEach(u => {
        if (isVideo(u)) {
            html += `<div class="media-item no-click-propagation">
                <video src="${u}" controls loop muted playsinline class="media-video" onclick="event.stopPropagation()"></video>
            </div>`;
        } else {
            html += `<div class="media-item"><img src="${u}" loading="lazy" onclick="event.stopPropagation(); window.openLightbox('${u}', '${(bm.tweet_text || '').replace(/'/g, "\\'")}')"></div>`;
        }
    });
    html += `</div>`;
    return html;
}

export function buildCard(bm) {
    const wrapper = document.createElement('article');
    wrapper.className = `tweet-card border-b border-x-border hover:bg-x-black/20 transition-colors cursor-pointer relative ${state.isBatchMode ? 'batch-selectable' : ''}`;
    wrapper.dataset.id = bm.id;
    if (state.selectedIds.has(bm.id)) wrapper.classList.add('selected');
    
    wrapper.onclick = (e) => {
        if (state.isBatchMode) {
            e.preventDefault();
            window.toggleSelect(bm.id, wrapper);
        } else {
            // Optional: Show detail view?
        }
    };

    const mediaHtml = renderMedia(bm);
    const contentArea = document.createElement('div');
    contentArea.className = state.isGalleryMode ? 'w-full h-full relative' : 'flex-1 p-4 flex gap-3 min-w-0';

    if (state.isGalleryMode) {
        contentArea.innerHTML = `
            ${mediaHtml || '<div class="w-full aspect-video bg-x-dark flex items-center justify-center"><ion-icon name="document-text-outline" class="text-4xl text-x-border"></ion-icon></div>'}
            <div class="gallery-caption">
                <div class="flex items-center gap-2 mb-2">
                    <div class="w-6 h-6 rounded-full avatar-placeholder flex items-center justify-center text-[10px] text-white font-bold">${(bm.author_name || 'T').charAt(0).toUpperCase()}</div>
                    <span class="font-bold text-xs truncate">${bm.author_name || 'User'}</span>
                </div>
                <div class="text-xs line-clamp-3 text-x-text opacity-90 mb-1">${bm.tweet_text || ''}</div>
                <div class="text-[10px] text-x-text-muted">@${bm.author_handle || 'user'}</div>
            </div>
        `;
    } else {
        const avatarCol = document.createElement('div');
        avatarCol.className = 'shrink-0 z-10';
        avatarCol.innerHTML = `<div class="w-12 h-12 rounded-full avatar-placeholder flex items-center justify-center text-white font-bold text-lg">${(bm.author_name || 'T').charAt(0).toUpperCase()}</div>`;
        
        const rightCol = document.createElement('div');
        rightCol.className = 'flex-1 min-w-0 z-10';
        
        const hRow = document.createElement('div');
        hRow.className = 'flex items-center gap-1 mb-0.5 flex-wrap';
        const authorName = bm.author_name || (bm.url.split('/')[2] || 'Tweet');
        const targetDate = bm.tweet_created_at || bm.created_at;
        const dateStr = new Date(targetDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        const displayHandle = (bm.author_handle || 'user').startsWith('@') ? bm.author_handle : `@${bm.author_handle || 'user'}`;
        hRow.innerHTML = `
            <span class="font-bold text-[15px] hover:underline truncate max-w-[150px]">${authorName}</span>
            <span class="text-x-text-muted text-[15px]">${displayHandle} · ${dateStr}</span>
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
        
        if (mediaHtml) {
            const mDiv = document.createElement('div');
            mDiv.innerHTML = renderExternalLinks(bm.tweet_text) + mediaHtml;
            rightCol.appendChild(mDiv);
        } else {
            const extLinks = renderExternalLinks(bm.tweet_text);
            if (extLinks) {
                const extDiv = document.createElement('div');
                extDiv.innerHTML = extLinks;
                rightCol.appendChild(extDiv);
            }
        }

        if (bm.note_html || bm.note) {
            const noteBox = document.createElement('div');
            noteBox.className = 'mt-3 p-3 bg-x-dark border border-x-border rounded-xl text-[15px] prose prose-invert prose-sm max-w-none text-x-text opacity-90 markdown-body';
            noteBox.innerHTML = bm.note_html || bm.note;
            rightCol.appendChild(noteBox);
        }

        const actionRow = document.createElement('div');
        actionRow.className = 'flex items-center gap-6 mt-4 pt-2 border-t border-x-border/30 z-10 action-buttons-list';
        
        const editBtn = document.createElement('button');
        editBtn.className = 'text-x-text-muted hover:text-x-blue flex items-center gap-1.5 transition-colors group';
        editBtn.innerHTML = `<ion-icon name="create-outline" class="text-lg"></ion-icon><span class="text-xs group-hover:underline">Edit</span>`;
        editBtn.onclick = (e) => { e.stopPropagation(); window.openEditModal(bm.id); };
        
        const syncBtn = document.createElement('button');
        syncBtn.className = 'text-x-text-muted hover:text-x-blue flex items-center gap-1.5 transition-colors group';
        syncBtn.innerHTML = `<ion-icon name="sync-outline" class="text-lg"></ion-icon><span class="text-xs group-hover:underline">Sync</span>`;
        syncBtn.onclick = (e) => { e.stopPropagation(); window.syncBookmark(bm.id, syncBtn.querySelector('ion-icon')); };
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'text-x-text-muted hover:text-red-500 flex items-center gap-1.5 transition-colors group';
        deleteBtn.innerHTML = `<ion-icon name="trash-outline" class="text-lg"></ion-icon><span class="text-xs group-hover:underline">Delete</span>`;
        deleteBtn.onclick = (e) => { e.stopPropagation(); window.deleteBookmark(bm.id); };

        actionRow.appendChild(editBtn);
        actionRow.appendChild(syncBtn);
        actionRow.appendChild(deleteBtn);
        rightCol.appendChild(actionRow);

        contentArea.appendChild(avatarCol);
        contentArea.appendChild(rightCol);
    }

    wrapper.appendChild(contentArea);
    return wrapper;
}
