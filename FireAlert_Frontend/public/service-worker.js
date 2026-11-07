// Unregister the old offline preview worker and discard its stale application cache.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((name) => name.startsWith('firealert-'))
          .map((name) => caches.delete(name))
      ))
      .then(() => self.registration.unregister())
  );
});