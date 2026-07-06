'use strict';

// ── State ─────────────────────────────────────────────────────────────────────

let state = { authenticated: false, user: null, session: null, currentApp: null };
let currentBucket = null; // 'auth' | 'home' | 'session' — tracks which view is showing
let startEnergy = 3;
let stopEnergy = 3;
let timerInterval = null;
let pollInterval = null;

const ENERGY_EMOJI  = ['', '😴', '😐', '🙂', '😊', '🔥'];
const ENERGY_LABELS = ['', 'Very low', 'Low', 'Medium', 'High', 'Peak'];

// Every bridge call returns { ok, error, ...data } rather than throwing, since
// promise-rejection shape for Python exceptions isn't consistent enough
// across pywebview versions/platforms to rely on — see webview_api.py.
function api(method, ...args) {
  return window.pywebview.api[method](...args);
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function initials(name) {
  if (!name) return '?';
  return name.split(' ').filter(Boolean).map(w => w[0].toUpperCase()).join('').slice(0, 2);
}

function formatTime(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
}

function getElapsed(session) {
  if (!session) return 0;
  const start = new Date(session.startedAt).getTime();
  const totalPausedMs = (session.totalPausedSeconds ?? 0) * 1000;
  const curPauseMs = (session.isPaused && session.pausedAt)
    ? Date.now() - new Date(session.pausedAt).getTime()
    : 0;
  return Math.max(0, Date.now() - start - totalPausedMs - curPauseMs);
}

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.getElementById(`view-${name}`).classList.remove('hidden');
}

function setError(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg ?? '';
}

function setBtn(btn, text, disabled) {
  btn.textContent = text;
  btn.disabled = disabled;
}

function buildEnergyPicker(containerId, initial, onChange) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  for (let i = 1; i <= 5; i++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `energy-btn${i === initial ? ' active' : ''}`;
    btn.textContent = ENERGY_EMOJI[i];
    btn.title = ENERGY_LABELS[i];
    btn.addEventListener('click', () => {
      container.querySelectorAll('.energy-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      onChange(i);
    });
    container.appendChild(btn);
  }
}

// ── Timer ─────────────────────────────────────────────────────────────────────

function startTimer() {
  stopTimer();
  const el = document.getElementById('timer');
  el.textContent = formatTime(getElapsed(state.session));
  timerInterval = setInterval(() => {
    el.textContent = formatTime(getElapsed(state.session));
  }, 1000);
}

function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

// ── View renderers ────────────────────────────────────────────────────────────

function renderAuthView() {
  stopTimer();
  showView('auth');
}

async function renderHomeView() {
  stopTimer();
  document.getElementById('home-name').textContent = state.user?.displayName ?? '';
  document.getElementById('home-avatar').textContent = initials(state.user?.displayName);
  document.getElementById('form-session').reset();
  setError('session-error', '');

  const select = document.getElementById('session-project');
  select.innerHTML = '<option value="">Loading projects…</option>';
  const res = await api('list_projects');
  select.innerHTML = '';
  if (res.ok && res.projects.length) {
    res.projects.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      select.appendChild(opt);
    });
  } else {
    select.innerHTML = '<option value="">No projects yet — create one on the web app</option>';
  }

  buildEnergyPicker('energy-picker', startEnergy, v => { startEnergy = v; });
  showView('home');
}

function updateSessionViewLive() {
  const session = state.session;
  const pauseBtn = document.getElementById('btn-pause');
  const statusEl = document.getElementById('timer-status');
  if (session.isPaused) {
    setBtn(pauseBtn, 'Resume', false);
    pauseBtn.classList.add('btn-primary'); pauseBtn.classList.remove('btn-ghost');
    statusEl.classList.remove('hidden');
  } else {
    setBtn(pauseBtn, 'Pause', false);
    pauseBtn.classList.remove('btn-primary'); pauseBtn.classList.add('btn-ghost');
    statusEl.classList.add('hidden');
  }
  document.getElementById('current-app').textContent = state.currentApp || '—';
}

function renderSessionView() {
  const session = state.session;
  document.getElementById('active-title').textContent = session.title;
  document.getElementById('active-project').textContent = session.projectName || 'No project';

  document.getElementById('stop-panel').classList.add('hidden');
  document.getElementById('session-controls').classList.remove('hidden');
  document.getElementById('stop-shipped').checked = false;
  setBtn(document.getElementById('btn-stop-confirm'), 'Save & stop', false);

  updateSessionViewLive();
  showView('session');
  startTimer();
}

function bucketFor(s) {
  if (!s.authenticated) return 'auth';
  if (s.session) return 'session';
  return 'home';
}

async function render() {
  const bucket = bucketFor(state);
  currentBucket = bucket;
  if (bucket === 'auth') return renderAuthView();
  if (bucket === 'session') return renderSessionView();
  return renderHomeView();
}

// ── State polling ─────────────────────────────────────────────────────────────
// The tray's background thread can pause/resume the session on its own (idle
// detection) or another client (the extension) can change it — polling here
// is what makes this window reflect that instead of going stale.

async function refreshState() {
  const res = await api('get_state');
  if (!res.ok) return;
  state = res;

  const bucket = bucketFor(state);
  if (bucket !== currentBucket) {
    currentBucket = bucket;
    await render();
  } else if (bucket === 'session') {
    updateSessionViewLive();
  }
}

function startPolling() {
  if (pollInterval) return;
  pollInterval = setInterval(refreshState, 2000);
}

// ── Auth tabs ─────────────────────────────────────────────────────────────────

function initAuthTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      document.getElementById('form-pairing').classList.toggle('hidden', tab !== 'pairing');
      document.getElementById('form-password').classList.toggle('hidden', tab !== 'password');
      setError('pairing-error', '');
      setError('password-error', '');
    });
  });
}

// ── Event listeners ───────────────────────────────────────────────────────────

document.getElementById('form-pairing').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  const code = document.getElementById('pairing-code').value.trim();
  setBtn(btn, 'Linking…', true);
  setError('pairing-error', '');
  const res = await api('pair', code);
  if (res.ok) {
    await refreshState();
  } else {
    setError('pairing-error', res.error);
    setBtn(btn, 'Link this device', false);
  }
});

document.getElementById('form-password').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  setBtn(btn, 'Signing in…', true);
  setError('password-error', '');
  const res = await api('login', email, password);
  if (res.ok) {
    await refreshState();
  } else {
    setError('password-error', res.error);
    setBtn(btn, 'Sign in', false);
  }
});

document.getElementById('btn-logout').addEventListener('click', async () => {
  await api('logout');
  await refreshState();
});

document.getElementById('form-session').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  const title = document.getElementById('session-title').value.trim();
  const projectId = document.getElementById('session-project').value;
  setError('session-error', '');
  if (!projectId) {
    setError('session-error', 'Create a project on the web app first.');
    return;
  }
  setBtn(btn, 'Starting…', true);
  const res = await api('start_session', title, projectId, startEnergy);
  if (res.ok) {
    await refreshState();
  } else {
    setError('session-error', res.error);
    setBtn(btn, 'Start session', false);
  }
});

document.getElementById('btn-pause').addEventListener('click', async () => {
  await api('toggle_pause');
  await refreshState();
});

document.getElementById('btn-stop').addEventListener('click', () => {
  document.getElementById('session-controls').classList.add('hidden');
  document.getElementById('stop-panel').classList.remove('hidden');
  buildEnergyPicker('stop-energy-picker', stopEnergy, v => { stopEnergy = v; });
});

document.getElementById('btn-stop-cancel').addEventListener('click', () => {
  document.getElementById('stop-panel').classList.add('hidden');
  document.getElementById('session-controls').classList.remove('hidden');
});

document.getElementById('btn-stop-confirm').addEventListener('click', async () => {
  const btn = document.getElementById('btn-stop-confirm');
  const shipped = document.getElementById('stop-shipped').checked;
  setBtn(btn, 'Saving…', true);
  const res = await api('stop_session', shipped, stopEnergy);
  if (res.ok) {
    await refreshState();
  } else {
    setBtn(btn, 'Save & stop', false);
  }
});

// ── Boot ────────────────────────────────────────────────────────────────────

window.addEventListener('pywebviewready', async () => {
  initAuthTabs();
  await refreshState();
  startPolling();
});
