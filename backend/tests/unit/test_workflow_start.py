import json
from types import SimpleNamespace

import azure.durable_functions as df
import azure.functions as func
import pytest
from azure.durable_functions.models.DurableOrchestrationStatus import (
    DurableOrchestrationStatus,
)

import function_app


class FakeDurableClient:
    def __init__(self, existing_input: dict[str, object]) -> None:
        self.status = SimpleNamespace(
            input_=existing_input,
            runtime_status=df.OrchestrationRuntimeStatus.Running,
        )
        self.started = False
        self.purged = False
        self.show_input_requested = False

    async def get_status(
        self,
        instance_id: str,
        show_input: bool = False,
    ) -> SimpleNamespace:
        self.show_input_requested = show_input
        return self.status

    def create_check_status_response(
        self,
        req: func.HttpRequest,
        instance_id: str,
    ) -> func.HttpResponse:
        return func.HttpResponse(
            json.dumps({"instance_id": instance_id}),
            status_code=202,
            mimetype="application/json",
        )

    async def purge_instance_history(self, instance_id: str) -> None:
        self.purged = True


class MissingWorkflowClient(FakeDurableClient):
    def __init__(self) -> None:
        self.status = DurableOrchestrationStatus()
        self.started = False
        self.purged = False
        self.show_input_requested = False

    async def start_new(
        self,
        function_name: str,
        instance_id: str,
        client_input: dict[str, object],
    ) -> None:
        self.started = True


class FailedWorkflowClient(FakeDurableClient):
    def __init__(self, existing_input: dict[str, object]) -> None:
        super().__init__(existing_input)
        self.status.runtime_status = df.OrchestrationRuntimeStatus.Failed

    async def start_new(
        self,
        function_name: str,
        instance_id: str,
        client_input: dict[str, object],
    ) -> None:
        self.started = True


class CompletedWorkflowClient(FailedWorkflowClient):
    def __init__(self, existing_input: dict[str, object]) -> None:
        super().__init__(existing_input)
        self.status.runtime_status = df.OrchestrationRuntimeStatus.Completed


@pytest.mark.asyncio
async def test_existing_workflow_input_is_compared() -> None:
    body = {
        "claim_id": "claim-1",
        "document_ids": ["document-1"],
    }
    request = func.HttpRequest(
        method="POST",
        url="http://localhost/api/refund-workflows",
        body=json.dumps(body).encode(),
    )
    client = FakeDurableClient(existing_input=body)

    start_activity = function_app.start_refund_workflow._function._func.__wrapped__
    response = await start_activity(request, client)

    assert response.status_code == 202
    assert json.loads(response.get_body()) == {
        "instance_id": "refund-workflow:claim-1",
    }
    assert client.show_input_requested is True


@pytest.mark.asyncio
async def test_missing_workflow_status_starts_new_workflow() -> None:
    body = {
        "claim_id": "new-claim",
        "document_ids": ["document-1"],
    }
    request = func.HttpRequest(
        method="POST",
        url="http://localhost/api/refund-workflows",
        body=json.dumps(body).encode(),
    )
    client = MissingWorkflowClient()

    start_activity = function_app.start_refund_workflow._function._func.__wrapped__
    response = await start_activity(request, client)

    assert response.status_code == 202
    assert client.started is True


@pytest.mark.asyncio
async def test_failed_workflow_is_purged_and_restarted() -> None:
    body = {
        "claim_id": "failed-claim",
        "document_ids": ["document-1"],
    }
    request = func.HttpRequest(
        method="POST",
        url="http://localhost/api/refund-workflows",
        body=json.dumps(body).encode(),
    )
    client = FailedWorkflowClient(existing_input=body)

    start_activity = function_app.start_refund_workflow._function._func.__wrapped__
    response = await start_activity(request, client)

    assert response.status_code == 202
    assert client.purged is True
    assert client.started is True


@pytest.mark.asyncio
async def test_failed_workflow_restarts_with_updated_documents() -> None:
    body = {
        "claim_id": "failed-claim",
        "document_ids": ["document-2"],
    }
    request = func.HttpRequest(
        method="POST",
        url="http://localhost/api/refund-workflows",
        body=json.dumps(body).encode(),
    )
    client = FailedWorkflowClient(existing_input={
        "claim_id": "failed-claim",
        "document_ids": ["document-1"],
    })

    start_activity = function_app.start_refund_workflow._function._func.__wrapped__
    response = await start_activity(request, client)

    assert response.status_code == 202
    assert client.purged is True
    assert client.started is True


@pytest.mark.asyncio
async def test_completed_workflow_restarts_for_revised_evidence() -> None:
    body = {
        "claim_id": "needs-information-claim",
        "document_ids": ["document-2"],
        "restart_workflow": True,
    }
    request = func.HttpRequest(
        method="POST",
        url="http://localhost/api/refund-workflows",
        body=json.dumps(body).encode(),
    )
    client = CompletedWorkflowClient(existing_input={
        "claim_id": "needs-information-claim",
        "document_ids": ["document-1"],
    })

    start_activity = function_app.start_refund_workflow._function._func.__wrapped__
    response = await start_activity(request, client)

    assert response.status_code == 202
    assert client.purged is True
    assert client.started is True


@pytest.mark.asyncio
async def test_existing_workflow_with_different_input_returns_conflict() -> None:
    body = {
        "claim_id": "claim-1",
        "document_ids": ["document-2"],
    }
    request = func.HttpRequest(
        method="POST",
        url="http://localhost/api/refund-workflows",
        body=json.dumps(body).encode(),
    )
    client = FakeDurableClient(
        existing_input={
            "claim_id": "claim-1",
            "document_ids": ["document-1"],
        }
    )

    start_activity = function_app.start_refund_workflow._function._func.__wrapped__
    response = await start_activity(request, client)

    assert response.status_code == 409
    assert response.get_body() == b"A different workflow already exists for this claim"
