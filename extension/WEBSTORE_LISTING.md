# Chrome Web Store listing draft

Copy-paste source for the Developer Console form at
https://chrome.google.com/webstore/devconsole — not itself submitted anywhere.

## Package to upload
`momentum-extension-v1.0.0.zip` (built from a production `config.js` —
see `build.js production`). Located in the system temp folder from the last
build; regenerate with:
```
node build.js production
Compress-Archive -Path background.js,content-script.js,config.js,icons.js,manifest.json,popup.css,popup.html,popup.js,icons -DestinationPath momentum-extension.zip
node build.js development   # restore local dev config afterward
```

## Category
Productivity

## Short description (max 132 characters)
Track focus sessions and site time from your toolbar — syncs with the Momentum web dashboard and desktop agent.

## Detailed description
Momentum helps you understand where your focused work time actually goes.

This extension is one piece of a three-part system — a web dashboard, this
Chrome extension, and an optional desktop tray agent — that all stay in sync
under one account.

**What it does:**
- Start, pause, and stop focus sessions right from your toolbar
- Automatically tracks which sites you visit and how long you spend on each
  while a session is running (domain only — not full URLs or page content)
- Keyboard shortcuts: Alt+Shift+P to pause/resume, Alt+Shift+X to stop
- Syncs automatically — sign in once on the web app, and the extension picks
  up your session without a second login
- Pause from your desktop tray app (if installed) and the extension reflects
  it within seconds

Everything you track shows up on your Momentum dashboard: streaks, goals,
activity heatmaps, top sites, and more.

## Privacy policy URL
https://momentum-beryl-alpha.vercel.app/privacy

## Single purpose description
(Required by Chrome Web Store review — describe the extension's one purpose)
Track the user's focused work sessions and time spent on websites during
those sessions, and sync that data with the user's Momentum account.

## Permission justifications
- **storage** — store the user's login session and active-session state
  locally in the browser.
- **tabs** — read the active tab's URL to determine which domain to credit
  time to during a session.
- **alarms** — periodically flush tracked site data and poll session status
  in the background service worker.
- **activeTab** — detect the currently active site.
- **host_permissions (backend API domain)** — required to call the Momentum
  API to start/pause/stop sessions and sync data.

## Still needed from you (can't be done without your accounts)
- A Chrome Web Store developer account ($5 one-time registration fee).
- Screenshots (1280x800 or 640x400, at least one required) — showing the
  popup in its logged-in and active-session states would be ideal.
- Actually submitting the listing for review (typically takes a few days).
