const CACHE_NAME = 'leanpilot-sf-v1';
const STATIC_ASSETS = ['/', '/shopfloor', '/andon'];
const API_BASE = '/api/';
const QUEUE_STORE = 'offline-queue';

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// IndexedDB helpers for offline queue
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('leanpilot-sw', 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(QUEUE_STORE, {
        keyPath: 'id',
        autoIncrement: true,
      });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getQueueCount() {
  return openDB().then(
    (db) =>
      new Promise((resolve) => {
        const tx = db.transaction(QUEUE_STORE, 'readonly');
        const req = tx.objectStore(QUEUE_STORE).count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(0);
      }),
  );
}

async function queueRequest(url, method, body, headers) {
  const db = await openDB();
  const tx = db.transaction(QUEUE_STORE, 'readwrite');
  const headerObj = {};
  if (headers && typeof headers.forEach === 'function') {
    headers.forEach((value, key) => {
      headerObj[key] = value;
    });
  }
  tx.objectStore(QUEUE_STORE).add({
    url,
    method,
    body,
    headers: headerObj,
    timestamp: Date.now(),
  });
  await new Promise((r) => {
    tx.oncomplete = r;
  });
  // Notify clients
  const allClients = await self.clients.matchAll();
  const count = await getQueueCount();
  allClients.forEach((c) =>
    c.postMessage({ type: 'QUEUE_UPDATED', count }),
  );
}

async function replayQueue() {
  const db = await openDB();
  const tx = db.transaction(QUEUE_STORE, 'readonly');
  const items = await new Promise((resolve) => {
    const req = tx.objectStore(QUEUE_STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve([]);
  });

  for (const item of items) {
    try {
      await fetch(item.url, {
        method: item.method,
        body: item.body,
        headers: item.headers,
      });
      // Delete from queue on success
      const delTx = db.transaction(QUEUE_STORE, 'readwrite');
      delTx.objectStore(QUEUE_STORE).delete(item.id);
      await new Promise((r) => {
        delTx.oncomplete = r;
      });
    } catch {
      break; // Stop on first failure — preserve order
    }
  }

  const allClients = await self.clients.matchAll();
  const remaining = await getQueueCount();
  allClients.forEach((c) =>
    c.postMessage({ type: 'QUEUE_UPDATED', count: remaining }),
  );
}

// Fetch handler
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API calls: network-first, queue writes if offline
  if (url.pathname.startsWith(API_BASE)) {
    if (event.request.method === 'GET') {
      // Network first, fall back to cache for GET
      event.respondWith(
        fetch(event.request)
          .then((resp) => {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
            return resp;
          })
          .catch(() => caches.match(event.request)),
      );
    } else if (url.pathname.startsWith('/api/shopfloor/')) {
      // POST/PATCH: try network, queue if offline
      event.respondWith(
        fetch(event.request.clone()).catch(async () => {
          const body = await event.request.text();
          await queueRequest(
            event.request.url,
            event.request.method,
            body,
            event.request.headers,
          );
          return new Response(JSON.stringify({ queued: true }), {
            status: 202,
            headers: { 'Content-Type': 'application/json' },
          });
        }),
      );
    }
    return;
  }

  // Static: cache-first
  event.respondWith(
    caches
      .match(event.request)
      .then((cached) => cached || fetch(event.request)),
  );
});

// Replay queue when requested
self.addEventListener('message', (event) => {
  if (event.data === 'REPLAY_QUEUE') {
    replayQueue();
  }
});
