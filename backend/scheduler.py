import os
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from db import db
from auth import get_current_user
from whatsflow import wa_send
from media import file_to_data_url

router = APIRouter(prefix="/api/schedules")
TZ = os.environ.get("WHATSFLOW_DEFAULT_TIMEZONE", "America/Sao_Paulo")
scheduler = AsyncIOScheduler(timezone=TZ)


class ScheduleBody(BaseModel):
    chat_id: str
    chat_name: Optional[str] = None
    days: List[int]  # 0=Seg ... 6=Dom
    time: str  # "HH:MM"
    message: Optional[str] = None
    image_file_id: Optional[str] = None
    enabled: bool = True


def _serialize(s: dict) -> dict:
    s = dict(s)
    s.pop("_id", None)
    return s


@router.get("")
async def list_schedules(user=Depends(get_current_user)):
    items = await db.scheduled_messages.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"schedules": items}


@router.post("")
async def create_schedule(body: ScheduleBody, user=Depends(get_current_user)):
    if not body.message and not body.image_file_id:
        raise HTTPException(status_code=400, detail="Envie texto ou imagem")
    doc = {
        "id": str(uuid.uuid4()),
        "chat_id": body.chat_id,
        "chat_name": body.chat_name,
        "days": body.days,
        "time": body.time,
        "message": body.message,
        "image_file_id": body.image_file_id,
        "enabled": body.enabled,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_run_marker": None,
        "last_status": None,
    }
    await db.scheduled_messages.insert_one(doc)
    return _serialize(doc)


class ToggleBody(BaseModel):
    enabled: bool


@router.patch("/{schedule_id}")
async def toggle_schedule(schedule_id: str, body: ToggleBody, user=Depends(get_current_user)):
    res = await db.scheduled_messages.update_one({"id": schedule_id}, {"$set": {"enabled": body.enabled}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado")
    return {"success": True}


@router.delete("/{schedule_id}")
async def delete_schedule(schedule_id: str, user=Depends(get_current_user)):
    await db.scheduled_messages.delete_one({"id": schedule_id})
    return {"success": True}


@router.post("/{schedule_id}/run")
async def run_now(schedule_id: str, user=Depends(get_current_user)):
    s = await db.scheduled_messages.find_one({"id": schedule_id})
    if not s:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado")
    ok, msg = await _fire(s)
    if not ok:
        raise HTTPException(status_code=400, detail=msg)
    return {"success": True}


async def _fire(s: dict):
    image_url = None
    if s.get("image_file_id"):
        image_url = await file_to_data_url(s["image_file_id"])
    ok, data = await wa_send(s["chat_id"], s.get("message") or None, image_url)
    status = "enviado" if ok else f"erro: {data.get('message', 'falha')}"
    await db.scheduled_messages.update_one(
        {"id": s["id"]},
        {"$set": {"last_status": status, "last_run_at": datetime.now(timezone.utc).isoformat()}},
    )
    return ok, status


async def tick():
    now = datetime.now(ZoneInfo(TZ))
    hhmm = now.strftime("%H:%M")
    weekday = now.weekday()
    marker = now.strftime("%Y-%m-%d ") + hhmm
    async for s in db.scheduled_messages.find({"enabled": True}):
        if s.get("time") == hhmm and weekday in (s.get("days") or []) and s.get("last_run_marker") != marker:
            await db.scheduled_messages.update_one({"id": s["id"]}, {"$set": {"last_run_marker": marker}})
            await _fire(s)


def start_scheduler():
    if not scheduler.running:
        scheduler.add_job(tick, "interval", seconds=60, id="wf_tick", replace_existing=True)
        scheduler.start()
