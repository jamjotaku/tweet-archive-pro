/**
 * api.js - API & Auth Module
 */

export const API_BASE = window.location.origin;

export const Auth = {
    getToken() { return localStorage.getItem('token'); },
    logout() { 
        localStorage.removeItem('token'); 
        if (window.location.pathname !== '/login') {
            window.location.href = '/login'; 
        }
    },
    async request(endpoint, options = {}) {
        const token = this.getToken();
        const headers = { ...(options.headers || {}) };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        
        const cleanBase = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE;
        const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        const url = `${cleanBase}${cleanEndpoint}`;

        console.debug(`[Auth] Request: ${options.method || 'GET'} ${url}`);
        const response = await fetch(url, { ...options, headers });
        if (response.status === 401 && !endpoint.includes('/token')) { this.logout(); }
        return response;
    }
};

// Global export for HTML compatibility
window.Auth = Auth;
