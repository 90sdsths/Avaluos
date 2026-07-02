// Service Worker — permite usar la app SIN INTERNET en campo.
// Guarda en caché los archivos de la app y los reutiliza cuando no hay conexión.

const CACHE = 'avaluos-v23';

// Archivos propios de la app (rutas relativas al directorio del SW)
const APP_FILES = [
  './',
  './index.html',
  './urbano.html',
  './rural.html',
  './registros.html',
  './storage.js',
  './planos.js',
  './tablas.js',
  './collapse.js',
  './mapacampo.js',
  './anotaciones.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './favicon-32.png'
];

// Librería externa del mapa (Leaflet) — se cachea para que el mapa cargue offline
const EXTERNOS = [
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css'
];

// Al instalar: descargar y guardar todo lo de la app
self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // los archivos propios son obligatorios
    await cache.addAll(APP_FILES);
    // los externos se intentan, pero si fallan no rompen la instalación
    await Promise.allSettled(EXTERNOS.map(u => cache.add(u).catch(() => {})));
    self.skipWaiting();
  })());
});

// Al activar: limpiar versiones viejas de la caché
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const claves = await caches.keys();
    await Promise.all(claves.filter(k => k !== CACHE).map(k => caches.delete(k)));
    self.clients.claim();
  })());
});

// Estrategia de respuesta a cada petición
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Tiles del mapa (imágenes satelitales): "cache primero, luego red".
  // Así los que ya descargaste (botón offline) sirven sin internet.
  const esTile = /tile|arcgisonline|opentopomap|basemaps|googleapis|ggpht|mt\d/i.test(url.hostname + url.pathname);
  if (esTile) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      try {
        const resp = await fetch(req);
        // guardar el tile descargado para usarlo offline luego
        if (resp.ok) cache.put(req, resp.clone());
        return resp;
      } catch (err) {
        return new Response('', { status: 504 });
      }
    })());
    return;
  }

  // No interceptar APIs que necesitan datos frescos (elevación, etc.)
  if (/api\.open-meteo\.com|api\.opentopodata|geoapify|nominatim/i.test(url.hostname)) {
    return; // dejar pasar a la red normalmente
  }

  // App y recursos: "cache primero, luego red" (para que abra sin internet)
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req);
    if (hit) {
      // refrescar en segundo plano si hay red (no bloquea)
      fetch(req).then(r => { if (r.ok) cache.put(req, r.clone()); }).catch(() => {});
      return hit;
    }
    try {
      const resp = await fetch(req);
      if (resp.ok && url.origin === self.location.origin) cache.put(req, resp.clone());
      return resp;
    } catch (err) {
      // si es una navegación (abrir una página) y no hay red, dar el index
      if (req.mode === 'navigate') {
        const idx = await cache.match('./index.html');
        if (idx) return idx;
      }
      return new Response('Sin conexión y sin copia en caché.', { status: 503 });
    }
  })());
});
