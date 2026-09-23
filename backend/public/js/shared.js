let API_BASE;

(function resolveApiBase() {
    const allowOverride = window.CONFIG?.DEBUG?.ALLOW_API_OVERRIDE === true;
    const storedOverride = allowOverride ? localStorage.getItem('API_BASE') : null;

    if (storedOverride) {
        API_BASE = storedOverride;
        console.log('🔗 API_BASE (override):', API_BASE);
        return;
    }

    // Detect: if we're on localhost, use DEV_URL; otherwise use PROD_URL
    const hostname = window.location.hostname;
    const isLocalhost = hostname === 'localhost'
                     || hostname === '127.0.0.1'
                     || hostname === '';

    if (isLocalhost) {
        API_BASE = window.CONFIG?.API?.DEV_URL || 'http://localhost:5001/api/v1';
    } else {
        API_BASE = window.CONFIG?.API?.PROD_URL || '/api/v1';
    }

    console.log('🔗 API_BASE:', API_BASE, '(hostname:', hostname, ')');
})();

// ──────────────────────────────────────────────
// SERVICE WORKER REGISTRATION
// ──────────────────────────────────────────────
// Registers the Service Worker so the app becomes installable.
// Note: Service Workers only work on localhost or HTTPS.
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('✅ Service Worker registered successfully:', registration.scope);
            })
            .catch(err => {
                console.error('❌ Service Worker registration failed:', err);
            });
    });
} else {
    console.warn('⚠️ Service Workers are not supported in this browser.');
}

// ──────────────────────────────────────────────
// STORAGE HELPERS
// ──────────────────────────────────────────────
const DB = {
    get(k)      { try { return JSON.parse(localStorage.getItem('fc_' + k)); } catch { return null; } },
    set(k, v)   { localStorage.setItem('fc_' + k, JSON.stringify(v)); },
    del(k)      { localStorage.removeItem('fc_' + k); }
};

// ──────────────────────────────────────────────
// IN-MEMORY CACHE (for slow-changing data)
// ──────────────────────────────────────────────
const _cache = {
    products: null,
    productsAt: 0,
    categories: null,
    categoriesAt: 0,
    TTL: 60_000 // 60 seconds
};

// ──────────────────────────────────────────────
// AUTH HELPERS
// ──────────────────────────────────────────────
function getToken()          { return localStorage.getItem('fc_token'); }
function setToken(t)         { localStorage.setItem('fc_token', t); }
function removeToken()       { localStorage.removeItem('fc_token'); }
function getCurrentUser()    { return DB.get('currentUser'); }
function setCurrentUser(u)   { DB.set('currentUser', u); }
function removeCurrentUser() { DB.del('currentUser'); }
function isAuthenticated()   { return !!getToken() && !!getCurrentUser(); }

/**
 * Redirect to login if not authenticated. Call at top of every protected page.
 */
function requireAuth(redirectPath = 'index.html') {
    if (!isAuthenticated()) {
        window.location.href = redirectPath;
        return false;
    }
    return true;
}

function getUserRole() {
    return getCurrentUser()?.role || null;
}

function hasRole(...allowed) {
    const role = getUserRole();
    return role && allowed.includes(role);
}

function isManagerOrOwner() {
    return hasRole('manager', 'owner');
}

// ──────────────────────────────────────────────
// PERMISSION HELPERS (frontend gating)
// Mirrors backend's utils/permissions.js logic
// ──────────────────────────────────────────────
/**
 * Check if the current user has a specific permission.
 * Owners ("all") pass every check.
 */
function hasPerm(permission) {
    const user = getCurrentUser();
    if (!user) return false;
    const perms = Array.isArray(user.permissions) ? user.permissions : [];
    if (perms.includes('all')) return true;
    return perms.includes(permission);
}

/**
 * Check if the current user has ANY of the given permissions.
 */
function hasAnyPerm(...permissions) {
    return permissions.some(p => hasPerm(p));
}

/**
 * Get the current user's effective permissions as an array.
 * Owners get the full list of permission IDs (for UI rendering).
 */
function getMyPermissions() {
    const user = getCurrentUser();
    if (!user) return [];
    const perms = Array.isArray(user.permissions) ? user.permissions : [];
    return perms;
}

/**
 * Fetch fresh permissions from the backend and update localStorage.
 * Call this at the top of every page's init() so permission changes
 * the owner makes take effect on the next page load.
 */
async function refreshCurrentUser() {
    try {
        const res = await apiRequest('/users/me/permissions');
        if (res.success && res.data) {
            const user = getCurrentUser() || {};
            user.permissions = Array.isArray(res.data.permissions) ? res.data.permissions : [];
            user.role = res.data.role || user.role;
            setCurrentUser(user);
        }
    } catch (err) {
        console.error('refreshCurrentUser failed:', err);
    }
}

// ──────────────────────────────────────────────
// API REQUEST HELPER
// ──────────────────────────────────────────────
async function apiRequest(endpoint, options = {}) {
    const token = getToken();
    const url = `${API_BASE}${endpoint}`;

    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    if (window.CONFIG?.DEBUG?.LOG_API) {
        console.log(`→ ${options.method || 'GET'} ${url}`);
    }

    let response;
    try {
        response = await fetch(url, { ...options, headers });
    } catch (netErr) {
        const msg = window.CONFIG?.ERRORS?.NETWORK || 'Network error';
        const err = new Error(msg);
        err.cause = netErr;
        throw err;
    }

    if (response.status === 204) return { success: true, data: null };

    let payload;
    try {
        payload = await response.json();
    } catch {
        payload = null;
    }

    if (!response.ok) {
        if (response.status === 401) {
            removeToken();
            removeCurrentUser();
            const loginUrl = window.CONFIG?.APP?.LOGIN_URL || 'index.html';
            if (!window.location.pathname.endsWith(loginUrl)) {
                window.location.href = loginUrl;
            }
            const err = new Error('Session expired. Please login again.');
            err.status = 401;
            throw err;
        }

        const msg = payload?.error?.message
            || payload?.message
            || window.CONFIG?.ERRORS?.SERVER
            || `Request failed (${response.status})`;
        const err = new Error(msg);
        err.status = response.status;
        err.data = payload;
        throw err;
    }

    return payload;
}

// ──────────────────────────────────────────────
// AUTH ACTIONS
// ──────────────────────────────────────────────
async function handleLogin(email, password) {
    try {
        const response = await apiRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        if (response.success) {
            setToken(response.data.token);
            setCurrentUser(response.data.user);
            updateUserChip();
            showToast(window.CONFIG?.MESSAGES?.LOGIN_SUCCESS || 'Welcome back!', 'success');
            return { success: true, user: response.data.user };
        }
        return { success: false, error: response.error?.message || 'Login failed' };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

async function handleRegister(email, password, fullName, role = 'employee') {
    try {
        const response = await apiRequest('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, password, full_name: fullName, role })
        });
        if (response.success) {
            setToken(response.data.token);
            setCurrentUser(response.data.user);
            updateUserChip();
            return { success: true, user: response.data.user };
        }
        return { success: false, error: response.error?.message || 'Registration failed' };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

async function handleLogout() {
    try {
        await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
        // ignore
    } finally {
        removeToken();
        removeCurrentUser();
        window.location.href = window.CONFIG?.APP?.LOGIN_URL || 'index.html';
    }
}

// ──────────────────────────────────────────────
// USERS API
// ──────────────────────────────────────────────
async function fetchUsers(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    const url = `/users${params ? '?' + params : ''}`;
    const response = await apiRequest(url);
    return response.data || [];
}

async function fetchUser(id) {
    const response = await apiRequest(`/users/${id}`);
    return response.data;
}

async function createUser(userData) {
    const response = await apiRequest('/users', {
        method: 'POST',
        body: JSON.stringify(userData)
    });
    return response.data;
}

async function updateUserRole(id, role) {
    const response = await apiRequest(`/users/${id}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role })
    });
    return response.data;
}

async function updateUserPermissions(id, permissions) {
    const response = await apiRequest(`/users/${id}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({ permissions })
    });
    return response.data;
}

async function updateUserProfile(id, updates) {
    const response = await apiRequest(`/users/${id}/profile`, {
        method: 'PUT',
        body: JSON.stringify(updates)
    });
    return response.data;
}

async function deactivateUser(id) {
    const response = await apiRequest(`/users/${id}`, { method: 'DELETE' });
    return response.data;
}

async function reactivateUser(id) {
    const response = await apiRequest(`/users/${id}/reactivate`, { method: 'POST' });
    return response.data;
}

async function fetchPermissionCatalog() {
    const response = await apiRequest('/users/permissions/catalog');
    return response.data;
}

async function fetchMyPermissions() {
    const response = await apiRequest('/users/me/permissions');
    return response.data;
}

// ──────────────────────────────────────────────
// PRODUCTS API  (with caching)
// ──────────────────────────────────────────────
/**
 * Fetch products. Results are cached for 60s unless filters are provided
 * or `force: true` is passed.
 */
async function fetchProducts(filters = {}, { force = false } = {}) {
    const hasFilters = Object.keys(filters || {}).length > 0;
    const now = Date.now();

    if (!hasFilters && !force && _cache.products && (now - _cache.productsAt) < _cache.TTL) {
        return _cache.products;
    }

    const params = new URLSearchParams(filters).toString();
    const url = `/products${params ? '?' + params : ''}`;
    const response = await apiRequest(url);
    const data = response.data || [];

    if (!hasFilters) {
        _cache.products = data;
        _cache.productsAt = now;
    }
    return data;
}

/**
 * Fetch product categories. Cached for 60s unless `force: true`.
 */
async function fetchCategories({ force = false } = {}) {
    const now = Date.now();
    if (!force && _cache.categories && (now - _cache.categoriesAt) < _cache.TTL) {
        return _cache.categories;
    }
    try {
        const response = await apiRequest('/products/get-categories');
        const data = response.data || [];
        _cache.categories = data;
        _cache.categoriesAt = now;
        return data;
    } catch (err) {
        console.error('fetchCategories error:', err);
        return [];
    }
}

/**
 * Invalidate the products cache. Call after create/update/delete/restock.
 */
function invalidateProductsCache() {
    _cache.products = null;
    _cache.productsAt = 0;
}

/**
 * Invalidate the categories cache. Call after creating a category.
 */
function invalidateCategoriesCache() {
    _cache.categories = null;
    _cache.categoriesAt = 0;
}

/**
 * Invalidate both caches.
 */
function invalidateCatalogCache() {
    invalidateProductsCache();
    invalidateCategoriesCache();
}

async function searchProducts(q, filters = {}) {
    const params = new URLSearchParams({ q, ...filters }).toString();
    const response = await apiRequest(`/products/search?${params}`);
    return response.data || [];
}

async function createProduct(productData) {
    const response = await apiRequest('/products', {
        method: 'POST',
        body: JSON.stringify(productData)
    });
    invalidateProductsCache();
    return response.data;
}

async function updateProduct(id, productData) {
    const response = await apiRequest(`/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify(productData)
    });
    invalidateProductsCache();
    return response.data;
}

async function deleteProduct(id) {
    await apiRequest(`/products/${id}`, { method: 'DELETE' });
    invalidateProductsCache();
    return true;
}

async function restockProduct(id, quantity, branchId) {
    const body = { quantity };
    if (branchId) body.branch_id = branchId;
    const response = await apiRequest(`/products/${id}/restock`, {
        method: 'POST',
        body: JSON.stringify(body)
    });
    invalidateProductsCache();
    return response.data;
}

async function fetchLowStockProducts(threshold = 5) {
    try {
        const response = await apiRequest(`/products/low-stock?threshold=${threshold}`);
        return response.data || [];
    } catch (err) {
        console.error('fetchLowStockProducts error:', err);
        return [];
    }
}

// ──────────────────────────────────────────────
// SALES API
// ──────────────────────────────────────────────
async function createSale(saleData) {
    const response = await apiRequest('/sales', {
        method: 'POST',
        body: JSON.stringify(saleData)
    });
    // A sale changes stock, so products cache is stale
    invalidateProductsCache();
    return response.data;
}

async function fetchSales(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    const url = `/sales${params ? '?' + params : ''}`;
    const response = await apiRequest(url);
    return response.data || [];
}

async function fetchMySales(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    const url = `/sales/my-sales${params ? '?' + params : ''}`;
    const response = await apiRequest(url);
    return response.data || [];
}

async function fetchTodaySales() {
    const response = await apiRequest('/sales/today');
    return response.data;
}

async function fetchCreditSales() {
    const response = await apiRequest('/sales/credit');
    return response.data;
}

// ──────────────────────────────────────────────
// REPORTS API
// ──────────────────────────────────────────────
async function fetchDailyReport(date) {
    const response = await apiRequest(`/reports/daily?date=${date}`);
    return response.data;
}

async function fetchTopProducts(limit = 10) {
    const response = await apiRequest(`/reports/top-products?limit=${limit}`);
    return response.data || [];
}

async function fetchTopProductsRange(limit = 5, startDate = null, endDate = null) {
    const params = { limit };
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    const qs = new URLSearchParams(params).toString();
    const response = await apiRequest(`/reports/top-products?${qs}`);
    return response.data || [];
}

async function fetchReport(type, params = {}) {
    const cleanParams = {};
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') cleanParams[k] = v;
    });
    const qs = new URLSearchParams(cleanParams).toString();
    const url = `/reports/${type}${qs ? '?' + qs : ''}`;
    const response = await apiRequest(url);
    return response.data;
}

async function fetchAnalyticsSummary(days = 30) {
    const response = await apiRequest(`/reports/analytics-summary?days=${days}`);
    return response.data;
}

async function exportReport(type, params = {}, format = 'excel') {
    const cleanParams = { type, format };
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') cleanParams[k] = v;
    });
    const qs = new URLSearchParams(cleanParams).toString();
    const url = `${API_BASE}/exports/report?${qs}`;
    const token = getToken();

    const res = await fetch(url, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });

    if (!res.ok) {
        let errMsg = `Export failed (${res.status})`;
        try {
            const j = await res.json();
            errMsg = j.error?.message || j.message || errMsg;
        } catch { /* ignore */ }
        throw new Error(errMsg);
    }

    const cd = res.headers.get('Content-Disposition') || '';
    const m = cd.match(/filename="?([^"]+)"?/);
    const filename = m ? m[1] : `report_${Date.now()}.${format === 'csv' ? 'csv' : 'xlsx'}`;

    const blob = await res.blob();
    downloadFile(blob, filename);
    return filename;
}

// ──────────────────────────────────────────────
// UI HELPERS
// ──────────────────────────────────────────────
function formatCurrency(n) {
    const c = window.CONFIG?.UI?.CURRENCY || {};
    const symbol = c.SYMBOL || 'KSh';
    const locale = c.LOCALE || 'en-KE';
    const min = c.MIN_FRACTION ?? 0;
    const max = c.MAX_FRACTION ?? 0;
    const num = Number(n) || 0;
    return symbol + ' ' + num.toLocaleString(locale, {
        minimumFractionDigits: min,
        maximumFractionDigits: max
    });
}

function getPaymentPillClass(payment) {
    const map = { Cash: 'pill-green', 'M-Pesa': 'pill-blue', Bank: 'pill-purple', Credit: 'pill-yellow' };
    return map[payment] || 'pill-green';
}

function getRolePillClass(role) {
    const map = { owner: 'pill-yellow', manager: 'pill-blue', employee: 'pill-green' };
    return map[role] || 'pill-green';
}

function createStats(arr) {
    return arr.map(([label, value, color]) =>
        `<div class="stat-card">
            <div class="stat-label">${label}</div>
            <div class="stat-value" style="color:${color};">${value}</div>
        </div>`
    ).join('');
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) {
        console.log(`[${type}] ${message}`);
        return;
    }
    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    const duration = window.CONFIG?.UI?.TOAST?.DURATION || 3000;
    const el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.innerHTML = '<span>' + (icons[type] || 'ℹ️') + '</span><span>' + message + '</span>';
    container.appendChild(el);
    setTimeout(() => el.remove(), duration);
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('open');
}

function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('open');
}

function downloadFile(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ──────────────────────────────────────────────
// THEME
// ──────────────────────────────────────────────
function toggleTheme() {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    const icon = document.getElementById('themeIcon');
    if (icon) icon.textContent = next === 'light' ? '☀️' : '🌙';
    localStorage.setItem('fc_theme', next);
}

// ──────────────────────────────────────────────
// ROLE HELPERS
// ──────────────────────────────────────────────
function getRoleConfig(role) {
    if (window.CONFIG?.ROLES?.[role]) return window.CONFIG.ROLES[role];
    const fallback = {
        owner:    { label: 'Owner',    icon: '👑', color: '#2e7d32' },
        manager:  { label: 'Manager',  icon: '🎯', color: '#3498db' },
        employee: { label: 'Employee', icon: '🧑‍💼', color: '#2ecc71' }
    };
    return fallback[role] || fallback.employee;
}

function updateUserChip() {
    const user = getCurrentUser();
    if (!user) return;
    const avatar = document.getElementById('userAvatar');
    const name = document.getElementById('userName');
    const role = document.getElementById('userRole');
    const cfg = getRoleConfig(user.role);
    if (avatar) {
        avatar.textContent = cfg.icon || '👤';
        avatar.style.background = (cfg.color || '#2ecc71') + '22';
        avatar.style.color = cfg.color || '#2ecc71';
    }
    if (name) name.textContent = user.full_name || user.name || 'User';
    if (role) role.textContent = (user.role || 'employee').toUpperCase();
}

function goToPage(page) {
    window.location.href = page + '.html';
}

// ──────────────────────────────────────────────
// INIT
// ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
    const savedTheme = localStorage.getItem('fc_theme')
        || window.CONFIG?.UI?.DEFAULT_THEME
        || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    const icon = document.getElementById('themeIcon');
    if (icon) icon.textContent = savedTheme === 'light' ? '☀️' : '🌙';

    // Theme toggle: header uses inline onclick="toggleTheme()" — no listener needed here.

    const clock = document.getElementById('headerClock');
    if (clock) {
        const tick = () => clock.textContent = new Date().toLocaleString('en-KE', {
            dateStyle: 'medium', timeStyle: 'short'
        });
        tick();
        setInterval(tick, 1000);
    }

    updateUserChip();

    document.querySelectorAll('.overlay').forEach(modal => {
        modal.addEventListener('click', function (e) {
            if (e.target === this) this.classList.remove('open');
        });
    });
});

// ──────────────────────────────────────────────
// EXPORTS
// ──────────────────────────────────────────────
window.DB = DB;
window.getToken = getToken;
window.setToken = setToken;
window.removeToken = removeToken;
window.getCurrentUser = getCurrentUser;
window.setCurrentUser = setCurrentUser;
window.removeCurrentUser = removeCurrentUser;
window.isAuthenticated = isAuthenticated;
window.requireAuth = requireAuth;
window.getUserRole = getUserRole;
window.hasRole = hasRole;
window.isManagerOrOwner = isManagerOrOwner;

// Permission helpers
window.hasPerm = hasPerm;
window.hasAnyPerm = hasAnyPerm;
window.getMyPermissions = getMyPermissions;
window.refreshCurrentUser = refreshCurrentUser;

window.apiRequest = apiRequest;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.handleLogout = handleLogout;

// Users API
window.fetchUsers = fetchUsers;
window.fetchUser = fetchUser;
window.createUser = createUser;
window.updateUserRole = updateUserRole;
window.updateUserPermissions = updateUserPermissions;
window.updateUserProfile = updateUserProfile;
window.deactivateUser = deactivateUser;
window.reactivateUser = reactivateUser;
window.fetchPermissionCatalog = fetchPermissionCatalog;
window.fetchMyPermissions = fetchMyPermissions;

// Products API
window.fetchProducts = fetchProducts;
window.fetchCategories = fetchCategories;
window.searchProducts = searchProducts;
window.createProduct = createProduct;
window.updateProduct = updateProduct;
window.deleteProduct = deleteProduct;
window.restockProduct = restockProduct;
window.fetchLowStockProducts = fetchLowStockProducts;

// Cache invalidation helpers
window.invalidateProductsCache = invalidateProductsCache;
window.invalidateCategoriesCache = invalidateCategoriesCache;
window.invalidateCatalogCache = invalidateCatalogCache;

// Sales API
window.createSale = createSale;
window.fetchSales = fetchSales;
window.fetchMySales = fetchMySales;
window.fetchTodaySales = fetchTodaySales;
window.fetchCreditSales = fetchCreditSales;

// Reports API
window.fetchDailyReport = fetchDailyReport;
window.fetchTopProducts = fetchTopProducts;
window.fetchTopProductsRange = fetchTopProductsRange;
window.fetchReport = fetchReport;
window.exportReport = exportReport;
window.fetchAnalyticsSummary = fetchAnalyticsSummary;

// UI
window.formatCurrency = formatCurrency;
window.getPaymentPillClass = getPaymentPillClass;
window.getRolePillClass = getRolePillClass;
window.createStats = createStats;
window.showToast = showToast;
window.closeModal = closeModal;
window.openModal = openModal;
window.downloadFile = downloadFile;
window.toggleTheme = toggleTheme;
window.goToPage = goToPage;
window.updateUserChip = updateUserChip;
window.getRoleConfig = getRoleConfig;

window.API_BASE = API_BASE;

console.log('✅ shared.js loaded');