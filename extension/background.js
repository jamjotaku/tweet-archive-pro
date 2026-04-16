// background.js - TweetArchive Pro Extension Service Worker

chrome.runtime.onInstalled.addListener(() => {
  console.log('TweetArchive Pro Extension Installed');
});

// コンテンツスクリプトからのリクエストを処理
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "open_sidepanel") {
    // 現在のタブでサイドパネルを開く
    chrome.sidePanel.open({ tabId: sender.tab.id });
    // 少し待ってからデータを送信（サイドパネルの準備が整うのを待つ）
    setTimeout(() => {
        chrome.runtime.sendMessage({
            action: "populate_preview",
            data: request.data
        }).catch(err => console.log("Sidepanel not yet ready, will retry on user open"));
    }, 500);
  }
});
