// ============================================
// SERVICE WORKER — FarmersChoice Agrovet
// Strategy:
//   • App shell (HTML / JS / CSS) → NETWORK FIRST
//     (always fetch fresh; fall back to cache only when offline)
//   • Static assets (images / fonts / CDN) → CACHE FIRST
//   • API calls → never intercepted
// This means during development you ALWAYS get fresh files.
// ============================================

const CACHE_NAME = 'farmerschoice-v3';  // bumped — deletes v1 on activate
const OFFLINE_URL = 'pos.html';

// Only pre-cache static assets. Do NOT pre-cache HTML/JS,
// otherwise you risk stale app-shell on first load.
const STATIC_ASSETS = [
  '/css/shared.css',
  '/images/agrovet-icon_512x512.png',  // <-- Updated to .png
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
];
// ────────────────────────────────────────────
// INSTALL
// ────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('📦 SW installing (v2)...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => {
        console.log('📦 SW precache complete');
        return self.skipWaiting();     // activate immediately
      })
      .catch((err) => console.error('❌ SW precache failed:', err))
  );
});

// ────────────────────────────────────────────
// ACTIVATE — delete any cache that isn't v2
// ────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('⚡ SW activating (v2)...');
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('🗑️ Deleting old cache:', name);
            return caches.delete(name);
          }
        })
      ))
      .then(() => {
        console.log('⚡ SW activated, taking control');
        return self.clients.claim();   // start controlling open tabs
      })
  );
});

// ────────────────────────────────────────────
// FETCH
// ────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // 1. Never touch non-GET or API calls
  if (req.method !== 'GET' || req.url.includes('/api/')) {
    return;
  }

  const url = new URL(req.url);

  // 2. App shell → NETWORK FIRST
  const isAppShell =
       req.destination === 'document'
    || req.destination === 'script'
    || req.destination === 'style'
    || url.pathname.endsWith('.html')
    || url.pathname.endsWith('.js')
    || url.pathname.endsWith('.css');

  if (isAppShell) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Cache the fresh copy for offline fallback
          if (res && res.status === 200 && res.type !== 'opaque') {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => {
          // Network failed → try cache
          return caches.match(req).then((cached) => {
            if (cached) return cached;
            // Final fallback for HTML navigation requests
            if (req.destination === 'document') {
              return caches.match(OFFLINE_URL);
            }
            return new Response('Offline', { status: 503 });
          });
        })
    );
    return;
  }

  // 3. Everything else (images, fonts, CDN) → CACHE FIRST
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => {
          // If it's an image, return a transparent pixel? Just 503.
          return new Response('', { status: 503 });
        });
    })
  );
});

// ────────────────────────────────────────────
// PUSH NOTIFICATIONS
// ────────────────────────────────────────────
self.addEventListener('push', (event) => {
  console.log('📨 Push received');
  let data = {
    title: 'FarmersChoice Agrovet',
    body: 'New activity!',
    icon: 'images/agrovet-icon_192x192.png',
    badge: 'images/agrovet-icon_512x512.png',
  };
  if (event.data) {
    try { data = event.data.json(); }
    catch { data.body = event.data.text(); }
  }

  const options = {
    body: data.body,
    icon: data.icon || 'images/agrovet-icon_192x192.png',
    badge: data.badge || 'images/agrovet-icon_512x512.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || 'pos.html',
      timestamp: Date.now()
    },
    actions: [
      { action: 'open',    title: '📊 Open POS' },
      { action: 'dismiss', title: '❌ Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ────────────────────────────────────────────
// NOTIFICATION CLICK
// ────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || 'pos.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      // Reuse an existing window if we have one
      for (const client of list) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new one
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});