"""WhatsFlow Dashboard backend regression tests."""
import io
import os
import uuid

import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else None
if BASE_URL is None:
    # Read from frontend/.env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

ADMIN_EMAIL = "admin@whatsflow.app"
ADMIN_PASSWORD = "whatsflow123"


@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def token(api):
    r = api.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "access_token" in data and data["user"]["email"] == ADMIN_EMAIL
    return data["access_token"]


@pytest.fixture(scope="session")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---- Health & Auth ----
class TestAuth:
    def test_root(self, api):
        r = api.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

    def test_login_success(self, api):
        r = api.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        assert r.json()["user"]["email"] == ADMIN_EMAIL

    def test_login_invalid(self, api):
        r = api.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_me_no_token(self, api):
        r = requests.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401

    def test_me_with_token(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["user"]["email"] == ADMIN_EMAIL

    def test_protected_requires_token(self):
        for path in ["/api/whatsapp/status", "/api/schedules", "/api/telegram/status"]:
            r = requests.get(f"{BASE_URL}{path}")
            assert r.status_code == 401, f"{path} should require auth, got {r.status_code}"


# ---- WhatsApp graceful degradation (Pi unreachable) ----
class TestWhatsApp:
    def test_status_unreachable(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/whatsapp/status", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data.get("ready") is False
        assert data.get("state") == "unreachable"

    def test_groups_empty(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/whatsapp/groups", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data.get("chats") == []
        assert data.get("not_ready") is True

    def test_channels_empty(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/whatsapp/channels", headers=auth_headers)
        assert r.status_code == 200
        assert r.json().get("not_ready") is True

    def test_send_returns_502(self, auth_headers):
        r = requests.post(
            f"{BASE_URL}/api/whatsapp/send",
            headers=auth_headers,
            json={"chat_id": "120363test@g.us", "message": "hello"},
        )
        assert r.status_code == 502

    def test_settings_persist(self, auth_headers):
        payload = {"base_url": "http://127.0.0.1:8001", "password": "testpwd"}
        r = requests.put(f"{BASE_URL}/api/whatsapp/settings", headers=auth_headers, json=payload)
        assert r.status_code == 200 and r.json()["success"] is True
        g = requests.get(f"{BASE_URL}/api/whatsapp/settings", headers=auth_headers)
        assert g.status_code == 200
        data = g.json()
        assert data["base_url"] == "http://127.0.0.1:8001"
        assert data["has_password"] is True


# ---- Telegram validation ----
class TestTelegram:
    def test_status(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/telegram/status", headers=auth_headers)
        assert r.status_code == 200
        assert "connected" in r.json()

    def test_connect_nonnumeric_api_id(self, auth_headers):
        r = requests.post(
            f"{BASE_URL}/api/telegram/connect",
            headers=auth_headers,
            json={"api_id": "abc", "api_hash": "somehash", "phone": "+5511999999999"},
        )
        assert r.status_code == 400
        assert "numérico" in r.json().get("detail", "")


# ---- Media upload ----
class TestMedia:
    def test_upload(self, token):
        # 1x1 PNG
        png = bytes.fromhex(
            "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000D49444154789C6300010000000500010D0A2DB40000000049454E44AE426082"
        )
        files = {"file": ("test.png", io.BytesIO(png), "image/png")}
        r = requests.post(
            f"{BASE_URL}/api/media/upload",
            files=files,
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "file_id" in data
        assert data["content_type"] == "image/png"
        return data["file_id"]


# ---- Schedules CRUD ----
class TestSchedules:
    def test_full_flow(self, auth_headers):
        # Create
        chat_id = f"120363test-{uuid.uuid4().hex[:6]}@g.us"
        payload = {
            "chat_id": chat_id,
            "chat_name": "Teste",
            "days": [0, 2, 4],
            "time": "09:30",
            "message": "TEST_msg agendada",
            "enabled": True,
        }
        r = requests.post(f"{BASE_URL}/api/schedules", headers=auth_headers, json=payload)
        assert r.status_code == 200, r.text
        created = r.json()
        assert created["chat_id"] == chat_id
        sid = created["id"]

        # List
        r = requests.get(f"{BASE_URL}/api/schedules", headers=auth_headers)
        assert r.status_code == 200
        assert any(s["id"] == sid for s in r.json()["schedules"])

        # Toggle
        r = requests.patch(f"{BASE_URL}/api/schedules/{sid}", headers=auth_headers, json={"enabled": False})
        assert r.status_code == 200

        # Run now -> 502 since Pi unreachable
        r = requests.post(f"{BASE_URL}/api/schedules/{sid}/run", headers=auth_headers)
        assert r.status_code == 502

        # Missing content validation
        r = requests.post(
            f"{BASE_URL}/api/schedules",
            headers=auth_headers,
            json={"chat_id": chat_id, "days": [1], "time": "10:00"},
        )
        assert r.status_code == 400

        # Delete
        r = requests.delete(f"{BASE_URL}/api/schedules/{sid}", headers=auth_headers)
        assert r.status_code == 200

        # Confirm gone
        r = requests.get(f"{BASE_URL}/api/schedules", headers=auth_headers)
        assert not any(s["id"] == sid for s in r.json()["schedules"])
