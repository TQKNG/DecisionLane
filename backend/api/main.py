from typing import Literal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from api.routers.claims import router as claims_router
from api.routers.orders import router as orders_router
from api.routers.reviews import router as reviews_router
from api.routers.uploads import router as uploads_router
from api.routers.webhooks import router as webhooks_router
from refundflow.config import get_settings
from refundflow.telemetry import configure_telemetry

logger = configure_telemetry()

settings = get_settings()
tags_metadata = [
    {"name": "health", "description": "Liveness and readiness probes."},
    {"name": "claims", "description": "Create and retrieve refund claims."},
    {"name": "uploads", "description": "Request evidence upload and submit claims for processing."},
    {"name": "reviews", "description": "Review assessments and record reviewer decisions."},
    {"name": "admin", "description": "Administrative operational metrics."},
    {"name": "webhooks", "description": "Signed callbacks from external services."},
]
app = FastAPI(
    title="RefundFlow API",
    description=(
        "API for submitting refund claims, uploading evidence, and reviewing "
        "refund assessments. Protected operations use Microsoft Entra bearer tokens."
    ),
    version="0.1.0",
    openapi_tags=tags_metadata,
    openapi_url="/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "Idempotency-Key"],
    allow_private_network=settings.app_env == "local",
)
app.include_router(claims_router)
app.include_router(orders_router)
app.include_router(uploads_router)
app.include_router(reviews_router)
app.include_router(webhooks_router)


class HealthResponse(BaseModel):
    status: Literal["ok", "ready"]


@app.get(
    "/health/live",
    tags=["health"],
    operation_id="get_liveness",
    summary="Check API liveness",
    description="Returns a successful response while the API process is running.",
    response_model=HealthResponse,
)
async def live() -> HealthResponse:
    return HealthResponse(status="ok")


@app.get(
    "/health/ready",
    tags=["health"],
    operation_id="get_readiness",
    summary="Check API readiness",
    description="Returns a successful response when the API can serve requests.",
    response_model=HealthResponse,
)
async def ready() -> HealthResponse:
    return HealthResponse(status="ready")
