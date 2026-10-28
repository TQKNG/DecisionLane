from collections.abc import AsyncIterator
from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file =(".env","python/.env"),
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

    azure_search_endpoint:str =""
    azure_search_index:str = "refundflow-policies-v1"
    azure_search_query_key:str=""
    azure_search_admin_key:str=""

    foundry_project_endpoint:str =""
    foundry_resource_endpoint:str="" 
    foundry_mode:str = "gpt-5.6-luna"
    foundry_escalation_model:str = "gpt-5.6-sol"
    foundry_evaluation_model:str = "gpt-5.6-luna"
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