from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from api.auth import CurrentUser, get_current_user
from api.dependencies import get_order_repository
from api.main import app
from refundflow.repositories.orders import InMemoryOrderRepository


@pytest.fixture
def order_client() -> Iterator[TestClient]:
    repository = InMemoryOrderRepository()
    app.dependency_overrides[get_order_repository] = lambda: repository
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        user_id="admin-1",
        name="Test Admin",
        email="admin@example.com",
        roles=frozenset({"Admin"}),
    )
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_admin_can_create_order(order_client: TestClient) -> None:
    response = order_client.post(
        "/v1/admin/orders",
        json={
            "id": "order-happy-path",
            "customer_id": "customer-1",
            "currency": "CAD",
            "paid_amount": "129.99",
            "payment_intent_id": "pi_local_happy_path_001",
        },
    )

    assert response.status_code == 201, response.text
    assert response.json()["id"] == "order-happy-path"
    assert response.json()["paid_amount"] == "129.99"


def test_duplicate_order_returns_conflict(order_client: TestClient) -> None:
    payload = {
        "id": "order-duplicate",
        "customer_id": "customer-1",
        "currency": "CAD",
        "paid_amount": "129.99",
        "payment_intent_id": "pi_local_duplicate_001",
    }

    first_response = order_client.post("/v1/admin/orders", json=payload)
    second_response = order_client.post("/v1/admin/orders", json=payload)

    assert first_response.status_code == 201
    assert second_response.status_code == 409


def test_customer_cannot_create_order() -> None:
    app.dependency_overrides[get_order_repository] = lambda: InMemoryOrderRepository()
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        user_id="customer-1",
        name="Test Customer",
        email="customer@example.com",
        roles=frozenset({"Customer"}),
    )
    try:
        response = TestClient(app).post(
            "/v1/admin/orders",
            json={
                "id": "order-forbidden",
                "customer_id": "customer-1",
                "currency": "CAD",
                "paid_amount": "10.00",
                "payment_intent_id": "pi_local_forbidden_001",
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 403
