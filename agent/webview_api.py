"""The JS-API bridge exposed to the webview UI (ui/app.js calls these as
`window.pywebview.api.<method>(...)`, which pywebview marshals onto a worker
thread and returns as a JS Promise).

Every method returns a plain `{"ok": ..., ...}` dict rather than raising —
promise-rejection shape for a Python exception isn't guaranteed consistent
enough across pywebview versions/platforms to build the UI around, so
failures are just regular data the JS side checks `res.ok` for.

This deliberately holds no business logic of its own — it's a thin adapter
over the same ApiClient/SessionController/AuthStore the rest of the agent
uses, so the tray menu and this window can't drift into different behavior.
"""
from api import ApiError
import platform_window as pw


class WebviewApi:
    def __init__(self, auth, api_client, controller):
        self._auth = auth
        self._api = api_client
        self._controller = controller

    def get_state(self) -> dict:
        session = self._controller.session
        current_app = None
        if session and not session.get("isPaused"):
            current_app = pw.get_active_app_name()

        return {
            "ok": True,
            "authenticated": self._auth.is_authenticated,
            "user": self._auth.user,
            "session": session,
            "currentApp": current_app,
        }

    def list_projects(self) -> dict:
        try:
            return {"ok": True, "projects": self._api.list_projects()}
        except ApiError as e:
            return {"ok": False, "error": str(e)}

    def login(self, email: str, password: str) -> dict:
        try:
            self._api.login(email, password)
            return {"ok": True}
        except ApiError as e:
            return {"ok": False, "error": str(e)}

    def pair(self, code: str) -> dict:
        try:
            self._api.pair(code)
            return {"ok": True}
        except ApiError as e:
            return {"ok": False, "error": str(e)}

    def logout(self) -> dict:
        self._auth.clear()
        return {"ok": True}

    def start_session(self, title: str, project_id: str, energy_level: int) -> dict:
        try:
            self._controller.start(title, project_id, energy_level)
            return {"ok": True}
        except ApiError as e:
            return {"ok": False, "error": str(e)}

    def toggle_pause(self) -> dict:
        try:
            if self._controller.is_paused:
                self._controller.resume()
            else:
                self._controller.pause(auto=False)
            return {"ok": True}
        except ApiError as e:
            return {"ok": False, "error": str(e)}

    def stop_session(self, shipped: bool, energy_level: int) -> dict:
        try:
            self._controller.stop(shipped=shipped, energy_level=energy_level)
            return {"ok": True}
        except ApiError as e:
            return {"ok": False, "error": str(e)}
