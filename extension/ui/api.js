const DEFAULT_BASE_URL = "https://tweet-archive-pro.fly.dev";
const API = {
    async getBaseUrl() {
        const { baseUrl } = await chrome.storage.local.get("baseUrl");
        return baseUrl || DEFAULT_BASE_URL;
    },
    async getToken() {
        const { token } = await chrome.storage.local.get("token");
        return token;
    },
    async request(path, options = {}) {
        const baseUrl = await this.getBaseUrl();
        const token = await this.getToken();
        const headers = { "Content-Type": "application/json", ...options.headers };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
        if (response.status === 401) { chrome.storage.local.remove("token"); window.location.reload(); }
        return response;
    },
    async login(username, password) {
        const baseUrl = await this.getBaseUrl();
        const formData = new URLSearchParams();
        formData.append("username", username);
        formData.append("password", password);
        const response = await fetch(`${baseUrl}/token`, {
            method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: formData
        });
        if (response.ok) {
            const data = await response.json();
            await chrome.storage.local.set({ token: data.access_token });
            return true;
        }
        return false;
    },
    async getCategories() {
        const res = await this.request("/bookmarks/categories");
        return res.ok ? await res.json() : [];
    },
    async saveBookmark(url, category, tags, note) {
        return this.request("/bookmarks", {
            method: "POST", body: JSON.stringify({ url, category, tags, note })
        });
    }
};
