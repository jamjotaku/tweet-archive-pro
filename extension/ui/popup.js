document.addEventListener('DOMContentLoaded', async () => {
    const authSection = document.getElementById('auth-section');
    const saveSection = document.getElementById('save-section');
    const token = await API.getToken();
    if (!token) {
        authSection.classList.remove('hidden');
        const loginBtn = document.getElementById('login-btn');
        loginBtn.onclick = async () => {
            const u = document.getElementById('username').value;
            const p = document.getElementById('password').value;
            if (await API.login(u, p)) window.location.reload();
            else document.getElementById('auth-error').innerText = "Invalid credentials";
        };
    } else {
        saveSection.classList.remove('hidden');
        const categories = await API.getCategories();
        const catSelect = document.getElementById('save-category');
        categories.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.name; opt.innerText = `${c.name} (${c.count})`;
            catSelect.appendChild(opt);
        });
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (tab.url.includes('x.com/') || tab.url.includes('twitter.com/')) {
                document.getElementById('author-preview').innerText = "Tweet Detected";
                document.getElementById('text-preview').innerText = tab.url;
                window.currentUrl = tab.url;
            }
        });
        chrome.runtime.onMessage.addListener((request) => {
            if (request.action === "populate_preview") {
                const data = request.data;
                document.getElementById('author-preview').innerText = data.author;
                document.getElementById('text-preview').innerText = data.text;
                window.currentUrl = data.url;
            }
        });
        const saveBtn = document.getElementById('save-btn');
        saveBtn.onclick = async () => {
            saveBtn.disabled = true;
            const res = await API.saveBookmark(window.currentUrl, catSelect.value, document.getElementById('save-tags').value, document.getElementById('save-note').value);
            if (res.ok) {
                document.getElementById('toast').classList.remove('hidden');
                setTimeout(() => window.close(), 1500);
            } else { saveBtn.disabled = false; alert("Error saving"); }
        };
    }
});
