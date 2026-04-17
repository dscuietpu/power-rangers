

const CACHE_NAME = 'technovate-maptiles-v2';
const MAP_TILE_URLS = ['tile.openstreetmap.org'];
const MAX_TILE_CACHE = 500;
const TILE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) =>
        Promise.all(names.map((n) => n !== CACHE_NAME && caches.delete(n)))
      )
      .then(() => self.clients.claim())
  );
  // Take control of all clients immediately
  event.waitUntil(self.clients.claim());
});

function wrapWithTimestamp(response) {
  const headers = new Headers(response.headers);
  headers.append('sw-cached-at', Date.now().toString());
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function isTileStale(cachedResponse) {
  const cachedAt = cachedResponse.headers.get('sw-cached-at');
  if (!cachedAt) return false;
  return Date.now() - parseInt(cachedAt) > TILE_TTL_MS;
}

async function trimCache(cache) {
  const keys = await cache.keys();
  if (keys.length > MAX_TILE_CACHE) {
    const toDelete = keys.slice(0, Math.floor(MAX_TILE_CACHE * 0.1));
    await Promise.all(toDelete.map((k) => cache.delete(k)));
  }
}

// ---- Map Tile Caching (existing) ----
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Check if the request is for an OSM map tile
  const isMapTile = MAP_TILE_URLS.some((domain) => url.hostname.includes(domain));

  if (isMapTile) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        // Cache-first strategy for map tiles
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) {
          // If we have a cached version, return it immediately (fast for disaster areas)
          // Optionally, we could fetch invisibly to update the cache, but map tiles don't change often.
          return cachedResponse;
        }

        // If not in cache, try network
        try {
          const networkResponse = await fetch(event.request);
          // Only cache successful GET responses
          if (networkResponse.ok && event.request.method === 'GET') {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch (error) {
          // Offline and not in cache, return a fallback or simply let it fail gracefully
          // For map tiles, failing just shows a blank tile which leaflet handles.
          console.error('Network request failed and no cache available for tile:', event.request.url);
          throw error;
        }
      })
    );
  }
});

// ---- Push Notification Handling ----
self.addEventListener('push', (event) => {
  let data = { title: '🚨 Disaster Alert', body: 'You have been pinged!', type: 'disaster_ping' };
  
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: [500, 200, 500, 200, 500, 200, 500, 200, 500, 200],
    tag: 'disaster-ping',
    renotify: true,
    requireInteraction: true,
    data: data,
    actions: [
      { action: 'respond', title: '🏃 Respond Now' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  // Show the notification
  event.waitUntil(
    self.registration.showNotification(data.title, options)
      .then(() => {
        // Post message to ALL open clients to trigger the siren sound
        return self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      })
      .then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'DISASTER_PING',
            payload: data
          });
        });
      })
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'respond') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clientList) => {
        // Focus existing window or open new one
        for (const client of clientList) {
          if (client.url.includes('/') && 'focus' in client) {
            return client.focus();
          }
        }
        return self.clients.openWindow('/');
      })
    );
  }
});
