'use strict';

const WEBSITE_URL = 'http://localhost:5173';

// ── State ─────────────────────────────────────────────────────────────────────
let timerInterval = null;
let currentState  = { auth: null, session: null };
let startEnergy   = 3;
let stopEnergy    = 3;

// ── Messaging ─────────────────────────────────────────────────────────────────

function send(msg) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, response => {
      if (chrome.runtime.lastError) {
        return reject(new Error(chrome.runtime.lastError.message));
      }
      if (!response.ok) {
        return reject(new Error(response.error ?? 'Unknown error'));
      }
      resolve(response);
    });
  });
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
  const start       = new Date(session.startedAt).getTime();
  const totalPaused = session.totalPausedMs ?? 0;
  const curPause    = (session.isPaused && session.pausedAt)
    ? Date.now() - new Date(session.pausedAt).getTime()
    : 0;
  return Math.max(0, Date.now() - start - totalPaused - curPause);
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
  btn.disabled    = disabled;
}

// ── Energy picker ─────────────────────────────────────────────────────────────

const ENERGY_EMOJI  = ['', '😴', '😐', '🙂', '😊', '🔥'];
const ENERGY_LABELS = ['', 'Very low', 'Low', 'Medium', 'High', 'Peak'];

function buildEnergyPicker(containerId, initial, onChange) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  for (let i = 1; i <= 5; i++) {
    const btn = document.createElement('button');
    btn.type      = 'button';
    btn.className = `energy-btn${i === initial ? ' active' : ''}`;
    btn.textContent = ENERGY_EMOJI[i];
    btn.title       = ENERGY_LABELS[i];
    btn.dataset.value = i;
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
  el.textContent = formatTime(getElapsed(currentState.session));
  timerInterval  = setInterval(() => {
    el.textContent = formatTime(getElapsed(currentState.session));
  }, 1000);
}

function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

// ── View renderers ────────────────────────────────────────────────────────────

async function renderSessionView(session) {
  document.getElementById('active-title').textContent   = session.title;
  document.getElementById('active-project').textContent = session.projectName || 'No project';

  const pauseBtn  = document.getElementById('btn-pause');
  const statusEl  = document.getElementById('timer-status');

  if (session.isPaused) {
    pauseBtn.textContent = 'Resume';
    pauseBtn.classList.add('btn-primary');
    pauseBtn.classList.remove('btn-ghost');
    statusEl.classList.remove('hidden');
  } else {
    pauseBtn.textContent = 'Pause';
    pauseBtn.classList.remove('btn-primary');
    pauseBtn.classList.add('btn-ghost');
    statusEl.classList.add('hidden');
  }

  // Reset stop panel
  document.getElementById('stop-panel').classList.add('hidden');
  document.getElementById('session-controls').classList.remove('hidden');
  document.getElementById('stop-shipped').checked = false;
  const confirmBtn = document.getElementById('btn-stop-confirm');
  setBtn(confirmBtn, 'Save & stop', false);

  // Current site (best-effort)
  chrome.storage.local.get('siteTracking', ({ siteTracking }) => {
    document.getElementById('current-site-domain').textContent =
      siteTracking?.current?.domain ?? '—';
  });

  showView('session');
  startTimer();
}

async function renderHomeView(auth) {
  stopTimer();

  document.getElementById('home-name').textContent   = auth.user.displayName;
  document.getElementById('home-avatar').textContent = initials(auth.user.displayName);

  // Reset the form
  document.getElementById('form-session').reset();
  setError('session-error', '');
  const startBtn = document.getElementById('form-session').querySelector('button[type=submit]');
  setBtn(startBtn, 'Start session', false);

  // Load projects
  try {
    const { projects } = await send({ type: 'GET_PROJECTS' });
    const select = document.getElementById('session-project');
    select.innerHTML = '<option value="">No project</option>';
    projects.forEach(p => {
      const opt = document.createElement('option');
      opt.value       = p.id;
      opt.textContent = p.name;
      select.appendChild(opt);
    });
  } catch {}

  buildEnergyPicker('energy-picker', startEnergy, v => { startEnergy = v; });
  showView('home');
}

// ── Auth tab switching ────────────────────────────────────────────────────────

function initAuthTabs() {
  // Reset to login tab each time auth view is shown
  const loginTab = document.querySelector('[data-tab="login"]');
  if (loginTab && !loginTab.classList.contains('active')) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    loginTab.classList.add('active');
    document.getElementById('form-login').classList.remove('hidden');
    document.getElementById('form-register').classList.add('hidden');
  }

  document.querySelectorAll('.tab-btn').forEach(btn => {
    // Remove old listener by cloning
    const fresh = btn.cloneNode(true);
    btn.replaceWith(fresh);
    fresh.addEventListener('click', () => {
      const tab = fresh.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      fresh.classList.add('active');
      document.getElementById('form-login').classList.toggle('hidden', tab !== 'login');
      document.getElementById('form-register').classList.toggle('hidden', tab !== 'register');
      setError('login-error', '');
      setError('reg-error', '');
    });
  });
}

// ── Stop panel ────────────────────────────────────────────────────────────────

function showStopPanel() {
  document.getElementById('session-controls').classList.add('hidden');
  document.getElementById('stop-panel').classList.remove('hidden');
  buildEnergyPicker('stop-energy-picker', stopEnergy, v => { stopEnergy = v; });
}

function hideStopPanel() {
  document.getElementById('stop-panel').classList.add('hidden');
  document.getElementById('session-controls').classList.remove('hidden');
}

// ── Initialise ────────────────────────────────────────────────────────────────

async function init() {
  try {
    const state = await send({ type: 'GET_STATE' });
    currentState = state;

    if (!state.auth) {
      initAuthTabs();
      showView('auth');
      return;
    }

    if (state.session) {
      await renderSessionView(state.session);
    } else {
      await renderHomeView(state.auth);
    }
  } catch {
    initAuthTabs();
    showView('auth');
  }
}

// ── Event listeners ───────────────────────────────────────────────────────────

// Open website
document.querySelectorAll('[data-open-web]').forEach(el => {
  el.addEventListener('click', () => chrome.tabs.create({ url: WEBSITE_URL }));
});

// Login
document.getElementById('form-login').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  setBtn(btn, 'Signing in…', true);
  setError('login-error', '');
  try {
    const res = await send({
      type:     'LOGIN',
      email:    document.getElementById('login-email').value,
      password: document.getElementById('login-password').value
    });
    currentState.auth = res.auth;
    await renderHomeView(res.auth);
  } catch (err) {
    setError('login-error', err.message);
    setBtn(btn, 'Sign in', false);
  }
});

// Register
document.getElementById('form-register').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  setBtn(btn, 'Creating…', true);
  setError('reg-error', '');
  try {
    const res = await send({
      type:        'REGISTER',
      email:       document.getElementById('reg-email').value,
      password:    document.getElementById('reg-password').value,
      displayName: document.getElementById('reg-name').value
    });
    currentState.auth = res.auth;
    await renderHomeView(res.auth);
  } catch (err) {
    setError('reg-error', err.message);
    setBtn(btn, 'Create account', false);
  }
});

// Logout
document.getElementById('btn-logout').addEventListener('click', async () => {
  await send({ type: 'LOGOUT' }).catch(() => {});
  currentState = { auth: null, session: null };
  stopTimer();
  initAuthTabs();
  showView('auth');
});

// Start session
document.getElementById('form-session').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  setBtn(btn, 'Starting…', true);
  setError('session-error', '');
  try {
    const res = await send({
      type:        'START_SESSION',
      title:       document.getElementById('session-title').value.trim(),
      projectId:   document.getElementById('session-project').value || null,
      energyLevel: startEnergy
    });
    currentState.session = res.session;
    await renderSessionView(res.session);
  } catch (err) {
    setError('session-error', err.message);
    setBtn(btn, 'Start session', false);
  }
});

// Pause / Resume
document.getElementById('btn-pause').addEventListener('click', async () => {
  if (!currentState.session) return;
  try {
    const type = currentState.session.isPaused ? 'RESUME_SESSION' : 'PAUSE_SESSION';
    const res  = await send({ type });
    currentState.session = res.session;
    await renderSessionView(res.session);
  } catch {}
});

// Stop → show confirmation
document.getElementById('btn-stop').addEventListener('click', showStopPanel);
document.getElementById('btn-stop-cancel').addEventListener('click', hideStopPanel);

// Confirm stop
document.getElementById('btn-stop-confirm').addEventListener('click', async () => {
  const btn     = document.getElementById('btn-stop-confirm');
  const shipped = document.getElementById('stop-shipped').checked;
  setBtn(btn, 'Saving…', true);
  try {
    await send({ type: 'STOP_SESSION', shipped, energyLevel: stopEnergy });
    currentState.session = null;
    stopTimer();
    await renderHomeView(currentState.auth);
  } catch {
    setBtn(btn, 'Save & stop', false);
  }
});

// ── Icon injection ────────────────────────────────────────────────────────────
// Replace all [data-icon] placeholders with SVG markup from icons.js

function injectIcons() {
  document.querySelectorAll('[data-icon]').forEach(el => {
    const name = el.dataset.icon;
    const fn   = Icons[name];
    if (fn) el.innerHTML = fn();
  });
}

// Boot
injectIcons();
init();