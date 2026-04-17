// content.js - TweetArchive Pro Content Script for X.com

const ARCHIVE_ICON = `
<svg viewBox="0 0 24 24" aria-hidden="true" style="color: #1d9bf0;">
    <path d="M21 4H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM3 6h18v12H3V6zm9 10l-4-4h3V9h2v3h3l-4 4z"></path>
</svg>
`;

function injectButtons() {
    // role="group" を持つ div をすべて探し、アクションボタン群を含むものを特定
    const groups = document.querySelectorAll('div[role="group"]:not(.tap-processed)');
    
    groups.forEach(group => {
        // リプライ ("reply") ボタンが含まれているかチェックして、ツイートのアクションバーであることを確認
        const hasReply = group.querySelector('[data-testid="reply"]');
        if (hasReply) {
            group.classList.add('tap-processed');
            
            const btn = document.createElement('div');
            btn.className = 'tap-archive-btn';
            btn.setAttribute('role', 'button');
            btn.setAttribute('title', 'Archive to TweetArchive Pro');
            btn.style.marginLeft = '12px';
            btn.innerHTML = ARCHIVE_ICON;
            
            btn.onclick = (e) => {
                e.stopPropagation();
                const tweetData = extractTweetData(group);
                chrome.runtime.sendMessage({
                    action: "open_sidepanel",
                    data: tweetData
                });
            };
            
            // アクションバーの最後に追加
            group.appendChild(btn);
        }
    });
}

function extractTweetData(actionBar) {
    const tweetRoot = actionBar.closest('article[data-testid="tweet"]');
    if (!tweetRoot) return { url: window.location.href };
    
    const textEl = tweetRoot.querySelector('[data-testid="tweetText"]');
    const authorEl = tweetRoot.querySelector('[data-testid="User-Name"]');
    const linkEls = tweetRoot.querySelectorAll('a[href*="/status/"]');
    
    let tweetUrl = "";
    for (const a of linkEls) {
        const match = a.href.match(/\/\w+\/status\/\d+/);
        if (match) {
            tweetUrl = "https://x.com" + match[0];
            break;
        }
    }
    if (!tweetUrl && window.location.href.includes('/status/')) {
        tweetUrl = window.location.href.split('?')[0];
    }

    return {
        url: tweetUrl || window.location.href,
        text: textEl ? textEl.innerText : "",
        author: authorEl ? authorEl.innerText.split('\n')[0] : "Tweet"
    };
}

injectButtons();
const observer = new MutationObserver(() => { injectButtons(); });
observer.observe(document.body, { childList: true, subtree: true });
