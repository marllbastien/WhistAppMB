const CACHE_VERSION = 'wb-scoring-v6';   // ⬅ tu incrémenteras ici
const CACHE_NAME = CACHE_VERSION;

const ASSETS = ['/', '/favicon.ico', '/Logo_App_Rond.png'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        (async () => {
            // 1) Nettoyage des anciens caches
            const keys = await caches.keys();
            await Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            );

            // 2) Prise de contrôle immédiate
            await self.clients.claim();

            // 3) Prévenir toutes les fenêtres qu'une nouvelle version est active
            const clientsList = await self.clients.matchAll({
                type: 'window',
                includeUncontrolled: true
            });

            for (const client of clientsList) {
                client.postMessage({ type: 'NEW_VERSION' });
            }
        })()
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const acceptHeader = req.headers.get('accept') || '';
    const url = new URL(req.url);

    // HTML / navigation → network-first
    if (req.mode === 'navigate' || acceptHeader.includes('text/html')) {
        event.respondWith(
            fetch(req)
                .then((response) => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
                    return response;
                })
                .catch(() => caches.match(req))
        );
        return;
    }

    // API → jamais mis en cache
    if (url.pathname.startsWith('/api/')) {
        return;
    }

    // Assets connus → cache-first
    if (ASSETS.includes(url.pathname)) {
        event.respondWith(
            caches.match(req).then((cached) => {
                if (cached) return cached;

                return fetch(req).then((response) => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
                    return response;
                });
            })
        );
        return;
    }

    // Le reste → réseau direct
});
