"""Thin HTTP client for the Momentum API.

Mirrors the auth/refresh pattern used by the Chrome extension's
background.js: refresh within 60s of expiry, single Authorization header
injection point. No refresh-coalescing lock is needed here — the agent drives
everything through one background thread plus tray-menu callbacks, which are
already serialized through SessionController's lock before they'd ever hit
the network concurrently.
"""
import datetime
import time

import requests

import config


class ApiError(Exception):
    pass


class ApiClient:
    def __init__(self, auth_store):
        self._auth = auth_store

    # ── Token handling ───────────────────────────────────────────────────────

    def _access_token(self) -> str:
        token = self._auth.access_token
        if token and self._auth.expires_at - 60 > time.time():
            return token
        return self._refresh()

    def _refresh(self) -> str:
        if not self._auth.refresh_token:
            raise ApiError("Not authenticated")
        res = requests.post(
            f"{config.API_BASE}/auth/refresh",
            json={"refreshToken": self._auth.refresh_token}, timeout=10,
        )
        if not res.ok:
            self._auth.clear()
            raise ApiError("Session expired — please log in again")
        self._auth.apply_auth_response(res.json())
        return self._auth.access_token

    def _request(self, method: str, path: str, **kwargs):
        token = self._access_token()
        headers = kwargs.pop("headers", {})
        headers["Authorization"] = f"Bearer {token}"
        res = requests.request(
            method, f"{config.API_BASE}{path}", headers=headers, timeout=10, **kwargs
        )
        if not res.ok:
            detail = res.text
            try:
                body = res.json()
                detail = body.get("error") or body.get("title") or detail
            except ValueError:
                pass
            raise ApiError(f"{method} {path} failed ({res.status_code}): {detail}")
        if res.status_code == 204 or not res.content:
            return None
        return res.json()

    # ── Auth ─────────────────────────────────────────────────────────────────

    def login(self, email: str, password: str) -> dict:
        res = requests.post(
            f"{config.API_BASE}/auth/login",
            json={"email": email, "password": password}, timeout=10,
        )
        if not res.ok:
            raise ApiError("Invalid email or password")
        data = res.json()
        self._auth.apply_auth_response(data)
        return data["user"]

    def pair(self, code: str) -> dict:
        """Exchanges a pairing code (generated from the web app's 'Link desktop
        agent' menu) for tokens — avoids typing a password into a native dialog."""
        res = requests.post(
            f"{config.API_BASE}/auth/pair",
            json={"code": code}, timeout=10,
        )
        if not res.ok:
            raise ApiError("Invalid or expired pairing code")
        data = res.json()
        self._auth.apply_auth_response(data)
        return data["user"]

    # ── Projects ─────────────────────────────────────────────────────────────

    def list_projects(self) -> list:
        return self._request("GET", "/projects") or []

    # ── Sessions ─────────────────────────────────────────────────────────────

    def start_session(self, title: str, project_id: str, energy_level: int = 3) -> dict:
        body = {
            "projectId": project_id,
            "title": title,
            "energyLevel": energy_level,
            "shipped": False,
            "startedAt": _iso_now(),
        }
        return self._request("POST", "/sessions", json=body)

    def pause_session(self, session_id: str) -> dict:
        return self._request("POST", f"/sessions/{session_id}/pause")

    def resume_session(self, session_id: str) -> dict:
        return self._request("POST", f"/sessions/{session_id}/resume")

    def end_session(self, session_id: str, shipped: bool | None = None,
                     energy_level: int | None = None) -> dict:
        body = {}
        if shipped is not None:
            body["shipped"] = shipped
        if energy_level is not None:
            body["energyLevel"] = energy_level
        return self._request("POST", f"/sessions/{session_id}/end", json=body)

    def session_status(self, session_id: str) -> dict:
        return self._request("GET", f"/sessions/{session_id}/status")

    def flush_app_usage(self, session_id: str, apps: list[dict]) -> None:
        self._request("POST", f"/sessions/{session_id}/apps", json={"apps": apps})


def _iso_now() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat()
