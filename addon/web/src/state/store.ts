// App-wide state container. EventTarget-based pub/sub so any consumer can
// re-render via simple subscribe(); avoids pulling reactive-controllers.
//
// Components either consume via @lit/context or call store.subscribe() directly.

import { createContext } from "@lit/context";
import type {
  CommitResponse,
  Domain,
  DryRunResponse,
  EntitySummary,
  YamlFile,
  YamlParseResponse,
} from "../api/types.js";

export type ConvertStep = "file" | "parse" | "dryrun" | "commit";

export interface RecentCommit {
  commit: CommitResponse;
  capturedAt: number;
}

export interface AppState {
  selectedDomain: Domain;
  files: YamlFile[] | null;
  selectedFile: string | null;
  parseResult: YamlParseResponse | null;
  dryRunResult: DryRunResponse | null;
  lastCommit: CommitResponse | null;
  recentCommits: RecentCommit[];
  entities: EntitySummary[];
  currentStep: ConvertStep;
}

const INITIAL: AppState = {
  selectedDomain: "light",
  files: null,
  selectedFile: null,
  parseResult: null,
  dryRunResult: null,
  lastCommit: null,
  recentCommits: [],
  entities: [],
  currentStep: "file",
};

export class Store extends EventTarget {
  private _state: AppState = { ...INITIAL };

  get state(): Readonly<AppState> {
    return this._state;
  }

  private set(patch: Partial<AppState>): void {
    this._state = { ...this._state, ...patch };
    this.dispatchEvent(new Event("change"));
  }

  subscribe(handler: () => void): () => void {
    this.addEventListener("change", handler);
    return () => this.removeEventListener("change", handler);
  }

  setDomain(domain: Domain): void {
    if (this._state.selectedDomain === domain) return;
    this.set({
      selectedDomain: domain,
      selectedFile: null,
      parseResult: null,
      dryRunResult: null,
      lastCommit: null,
      currentStep: "file",
    });
  }

  setFiles(files: YamlFile[]): void {
    this.set({ files });
  }

  selectFile(name: string): void {
    this.set({
      selectedFile: name,
      parseResult: null,
      dryRunResult: null,
      lastCommit: null,
      currentStep: "parse",
    });
  }

  setParseResult(parseResult: YamlParseResponse): void {
    this.set({ parseResult, currentStep: "dryrun" });
  }

  setDryRunResult(dryRunResult: DryRunResponse): void {
    this.set({ dryRunResult, currentStep: "commit" });
  }

  setLastCommit(commit: CommitResponse): void {
    const entry: RecentCommit = { commit, capturedAt: Date.now() };
    this.set({
      lastCommit: commit,
      recentCommits: [entry, ...this._state.recentCommits].slice(0, 50),
    });
  }

  setEntities(entities: EntitySummary[]): void {
    this.set({ entities });
  }

  setStep(step: ConvertStep): void {
    this.set({ currentStep: step });
  }

  resetConvert(): void {
    this.set({
      selectedFile: null,
      parseResult: null,
      dryRunResult: null,
      lastCommit: null,
      currentStep: "file",
    });
  }
}

export const store = new Store();
export const storeContext = createContext<Store>("knx-store");
