'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration — update API_BASE to match your backend URL
// ─────────────────────────────────────────────────────────────────────────────
const API_BASE = 'http://localhost:5000/api/v1';

// ── Storage helpers ───────────────────────────────────────────────────────────

async function getStorage(key) {
  const result = await chrome.storage.local.get(key);
  return Array.isArray(key) ? result : result[key] ?? null;
}

async function setStorage(obj) {
  return chrome.storage.local.set(obj);
}

// ── Auth helpers ──────────────────────────────────────────────────────────────

async function getAuth() {
  return getStorage('auth');
}

async function setAuth(auth) {
  await setStorage({ auth });
}

async function doRefresh() {
  const auth = await getAuth();
  if (!auth?.refreshToken) return null;

  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: auth.refreshToken })
    });

    if (!res.ok) { await setAuth(null); return null; }

    const data = await res.json();
    const newAuth = {
      ...auth,
      accessToken:  data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt:    Date.now() + (data.expiresIn ?? 900) * 1000
    };
    await setAuth(newAuth);
    return newAuth;
  } catch {
    return null;
  }
}

async function getAccessToken() {
  let auth = await getAuth();
  if (!auth) return null;
  // Refresh if expired or within 60 s of expiry
  if (!auth.expiresAt || auth.expiresAt - 60_000 < Date.now()) {
    auth = await doRefresh();
  }
  return auth?.accessToken ?? null;
}

async function apiFetch(path, options = {}) {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(options.headers ?? {})
    }
  });

  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try { const d = await res.json(); msg = d.message ?? d.title ?? msg; } catch {}
    throw new Error(msg);
  }

  if (res.status === 204) return null;
  return res.json();
}

// ── Site tracking ─────────────────────────────────────────────────────────────

async function getSiteTracking() {
  const st = await getStorage('siteTracking');
  return st ?? { sites: {}, current: null };
}

function domainFromUrl(url) {
  try {
    const u = new URL(url);
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    return u.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

// Credit elapsed time to the current domain without changing which domain is active
async function flushCurrentSite() {
  const tracking = await getSiteTracking();
  if (!tracking.current) return tracking;

  const { domain, startedAt } = tracking.current;
  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  if (!tracking.sites[domain]) tracking.sites[domain] = { timeSpentSeconds: 0, visitCount: 0 };
  tracking.sites[domain].timeSpentSeconds += elapsed;

  return tracking;
}

async function setActiveDomain(domain) {
  const tracking = await flushCurrentSite();

  if (domain) {
    if (!tracking.sites[domain]) tracking.sites[domain] = { timeSpentSeconds: 0, visitCount: 0 };
    tracking.sites[domain].visitCount += 1;
    tracking.current = { domain, startedAt: Date.now() };
  } else {
    tracking.current = null;
  }

  await setStorage({ siteTracking: tracking });
}

async function getActiveTabDomain() {
  try {
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return tabs.length ? domainFromUrl(tabs[0].url ?? '') : null;
  } catch {
    return null;
  }
}

async function startSiteTracking() {
  const domain = await getActiveTabDomain();
  await setStorage({ siteTracking: { sites: {}, current: null } });
  if (domain) await setActiveDomain(domain);
  chrome.alarms.create('site-flush', { periodInMinutes: 0.5 }); // every 30 s
}

// Finalise tracking and return the accumulated sites map
async function stopSiteTracking() {
  const tracking = await flushCurrentSite();
  tracking.current = null;
  await setStorage({ siteTracking: tracking });
  chrome.alarms.clear('site-flush');
  return tracking.sites;
}

// ── Tab events ────────────────────────────────────────────────────────────────

chrome.tabs.onActivated.addListener(async (info) => {
  const session = await getStorage('session');
  if (!session || session.isPaused) return;

  try {
    const tab = await chrome.tabs.get(info.tabId);
    const domain = domainFromUrl(tab.url ?? '');
    await setActiveDomain(domain);
  } catch {}
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  const session = await getStorage('session');
  if (!session || session.isPaused) return;

  try {
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tabs.length || tabs[0].id !== tabId) return;
    const domain = domainFromUrl(tab.url ?? '');
    await setActiveDomain(domain);
  } catch {}
});

// ── Status polling ────────────────────────────────────────────────────────────
// The backend is the single source of truth for pause state — the tray agent's
// idle detection can pause/resume/end a session without this extension knowing.
// Unlike 'site-flush', this alarm keeps running while paused, since a resume
// (or end) triggered elsewhere needs to be picked up regardless of our local
// pause state.

async function pollSessionStatus() {
  const session = await getStorage('session');
  if (!session) return;

  let status;
  try {
    status = await apiFetch(`/sessions/${session.id}/status`);
  } catch {
    return; // transient — try again next alarm
  }

  if (status.endedAt) {
    // Ended elsewhere (e.g. the tray agent) — mirror handleStopSession's local
    // cleanup. Whoever ended it already flushed their own site/app data.
    await stopSiteTracking();
    chrome.alarms.clear('status-poll');
    await setStorage({ session: null, siteTracking: null });
    return;
  }

  const totalPausedMs = status.totalPausedSeconds * 1000;

  if (status.isPaused !== session.isPaused) {
    if (status.isPaused) {
      // Paused elsewhere — stop crediting site time locally, same as handlePauseSession.
      const tracking = await flushCurrentSite();
      tracking.current = null;
      await setStorage({ siteTracking: tracking });
      chrome.alarms.clear('site-flush');
    } else {
      // Resumed elsewhere — restart site tracking, same as handleResumeSession.
      const domain = await getActiveTabDomain();
      const prevTracking = await getSiteTracking();
      await setStorage({ siteTracking: { sites: prevTracking.sites, current: null } });
      if (domain) await setActiveDomain(domain);
      chrome.alarms.create('site-flush', { periodInMinutes: 0.5 });
    }

    await setStorage({
      session: {
        ...session,
        isPaused:      status.isPaused,
        pausedAt:      status.isPaused ? status.pausedAt : null,
        totalPausedMs,
      }
    });
  } else if (totalPausedMs !== session.totalPausedMs) {
    await setStorage({ session: { ...session, totalPausedMs } });
  }
}

// ── Alarm handler ─────────────────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'status-poll') {
    await pollSessionStatus();
    return;
  }

  if (alarm.name !== 'site-flush') return;
  const session = await getStorage('session');
  if (!session || session.isPaused) return;

  // Flush and reset the clock so next flush only counts new time
  const tracking = await flushCurrentSite();
  if (tracking.current) tracking.current.startedAt = Date.now();
  await setStorage({ siteTracking: tracking });
});

// ── Keyboard command handlers ─────────────────────────────────────────────────

chrome.commands.onCommand.addListener(async (command) => {
  const session = await getStorage('session');
  if (!session) return;

  if (command === 'pause-resume') {
    if (session.isPaused) await handleResumeSession();
    else await handlePauseSession();
  } else if (command === 'stop-session') {
    await handleStopSession({ shipped: false, energyLevel: null });
  }
});

// ── Session state handlers ────────────────────────────────────────────────────

async function handlePauseSession() {
  const session = await getStorage('session');
  if (!session || session.isPaused) return session;

  // Pause site tracking
  const tracking = await flushCurrentSite();
  tracking.current = null;
  await setStorage({ siteTracking: tracking });
  chrome.alarms.clear('site-flush');

  const updated = { ...session, isPaused: true, pausedAt: new Date().toISOString() };

  try { await apiFetch(`/sessions/${session.id}/pause`, { method: 'POST' }); } catch {}

  await setStorage({ session: updated });
  return updated;
}

async function handleResumeSession() {
  const session = await getStorage('session');
  if (!session || !session.isPaused) return session;

  const pausedMs = session.pausedAt
    ? Date.now() - new Date(session.pausedAt).getTime()
    : 0;

  const updated = {
    ...session,
    isPaused:      false,
    pausedAt:      null,
    totalPausedMs: (session.totalPausedMs ?? 0) + pausedMs
  };

  try { await apiFetch(`/sessions/${session.id}/resume`, { method: 'POST' }); } catch {}

  await setStorage({ session: updated });

  // Resume site tracking
  const domain = await getActiveTabDomain();
  const prevTracking = await getSiteTracking();
  await setStorage({ siteTracking: { sites: prevTracking.sites, current: null } });
  if (domain) await setActiveDomain(domain);
  chrome.alarms.create('site-flush', { periodInMinutes: 0.5 });

  return updated;
}

async function handleStopSession({ shipped, energyLevel }) {
  const session = await getStorage('session');
  if (!session) return;

  // Flush and collect site data
  const sites = await stopSiteTracking();

  const sitePayload = Object.entries(sites)
    .filter(([, d]) => d.timeSpentSeconds > 0)
    .map(([domain, d]) => ({
      domain,
      timeSpentSeconds: Math.round(d.timeSpentSeconds),
      visitCount:       d.visitCount
    }));

  if (sitePayload.length > 0) {
    try {
      await apiFetch(`/sessions/${session.id}/sites`, {
        method: 'POST',
        body:   JSON.stringify({ sites: sitePayload })
      });
    } catch {}
  }

  // End session
  try {
    const body = {};
    if (shipped   !== undefined && shipped   !== null) body.shipped     = shipped;
    if (energyLevel !== undefined && energyLevel !== null) body.energyLevel = energyLevel;
    await apiFetch(`/sessions/${session.id}/end`, {
      method: 'POST',
      body:   JSON.stringify(body)
    });
  } catch {}

  chrome.alarms.clear('status-poll');
  await setStorage({ session: null, siteTracking: null });
}

// ── Message router ────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message)
    .then(result => sendResponse({ ok: true, ...result }))
    .catch(err  => sendResponse({ ok: false, error: err.message }));
  return true; // keep channel open for async response
});

async function handleMessage(msg) {
  switch (msg.type) {

    case 'GET_STATE': {
      const auth    = await getStorage('auth');
      const session = await getStorage('session');
      return { auth: auth ?? null, session: session ?? null };
    }

    case 'LOGIN': {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: msg.email, password: msg.password })
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.message ?? 'Invalid email or password');
      }
      const data = await res.json();
      // API returns { accessToken, refreshToken, expiresIn, user: { id, email, displayName } }
      const auth = {
        accessToken:  data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt:    Date.now() + (data.expiresIn ?? 900) * 1000,
        user: {
          id:          data.user.id,
          email:       data.user.email,
          displayName: data.user.displayName ?? data.user.email
        }
      };
      await setAuth(auth);
      return { auth };
    }

    case 'REGISTER': {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          email:       msg.email,
          password:    msg.password,
          displayName: msg.displayName
        })
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.message ?? 'Registration failed');
      }
      const data = await res.json();
      const auth = {
        accessToken:  data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt:    Date.now() + (data.expiresIn ?? 900) * 1000,
        user: {
          id:          data.user.id,
          email:       data.user.email,
          displayName: data.user.displayName ?? data.user.email
        }
      };
      await setAuth(auth);
      return { auth };
    }

    case 'LOGOUT': {
      const auth = await getAuth();
      if (auth?.refreshToken) {
        fetch(`${API_BASE}/auth/logout`, {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${auth.accessToken}`
          },
          body: JSON.stringify({ refreshToken: auth.refreshToken })
        }).catch(() => {});
      }
      await chrome.storage.local.clear();
      return {};
    }

    // Relayed by content-script.js from the web app's AuthContext — logs the
    // extension in automatically so the user doesn't type credentials twice.
    case 'EXTERNAL_AUTH_SYNC': {
      const auth = msg.auth;
      if (auth?.accessToken && auth?.refreshToken && auth?.user) {
        await setAuth(auth);
      }
      return {};
    }

    case 'EXTERNAL_LOGOUT_SYNC': {
      // Only clear auth — preserve any session/siteTracking in progress so an
      // in-flight focus session isn't silently discarded by a web-app logout.
      await setAuth(null);
      return {};
    }

    case 'GET_PROJECTS': {
      const projects = await apiFetch('/projects');
      return { projects: projects ?? [] };
    }

    case 'START_SESSION': {
      const body = { title: msg.title };
      if (msg.projectId)   body.projectId   = msg.projectId;
      if (msg.energyLevel) body.energyLevel = msg.energyLevel;

      const data = await apiFetch('/sessions', {
        method: 'POST',
        body:   JSON.stringify(body)
      });

      // Try to resolve project name
      let projectName = null;
      if (msg.projectId) {
        try {
          const proj = await apiFetch(`/projects/${msg.projectId}`);
          projectName = proj?.name ?? null;
        } catch {}
      }

      const session = {
        id:           data.id,
        title:        data.title,
        projectId:    data.projectId ?? null,
        projectName,
        startedAt:    data.startedAt,
        isPaused:     false,
        pausedAt:     null,
        totalPausedMs: 0
      };

      await setStorage({ session });
      await startSiteTracking();
      chrome.alarms.create('status-poll', { periodInMinutes: 0.5 });
      return { session };
    }

    case 'PAUSE_SESSION': {
      const session = await handlePauseSession();
      return { session };
    }

    case 'RESUME_SESSION': {
      const session = await handleResumeSession();
      return { session };
    }

    case 'STOP_SESSION': {
      await handleStopSession({ shipped: msg.shipped, energyLevel: msg.energyLevel });
      return {};
    }

    default:
      throw new Error(`Unknown message type: ${msg.type}`);
  }
}