// Simple offline-first service worker for Simple Todos.
// App-shell caching with a network-first strategy for navigation requests
// and cache-first for static assets. localStorage handles all data, so
// no API caching needed.

const VERSION = "v1";
const CACHE = `simple-todos-${VERSION}`;
const APP_SHELL = ["/", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches
            .open(CACHE)
            .then((c) => c.addAll(APP_SHELL))
            .then(() => globalThis.skipWaiting()),
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(
                    keys
                        .filter((k) => k !== CACHE)
                        .map((k) => caches.delete(k)),
                ),
            )
            .then(() => globalThis.clients.claim()),
    );
});

// ---------- Web Push reminders ----------
//
// Payload shape (set by /api/push/notify-cron): JSON
//   { title: string, body: string, todoId: string, url: string }
// The service worker just renders the notification; click handling
// re-focuses the existing window (or opens a new one) at the URL,
// which the app uses for deep-linking.

self.addEventListener("push", (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch {
        data = { body: event.data ? event.data.text() : "", title: "Todos" };
    }
    const title = data.title || "Todos";
    const body = data.body || "";
    const url = data.url || "/";
    event.waitUntil(
        globalThis.registration.showNotification(title, {
            body,
            data: { todoId: data.todoId, url },
            icon: "/icons/icon-192.png",
            tag: data.todoId ? `todo-${data.todoId}` : "todos-reminder",
        }),
    );
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const targetUrl =
        (event.notification.data && event.notification.data.url) || "/";
    event.waitUntil(
        globalThis.clients
            .matchAll({ includeUncontrolled: true, type: "window" })
            .then((clientList) => {
                // If an app window is already open, focus it and tell the app
                // to navigate via postMessage; otherwise open a fresh window.
                for (const client of clientList) {
                    if (client.url.includes(self.location.origin)) {
                        client.postMessage({
                            type: "reminder-click",
                            url: targetUrl,
                        });
                        return client.focus();
                    }
                }
                return globalThis.clients.openWindow(targetUrl);
            }),
    );
});

self.addEventListener("fetch", (event) => {
    const req = event.request;
    if (req.method !== "GET") return;
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;

    if (req.mode === "navigate") {
        event.respondWith(
            fetch(req)
                .then((res) => {
                    const copy = res.clone();
                    caches
                        .open(CACHE)
                        .then((c) => c.put(req, copy))
                        .catch(() => {});
                    return res;
                })
                .catch(() =>
                    caches.match(req).then((r) => r || caches.match("/")),
                ),
        );
        return;
    }

    event.respondWith(
        caches.match(req).then((cached) => {
            if (cached) return cached;
            return fetch(req).then((res) => {
                if (
                    res.ok &&
                    (url.pathname.startsWith("/_next/") ||
                        url.pathname.startsWith("/icons/"))
                ) {
                    const copy = res.clone();
                    caches
                        .open(CACHE)
                        .then((c) => c.put(req, copy))
                        .catch(() => {});
                }
                return res;
            });
        }),
    );
});
