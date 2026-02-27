import { ArrProvider } from "./base.js";
import type { SearchCandidate } from "../types.js";

interface RadarrMovie {
  id: number;
  title: string;
  monitored: boolean;
  hasFile: boolean;
  movieFile?: {
    qualityCutoffNotMet: boolean;
  };
}

export class RadarrProvider extends ArrProvider {
  async getCandidates(): Promise<SearchCandidate[]> {
    const movies = await this.api<RadarrMovie[]>("/api/v3/movie");
    const candidates: SearchCandidate[] = [];
    const { searchMode, monitoredOnly } = this.config;

    for (const movie of movies) {
      if (monitoredOnly && !movie.monitored) continue;

      if (
        (searchMode === "missing" || searchMode === "both") &&
        !movie.hasFile
      ) {
        candidates.push({ id: movie.id, title: movie.title, type: "missing" });
        continue;
      }

      if (
        (searchMode === "upgrades" || searchMode === "both") &&
        movie.hasFile &&
        movie.movieFile?.qualityCutoffNotMet
      ) {
        candidates.push({
          id: movie.id,
          title: movie.title,
          type: "upgrade",
        });
      }
    }

    return candidates;
  }

  async search(ids: number[]): Promise<void> {
    await this.api("/api/v3/command", {
      method: "POST",
      body: JSON.stringify({ name: "MoviesSearch", movieIds: ids }),
    });
  }
}
