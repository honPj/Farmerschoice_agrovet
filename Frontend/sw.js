// ============================================
// SERVICE WORKER - OFFLINE MODE
// ============================================

const CACHE_NAME = 'bartrak-v1';
const OFFLINE_URL = 'pos.html';

// Files to cache for offline use
const FILES_TO_CACHE = [
  'pos.html',
  'OIP.webp',
  'manifest.json',
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=Inter:wght@300;400;500;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
];

// Install event - cache files
self.addEventListener('install', (event) => {
  console.log('📦 Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Caching files...');
        return cache.addAll(FILES_TO_CACHE);
      })
      .then(() => {
        console.log('📦 Cache complete!');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('❌ Cache failed:', error);
      })
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  console.log('⚡ Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  const request = event.request;
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    event.respondWith(fetch(request));
    return;
  }
  
  // Try cache first, fallback to network
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // Return cached version
          return cachedResponse;
        }
        
        // Not in cache - fetch from network
        return fetch(request)
          .then((networkResponse) => {
            // Cache the new response for next time
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(request, clone);
                });
            }
            return networkResponse;
          })
          .catch(() => {
            // Network failed - show offline page
            return caches.match(OFFLINE_URL);
          });
      })
  );
});

// ============================================
// PUSH NOTIFICATIONS
// ============================================

// Push event - display notification
self.addEventListener('push', (event) => {
  console.log('📨 Push notification received:', event);
  
  let data = {
    title: 'BarTrak POS',
    body: 'New activity!',
    icon: 'icon-192.png',
    badge: 'icon-192.png'
  };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }
  
  const options = {
    body: data.body,
    icon: data.icon || 'icon-192.png',
    badge: data.badge || 'icon-192.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || 'pos.html',
      timestamp: Date.now()
    },
    actions: [
      {
        action: 'open',
        title: '📊 Open POS'
      },
      {
        action: 'dismiss',
        title: '❌ Dismiss'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'dismiss') {
    return;
  }
  
  const url = event.notification.data?.url || 'pos.html';
  
  event.waitUntil(
    clients.openWindow(url)
  );
});

