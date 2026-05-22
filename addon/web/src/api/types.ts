// Mirror of addon/app/schemas.py — keep in sync with backend Pydantic models.

export type Domain = "light" | "sensor" | "cover" | "climate";

export interface ApiError {
  code: string;
  message: string;
  hint?: string | null;
  entity?: string | null;
}

export interface YamlFile {
  name: string;
  size_bytes: number;
}

export interface YamlFilesResponse {
  files: YamlFile[];
}

export interface ParsedDomainSummary {
  domain: string;
  entity_count: number;
  entity_names: string[];
}

export interface YamlParseResponse {
  path: string;
  domains: ParsedDomainSummary[];
  raw_size: number;
}

export interface DryRunRequest {
  path: string;
  domain: string;
}

export type ValidationStatus = "ok" | "error";

export interface DryRunEntry {
  name: string;
  payload: Record<string, unknown>;
  validation: ValidationStatus | string;
  message?: string | null;
}

export interface DryRunResponse {
  path: string;
  domain: string;
  entries: DryRunEntry[];
}

export interface CommitRequest {
  path: string;
  domain: string;
  only_names?: string[] | null;
}

export interface CommitResultEntry {
  name: string;
  entity_id?: string | null;
  applied: boolean;
  error?: string | null;
}

export interface CommitResponse {
  path: string;
  domain: string;
  migration_id: number;
  entries: CommitResultEntry[];
}

export interface EntitySummary {
  entity_id: string;
  name: string | null;
  platform: string;
  state: string | null;
}

export interface EntitiesResponse {
  entities: EntitySummary[];
}

export interface EntityConfigResponse {
  entity_id: string;
  config: Record<string, unknown>;
}
