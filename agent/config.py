"""Agent configuration, loaded from environment variables / a local .env file.

Mirrors the extension's config.js / .env.development pattern so environment
switching (dev vs. prod API) works the same way across all three client layers.
"""
import os
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env")
except ImportError:
    pass  # python-dotenv not installed yet — fall back to real env vars only

# Defaults to the deployed production API — this is what ships in the
# distributed .exe (PyInstaller's onefile extraction path means a real .env
# next to the source doesn't travel with it, so the fallback here IS what
# real downloaders get). Override locally via .env or the env var for
# development against a local docker-compose backend instead.
API_BASE = os.environ.get("MOMENTUM_API_BASE", "https://z3hgvijkqp.us-east-1.awsapprunner.com/api/v1")

# How long the OS must report no keyboard/mouse input before we auto-pause.
AUTO_PAUSE_IDLE_SECONDS = int(os.environ.get("MOMENTUM_AUTO_PAUSE_IDLE_SECONDS", "90"))

# How often the buffered app-usage tally is flushed to the backend.
FLUSH_INTERVAL_SECONDS = int(os.environ.get("MOMENTUM_FLUSH_INTERVAL_SECONDS", "30"))

# How often we poll GET /sessions/{id}/status to pick up pause/resume/end
# events that originated elsewhere (e.g. the extension's keyboard shortcut).
STATUS_POLL_SECONDS = int(os.environ.get("MOMENTUM_STATUS_POLL_SECONDS", "5"))

TICK_SECONDS = 1.0

AUTH_FILE = Path(os.environ.get("MOMENTUM_AUTH_FILE", str(Path.home() / ".momentum" / "auth.json")))
