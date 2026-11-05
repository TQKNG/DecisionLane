from collections.abc import AsyncIterator
from functools import lru_cache

from azure.identity.aio import DefaultAzureCredential

from refundflow.config import get_settings
from refundflow.repositories.claims import ClaimRepository, InMemoryClaimRepository
from refundflow.repositories.cosmos import CosmosClaimRepository
from refundflow.repositories.orders import (
    CosmosOrderRepository,
    InMemoryOrderRepository,
    OrderRepository,
)


@lru_cache
def get_local_repository() -> InMemoryClaimRepository:
    return InMemoryClaimRepository()


async def get_claim_repository() -> AsyncIterator[ClaimRepository]:
    settings = get_settings()
    if settings.app_env == "local" and not settings.cosmos_endpoint:
        yield get_local_repository()
        return
    credential = DefaultAzureCredential()
    repository = CosmosClaimRepository(
        endpoint=settings.cosmos_endpoint,
        database_name=settings.cosmos_database,
        credential=credential,
    )
    try:
        yield repository
    finally:
        await repository.close()
        await credential.close()


@lru_cache
def get_local_order_repository() -> InMemoryOrderRepository:
    return InMemoryOrderRepository()


async def get_order_repository() -> AsyncIterator[OrderRepository]:
    settings = get_settings()
    if settings.app_env == "local" and not settings.cosmos_endpoint:
        yield get_local_order_repository()
        return
    credential = DefaultAzureCredential()
    repository = CosmosOrderRepository(
        settings.cosmos_endpoint,
        settings.cosmos_database,
        credential,
    )
    try:
        yield repository
    finally:
        await repository.close()
        await credential.close()