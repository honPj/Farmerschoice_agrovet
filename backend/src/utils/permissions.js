
export const PERMISSIONS = {
    // Users
    'users.view':        'View users list and details',
    'users.create':      'Create new users',
    'users.edit_role':   'Change user roles',
    'users.edit_perms':  'Grant or revoke permissions',
    'users.deactivate':  'Deactivate / reactivate accounts',

    // Stock
    'stock.view':        'View the Stock page',
    'stock.manage':      'Add, edit, delete products',
    'stock.restock':     'Restock products',

    // Sales
    'sales.view_all':    'View All Sales page',
    'sales.refund':      'Process refunds / returns',

    // Reports & Analytics
    'reports.view':      'View Reports page',
    'live.view':         'View Live Dashboard',
    'analytics.view':    'View Analytics page',

    // Finance
    'discounts.manage':  'Create / manage discounts',
    'credit.collect':    'Record credit payments'
};

// Grouped for the UI checkbox grid
export const PERMISSION_GROUPS = [
    {
        group: 'Users',
        icon: '👥',
        items: [
            'users.view',
            'users.create',
            'users.edit_role',
            'users.edit_perms',
            'users.deactivate'
        ]
    },
    {
        group: 'Stock',
        icon: '📦',
        items: [
            'stock.view',
            'stock.manage',
            'stock.restock'
        ]
    },
    {
        group: 'Sales',
        icon: '💰',
        items: [
            'sales.view_all',
            'sales.refund'
        ]
    },
    {
        group: 'Reports & Analytics',
        icon: '📊',
        items: [
            'reports.view',
            'live.view',
            'analytics.view'
        ]
    },
    {
        group: 'Finance',
        icon: '💳',
        items: [
            'discounts.manage',
            'credit.collect'
        ]
    }
];

/**
 * Check if a user has a specific permission.
 * Owners (with "all") pass every check.
 */
export function hasPermission(user, permission) {
    if (!user) return false;
    const perms = Array.isArray(user.permissions) ? user.permissions : [];
    if (perms.includes('all')) return true;
    return perms.includes(permission);
}

/**
 * Check if a user has ANY of the given permissions.
 */
export function hasAnyPermission(user, permissions) {
    const list = Array.isArray(permissions) ? permissions : [permissions];
    return list.some(p => hasPermission(user, p));
}

/**
 * Validate a permission ID against the catalog.
 */
export function isValidPermission(p) {
    return Object.prototype.hasOwnProperty.call(PERMISSIONS, p);
}

/**
 * Filter an array down to only valid permission IDs.
 * Removes duplicates, keeps "all" if present.
 */
export function sanitizePermissions(arr) {
    if (!Array.isArray(arr)) return [];
    const seen = new Set();
    const out = [];
    for (const p of arr) {
        if (typeof p !== 'string') continue;
        if (p === 'all') {
            if (!seen.has('all')) { seen.add('all'); out.push('all'); }
            continue;
        }
        if (isValidPermission(p) && !seen.has(p)) {
            seen.add(p);
            out.push(p);
        }
    }
    return out;
}

/**
 * Effective permissions for UI: owners get the full list.
 */
export function effectivePermissions(user) {
    if (!user) return [];
    const perms = Array.isArray(user.permissions) ? user.permissions : [];
    if (perms.includes('all')) return Object.keys(PERMISSIONS);
    return perms.filter(isValidPermission);
}