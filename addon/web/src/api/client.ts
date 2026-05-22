// Typed fetch wrapper for /api/*.
// Relative URLs resolve against document.baseURI (set via Vite base:'./'),
// so they work under HA Ingress prefix without configuration.
//
// Backend returns FastAPI HTTPException as { detail: string|object } on errors.

import type {
  CommitRequest,
  CommitResponse,
  DryRunRequest,
  DryRunResponse,
  EntitiesResponse,
  EntityConfigResponse,
  YamlFilesResponse,
  YamlParseResponse,
} from "./types.js";

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly detail: unknown,
    message: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function request<T>(
  path: string,
  init?: RequestInit & { query?: Record<string, string> },
): Promise<T> {
  const { query, ...rest } = init ?? {};
  let url = path.replace(/^\//, "");
  if (query) {
    const qs = new URLSearchParams(query).toString();
    if (qs) url += `?${qs}`;
  }
  let res: Response;
  try {
    res = await fetch(url, {
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(rest.body ? { "Content-Type": "application/json" } : {}),
        ...(rest.headers ?? {}),
      },
      ...rest,
    });
  } catch (err) {
    throw new ApiClientError(0, null, `Network error: ${(err as Error).message}`);
  }

  if (res.status === 401) {
    // Ingress cookie expired — hard reload re-issues it.
    window.location.reload();
    throw new ApiClientError(401, null, "Session expired");
  }

  const text = await res.text();
  const data: unknown = text ? safeJson(text) : null;

  if (!res.ok) {
    const detail = extractDetail(data);
    throw new ApiClientError(res.status, data, detail ?? `HTTP ${res.status}`);
  }
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractDetail(data: unknown): string | null {
  if (data && typeof data === "object" && "detail" in data) {
    const d = (data as { detail: unknown }).detail;
    if (typeof d === "string") return d;
    return JSON.stringify(d);
  }
  return null;
}

export const api = {
  health: () => request<{ status: string }>("api/health"),

  yaml: {
    list: () => request<YamlFilesResponse>("api/yaml/files"),
    parse: (path: string) =>
      request<YamlParseResponse>("api/yaml/parse", { query: { path } }),
  },

  convert: {
    dryRun: (req: DryRunRequest) =>
      request<DryRunResponse>("api/convert/dry-run", {
        method: "POST",
        body: JSON.stringify(req),
      }),
    commit: (req: CommitRequest) =>
      request<CommitResponse>("api/convert/commit", {
        method: "POST",
        body: JSON.stringify(req),
      }),
  },

  entities: {
    list: () => request<EntitiesResponse>("api/entities"),
    get: (entityId: string) =>
      request<EntityConfigResponse>(`api/entities/${encodeURIComponent(entityId)}`),
    delete: (entityId: string) =>
      request<null>(`api/entities/${encodeURIComponent(entityId)}`, {
        method: "DELETE",
      }),
  },
};
