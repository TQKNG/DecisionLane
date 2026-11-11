from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from api.auth import CurrentUser, get_current_user
from api.dependencies import get_claim_repository, get_order_repository
from api.main import app
from refundflow.repositories.claims import InMemoryClaimRepository
from refundflow.repositories.orders import InMemoryOrderRepository


@pytest.fixture(autouse=True)
def use_in_memory_repositories() -> Iterator[None]:
    claim_repository = InMemoryClaimRepository()
    order_repository = InMemoryOrderRepository()

    app.dependency_overrides[get_claim_repository] = lambda: claim_repository
    app.dependency_overrides[get_order_repository] = lambda: order_repository
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        user_id="local-customer",
        name="Local Customer",
        email="local-customer@example.com",
        roles=frozenset({"Customer"}),
    )

    yield

    app.dependency_overrides.clear()

client = TestClient(app)

def test_create_and_read_claim()-> None:
    response = client.post(
        "/v1/claims",
        json={
            "order_id": "order-1001",
            "claim_type": "damaged_item",
            "reason": "The headphones arrived with a cracked ear cup.",
            "requested_amount": "129.99",
            "currency": "CAD",
        }
    )
    assert response.status_code == 201, response.text

    claim = response.json()
    get_response = client.get(f"/v1/claims/{claim['id']}")
    assert get_response.status_code == 200
    assert get_response.json()['order_id'] == "order-1001"
