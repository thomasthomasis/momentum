"""System tray UI: a pystray icon + menu, with small tkinter dialogs for
login, starting a session, and stopping one.

Threading model: tkinter is not thread-safe and all widget/dialog calls must
happen on whichever thread runs `root.mainloop()`. pystray's menu callbacks
are not guaranteed to fire on that same thread, so every dialog call is
marshaled onto the Tk thread via `root.after(...)` plus a synchronization
event, rather than assuming it's already safe to call tkinter directly from
a pystray callback. The Tk root is created once and reused for the whole
app lifetime — recreating a fresh `tk.Tk()` per dialog (the previous design)
is a known source of dialogs that render but silently stop responding to
clicks on Windows.
"""
import threading
import tkinter as tk
from tkinter import simpledialog, messagebox

import pystray
from PIL import Image, ImageDraw

from api import ApiClient, ApiError
from auth import AuthStore
from session_controller import SessionController
import config

COLOR_IDLE = (120, 120, 120)
COLOR_ACTIVE = (34, 197, 94)
COLOR_PAUSED = (234, 179, 8)


def _make_icon(color) -> Image.Image:
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.ellipse((8, 8, 56, 56), fill=color)
    return img


class TrayApp:
    def __init__(self):
        self.auth = AuthStore()
        self.api = ApiClient(self.auth)
        self.controller = SessionController(self.api, on_change=self._refresh)
        self.icon = pystray.Icon("momentum", _make_icon(COLOR_IDLE), "Momentum", self._build_menu())
        self._stop_event = threading.Event()
        self._root: tk.Tk | None = None  # created once run() starts, on the Tk thread

    # ── Menu / icon state ────────────────────────────────────────────────────

    def _build_menu(self) -> pystray.Menu:
        if not self.auth.is_authenticated:
            return pystray.Menu(
                pystray.MenuItem("Log in…", self._login_flow),
                pystray.MenuItem("Quit", self._quit),
            )

        if not self.controller.is_active:
            return pystray.Menu(
                pystray.MenuItem(f"Signed in as {self._display_name()}", None, enabled=False),
                pystray.Menu.SEPARATOR,
                pystray.MenuItem("Start session…", self._start_flow),
                pystray.MenuItem("Log out", self._logout),
                pystray.MenuItem("Quit", self._quit),
            )

        pause_label = "Resume" if self.controller.is_paused else "Pause"
        return pystray.Menu(
            pystray.MenuItem(self.controller.session["title"], None, enabled=False),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem(pause_label, self._toggle_pause),
            pystray.MenuItem("Stop session…", self._stop_flow),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Log out", self._logout),
            pystray.MenuItem("Quit", self._quit),
        )

    def _display_name(self) -> str:
        return (self.auth.user or {}).get("displayName", "you")

    def _refresh(self) -> None:
        self.icon.menu = self._build_menu()
        if not self.controller.is_active:
            self.icon.icon = _make_icon(COLOR_IDLE)
        elif self.controller.is_paused:
            self.icon.icon = _make_icon(COLOR_PAUSED)
        else:
            self.icon.icon = _make_icon(COLOR_ACTIVE)

    # ── Running tkinter code on the Tk thread from any thread ───────────────

    def _on_tk_thread(self, fn):
        """Runs fn(root) on the thread running root.mainloop() and blocks the
        caller until it finishes, returning fn's result (or re-raising its
        exception). pystray menu callbacks aren't guaranteed to already be on
        that thread, so this is the only safe way to show a dialog from one."""
        result: dict = {}
        done = threading.Event()

        def wrapper():
            try:
                result["value"] = fn(self._root)
            except Exception as e:  # noqa: BLE001 — re-raised on the caller's thread below
                result["error"] = e
            finally:
                done.set()

        self._root.after(0, wrapper)
        done.wait()
        if "error" in result:
            raise result["error"]
        return result.get("value")

    def _bring_to_front(self, root) -> None:
        root.deiconify()
        root.attributes("-topmost", True)
        root.lift()
        root.focus_force()
        root.withdraw()  # the root itself stays invisible; only child dialogs show

    def _login_flow(self, _icon=None, _item=None) -> None:
        def run(root):
            self._bring_to_front(root)
            use_code = messagebox.askyesno(
                "Momentum",
                "Log in with a pairing code from the web app?\n\n"
                "(Choose 'No' to use email/password instead.)",
                parent=root,
            )
            if use_code:
                self._pairing_code_login(root)
            else:
                self._password_login(root)
        self._on_tk_thread(run)
        self._refresh()

    def _pairing_code_login(self, root) -> None:
        code = simpledialog.askstring(
            "Momentum",
            "Pairing code (from the web app's user menu → Link desktop agent):",
            parent=root,
        )
        if not code:
            return
        try:
            self.api.pair(code)
        except ApiError as e:
            messagebox.showerror("Momentum", str(e), parent=root)

    def _password_login(self, root) -> None:
        email = simpledialog.askstring("Momentum", "Email:", parent=root)
        if not email:
            return
        password = simpledialog.askstring("Momentum", "Password:", parent=root, show="*")
        if not password:
            return
        try:
            self.api.login(email, password)
        except ApiError as e:
            messagebox.showerror("Momentum", str(e), parent=root)

    def _logout(self, _icon=None, _item=None) -> None:
        self.auth.clear()
        self._refresh()

    def _start_flow(self, _icon=None, _item=None) -> None:
        def run(root):
            self._bring_to_front(root)
            try:
                projects = self.api.list_projects()
            except ApiError as e:
                messagebox.showerror("Momentum", str(e), parent=root)
                return
            if not projects:
                messagebox.showinfo(
                    "Momentum", "No projects yet — create one on the web app first.", parent=root)
                return

            names = [p["name"] for p in projects]
            prompt = "Project:\n" + "\n".join(f"  {i + 1}. {n}" for i, n in enumerate(names))
            choice = simpledialog.askstring("Momentum", prompt, parent=root, initialvalue="1")
            if not choice:
                return
            try:
                project = projects[int(choice) - 1]
            except (ValueError, IndexError):
                messagebox.showerror("Momentum", "Invalid project number.", parent=root)
                return

            title = simpledialog.askstring("Momentum", "Session title:", parent=root)
            if not title:
                return
            try:
                self.controller.start(title, project["id"])
            except ApiError as e:
                messagebox.showerror("Momentum", str(e), parent=root)
        self._on_tk_thread(run)

    def _toggle_pause(self, _icon=None, _item=None) -> None:
        try:
            if self.controller.is_paused:
                self.controller.resume()
            else:
                self.controller.pause(auto=False)
        except ApiError as e:
            self._show_error(str(e))

    def _stop_flow(self, _icon=None, _item=None) -> None:
        def run(root):
            self._bring_to_front(root)
            shipped = messagebox.askyesno("Momentum", "Ship something this session?", parent=root)
            try:
                self.controller.stop(shipped=shipped)
            except ApiError as e:
                messagebox.showerror("Momentum", str(e), parent=root)
        self._on_tk_thread(run)

    def _show_error(self, message: str) -> None:
        def run(root):
            self._bring_to_front(root)
            messagebox.showerror("Momentum", message, parent=root)
        self._on_tk_thread(run)

    def _quit(self, _icon=None, _item=None) -> None:
        self._stop_event.set()
        self.icon.stop()
        if self._root is not None:
            self._root.after(0, self._root.quit)

    # ── Background loop ──────────────────────────────────────────────────────

    def _background_loop(self) -> None:
        while not self._stop_event.is_set():
            try:
                self.controller.tick()
            except Exception as e:  # keep the loop alive no matter what
                print(f"[agent] unexpected error in tick: {e}")
            self._stop_event.wait(config.TICK_SECONDS)

    def run(self) -> None:
        # The Tk root's mainloop owns this (the main) thread for the rest of
        # the process's life; pystray's icon loop runs on its own thread
        # instead (its Windows backend doesn't require the main thread the
        # way Cocoa's does on macOS).
        self._root = tk.Tk()
        self._root.withdraw()

        def start_background():
            if not self.auth.is_authenticated:
                self._login_flow()
            threading.Thread(target=self._background_loop, daemon=True).start()
            threading.Thread(target=self.icon.run, daemon=True).start()

        self._root.after(100, start_background)
        self._root.mainloop()
