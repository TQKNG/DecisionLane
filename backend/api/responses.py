from typing import Any

from pydantic import BaseModel


class ErrorResponse(BaseModel):
    detail: str


ERROR_DESCRIPTIONS = {
    400: "The request is invalid or violates a business rule.",
    401: "The bearer token is missing or invalid.",
    403: "The authenticated user does not have a required role.",
    404: "The requested resource was not found.",
    409: "The request conflicts with the resource's current state.",
}


def error_responses(*status_codes: int) -> dict[int | str, dict[str, Any]]:
    return {
        status_code: {
            "model": ErrorResponse,
            "description": ERROR_DESCRIPTIONS[status_code],
        }
        for status_code in status_codes
    }
