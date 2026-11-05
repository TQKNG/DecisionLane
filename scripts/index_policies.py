from __future__ import annotations

import asyncio
import hashlib
import os
from pathlib import Path

from azure.core.credentials import AzureKeyCredential
from azure.identity.aio import DefaultAzureCredential
from azure.search.documents import SearchClient
from azure.search.documents.indexes import SearchIndexClient
from azure.search.documents.indexes.models import (
    HnswAlgorithmConfiguration,
    SearchableField,
    SearchField,
    SearchFieldDataType,
    SearchIndex,
    SimpleField,
    VectorSearch,
    VectorSearchProfile,
)
from refundflow.services.embeddings import EmbeddingService


def split_markdown(text: str, maximum_characters: int = 1600) -> list[tuple[str, str]]:
    chunks: list[tuple[str, str]] = []
    title = "Policy"
    buffer: list[str] = []
    for line in text.splitlines():
        if line.startswith("## ") or sum(len(value) for value in buffer) >= maximum_characters:
            if buffer:
                chunks.append((title, "\n".join(buffer).strip()))
                buffer = []
            if line.startswith("## "):
                title = line.removeprefix("## ").strip()
        buffer.append(line)
    if buffer:
        chunks.append((title, "\n".join(buffer).strip()))
    return [(heading, content) for heading, content in chunks if content]


async def main() -> None:
    endpoint = os.environ["AZURE_SEARCH_ENDPOINT"]
    index_name = os.environ.get("AZURE_SEARCH_INDEX", "refundflow-policies-v1")
    admin_key = os.environ["AZURE_SEARCH_ADMIN_KEY"]
    resource_endpoint = os.environ["FOUNDRY_RESOURCE_ENDPOINT"]
    embedding_model = os.environ.get(
        "FOUNDRY_EMBEDDING_MODEL", "text-embedding-3-small"
    )
    credential = DefaultAzureCredential()
    embedding_service = EmbeddingService(
        resource_endpoint,
        embedding_model,
        credential,
    )

    index = SearchIndex(
        name=index_name,
        fields=[
            SimpleField(name="id", type=SearchFieldDataType.String, key=True),
            SimpleField(name="policy_id", type=SearchFieldDataType.String, filterable=True),
            SimpleField(name="policy_version", type=SearchFieldDataType.String, filterable=True),
            SimpleField(name="chunk_id", type=SearchFieldDataType.String, filterable=True),
            SearchableField(name="title", type=SearchFieldDataType.String),
            SearchableField(name="content", type=SearchFieldDataType.String),
            SearchField(
                name="content_vector",
                type=SearchFieldDataType.Collection(SearchFieldDataType.Single),
                searchable=True,
                vector_search_dimensions=1536,
                vector_search_profile_name="policy-vector-profile",
            ),
        ],
        vector_search=VectorSearch(
            algorithms=[HnswAlgorithmConfiguration(name="policy-hnsw")],
            profiles=[
                VectorSearchProfile(
                    name="policy-vector-profile",
                    algorithm_configuration_name="policy-hnsw",
                )
            ],
        ),
    )
    index_client = SearchIndexClient(endpoint, AzureKeyCredential(admin_key))
    index_client.create_or_update_index(index)

    repo_root = Path(__file__).resolve().parents[1]
    policies_dir = repo_root / "policies"
    documents: list[dict[str, object]] = []
    for path in sorted(policies_dir.glob("*.md")):
        text = path.read_text(encoding="utf-8")
        policy_version = "2026-01"
        chunks = split_markdown(text)
        vectors = await embedding_service.embed([content for _, content in chunks])
        for sequence, ((title, content), vector) in enumerate(zip(chunks, vectors, strict=True)):
            chunk_id = f"{path.stem}-{sequence:03d}"
            documents.append(
                {
                    "id": hashlib.sha256(chunk_id.encode()).hexdigest(),
                    "policy_id": path.stem,
                    "policy_version": policy_version,
                    "chunk_id": chunk_id,
                    "title": title,
                    "content": content,
                    "content_vector": vector,
                }
            )

    search_client = SearchClient(endpoint, index_name, AzureKeyCredential(admin_key))
    result = search_client.upload_documents(documents)
    if not all(item.succeeded for item in result):
        raise RuntimeError(f"Some policy chunks failed to index: {result}")
    print(f"Indexed {len(documents)} policy chunks into {index_name}")
    await credential.close()


if __name__ == "__main__":
    asyncio.run(main())