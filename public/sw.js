// Minimal, safe service worker: installable PWA, network-first pass-through.
self.addEventListener("install", () => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("fetch", (event) => {
  // Pass requests straight through to the network — no aggressive caching.
  event.respondWith(fetch(event.request))
})
