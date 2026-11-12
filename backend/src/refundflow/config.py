from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]
ENV_FILE = BACKEND_DIR / ".env"

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ENV_FILE,
        env_file_encoding="utf-8",
        extra= "ignore"
    )

    app_env: str = "local"
    allowed_origins: str = "http://localhost:3000"
    
    cosmos_endpoint: str = ""
    cosmos_database: str = "http://localhost:3000"
    storage_account_name:str = ""
    storage_account_url:str =""
    quarantine_container:str="quarantine"
    evidence_container:str="evidence"

    content_safety_endpoint: str = ""
    document_intelligence_endpoint: str=""
    content_understanding_document_analyzer_id: str = (
        "refund_evidence_document_classifier"
    )
    content_understanding_image_analyzer_id: str = (
        "refund_evidence_image_classifier"
    )
    content_understanding_api_version: str = "2025-11-01"

    azure_search_endpoint:str =""
    azure_search_index:str = "refundflow-policies-v1"
    azure_search_query_key:str=""
    azure_search_admin_key:str=""

    foundry_project_endpoint:str =""
    foundry_resource_endpoint:str="" 
    foundry_model:str = "gpt-5.6-luna"
    foundry_escalation_model:str = "gpt-5.6-sol"
    foundry_evaluation_model:str = "gpt-4.1-mini"
    foundry_embedding_model:str = "text-embedding-3-small"

    customer_tenant_id: str = ""
    customer_api_audience: str = ""
    staff_tenant_id: str = ""
    staff_api_audience: str = ""

    function_base_url:str = "http://localhost:7071/api"
    function_key: str = ""

    stripe_secret_key:str = ""
    stripe_webhook_secret:str = ""
    acs_email_endpoint:str = ""
    acs_sender_address:str = ""

    monthly_claim_limit: int = 50
    monthly_upload_bytes_limit:int = 1_073_741_824
    monthly_document_page_limit:int = 500
    monthly_runtime_ai_usd_limit:float=8.0
    monthly_evaluation_ai_usd_limit:float= 5.0

    applicationinsights_connection_string:str = Field(default="")

    @property
    def allowed_origin_list(self) -> list[str]:
        return [value.strip() for value in self.allowed_origins.split(",") if value.strip()]

@lru_cache
def get_settings() -> Settings:
    return Settings()
