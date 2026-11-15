import json
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)
BACKEND_ROOT = Path(__file__).resolve().parents[2]
EXPECTED_OPERATIONS = {
    ("get", "/health/live"): ("get_liveness", "health", "200", False, False),
    ("get", "/health/ready"): ("get_readiness", "health", "200", False, False),
    ("post", "/v1/claims"): ("create_claim", "claims", "201", True, True),
    ("get", "/v1/claims"): ("list_claims", "claims", "200", True, True),
    ("get", "/v1/claims/{claim_id}"): ("get_claim", "claims", "200", True, True),
    (
        "post",
        "/v1/claims/{claim_id}/uploads",
    ): ("request_claim_upload", "uploads", "200", True, True),
    (
        "post",
        "/v1/claims/{claim_id}/uploads/{document_id}/complete",
    ): ("complete_claim_upload", "uploads", "202", True, True),
    ("post", "/v1/claims/{claim_id}/submit"): ("submit_claim", "uploads", "202", True, True),
    ("get", "/v1/reviews/{claim_id}"): ("get_review", "reviews", "200", True, True),
    (
        "get",
        "/v1/reviews/{claim_id}/documents/{document_id}",
    ): ("download_review_document", "reviews", "200", True, True),
    (
        "post",
        "/v1/reviews/{claim_id}/decision",
    ): ("decide_review", "reviews", "202", True, True),
    ("get", "/v1/admin/kpis"): ("get_admin_kpis", "admin", "200", True, False),
    (
        "post",
        "/v1/admin/orders",
    ): ("create_admin_order", "admin", "201", True, True),
    (
        "post",
        "/v1/webhooks/stripe",
    ): ("receive_stripe_webhook", "webhooks", "200", False, True),
}
EXPECTED_ROLES = {
    ("post", "/v1/claims"): ("Customer",),
    ("get", "/v1/claims"): ("Customer", "Reviewer", "Admin"),
    ("get", "/v1/claims/{claim_id}"): ("Customer", "Reviewer", "Admin"),
    ("post", "/v1/claims/{claim_id}/uploads"): ("Customer",),
    (
        "post",
        "/v1/claims/{claim_id}/uploads/{document_id}/complete",
    ): ("Customer",),
    ("post", "/v1/claims/{claim_id}/submit"): ("Customer",),
    ("get", "/v1/reviews/{claim_id}"): ("Reviewer", "Admin"),
    (
        "get",
        "/v1/reviews/{claim_id}/documents/{document_id}",
    ): ("Reviewer", "Admin"),
    ("post", "/v1/reviews/{claim_id}/decision"): ("Reviewer", "Admin"),
    ("get", "/v1/admin/kpis"): ("Admin",),
    ("post", "/v1/admin/orders"): ("Admin",),
}


def operations(document: dict[str, Any]) -> dict[tuple[str, str], dict[str, Any]]:
    return {
        (method, path): operation
        for path, path_item in document["paths"].items()
        for method, operation in path_item.items()
        if method in {"get", "post", "put", "patch", "delete"}
    }


def test_openapi_endpoint_matches_application_schema() -> None:
    response = client.get("/openapi.json")

    assert response.status_code == 200
    document = response.json()
    assert document["openapi"].startswith("3.")
    assert document == app.openapi()


def test_documentation_pages_reference_published_schema() -> None:
    for path in ("/docs", "/redoc"):
        response = client.get(path)

        assert response.status_code == 200
        assert "/openapi.json" in response.text


def test_every_api_operation_has_expected_metadata_and_responses() -> None:
    document = app.openapi()
    actual_operations = operations(document)

    assert set(actual_operations) == set(EXPECTED_OPERATIONS)
    assert {tag["name"] for tag in document["tags"] if tag.get("description")} == {
        "health",
        "claims",
        "uploads",
        "reviews",
        "admin",
        "webhooks",
    }
    for key, (
        operation_id,
        tag,
        success_status,
        protected,
        has_validation_errors,
    ) in EXPECTED_OPERATIONS.items():
        operation = actual_operations[key]
        assert operation["operationId"] == operation_id
        assert operation["tags"] == [tag]
        assert operation["summary"]
        assert operation["description"]
        assert success_status in operation["responses"]
        assert ("422" in operation["responses"]) is has_validation_errors
        assert bool(operation.get("security")) is protected
        if protected:
            assert "401" in operation["responses"]
            assert "403" in operation["responses"]
            for role in EXPECTED_ROLES[key]:
                assert role.lower() in operation["description"].lower()


def test_security_schemes_document_entra_roles_and_stripe_signature() -> None:
    document = app.openapi()
    schemes = document["components"]["securitySchemes"]

    assert schemes["EntraBearer"]["type"] == "http"
    assert schemes["EntraBearer"]["scheme"] == "bearer"
    assert schemes["EntraBearer"]["bearerFormat"] == "JWT"
    assert "roles claim" in schemes["EntraBearer"]["description"]

    webhook = document["paths"]["/v1/webhooks/stripe"]["post"]
    assert webhook["requestBody"]["required"] is True
    assert webhook["requestBody"]["content"]["application/json"]["schema"]["type"] == "object"
    signature = next(
        parameter for parameter in webhook["parameters"] if parameter["name"] == "Stripe-Signature"
    )
    assert signature["in"] == "header"
    assert signature["required"] is True
    assert not webhook.get("security")
    assert "400" in webhook["responses"]


def test_request_and_response_models_include_constraints_and_error_shapes() -> None:
    document = app.openapi()
    schemas = document["components"]["schemas"]
    create_claim = schemas["CreateClaimRequest"]["properties"]
    assert create_claim["reason"]["minLength"] == 10
    assert create_claim["reason"]["maxLength"] == 2000
    amount_schema = create_claim["requested_amount"]
    numeric_variant = next(
        variant for variant in amount_schema["anyOf"] if variant.get("type") == "number"
    )
    assert numeric_variant["exclusiveMinimum"] == 0
    assert (
        "$ref"
        in document["paths"]["/v1/claims"]["post"]["responses"]["400"]["content"][
            "application/json"
        ]["schema"]
    )
    assert schemas["ErrorResponse"]["properties"]["detail"]["type"] == "string"
    assert "ApprovalRecord" in schemas
    assert "AdminKpis" in schemas
    decision_schema = schemas["ApprovalRequest"]["properties"]["decision"]
    assert decision_schema["enum"] == ["approve", "reject"]
    list_claims_parameters = document["paths"]["/v1/claims"]["get"]["parameters"]
    status_parameter = next(
        parameter for parameter in list_claims_parameters if parameter["name"] == "status"
    )
    assert status_parameter["required"] is False
    assert status_parameter["description"]


def test_checked_in_openapi_document_matches_application_schema() -> None:
    checked_in = json.loads((BACKEND_ROOT / "openapi" / "openapi.json").read_text(encoding="utf-8"))

    assert checked_in == app.openapi()
