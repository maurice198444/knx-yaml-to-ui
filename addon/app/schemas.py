"""Pydantic models for request/response payloads."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class ApiError(BaseModel):
    code: str
    message: str
    hint: str | None = None
    entity: str | None = None


class YamlFile(BaseModel):
    name: str
    size_bytes: int


class YamlFilesResponse(BaseModel):
    files: list[YamlFile]


class ParsedDomainSummary(BaseModel):
    domain: str
    entity_count: int
    entity_names: list[str]


class YamlParseResponse(BaseModel):
    path: str
    domains: list[ParsedDomainSummary]
    raw_size: int


class DryRunRequest(BaseModel):
    path: str = Field(description="YAML path relative to /config/knx/")
    domain: str = Field(default="light", description="Slice 1A supports only 'light'")


class DryRunEntry(BaseModel):
    name: str
    payload: dict[str, Any]
    validation: str
    message: str | None = None


class DryRunResponse(BaseModel):
    path: str
    domain: str
    entries: list[DryRunEntry]


class CommitRequest(BaseModel):
    path: str
    domain: str = "light"
    only_names: list[str] | None = Field(
        default=None,
        description="If set, only commit entities whose name appears here",
    )


class CommitResultEntry(BaseModel):
    name: str
    entity_id: str | None = None
    applied: bool
    error: str | None = None


class CommitResponse(BaseModel):
    path: str
    domain: str
    migration_id: int
    entries: list[CommitResultEntry]


class EntitySummary(BaseModel):
    entity_id: str
    name: str | None
    platform: str
    state: str | None


class EntitiesResponse(BaseModel):
    entities: list[EntitySummary]


class EntityConfigResponse(BaseModel):
    entity_id: str
    config: dict[str, Any]
