"""Convert router — dry-run + commit for one supported domain at a time."""
from __future__ import annotations

import logging
from typing import Annotated, Any, cast

from fastapi import APIRouter, Depends, HTTPException
from knx_yaml_to_ui_core.builders import BUILDERS
from knx_yaml_to_ui_core.parser import ParseError, parse_yaml
from knx_yaml_to_ui_core.types import ParsedDomains
from knx_yaml_to_ui_core.validators import UnsupportedFeature, ValidationError

from ..adapters.db import DB
from ..adapters.fs_adapter import FsAdapter, FsError
from ..adapters.ha_client import HAClient, HAClientError
from ..deps import get_db, get_fs_adapter, get_ha_client
from ..schemas import (
    CommitRequest,
    CommitResponse,
    CommitResultEntry,
    DryRunEntry,
    DryRunRequest,
    DryRunResponse,
)

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/convert", tags=["convert"])

SUPPORTED_DOMAINS = set(BUILDERS.keys())

FsDep = Annotated[FsAdapter, Depends(get_fs_adapter)]
HaDep = Annotated[HAClient, Depends(get_ha_client)]
DbDep = Annotated[DB, Depends(get_db)]


def _ensure_supported(domain: str) -> None:
    if domain not in SUPPORTED_DOMAINS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"domain '{domain}' not supported in Slice 1A "
                f"(supported: {sorted(SUPPORTED_DOMAINS)})"
            ),
        )


async def _load_and_parse(path: str, fs: FsAdapter) -> ParsedDomains:
    try:
        content = await fs.read(path)
    except FsError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=f"{path} not found") from exc
    try:
        return parse_yaml(content)
    except ParseError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/dry-run", response_model=DryRunResponse)
async def dry_run(req: DryRunRequest, fs: FsDep) -> DryRunResponse:
    _ensure_supported(req.domain)
    parsed = await _load_and_parse(req.path, fs)
    entries: list[DryRunEntry] = []
    builder = BUILDERS[req.domain]
    for yml in parsed.get(req.domain, []):
        yml_dict = cast(dict[str, Any], yml)
        name = yml.get("name", "<unnamed>")
        try:
            payload = builder(yml_dict)
            entries.append(
                DryRunEntry(name=name, payload=dict(payload), validation="ok")
            )
        except (ValidationError, UnsupportedFeature) as exc:
            entries.append(
                DryRunEntry(
                    name=name,
                    payload={},
                    validation="error",
                    message=str(exc),
                )
            )
    return DryRunResponse(path=req.path, domain=req.domain, entries=entries)


@router.post("/commit", response_model=CommitResponse)
async def commit(
    req: CommitRequest, fs: FsDep, ha: HaDep, db: DbDep
) -> CommitResponse:
    _ensure_supported(req.domain)
    parsed = await _load_and_parse(req.path, fs)
    builder = BUILDERS[req.domain]
    entries: list[CommitResultEntry] = []

    for yml in parsed.get(req.domain, []):
        yml_dict = cast(dict[str, Any], yml)
        name = yml.get("name", "<unnamed>")
        if req.only_names is not None and name not in req.only_names:
            continue
        try:
            payload = builder(yml_dict)
        except (ValidationError, UnsupportedFeature) as exc:
            entries.append(
                CommitResultEntry(name=name, applied=False, error=str(exc))
            )
            continue
        try:
            await ha.send({"type": "knx/validate_entity", **payload})
            create_result = await ha.send(
                {"type": "knx/create_entity", **payload}
            )
            entries.append(
                CommitResultEntry(
                    name=name,
                    entity_id=create_result.get("entity_id"),
                    applied=True,
                )
            )
        except HAClientError as exc:
            log.exception("commit failed for %s", name)
            entries.append(
                CommitResultEntry(name=name, applied=False, error=str(exc))
            )

    migration_id = await db.insert_row(
        kind="convert.commit",
        payload={
            "path": req.path,
            "domain": req.domain,
            "entries": [e.model_dump() for e in entries],
        },
        status="ok" if all(e.applied for e in entries) else "partial",
    )
    return CommitResponse(
        path=req.path,
        domain=req.domain,
        migration_id=migration_id,
        entries=entries,
    )
