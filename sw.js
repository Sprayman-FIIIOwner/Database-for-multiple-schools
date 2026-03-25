self.addEventListener('install', (e) => {
  console.log('Service Worker: Installed');
});

self.addEventListener('fetch', (e) => {
  // Biarkan browser ngambil data kayak biasa
  e.respondWith(fetch(e.request));
});