"""HA-WebSocket adapter.

One HAClient instance per backend process, owned by FastAPI lifespan. Performs
the HA auth handshake on connect, multiplexes commands via incrementing `id`
fields, and exposes `send(payload) -> result_dict`. Subscriptions get a
separate channel via `subscribe()` which returns an async iterator of events.
"""
from __future__ import annotations

import asyncio
import contextlib
import json
import logging
from collections.abc import AsyncIterator
from itertools import count
from typing import Any

import websockets
from websockets.asyncio.client import ClientConnection

log = logging.getLogger(__name__)


class HAClientError(RuntimeError):
    """HA returned an error result, the socket dropped, or auth failed."""


class HAClient:
    def __init__(self, *, url: str, token: str, recv_timeout: float = 10.0) -> None:
        self._url = url
        self._token = token
        self._recv_timeout = recv_timeout
        self._ws: ClientConnection | None = None
        self._id_seq = count(1)
        self._pending: dict[int, asyncio.Future[dict[str, Any]]] = {}
        self._subscriptions: dict[int, asyncio.Queue[dict[str, Any]]] = {}
        self._reader_task: asyncio.Task[None] | None = None
        self._lock = asyncio.Lock()

    async def connect(self) -> None:
        ws = await websockets.connect(self._url, max_size=2**22)
        try:
            hello = json.loads(await asyncio.wait_for(ws.recv(), self._recv_timeout))
            if hello.get("type") != "auth_required":
                raise HAClientError(f"unexpected first frame: {hello}")
            await ws.send(json.dumps({"type": "auth", "access_token": self._token}))
            reply = json.loads(await asyncio.wait_for(ws.recv(), self._recv_timeout))
            if reply.get("type") != "auth_ok":
                raise HAClientError(f"auth failed: {reply}")
        except Exception:
            await ws.close()
            raise
        self._ws = ws
        self._reader_task = asyncio.create_task(self._reader_loop())

    async def close(self) -> None:
        if self._reader_task:
            self._reader_task.cancel()
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await self._reader_task
            self._reader_task = None
        if self._ws:
            await self._ws.close()
            self._ws = None

    async def send(self, payload: dict[str, Any]) -> Any:
        # HA WS "result" field can be a dict OR a list (e.g. config/entity_registry/list).
        if not self._ws:
            raise HAClientError("not connected")
        msg_id = next(self._id_seq)
        future: asyncio.Future[Any] = asyncio.get_running_loop().create_future()
        self._pending[msg_id] = future
        outbound = {"id": msg_id, **payload}
        async with self._lock:
            await self._ws.send(json.dumps(outbound))
        try:
            result = await asyncio.wait_for(future, timeout=self._recv_timeout)
        finally:
            self._pending.pop(msg_id, None)
        return result

    async def subscribe(
        self, payload: dict[str, Any]
    ) -> tuple[int, AsyncIterator[dict[str, Any]]]:
        """Send subscription command. Returns (subscription_id, async-iter of events)."""
        if not self._ws:
            raise HAClientError("not connected")
        msg_id = next(self._id_seq)
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=256)
        self._subscriptions[msg_id] = queue
        outbound = {"id": msg_id, **payload}
        future: asyncio.Future[dict[str, Any]] = asyncio.get_running_loop().create_future()
        self._pending[msg_id] = future
        async with self._lock:
            await self._ws.send(json.dumps(outbound))
        try:
            await asyncio.wait_for(future, timeout=self._recv_timeout)
        finally:
            self._pending.pop(msg_id, None)

        async def iterator() -> AsyncIterator[dict[str, Any]]:
            try:
                while True:
                    yield await queue.get()
            finally:
                self._subscriptions.pop(msg_id, None)

        return msg_id, iterator()

    async def _reader_loop(self) -> None:
        assert self._ws is not None
        try:
            async for raw in self._ws:
                msg = json.loads(raw)
                msg_id = msg.get("id")
                msg_type = msg.get("type")
                if msg_type == "event" and msg_id in self._subscriptions:
                    await self._subscriptions[msg_id].put(msg["event"])
                    continue
                future = self._pending.get(msg_id) if msg_id is not None else None
                if future is None or future.done():
                    continue
                if msg_type == "result" and msg.get("success") is True:
                    # `or {}` would mangle empty lists to dicts — handle None explicitly.
                    result_value = msg.get("result")
                    future.set_result({} if result_value is None else result_value)
                elif msg_type == "result" and msg.get("success") is False:
                    err = msg.get("error") or {}
                    future.set_exception(
                        HAClientError(
                            f"{err.get('code', 'unknown')}: {err.get('message', '')}"
                        )
                    )
                else:
                    future.set_exception(HAClientError(f"unexpected frame: {msg}"))
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            log.warning("HA reader loop crashed: %s", exc)
            for fut in self._pending.values():
                if not fut.done():
                    fut.set_exception(HAClientError(f"connection lost: {exc}"))
            self._pending.clear()
