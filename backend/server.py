import logging

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from db import db
from auth import router as auth_router, seed_admin
from whatsflow import router as whatsapp_router
from telegram_service import router as telegram_router
from scheduler import router as schedules_router, start_scheduler
from media import router as media_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="NewFlow Dashboard")


@app.get("/api/")
async def root():
    return {"message": "NewFlow Dashboard API", "status": "ok"}


app.include_router(auth_router)
app.include_router(whatsapp_router)
app.include_router(telegram_router)
app.include_router(schedules_router)
app.include_router(media_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.telegram_accounts.create_index("account_id", unique=True)
    await db.scheduled_messages.create_index("id", unique=True)
    await seed_admin()
    start_scheduler()
    logger.info("NewFlow Dashboard started")


@app.on_event("shutdown")
async def on_shutdown():
    from db import client
    client.close()
