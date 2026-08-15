import base64
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Header, Query, Response

from db import db
from auth import get_current_user

router = APIRouter(prefix="/api/media")

# Armazenamento local em disco (self-host). Configuravel via UPLOADS_DIR.
UPLOADS_DIR = Path(os.environ.get("UPLOADS_DIR") or (Path(__file__).parent / "uploads"))
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

MIME = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "gif": "image/gif", "webp": "image/webp"}


@router.post("/upload")
async def upload(file: UploadFile = File(...), user=Depends(get_current_user)):
    ext = (file.filename or "img.png").split(".")[-1].lower()
    if ext not in MIME:
        ext = "png"
    content_type = file.content_type or MIME.get(ext, "application/octet-stream")
    data = await file.read()
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Imagem muito grande (máx 25MB)")
    file_id = str(uuid.uuid4())
    stored_name = f"{file_id}.{ext}"
    (UPLOADS_DIR / stored_name).write_bytes(data)
    await db.files.insert_one({
        "id": file_id,
        "stored_name": stored_name,
        "original_filename": file.filename,
        "content_type": content_type,
        "size": len(data),
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"file_id": file_id, "content_type": content_type}


@router.get("/{file_id}")
async def download(file_id: str, authorization: str = Header(None), auth: str = Query(None)):
    await get_current_user(authorization or (f"Bearer {auth}" if auth else None))
    record = await db.files.find_one({"id": file_id, "is_deleted": False})
    if not record:
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")
    path = UPLOADS_DIR / record["stored_name"]
    if not path.exists():
        raise HTTPException(status_code=404, detail="Arquivo não encontrado no disco")
    return Response(content=path.read_bytes(), media_type=record.get("content_type", "application/octet-stream"))


async def file_to_data_url(file_id: str):
    record = await db.files.find_one({"id": file_id, "is_deleted": False})
    if not record:
        return None
    path = UPLOADS_DIR / record["stored_name"]
    if not path.exists():
        return None
    b64 = base64.b64encode(path.read_bytes()).decode()
    return f"data:{record.get('content_type', 'image/png')};base64,{b64}"
