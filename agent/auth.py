"""Local token storage for the tray agent.

Same shape/semantics as the extension's chrome.storage-backed auth object:
holds an access + refresh token pair and refreshes within 60s of expiry.
Persisted to a JSON file in the user's home directory since a tray app has
no equivalent of chrome.storage.local.
"""
import json
import time

import config


class AuthStore:
    def __init__(self):
        self.access_token: str | None = None
        self.refresh_token: str | None = None
        self.expires_at: float = 0.0
        self.user: dict | None = None
        self._load()

    @property
    def is_authenticated(self) -> bool:
        return self.refresh_token is not None

    def apply_auth_response(self, data: dict) -> None:
        self.access_token = data["accessToken"]
        self.refresh_token = data["refreshToken"]
        self.expires_at = time.time() + data.get("expiresIn", 900)
        if "user" in data:
            self.user = data["user"]
        self._save()

    def clear(self) -> None:
        self.access_token = None
        self.refresh_token = None
        self.expires_at = 0.0
        self.user = None
        config.AUTH_FILE.unlink(missing_ok=True)

    def _load(self) -> None:
        try:
            data = json.loads(config.AUTH_FILE.read_text())
        except (FileNotFoundError, ValueError):
            return
        self.access_token = data.get("accessToken")
        self.refresh_token = data.get("refreshToken")
        self.expires_at = data.get("expiresAt", 0.0)
        self.user = data.get("user")

    def _save(self) -> None:
        config.AUTH_FILE.parent.mkdir(parents=True, exist_ok=True)
        config.AUTH_FILE.write_text(json.dumps({
            "accessToken": self.access_token,
            "refreshToken": self.refresh_token,
            "expiresAt": self.expires_at,
            "user": self.user,
        }))
        try:
            config.AUTH_FILE.chmod(0o600)
        except OSError:
            pass  # best-effort — platforms without POSIX perms (Windows) ignore this
