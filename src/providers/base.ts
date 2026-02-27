import type { InstanceConfig, SearchCandidate } from "../types.js";
import type { SearchHistoryStore } from "../search-history.js";
import { log, logError } from "../logger.js";

export abstract class ArrProvider {
  protected config: InstanceConfig;
  private searchHistory: SearchHistoryStore;

  constructor(config: InstanceConfig, searchHistory: SearchHistoryStore) {
    this.config = config;
    this.searchHistory = searchHistory;
  }

  protected get name(): string {
    return this.config.name;
  }

  protected async api<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.config.url.replace(/\/+$/, "")}${endpoint}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        "X-Api-Key": this.config.apiKey,
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!res.ok) {
      throw new Error(`${res.status} ${res.statusText} from ${endpoint}`);
    }

    return res.json() as Promise<T>;
  }

  abstract getCandidates(): Promise<SearchCandidate[]>;
  abstract search(ids: number[]): Promise<void>;

  async run(): Promise<void> {
    const prefix = this.config.dryRun ? "[DRY RUN] " : "";
    log(this.name, `${prefix}Starting search (mode: ${this.config.searchMode})`);

    let candidates: SearchCandidate[];
    try {
      candidates = await this.getCandidates();
    } catch (err) {
      logError(this.name, `Failed to fetch candidates: ${err}`);
      return;
    }

    if (candidates.length === 0) {
      log(this.name, "No candidates found");
      return;
    }

    log(this.name, `Found ${candidates.length} candidates`);

    const recentIds = this.searchHistory.filterRecent(
      candidates.map((c) => c.id)
    );
    const before = candidates.length;
    candidates = candidates.filter((c) => !recentIds.includes(c.id));
    const skipped = before - candidates.length;
    if (skipped > 0) {
      log(
        this.name,
        `Skipped ${skipped} recently searched (within ${this.config.searchFrequencyHours}h)`
      );
    }
    if (candidates.length === 0) {
      log(this.name, "No candidates remaining after filtering");
      return;
    }

    const selected = candidates.slice(0, this.config.limit);
    const missing = selected.filter((c) => c.type === "missing");
    const upgrades = selected.filter((c) => c.type === "upgrade");

    const verb = this.config.dryRun ? "Would search" : "Searching";
    if (missing.length > 0) {
      log(this.name, `${prefix}${verb} ${missing.length} missing items`);
      for (const item of missing) {
        log(this.name, `${prefix}  [missing] ${item.title}`);
      }
    }
    if (upgrades.length > 0) {
      log(this.name, `${prefix}${verb} ${upgrades.length} upgrade items`);
      for (const item of upgrades) {
        log(this.name, `${prefix}  [upgrade] ${item.title}`);
      }
    }

    if (this.config.dryRun) {
      return;
    }

    try {
      await this.search(selected.map((c) => c.id));
    } catch (err) {
      logError(this.name, `Search command failed: ${err}`);
    }

    this.searchHistory.record(selected.map((c) => c.id));
    this.searchHistory.save();

    log(this.name, "Run complete");
  }
}
