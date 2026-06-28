// Базовый service worker.
// На этом этапе офлайн-режим необязателен — кешируем только оболочку (app shell),
// чтобы приложение считалось устанавливаемой PWA. Для сетевых данных (Supabase)
// всегда используется network-first, чтобы не показывать устаревшие заявки.

const CACHE_NAME = 'perevozchik-crm-v1';
const APP_SHELL = ['/', '/index.html', '/icon.svg', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Только GET-запросы и только свой origin.
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  // Запросы к Supabase API не кешируем — пропускаем в сеть как есть.
  if (request.url.includes('/auth/v1') || request.url.includes('/rest/v1')) {
    return;
  }

  // Навигационные запросы: сеть, при сбое — кешированная оболочка.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Статика: cache-first.
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});
