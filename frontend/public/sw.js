// MedFlow Service Worker - Offline First Architecture
const CACHE_NAME = 'medflow-v2';
const API_CACHE = 'medflow-api-v2';
const IMAGE_CACHE = 'medflow-images-v2';

// Files to cache on install
const STATIC_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('medflow-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API requests - Network first, cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone the response before caching
          const responseToCache = response.clone();

          // Only cache successful GET requests
          if (request.method === 'GET' && response.status === 200) {
            caches.open(API_CACHE).then((cache) => {
              cache.put(request, responseToCache);
            });
          }

          return response;
        })
        .catch(() => {
          // If network fails, try cache
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              console.log('[SW] Serving API from cache:', request.url);
              return cachedResponse;
            }

            // Return offline response for failed API calls
            return new Response(
              JSON.stringify({
                offline: true,
                message: 'You are currently offline. This data will sync when connection is restored.'
              }),
              { headers: { 'Content-Type': 'application/json' } }
            );
          });
        })
    );
    return;
  }

  // Image requests - Cache first
  if (request.destination === 'image') {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request).then((response) => {
          const responseToCache = response.clone();

          caches.open(IMAGE_CACHE).then((cache) => {
            cache.put(request, responseToCache);
          });

          return response;
        }).catch(() => {
          // Return placeholder image if offline
          return caches.match('/placeholder.png');
        });
      })
    );
    return;
  }

  // Static assets - Cache first, network fallback
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then((response) => {
        // Don't cache non-GET requests
        if (request.method !== 'GET') {
          return response;
        }

        // Don't cache unsuccessful responses
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        const responseToCache = response.clone();

        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });

        return response;
      });
    }).catch(() => {
      // If both cache and network fail, show offline page
      if (request.destination === 'document') {
        return caches.match('/offline.html');
      }
    })
  );
});

// SYNC_ENTITIES - must match syncService.js
const SYNC_ENTITIES = [
  'patients', 'appointments', 'prescriptions', 'ophthalmologyExams', 'users',
  'visits', 'labOrders', 'labResults', 'invoices', 'queue',
  'pharmacyInventory', 'orthopticExams', 'glassesOrders', 'frameInventory',
  'contactLensInventory', 'clinics', 'approvals', 'stockReconciliations'
];

// Background sync handler
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);

  // Handle both tag formats for compatibility
  if (event.tag === 'medflow-sync-queue' || event.tag === 'sync-queue') {
    event.waitUntil(
      handleBackgroundSync()
    );
  }

  // Handle entity-specific sync tags
  SYNC_ENTITIES.forEach(entity => {
    if (event.tag === `sync-${entity}`) {
      event.waitUntil(
        handleEntitySync(entity)
      );
    }
  });
});

// Handle general background sync
async function handleBackgroundSync() {
  console.log('[SW] Processing background sync queue');

  try {
    // Notify the main thread to trigger sync
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(client => {
      client.postMessage({
        type: 'BACKGROUND_SYNC',
        timestamp: Date.now()
      });
    });

    // Call the global sync function if available
    if (typeof self.__medflowSync === 'function') {
      await self.__medflowSync();
    }

    return true;
  } catch (error) {
    console.error('[SW] Background sync failed:', error);
    throw error; // Re-throw to retry
  }
}

// Handle entity-specific sync
async function handleEntitySync(entity) {
  console.log(`[SW] Syncing entity: ${entity}`);

  try {
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(client => {
      client.postMessage({
        type: 'ENTITY_SYNC',
        entity,
        timestamp: Date.now()
      });
    });
    return true;
  } catch (error) {
    console.error(`[SW] Entity sync failed for ${entity}:`, error);
    throw error;
  }
}

// Periodic background sync (for browsers that support it)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'medflow-periodic-sync') {
    console.log('[SW] Periodic sync triggered');
    event.waitUntil(handleBackgroundSync());
  }
});

// Push notifications
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'New notification from MedFlow',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      { action: 'explore', title: 'View' },
      { action: 'close', title: 'Close' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('MedFlow', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Message handler for client communication
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CACHE_URLS') {
    const urlsToCache = event.data.payload;
    caches.open(CACHE_NAME).then((cache) => {
      cache.addAll(urlsToCache);
    });
  }
});

console.log('[SW] Service Worker loaded');