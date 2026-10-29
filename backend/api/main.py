from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routers.claims import router as claims_router
from refundflow.config import get_settings
from refundflow.telemetry import configure_telemetry

logger = configure_telemetry()



settings = get_settings()
app = FastAPI(title = "RefundFlow API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origin_list,
    allow_credentials = True,
    allow_methods =["GET","POST","PUT","DELETE"],
    allow_headers = ["Authorization", "Content-Type"]
)
app.include_router(claims_router)

@app.get("/healh/live", tags=["health"])
async def live()-> dict[str,str]:
    return {"status": "ok"}

@app.get("/health/ready", tags=["health"])
async def ready() -> dict[str,str]:
    return {"status":"ready"}