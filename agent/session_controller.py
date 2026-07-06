"""Owns the current-session lifecycle: start/pause/resume/stop, idle-driven
auto pause/resume, app-usage sampling, and periodic status sync.

Design: the tray app is the primary session controller (per the agreed
architecture) — idle detection lives here because this is the one place with
a real OS idle-time signal. `_auto_paused` distinguishes an idle-triggered
pause from a manual one so returning activity only auto-resumes sessions the
idle logic itself paused; a manually-paused session stays paused until the
user explicitly resumes it from the tray menu.

The backend remains the single source of truth: `_sync_status_locked` polls
GET /sessions/{id}/status so a pause/resume/end triggered elsewhere (e.g. the
extension's keyboard shortcut) is picked up here too, rather than the tray
silently drifting out of sync.
"""
import threading
import time

from api import ApiClient, ApiError
from tracker import AppUsageTracker
import platform_window as pw
import config


class SessionController:
    def __init__(self, api: ApiClient, on_change=None):
        self._api = api
        self._tracker = AppUsageTracker(api)
        self._on_change = on_change or (lambda: None)
        self._lock = threading.RLock()

        self.session: dict | None = None
        self._auto_paused = False
        self._last_flush = 0.0
        self._last_status_poll = 0.0

    @property
    def is_active(self) -> bool:
        with self._lock:
            return self.session is not None

    @property
    def is_paused(self) -> bool:
        with self._lock:
            return bool(self.session and self.session.get("isPaused"))

    # ── Lifecycle ────────────────────────────────────────────────────────────

    def start(self, title: str, project_id: str, energy_level: int = 3) -> None:
        with self._lock:
            self.session = self._api.start_session(title, project_id, energy_level)
            self._auto_paused = False
            self._tracker.reset()
            now = time.time()
            self._last_flush = now
            self._last_status_poll = now
        self._on_change()

    def pause(self, *, auto: bool = False) -> None:
        with self._lock:
            if not self.session or self.session.get("isPaused"):
                return
            self.session = self._api.pause_session(self.session["id"])
            self._auto_paused = auto
        self._on_change()

    def resume(self) -> None:
        with self._lock:
            if not self.session or not self.session.get("isPaused"):
                return
            self.session = self._api.resume_session(self.session["id"])
            self._auto_paused = False
        self._on_change()

    def stop(self, shipped: bool = False, energy_level: int | None = None) -> None:
        with self._lock:
            if not self.session:
                return
            session_id = self.session["id"]
            self._tracker.flush(session_id)
            self._api.end_session(session_id, shipped, energy_level)
            self.session = None
            self._auto_paused = False
            self._tracker.reset()
        self._on_change()

    # ── Background loop ──────────────────────────────────────────────────────

    def tick(self) -> None:
        """Call once per second from the background thread."""
        with self._lock:
            if not self.session:
                return

            now = time.time()
            if now - self._last_status_poll >= config.STATUS_POLL_SECONDS:
                self._last_status_poll = now
                self._sync_status_locked()
                if not self.session:
                    return  # session ended elsewhere

            paused = self.session.get("isPaused", False)
            idle = pw.get_idle_seconds()

            if not paused and idle >= config.AUTO_PAUSE_IDLE_SECONDS:
                self.pause(auto=True)
                return
            if paused and self._auto_paused and idle < config.AUTO_PAUSE_IDLE_SECONDS:
                self.resume()
                return

            self._tracker.tick(active=not paused)

            if now - self._last_flush >= config.FLUSH_INTERVAL_SECONDS:
                self._tracker.flush(self.session["id"])
                self._last_flush = now

    def _sync_status_locked(self) -> None:
        try:
            status = self._api.session_status(self.session["id"])
        except ApiError as e:
            print(f"[agent] status poll failed (will retry): {e}")
            return

        if status.get("endedAt"):
            self.session = None
            self._auto_paused = False
            self._tracker.reset()
            self._on_change()
            return

        was_paused = self.session.get("isPaused", False)
        self.session["isPaused"] = status["isPaused"]
        self.session["pausedAt"] = status["pausedAt"]
        self.session["totalPausedSeconds"] = status["totalPausedSeconds"]

        if status["isPaused"] != was_paused:
            # State changed elsewhere (not via our own pause()/resume()) — the
            # idle logic didn't cause this, so don't let it auto-resume later.
            self._auto_paused = False
            self._on_change()
