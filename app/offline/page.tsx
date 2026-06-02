"use client";

/**
 * Fallback shown by the next-pwa service worker when navigation fetches fail.
 *
 * Routing: `next-pwa` ships a default precache + runtime cache. When a
 * navigation request misses the cache AND the network is unreachable, the SW
 * serves this page instead of the browser's "no internet" chrome.
 *
 * Test plan (manual — automation lives in OPERATIONS.md):
 *   1. `npm run build && npm run start`
 *   2. Open Chrome → DevTools → Application → Service Workers — confirm
 *      `/sw.js` is registered and "Activated".
 *   3. Navigate to /dashboard while online; let it cache.
 *   4. DevTools → Network → "Offline" checkbox.
 *   5. Reload — the cached shell should render, falling back to this page only
 *      for routes that weren't pre-visited.
 *   6. Install the PWA via the address-bar install icon; relaunch from
 *      OS app drawer; confirm cold-start renders /dashboard without network.
 */
export default function OfflinePage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white border rounded-lg p-8 text-center space-y-4">
        <div className="text-5xl" aria-hidden>
          ⚡
        </div>
        <h1 className="text-2xl font-bold text-gray-900">You&apos;re offline</h1>
        <p className="text-sm text-gray-600">
          We&apos;ll automatically reconnect when your network is back. Pages you&apos;ve
          already visited should still work — try going back instead of reloading.
        </p>
        <div className="pt-2 flex justify-center gap-2">
          <button
            type="button"
            onClick={() => history.back()}
            className="px-4 py-2 text-sm border rounded hover:bg-gray-50"
          >
            ← Go back
          </button>
          <button
            type="button"
            onClick={() => location.reload()}
            className="px-4 py-2 text-sm bg-brand text-white rounded hover:bg-brand-dark"
          >
            Retry now
          </button>
        </div>
        <p className="text-xs text-gray-400 pt-3 border-t">
          PlotBroker · works offline for pages you&apos;ve already opened.
        </p>
      </div>
    </main>
  );
}
