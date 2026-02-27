import { readFileSync, writeFileSync, mkdirSync, renameSync } from "fs";
import { join, dirname } from "path";

export interface SearchHistoryStore {
  filterRecent(ids: number[]): number[];
  record(ids: number[]): void;
  save(): void;
}

interface FileData {
  searchHistory: Record<string, number>;
}

export class JsonSearchHistoryStore implements SearchHistoryStore {
  private filePath: string;
  private searchHistory: Record<string, number>;
  private maxAgeMs: number;

  constructor(dataDir: string, instanceName: string, frequencyHours: number) {
    mkdirSync(dataDir, { recursive: true });
    this.filePath = join(dataDir, `${instanceName}.json`);
    this.maxAgeMs = frequencyHours * 60 * 60 * 1000;
    this.searchHistory = this.load();
  }

  private load(): Record<string, number> {
    try {
      const raw = readFileSync(this.filePath, "utf-8");
      const parsed = JSON.parse(raw) as FileData;
      return parsed.searchHistory;
    } catch {
      return {};
    }
  }

  filterRecent(ids: number[]): number[] {
    const cutoff = Date.now() - this.maxAgeMs;
    return ids.filter((id) => {
      const lastSearched = this.searchHistory[String(id)];
      return lastSearched !== undefined && lastSearched > cutoff;
    });
  }

  record(ids: number[]): void {
    const now = Date.now();
    for (const id of ids) {
      this.searchHistory[String(id)] = now;
    }
  }

  save(): void {
    const cutoff = Date.now() - this.maxAgeMs;
    const pruned: Record<string, number> = {};
    for (const [id, ts] of Object.entries(this.searchHistory)) {
      if (ts > cutoff) {
        pruned[id] = ts;
      }
    }
    this.searchHistory = pruned;

    const fileData: FileData = { searchHistory: this.searchHistory };
    const tmp = this.filePath + ".tmp";
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(tmp, JSON.stringify(fileData, null, 2));
    renameSync(tmp, this.filePath);
  }
}
