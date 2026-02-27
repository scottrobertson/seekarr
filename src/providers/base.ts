import type { InstanceConfig, SearchCandidate } from "../types.js";
import { RateLimiter } from "../rate-limiter.js";
import { log, logError } from "../logger.js";

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export abstract class ArrProvider {
  protected config: InstanceConfig;
  private rateLimiter: RateLimiter;

  constructor(config: InstanceConfig) {
    this.config = config;
    this.rateLimiter = new RateLimiter(config.rateLimitPerMinute);
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

    const selected = shuffle(candidates).slice(0, this.config.searchLimit);
    const missing = selected.filter((c) => c.type === "missing");
    const upgrades = selected.filter((c) => c.type === "upgrade");

    if (missing.length > 0) {
      log(this.name, `${prefix}Would search ${missing.length} missing items`);
      for (const item of missing) {
        log(this.name, `${prefix}  [missing] ${item.title}`);
      }
    }
    if (upgrades.length > 0) {
      log(this.name, `${prefix}Would search ${upgrades.length} upgrade items`);
      for (const item of upgrades) {
        log(this.name, `${prefix}  [upgrade] ${item.title}`);
      }
    }

    if (this.config.dryRun) {
      return;
    }

    const batchSize = 5;
    for (let i = 0; i < selected.length; i += batchSize) {
      const batch = selected.slice(i, i + batchSize);
      await this.rateLimiter.wait();
      try {
        await this.search(batch.map((c) => c.id));
      } catch (err) {
        logError(this.name, `Search command failed: ${err}`);
      }
    }

    log(this.name, "Run complete");
  }
}
