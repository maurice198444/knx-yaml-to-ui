// Browser-side WebSocket client for /ws/state-stream.
// Resolves URL against document.baseURI so it works under HA Ingress.
// Exponential reconnect backoff capped at 30s. Reset on successful open.

import type { LiveStatus } from "../components/ui/live-dot.js";

export interface StateEvent {
  entity_id: string;
  state: string | null;
  attributes: Record<string, unknown>;
  last_changed: string | null;
}

const BACKOFF_STEPS_MS = [1000, 2000, 4000, 8000, 16000, 30000];

// HA Ingress accepts the WS handshake even when the add-on is down, then closes
// shortly after. Without a grace window the UI would flap open↔closed every
// backoff cycle. We hold status at "connecting" until the socket stays open for
// OPEN_GRACE_MS without closing, OR until the first payload arrives.
const OPEN_GRACE_MS = 600;

function resolveWsUrl(path: string): string {
  const httpUrl = new URL(path, document.baseURI);
  const proto = httpUrl.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${httpUrl.host}${httpUrl.pathname}${httpUrl.search}`;
}

export class WsClient extends EventTarget {
  private _status: LiveStatus = "closed";
  private _socket: WebSocket | null = null;
  private _reconnectTimer: number | null = null;
  private _openGraceTimer: number | null = null;
  private _backoffIndex = 0;
  private _wantOpen = false;

  constructor(private readonly path: string = "ws/state-stream") {
    super();
  }

  get status(): LiveStatus {
    return this._status;
  }

  connect(): void {
    if (this._wantOpen) return;
    this._wantOpen = true;
    this._open();
  }

  close(): void {
    this._wantOpen = false;
    this._clearGraceTimer();
    if (this._reconnectTimer !== null) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    if (this._socket) {
      this._socket.close();
      this._socket = null;
    }
    this._setStatus("closed");
  }

  private _clearGraceTimer(): void {
    if (this._openGraceTimer !== null) {
      clearTimeout(this._openGraceTimer);
      this._openGraceTimer = null;
    }
  }

  private _open(): void {
    this._setStatus("connecting");
    let sock: WebSocket;
    try {
      sock = new WebSocket(resolveWsUrl(this.path));
    } catch {
      this._scheduleReconnect();
      return;
    }
    this._socket = sock;

    sock.addEventListener("open", () => {
      // Hold "connecting" until either OPEN_GRACE_MS elapses without close
      // or the first message arrives — protects against HA Ingress accepting
      // the handshake while the add-on backend is actually down.
      this._clearGraceTimer();
      this._openGraceTimer = window.setTimeout(() => {
        this._openGraceTimer = null;
        if (this._socket === sock && sock.readyState === WebSocket.OPEN) {
          this._backoffIndex = 0;
          this._setStatus("open");
        }
      }, OPEN_GRACE_MS);
    });

    sock.addEventListener("message", (e) => {
      // First payload proves the backend is alive — flip to open immediately.
      if (this._status !== "open") {
        this._clearGraceTimer();
        this._backoffIndex = 0;
        this._setStatus("open");
      }
      let payload: StateEvent;
      try {
        payload = JSON.parse(e.data as string) as StateEvent;
      } catch {
        return;
      }
      this.dispatchEvent(new CustomEvent<StateEvent>("state", { detail: payload }));
    });

    const onClosedOrErrored = () => {
      this._clearGraceTimer();
      this._socket = null;
      if (this._wantOpen) this._scheduleReconnect();
      else this._setStatus("closed");
    };
    sock.addEventListener("close", onClosedOrErrored);
    sock.addEventListener("error", () => {
      // 'close' fires after 'error' in browsers; let onClosedOrErrored handle reconnect.
    });
  }

  private _scheduleReconnect(): void {
    this._setStatus("connecting");
    const delay =
      BACKOFF_STEPS_MS[Math.min(this._backoffIndex, BACKOFF_STEPS_MS.length - 1)] ?? 30000;
    this._backoffIndex += 1;
    this._reconnectTimer = window.setTimeout(() => {
      this._reconnectTimer = null;
      if (this._wantOpen) this._open();
    }, delay);
  }

  private _setStatus(next: LiveStatus): void {
    if (this._status === next) return;
    this._status = next;
    this.dispatchEvent(new Event("status"));
  }
}

// Shared singleton — topbar dot + entities-view subscribe to the same instance.
export const ws = new WsClient();
