import base64
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Header, Query, Response

from db import db
from auth import get_current_user
import storage

router = APIRouter(prefix="/api/media")

MIME = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "gif": "image/gif", "webp": "image/webp"}


@router.post("/upload")
async def upload(file: UploadFile = File(...), user=Depends(get_current_user)):
    ext = (file.filename or "img.png").split(".")[-1].lower()
    content_type = file.content_type or MIME.get(ext, "application/octet-stream")
    data = await file.read()
    path = f"{storage.APP_NAME}/uploads/{user['_id']}/{uuid.uuid4()}.{ext}"
    result = storage.put_object(path, data, content_type)
    file_id = str(uuid.uuid4())
    await db.files.insert_one({
        "id": file_id,
        "storage_path": result["path"],
        "original_filename": file.filename,
        "content_type": content_type,
        "size": result.get("size", len(data)),
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
    data, content_type = storage.get_object(record["storage_path"])
    return Response(content=data, media_type=record.get("content_type", content_type))


async def file_to_data_url(file_id: str):
    record = await db.files.find_one({"id": file_id, "is_deleted": False})
    if not record:
        return None
    data, content_type = storage.get_object(record["storage_path"])
    b64 = base64.b64encode(data).decode()
    return f"data:{record.get('content_type', content_type)};base64,{b64}"
