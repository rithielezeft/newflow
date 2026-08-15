import os
import time

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from db import db
from auth import get_current_user
from media import file_to_data_url

router = APIRouter(prefix="/api/whatsapp")

_token_cache = {}  # base_url -> {"token": str, "exp": float}


async def get_wf_settings():
    s = await db.settings.find_one({"_id": "whatsflow"}) or {}
    base = (s.get("base_url") or os.environ.get("WHATSFLOW_BASE_URL") or "").rstrip("/")
    return base, s.get("password")


async def _get_token(base: str, password: str):
    cached = _token_cache.get(base)
    if cached and cached["exp"] > time.time():
        return cached["token"]
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post(f"{base}/api/auth/login", json={"password": password})
        r.raise_for_status()
        token = r.json()["access_token"]
    _token_cache[base] = {"token": token, "exp": time.time() + 3000}
    return token


async def wf_request(method: str, path: str, json=None):
    """Returns (ok, data_or_error). Gracefully degrades if the Raspberry Pi is unreachable."""
    base, password = await get_wf_settings()
    if not base:
        return False, {"unreachable": True, "message": "Configure a URL do WhatsFlow em Configurações."}
    try:
        token = await _get_token(base, password) if password else None
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.request(method, f"{base}{path}", json=json, headers=headers)
        if r.status_code >= 400:
            try:
                detail = r.json().get("detail", r.text)
            except Exception:
                detail = r.text
            return False, {"status_code": r.status_code, "message": detail}
        return True, r.json()
    except (httpx.ConnectError, httpx.ConnectTimeout, httpx.ReadTimeout):
        return False, {"unreachable": True, "message": "WhatsFlow inacessível. Rode o dashboard na Raspberry Pi ou exponha a API publicamente."}
    except Exception as e:
        return False, {"unreachable": True, "message": str(e)}


async def wa_send(chat_id: str, message: Optional[str] = None, image_url: Optional[str] = None):
    is_channel = chat_id.endswith("@newsletter")
    path = "/api/whatsapp/channels/send" if is_channel else "/api/whatsapp/groups/send"
    ok, data = await wf_request("POST", path, {"chat_id": chat_id, "message": message, "image_url": image_url})
    return ok, data


@router.get("/status")
async def status(user=Depends(get_current_user)):
    ok, data = await wf_request("GET", "/api/whatsapp/status")
    if not ok:
        return {"ready": False, "state": "unreachable", "error": data.get("message"), "has_qr": False, "unreachable": True}
    return data


@router.get("/qr")
async def qr(user=Depends(get_current_user)):
    ok, data = await wf_request("GET", "/api/whatsapp/qr")
    if not ok:
        return {"qr": None, "ready": False, "state": "unreachable", "unreachable": True, "message": data.get("message")}
    return data


@router.get("/groups")
async def groups(user=Depends(get_current_user)):
    ok, data = await wf_request("GET", "/api/whatsapp/groups")
    if not ok:
        return {"chats": [], "count": 0, "not_ready": True, "message": data.get("message")}
    return data


@router.get("/channels")
async def channels(user=Depends(get_current_user)):
    ok, data = await wf_request("GET", "/api/whatsapp/channels")
    if not ok:
        return {"chats": [], "count": 0, "not_ready": True, "message": data.get("message")}
    return data


class SendBody(BaseModel):
    chat_id: str
    message: Optional[str] = None
    image_url: Optional[str] = None
    image_file_id: Optional[str] = None


@router.post("/send")
async def send(body: SendBody, user=Depends(get_current_user)):
    image_url = body.image_url
    if body.image_file_id:
        image_url = await file_to_data_url(body.image_file_id)
        if not image_url:
            raise HTTPException(status_code=400, detail="Imagem não encontrada")
    if not body.message and not image_url:
        raise HTTPException(status_code=400, detail="Envie ao menos texto ou imagem")
    ok, data = await wa_send(body.chat_id, body.message, image_url)
    if not ok:
        raise HTTPException(status_code=400, detail=data.get("message", "Falha ao enviar"))
    return data


class SettingsBody(BaseModel):
    base_url: str
    password: Optional[str] = None


@router.get("/settings")
async def get_settings(user=Depends(get_current_user)):
    s = await db.settings.find_one({"_id": "whatsflow"}) or {}
    return {"base_url": s.get("base_url") or os.environ.get("WHATSFLOW_BASE_URL", ""), "has_password": bool(s.get("password"))}


@router.put("/settings")
async def put_settings(body: SettingsBody, user=Depends(get_current_user)):
    update = {"base_url": body.base_url.rstrip("/")}
    if body.password is not None and body.password != "":
        update["password"] = body.password
    await db.settings.update_one({"_id": "whatsflow"}, {"$set": update}, upsert=True)
    _token_cache.clear()
    return {"success": True}
