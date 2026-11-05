from __future__ import annotations

import httpx
from azure.core.credentials_async import AsyncTokenCredential


class EmbeddingService:
    def __init__(
        self,
        endpoint:str,
        deployment_name: str,
        credential: AsyncTokenCredential
    )->None:
        self._endpoint = endpoint.rstrip("/")
        self._deployment_name = deployment_name
        self._credential = credential

    async def embed(self, texts: list[str]) -> list[list[float]]:
        token = await self._credential.get_token(
            "https://cognitiveservices.azure.com/.default"
        )
        url = (
            f"{self._endpoint}/openai/deployments/{self._deployment_name}"
            "/embeddings?api-version=2024-10-21"
        )
        async with httpx.AsyncClient(timeout=60)as client:
            response = await client.post(
                url,
                headers = {"Authorization": f"Bearer {token.token}"},
                json={"input":texts}
            )
            response.raise_for_status()
        rows = sorted(response.json()["data"], key=lambda row:row["index"])
        return [row["embedding"] for row in rows]
        