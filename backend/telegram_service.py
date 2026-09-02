import base64
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

from cryptography.fernet import Fernet
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from telethon import TelegramClient
from telethon.errors import (
    PhoneCodeExpiredError,
    PhoneCodeInvalidError,
    PasswordHashInvalidError,
    SessionPasswordNeededError,
)
from telethon.sessions import StringSession

from db import db
from auth import get_current_user
from whatsflow import wa_send

router = APIRouter(prefix="/api/telegram")

_fernet = Fernet(os.environ["SESSION_ENCRYPTION_KEY"].encode())
ACCOUNT_ID = "default"


def _enc(v: str) -> str:
    return _fernet.encrypt(v.encode()).decode()


def _dec(v: str) -> str:
    return _fernet.decrypt(v.encode()).decode()


async def _get_row():
    return await db.telegram_accounts.find_one({"account_id": ACCOUNT_ID})


def _make_client(session: str, api_id: int, api_hash: str) -> TelegramClient:
    return TelegramClient(StringSession(session), api_id, api_hash)


async def _authorized_client(row):
    if not row or row.get("pending") or not row.get("session_enc"):
        raise HTTPException(status_code=401, detail="Telegram não conectado")
    client = _make_client(_dec(row["session_enc"]), int(row["api_id"]), row["api_hash"])
    await client.connect()
    if not await client.is_user_authorized():
        await client.disconnect()
        raise HTTPException(status_code=401, detail="Sessão do Telegram expirada")
    return client


class ConnectBody(BaseModel):
    api_id: str
    api_hash: str
    phone: str


@router.post("/connect")
async def connect(body: ConnectBody, user=Depends(get_current_user)):
    try:
        api_id = int(body.api_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="api_id deve ser numérico")
    client = _make_client("", api_id, body.api_hash)
    try:
        await client.connect()
        sent = await client.send_code_request(body.phone)
        session = client.session.save()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Falha ao solicitar código: {e}")
    finally:
        await client.disconnect()
    await db.telegram_accounts.update_one(
        {"account_id": ACCOUNT_ID},
        {"$set": {
            "account_id": ACCOUNT_ID,
            "api_id": api_id,
            "api_hash": body.api_hash,
            "phone": body.phone,
            "phone_code_hash": sent.phone_code_hash,
            "session_enc": _enc(session),
            "pending": True,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    return {"status": "code_sent"}


class VerifyBody(BaseModel):
    code: str
    password: Optional[str] = None


@router.post("/verify")
async def verify(body: VerifyBody, user=Depends(get_current_user)):
    row = await _get_row()
    if not row or not row.get("pending"):
        raise HTTPException(status_code=400, detail="Nenhum login pendente. Solicite um novo código.")
    client = _make_client(_dec(row["session_enc"]), int(row["api_id"]), row["api_hash"])
    try:
        await client.connect()
        try:
            await client.sign_in(phone=row["phone"], code=body.code, phone_code_hash=row["phone_code_hash"])
        except SessionPasswordNeededError:
            if not body.password:
                return {"status": "password_required"}
            try:
                await client.sign_in(password=body.password)
            except PasswordHashInvalidError:
                raise HTTPException(status_code=401, detail="Senha 2FA inválida")
        session = client.session.save()
        me = await client.get_me()
        await db.telegram_accounts.update_one(
            {"account_id": ACCOUNT_ID},
            {"$set": {
                "session_enc": _enc(session),
                "pending": False,
                "telegram_user_id": me.id,
                "username": me.username,
                "first_name": me.first_name,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        return {"status": "authenticated", "user": {"id": me.id, "username": me.username, "first_name": me.first_name}}
    except (PhoneCodeInvalidError, PhoneCodeExpiredError):
        raise HTTPException(status_code=400, detail="Código inválido ou expirado")
    finally:
        await client.disconnect()


@router.get("/status")
async def status(user=Depends(get_current_user)):
    row = await _get_row()
    if not row:
        return {"connected": False, "configured": False}
    if row.get("pending"):
        return {"connected": False, "configured": True, "pending": True, "phone": row.get("phone")}
    try:
        client = _make_client(_dec(row["session_enc"]), int(row["api_id"]), row["api_hash"])
        await client.connect()
        authed = await client.is_user_authorized()
        await client.disconnect()
    except Exception:
        authed = False
    return {
        "connected": authed,
        "configured": True,
        "phone": row.get("phone"),
        "username": row.get("username"),
        "first_name": row.get("first_name"),
    }


@router.post("/disconnect")
async def disconnect(user=Depends(get_current_user)):
    await db.telegram_accounts.delete_one({"account_id": ACCOUNT_ID})
    return {"success": True}


@router.get("/dialogs")
async def dialogs(kind: str = Query("all"), user=Depends(get_current_user)):
    row = await _get_row()
    client = await _authorized_client(row)
    try:
        result = []
        async for d in client.iter_dialogs():
            entity = d.entity
            is_channel = bool(getattr(entity, "broadcast", False))
            is_group = bool(getattr(entity, "megagroup", False)) or d.is_group
            if kind == "channel" and not is_channel:
                continue
            if kind == "group" and not is_group:
                continue
            result.append({
                "id": str(d.id),
                "name": d.name,
                "unread_count": d.unread_count,
                "is_group": is_group,
                "is_channel": is_channel,
                "username": getattr(entity, "username", None),
            })
        return {"dialogs": result, "count": len(result)}
    finally:
        await client.disconnect()


@router.get("/chats/{chat_ref}/messages")
async def messages(chat_ref: str, limit: int = Query(20, ge=1, le=100), include_photos: bool = False, user=Depends(get_current_user)):
    row = await _get_row()
    client = await _authorized_client(row)
    try:
        try:
            entity = await client.get_entity(int(chat_ref))
        except (ValueError, TypeError):
            entity = await client.get_entity(chat_ref)
        output = []
        async for m in client.iter_messages(entity, limit=limit):
            item = {
                "id": m.id,
                "date": m.date.isoformat() if m.date else None,
                "text": m.message or "",
                "has_photo": bool(m.photo),
            }
            if m.photo and include_photos:
                raw = await client.download_media(m, file=bytes)
                if raw and len(raw) <= 5_000_000:
                    item["photo_base64"] = f"data:image/jpeg;base64,{base64.b64encode(raw).decode()}"
            output.append(item)
        return {
            "chat": {
                "id": str(entity.id),
                "title": getattr(entity, "title", None),
                "username": getattr(entity, "username", None),
                "description": getattr(entity, "about", None),
            },
            "messages": output,
        }
    finally:
        await client.disconnect()


class RelayBody(BaseModel):
    source_chat_id: str
    message_id: Optional[int] = None
    wa_chat_id: str
    include_image: bool = True
    extra_text: Optional[str] = None


@router.post("/relay")
async def relay(body: RelayBody, user=Depends(get_current_user)):
    row = await _get_row()
    client = await _authorized_client(row)
    try:
        try:
            entity = await client.get_entity(int(body.source_chat_id))
        except (ValueError, TypeError):
            entity = await client.get_entity(body.source_chat_id)
        if body.message_id:
            msg = await client.get_messages(entity, ids=body.message_id)
        else:
            msgs = await client.get_messages(entity, limit=1)
            msg = msgs[0] if msgs else None
        if not msg:
            raise HTTPException(status_code=404, detail="Mensagem não encontrada")
        text = msg.message or ""
        if body.extra_text:
            text = (text + "\n\n" + body.extra_text).strip() if text else body.extra_text
        image_url = None
        if body.include_image and msg.photo:
            raw = await client.download_media(msg, file=bytes)
            if raw:
                image_url = f"data:image/jpeg;base64,{base64.b64encode(raw).decode()}"
    finally:
        await client.disconnect()

    if not text and not image_url:
        raise HTTPException(status_code=400, detail="A mensagem de origem está vazia")
    ok, data = await wa_send(body.wa_chat_id, text or None, image_url)
    if not ok:
        raise HTTPException(status_code=400, detail=data.get("message", "Falha ao enviar para o WhatsApp"))
    return {"success": True, "sent_text": text, "had_image": bool(image_url), "wa_result": data}


# ----------------- Repasse automático (auto-relay) -----------------

class AutoRelayBody(BaseModel):
    source_chat_id: str
    source_name: Optional[str] = None
    wa_chat_id: str
    wa_name: Optional[str] = None
    include_image: bool = True
    extra_text: Optional[str] = None


class ToggleRelayBody(BaseModel):
    enabled: bool


@router.get("/relays")
async def list_relays(user=Depends(get_current_user)):
    items = await db.auto_relays.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"relays": items}


@router.post("/relays")
async def create_relay(body: AutoRelayBody, user=Depends(get_current_user)):
    row = await _get_row()
    client = await _authorized_client(row)
    try:
        entity = None
        try:
            entity = await client.get_entity(int(body.source_chat_id))
        except (ValueError, TypeError):
            try:
                entity = await client.get_entity(body.source_chat_id)
            except Exception:
                entity = None
        if entity is None:
            raise HTTPException(status_code=400, detail="Não foi possível resolver a origem no Telegram")
        latest = await client.get_messages(entity, limit=1)
        last_id = latest[0].id if latest else 0
    finally:
        await client.disconnect()
    doc = {
        "id": str(uuid.uuid4()),
        "source_chat_id": body.source_chat_id,
        "source_name": body.source_name,
        "wa_chat_id": body.wa_chat_id,
        "wa_name": body.wa_name,
        "include_image": body.include_image,
        "extra_text": body.extra_text,
        "enabled": True,
        "last_message_id": last_id,
        "last_status": "aguardando novos posts",
        "forwarded_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.auto_relays.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.patch("/relays/{relay_id}")
async def toggle_relay(relay_id: str, body: ToggleRelayBody, user=Depends(get_current_user)):
    res = await db.auto_relays.update_one({"id": relay_id}, {"$set": {"enabled": body.enabled}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Regra não encontrada")
    return {"success": True}


@router.delete("/relays/{relay_id}")
async def delete_relay(relay_id: str, user=Depends(get_current_user)):
    await db.auto_relays.delete_one({"id": relay_id})
    return {"success": True}


async def poll_auto_relays():
    """Background: encaminha automaticamente novos posts do Telegram para o WhatsApp."""
    row = await _get_row()
    if not row or row.get("pending") or not row.get("session_enc"):
        return
    relays = await db.auto_relays.find({"enabled": True}).to_list(100)
    if not relays:
        return
    client = _make_client(_dec(row["session_enc"]), int(row["api_id"]), row["api_hash"])
    try:
        await client.connect()
        if not await client.is_user_authorized():
            return
        for r in relays:
            try:
                try:
                    entity = await client.get_entity(int(r["source_chat_id"]))
                except (ValueError, TypeError):
                    entity = await client.get_entity(r["source_chat_id"])
                last_id = r.get("last_message_id", 0) or 0
                msgs = await client.get_messages(entity, min_id=last_id, limit=30)
                new_max = last_id
                sent = 0
                for m in sorted(msgs, key=lambda x: x.id):
                    if m.id <= last_id:
                        continue
                    new_max = max(new_max, m.id)
                    text = m.message or ""
                    if r.get("extra_text"):
                        text = (text + "\n\n" + r["extra_text"]).strip() if text else r["extra_text"]
                    image_url = None
                    if r.get("include_image", True) and m.photo:
                        raw = await client.download_media(m, file=bytes)
                        if raw:
                            image_url = f"data:image/jpeg;base64,{base64.b64encode(raw).decode()}"
                    if text or image_url:
                        ok, _ = await wa_send(r["wa_chat_id"], text or None, image_url)
                        if ok:
                            sent += 1
                await db.auto_relays.update_one(
                    {"id": r["id"]},
                    {"$set": {
                        "last_message_id": new_max,
                        "last_status": f"{sent} repassado(s)" if sent else "sem novidades",
                        "last_run_at": datetime.now(timezone.utc).isoformat(),
                    }, "$inc": {"forwarded_count": sent}},
                )
            except Exception as e:
                await db.auto_relays.update_one({"id": r["id"]}, {"$set": {"last_status": f"erro: {str(e)[:80]}"}})
    except Exception:
        pass
    finally:
        await client.disconnect()
