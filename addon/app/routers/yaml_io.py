"""Endpoints to list and parse YAML files in /config/knx/."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from knx_yaml_to_ui_core.parser import ParseError, parse_yaml

from ..adapters.fs_adapter import FsAdapter, FsError
from ..deps import get_fs_adapter
from ..schemas import (
    ParsedDomainSummary,
    YamlFile,
    YamlFilesResponse,
    YamlParseResponse,
)

router = APIRouter(prefix="/api/yaml", tags=["yaml"])

FsDep = Annotated[FsAdapter, Depends(get_fs_adapter)]


@router.get("/files", response_model=YamlFilesResponse)
async def list_files(fs: FsDep) -> YamlFilesResponse:
    names = await fs.list_files()
    items: list[YamlFile] = []
    for name in names:
        content = await fs.read(name)
        items.append(YamlFile(name=name, size_bytes=len(content)))
    return YamlFilesResponse(files=items)


@router.get("/parse", response_model=YamlParseResponse)
async def parse_file(
    fs: FsDep,
    path: Annotated[str, Query(description="YAML file relative to /config/knx/")],
) -> YamlParseResponse:
    try:
        content = await fs.read(path)
    except FsError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=f"{path} not found") from exc

    try:
        parsed = parse_yaml(content)
    except ParseError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    domains = [
        ParsedDomainSummary(
            domain=domain,
            entity_count=len(entries),
            entity_names=[e.get("name", "<unnamed>") for e in entries],
        )
        for domain, entries in parsed.items()
    ]
    return YamlParseResponse(path=path, domains=domains, raw_size=len(content))
