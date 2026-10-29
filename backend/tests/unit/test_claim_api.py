from fastapi.testclient import TestClient

from api.main import app

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
    assert response.status_code == 201

    claim = response.json()
    get_response = client.get(f"/v1/claims/{claim['id']}")
    assert get_response.status_code == 200
    assert get_response.json()['order_id'] == "order-1001"