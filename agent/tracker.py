"""Buffers per-app time-spent samples and flushes them to the backend using
the same delete-and-replace contract as the extension's site tracker
(BrowsedSitesController / AppUsageController both just replace all rows for
the session on each POST — idempotent, safe to retry).
"""
import threading
import time

from api import ApiClient, ApiError
import platform_window as pw


class AppUsageTracker:
    def __init__(self, api: ApiClient):
        self._api = api
        self._lock = threading.Lock()
        self._usage: dict[str, dict] = {}  # app_name -> {"seconds": int, "switches": int}
        self._current_app: str | None = None
        self._current_started: float | None = None

    def tick(self, active: bool) -> None:
        """Call ~once per second. `active=False` while paused/stopped — no time
        is credited then, mirroring the extension pausing its site tracker."""
        app = pw.get_active_app_name() if active else None
        with self._lock:
            if app != self._current_app:
                self._credit_current_locked()
                self._current_app = app
                self._current_started = time.time() if app else None
                if app:
                    bucket = self._usage.setdefault(app, {"seconds": 0, "switches": 0})
                    bucket["switches"] += 1

    def _credit_current_locked(self) -> None:
        if self._current_app and self._current_started:
            elapsed = int(time.time() - self._current_started)
            self._usage[self._current_app]["seconds"] += elapsed
            self._current_started = time.time()

    def flush(self, session_id: str) -> None:
        """Call every ~30s. Sends the full running tally — the backend replaces
        all app-usage rows for the session, so re-sending totals (rather than
        deltas) is safe if a flush is retried or arrives out of order."""
        with self._lock:
            self._credit_current_locked()
            snapshot = {k: dict(v) for k, v in self._usage.items() if v["seconds"] > 0}
        if not snapshot:
            return
        apps = [
            {"appName": name, "timeSpentSeconds": d["seconds"], "switchCount": d["switches"]}
            for name, d in snapshot.items()
        ]
        try:
            self._api.flush_app_usage(session_id, apps)
        except ApiError as e:
            print(f"[agent] app-usage flush failed (will retry next cycle): {e}")

    def reset(self) -> None:
        with self._lock:
            self._usage.clear()
            self._current_app = None
            self._current_started = None
