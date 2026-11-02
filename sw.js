'use strict';

/**
 * Service worker de la calculadora (T-014, v0.4.0).
 *
 * Precarga solo los ficheros propios de la aplicación, con rutas
 * relativas, para publicarla bajo /calculadora-profes/ y abrirla sin
 * conexión. No llama a otros dominios ni envía analítica.
 *
 * CACHE_NAME identifica la versión guardada. Al activar una versión
 * nueva se borran las cachés anteriores de este proyecto (las que
 * empiezan por «calculadora-profes-») y esta copia pasa a controlar
 * las páginas ya abiertas.
 */

var CACHE_NAME = 'calculadora-profes-v0.4.0';

var PRECACHE_URLS = [
  'index.html',
  './',
  'style.css',
  'app.js',
  'calc.js',
  'storage.js',
  'manifest.json',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(PRECACHE_URLS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      var deletions = [];
      var index;
      for (index = 0; index < keys.length; index += 1) {
        if (keys[index] !== CACHE_NAME && keys[index].indexOf('calculadora-profes-') === 0) {
          deletions.push(caches.delete(keys[index]));
        }
      }
      return Promise.all(deletions);
    }).then(function () {
      return self.clients.claim();
    })
  );
});

/**
 * Solo las peticiones GET del mismo origen y dentro del alcance se
 * responden desde aquí. El resto (otros métodos, otros orígenes, o la
 * propia petición del service worker) sigue su curso sin tocarlo: así
 * el navegador puede actualizar sw.js y no se llama a terceros.
 */
function shouldHandle(request) {
  var url;
  var scopePath;
  if (request.method !== 'GET') {
    return false;
  }
  if (request.destination === 'serviceworker') {
    return false;
  }
  try {
    url = new URL(request.url);
  } catch (error) {
    return false;
  }
  if (url.origin !== self.location.origin) {
    return false;
  }
  scopePath = new URL(self.registration.scope).pathname;
  return url.pathname.indexOf(scopePath) === 0;
}

function fromCacheOrNetwork(request) {
  return caches.match(request).then(function (cached) {
    if (cached) {
      return cached;
    }
    return fetch(request);
  });
}

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (!shouldHandle(request)) {
    return;
  }
  if (request.mode === 'navigate') {
    event.respondWith(
      fromCacheOrNetwork(request).catch(function () {
        return caches.match('index.html').then(function (cached) {
          return cached || Response.error();
        });
      })
    );
    return;
  }
  event.respondWith(fromCacheOrNetwork(request));
});
