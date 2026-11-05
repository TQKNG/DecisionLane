from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from functools import lru_cache
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient

from refundflow.config import get_settings

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class CurrentUser:
    user_id: str
    name: str
    email: str
    roles: frozenset[str]


@lru_cache
def get_jwks_client(tenant_id: str) -> PyJWKClient:
    return PyJWKClient(
        f"https://login.microsoftonline.com/{tenant_id}/discovery/v2.0/keys",
        cache_keys=True,
    )


def decode_token(token: str) -> dict[str, object]:
    settings = get_settings()
    tenant_id = settings.customer_tenant_id
    audience = settings.customer_api_audience
    signing_key = get_jwks_client(tenant_id).get_signing_key_from_jwt(token)
    return jwt.decode(
        token,
        signing_key.key,
        algorithms=["RS256"],
        audience=audience,
        issuer=f"https://login.microsoftonline.com/{tenant_id}/v2.0",
        options={"require": ["exp", "iat", "iss", "aud", "sub"]},
    )


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> CurrentUser:
    settings = get_settings()
    if settings.app_env == "local" and credentials is None:
        return CurrentUser(
            user_id="local-customer",
            name="Local Customer",
            email="local-customer@example.com",
            roles=frozenset({"Customer", "Reviewer", "Admin"}),
        )
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")
    try:
        claims = decode_token(credentials.credentials)
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        ) from exc
    roles = claims.get("roles", [])
    if not isinstance(roles, list):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token roles",
        )
    return CurrentUser(
        user_id=str(claims.get("oid") or claims["sub"]),
        name=str(claims.get("name", "Unknown user")),
        email=str(claims.get("preferred_username", "")),
        roles=frozenset(str(value) for value in roles),
    )


def require_roles(*allowed_roles: str) -> Callable[..., Awaitable[CurrentUser]]:
    async def authorize(user: Annotated[CurrentUser, Depends(get_current_user)]) -> CurrentUser:
        if not user.roles.intersection(allowed_roles):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        return user

    return authorize