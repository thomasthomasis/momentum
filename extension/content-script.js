'use strict';

// Bridges login/logout state from the Momentum web app into the extension.
// AuthContext.tsx dispatches these events on `window` after a successful
// login/register/session-restore (or on logout) — we just relay the payload
// to the background service worker, which is the only thing with access to
// chrome.storage.local.
//
// Note: content scripts only inject on page load/navigation, so a tab that
// was already open before this extension was installed/reloaded won't fire
// these until it's refreshed.

window.addEventListener('momentum-auth', (event) => {
  chrome.runtime.sendMessage({ type: 'EXTERNAL_AUTH_SYNC', auth: event.detail });
});

window.addEventListener('momentum-logout', () => {
  chrome.runtime.sendMessage({ type: 'EXTERNAL_LOGOUT_SYNC' });
});
