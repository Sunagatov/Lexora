import {createHash} from 'node:crypto'
import type {Plugin} from 'vite'

export function offlinePlugin(): Plugin {
  return {
    name: 'lexora-offline-shell', apply: 'build', enforce: 'post',
    generateBundle(_, bundle) {
      const files = ['/index.html', '/favicon.svg', ...Object.keys(bundle).filter(name => name !== 'index.html').map(name => `/${name}`)]
      const version = createHash('sha256').update(JSON.stringify(files)).digest('hex').slice(0, 16)
      this.emitFile({type: 'asset', fileName: 'sw.js', source: `
const CACHE = 'lexora-shell-${version}';
const FILES = ${JSON.stringify(files)};
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  await cache.addAll(FILES.map(url => new Request(url, {cache: 'reload'})));
  await self.skipWaiting();
})()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  // Retain the previous shell while already-open tabs finish using it.
  const keys = (await caches.keys()).filter(key => key.startsWith('lexora-shell-'));
  await Promise.all(keys.slice(0, -2).map(key => caches.delete(key)));
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const shell = async () => (await caches.open(CACHE)).match('/index.html');
      try {
        const response = await fetch(request, {signal: AbortSignal.timeout(5000)});
        return response.status >= 500 ? (await shell()) || response : response;
      } catch { return shell(); }
    })());
  } else if (FILES.includes(url.pathname)) {
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(url.pathname)) || fetch(request)));
  }
});
`})
    },
  }
}
