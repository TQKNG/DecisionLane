from __future__ import annotations

from io import BytesIO

import pypdfium2 as pdfium
from azure.ai.contentsafety.aio import ContentSafetyClient
from azure.ai.contentsafety.models import AnalyzeImageOptions, ImageData
from azure.core.credentials_async import AsyncTokenCredential

from refundflow.domain.models import SafetyAnalysis
from refundflow.domain.safety_policy import decide_image_safety


class ContentSafetyService:
    def __init__(
        self,
        endpoint: str,
        api_version: str,
        credential: AsyncTokenCredential,
    ) -> None:
        self._client = ContentSafetyClient(
            endpoint,
            credential,
            api_version=api_version,
        )

    async def _analyze_image(self,image_bytes:bytes) -> dict[str, int]:
        response = await self._client.analyze_image(
            AnalyzeImageOptions(image=ImageData(content=image_bytes))
        )
        return{
            str(getattr(item.category,"value", item.category)):int(item.severity or 0)
            for item in response.categories_analysis
        }

    async def analyze(self, content:bytes, content_type:str) -> SafetyAnalysis:
        images: list[bytes]
        if content_type == "application/pdf":
            document=pdfium.PdfDocument(content)
            if len(document) > 2:
                raise ValueError("PDF files may contain at most two pages")
            images =[]
            for page_number in range(len(document)):
                page = document[page_number]
                image = page.render(scale=1.5).to_pil()
                output=BytesIO()
                image.save(output, format="JPEG", quality=85)
                images.append(output.getvalue())
        else:
            images = [content]

        highest: dict[str,int] ={}
        for image_bytes in images:
            scores = await self._analyze_image(image_bytes)
            for category, severity in scores.items():
                highest[category] = max(highest.get(category,0), severity)
        decision = decide_image_safety(highest)
        return SafetyAnalysis(decision=decision, severities=highest)
    
    async def close(self)-> None:
        await self._client.close()
    
    
