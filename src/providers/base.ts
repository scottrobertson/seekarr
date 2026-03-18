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
    log(this.name, `${prefix}Starting search (mode: ${this.config.searchMode}, limit: ${this.config.limit})`);

    let candidates: SearchCandidate[];
    try {
      candidates = await this.getCandidates();
    } catch (err) {
      logError(this.name, `Failed to fetch candidates: ${err}`);
      return;
    }

    const totalCandidates = candidates.length;

    const recentIds = this.searchHistory.filterRecent(
      candidates.map((c) => c.id)
    );
    candidates = candidates.filter((c) => !recentIds.includes(c.id));

    log(this.name, `Found ${totalCandidates} candidates, ${recentIds.length} recently searched, ${candidates.length} eligible`);

    if (candidates.length === 0) {
      log(this.name, "No candidates remaining");
      return;
    }

    // Shuffle candidates so every item gets a fair chance of being searched
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    const selected = candidates.slice(0, this.config.limit);
    log(this.name, `Randomly selected ${selected.length} of ${candidates.length} eligible candidates`);
    for (const item of selected) {
      log(this.name, `${prefix}  [${item.type}] ${item.title}`);
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
