"""System tray icon + the webview window that's the agent's actual UI.

Threading model: pywebview's `webview.start()` owns the main thread (required
on macOS, and the simplest correct choice everywhere). pystray's icon loop and
the background tick loop (idle detection, app-usage sampling, status polling)
each run on their own daemon thread. The webview window itself holds all
state-dependent UI (login, start-session form, active-session timer) — the
tray menu is now just two static items, "Open Momentum" and "Quit", since
there's nothing left for it to branch on.
"""
import os
import sys
import threading

import pystray
import webview
from PIL import Image, ImageDraw

from api import ApiClient
from auth import AuthStore
from session_controller import SessionController
from webview_api import WebviewApi
import config

COLOR_IDLE = (120, 120, 120, 255)
COLOR_ACTIVE = (34, 197, 94, 255)
COLOR_PAUSED = (234, 179, 8, 255)

# Same bolt glyph as favicon.svg / extension icons (Icons.tsx's BoltIcon path,
# `M13 2L3 14h9l-1 8 10-12h-9l1-8z`, as polygon vertices) — one shared logo
# across the web app, extension, and this tray icon.
_BOLT_POLYGON = [(13, 2), (3, 14), (12, 14), (11, 22), (21, 10), (12, 10)]


def _resource_path(relative_path: str) -> str:
    """Resolves a bundled file both when running from source and when frozen
    by PyInstaller (which extracts data files to sys._MEIPASS at runtime)."""
    base = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, relative_path)


def _make_icon(badge_color) -> Image.Image:
    size, supersample = 64, 4
    big = size * supersample
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    draw.rounded_rectangle([0, 0, big - 1, big - 1], radius=int(big * 0.22), fill=badge_color)

    bolt_box = big * 0.62
    offset = (big - bolt_box) / 2
    scale = bolt_box / 24
    points = [(offset + x * scale, offset + y * scale) for x, y in _BOLT_POLYGON]
    draw.polygon(points, fill=(255, 255, 255, 255))

    return img.resize((size, size), Image.LANCZOS)


class TrayApp:
    def __init__(self):
        self.auth = AuthStore()
        self.api = ApiClient(self.auth)
        self.controller = SessionController(self.api, on_change=self._refresh_icon)
        self.icon = pystray.Icon("momentum", _make_icon(COLOR_IDLE), "Momentum", self._build_menu())
        self.window = None
        self._stop_event = threading.Event()

    def _build_menu(self) -> pystray.Menu:
        return pystray.Menu(
            pystray.MenuItem("Open Momentum", self._show_window, default=True),
            pystray.MenuItem("Quit", self._quit),
        )

    def _refresh_icon(self) -> None:
        if not self.controller.is_active:
            self.icon.icon = _make_icon(COLOR_IDLE)
        elif self.controller.is_paused:
            self.icon.icon = _make_icon(COLOR_PAUSED)
        else:
            self.icon.icon = _make_icon(COLOR_ACTIVE)

    # ── Window ────────────────────────────────────────────────────────────────

    def _show_window(self, _icon=None, _item=None) -> None:
        self.window.show()

    def _on_window_closing(self) -> bool:
        # Closing the window (the X button) just hides it — the app keeps
        # running in the tray. "Quit" from the tray menu is the real exit.
        self.window.hide()
        return False

    def _quit(self, _icon=None, _item=None) -> None:
        self._stop_event.set()
        self.icon.stop()
        self.window.destroy()

    # ── Background loop ──────────────────────────────────────────────────────

    def _background_loop(self) -> None:
        while not self._stop_event.is_set():
            try:
                self.controller.tick()
            except Exception as e:  # keep the loop alive no matter what
                print(f"[agent] unexpected error in tick: {e}")
            self._stop_event.wait(config.TICK_SECONDS)

    def run(self) -> None:
        bridge = WebviewApi(self.auth, self.api, self.controller)
        self.window = webview.create_window(
            "Momentum",
            _resource_path("ui/index.html"),
            js_api=bridge,
            width=380,
            height=580,
            hidden=True,
        )
        self.window.events.closing += self._on_window_closing

        def start_background():
            threading.Thread(target=self._background_loop, daemon=True).start()
            threading.Thread(target=self.icon.run, daemon=True).start()
            if not self.auth.is_authenticated:
                self.window.show()

        webview.start(start_background, debug=False)
