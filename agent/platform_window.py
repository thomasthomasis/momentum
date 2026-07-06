"""Cross-platform helpers for the active foreground app and system idle time.

Windows uses ctypes directly against user32/kernel32 — no pywin32 dependency.
macOS uses pyobjc (Quartz + AppKit). Linux shells out to the `xprintidle` and
`xdotool` command-line tools (X11 only — there's no portable Wayland
equivalent) and degrades gracefully if they're missing: idle time reads as 0
(auto-pause never triggers) and the active app reads as None, with a
one-time warning instead of a crash.
"""
import platform
import subprocess
import sys

_SYSTEM = platform.system()


def get_idle_seconds() -> float:
    if _SYSTEM == "Windows":
        return _windows_idle_seconds()
    if _SYSTEM == "Darwin":
        return _macos_idle_seconds()
    if _SYSTEM == "Linux":
        return _linux_idle_seconds()
    return 0.0


def get_active_app_name() -> str | None:
    if _SYSTEM == "Windows":
        return _windows_active_app()
    if _SYSTEM == "Darwin":
        return _macos_active_app()
    if _SYSTEM == "Linux":
        return _linux_active_app()
    return None


# ── Windows ──────────────────────────────────────────────────────────────────

def _windows_idle_seconds() -> float:
    import ctypes

    class LASTINPUTINFO(ctypes.Structure):
        _fields_ = [("cbSize", ctypes.c_uint), ("dwTime", ctypes.c_uint)]

    info = LASTINPUTINFO()
    info.cbSize = ctypes.sizeof(LASTINPUTINFO)
    ctypes.windll.user32.GetLastInputInfo(ctypes.byref(info))
    millis_since_boot = ctypes.windll.kernel32.GetTickCount()
    return max(0.0, (millis_since_boot - info.dwTime) / 1000.0)


def _windows_active_app() -> str | None:
    import ctypes

    hwnd = ctypes.windll.user32.GetForegroundWindow()
    if not hwnd:
        return None
    pid = ctypes.c_ulong()
    ctypes.windll.user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
    return _process_name(pid.value)


# ── macOS ────────────────────────────────────────────────────────────────────

def _macos_idle_seconds() -> float:
    try:
        import Quartz
        return Quartz.CGEventSourceSecondsSinceLastEventType(
            Quartz.kCGEventSourceStateHIDSystemState, Quartz.kCGAnyInputEventType
        )
    except Exception:
        return 0.0


def _macos_active_app() -> str | None:
    try:
        from AppKit import NSWorkspace
        app = NSWorkspace.sharedWorkspace().frontmostApplication()
        return app.localizedName() if app else None
    except Exception:
        return None


# ── Linux (X11 only) ─────────────────────────────────────────────────────────

_linux_warned: set[str] = set()


def _linux_warn_once(tool: str) -> None:
    if tool in _linux_warned:
        return
    _linux_warned.add(tool)
    print(
        f"[agent] '{tool}' not found — idle/app detection degraded on Linux. "
        f"Install it (e.g. `sudo apt install {tool}`) for full functionality.",
        file=sys.stderr,
    )


def _linux_idle_seconds() -> float:
    try:
        out = subprocess.run(["xprintidle"], capture_output=True, text=True, timeout=2)
        return int(out.stdout.strip()) / 1000.0
    except (FileNotFoundError, subprocess.SubprocessError, ValueError):
        _linux_warn_once("xprintidle")
        return 0.0


def _linux_active_app() -> str | None:
    try:
        win = subprocess.run(["xdotool", "getactivewindow"], capture_output=True, text=True, timeout=2)
        pid_out = subprocess.run(
            ["xdotool", "getwindowpid", win.stdout.strip()],
            capture_output=True, text=True, timeout=2,
        )
        return _process_name(int(pid_out.stdout.strip()))
    except (FileNotFoundError, subprocess.SubprocessError, ValueError):
        _linux_warn_once("xdotool")
        return None


# ── Shared ───────────────────────────────────────────────────────────────────

def _process_name(pid: int) -> str | None:
    try:
        import psutil
        return psutil.Process(pid).name()
    except Exception:
        return None
