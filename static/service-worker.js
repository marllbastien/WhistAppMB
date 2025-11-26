const CACHE_NAME = 'wb-scoring-v1';
const ASSETS = [
    '/',
    '/favicon.ico',
    '/Logo_App_Rond.png'
];

// Install : on met quelques fichiers de base en cache
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

// Activate : on nettoie les anciens caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            )
        )
    );
});

// Fetch : on sert le cache d'abord, puis le réseau
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return; // laisse les POST/PUT tranquilles

    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) return cached;

            return fetch(event.request).then((response) => {
                const clone = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, clone);
                });
                return response;
            });
        })
    );
});
