import { ArrProvider } from "./base.js";
import type { SearchCandidate } from "../types.js";

interface SonarrSeries {
  id: number;
  title: string;
  monitored: boolean;
}

interface SonarrEpisode {
  id: number;
  title: string;
  series?: SonarrSeries;
  seasonNumber: number;
  episodeNumber: number;
  monitored: boolean;
  hasFile: boolean;
}

interface SonarrPagedResponse {
  page: number;
  pageSize: number;
  totalRecords: number;
  records: SonarrEpisode[];
}

export class SonarrProvider extends ArrProvider {
  private async fetchAllPages(endpoint: string): Promise<SonarrEpisode[]> {
    const episodes: SonarrEpisode[] = [];
    let page = 1;
    const pageSize = 50;

    while (true) {
      const monitored = this.config.monitoredOnly ? "true" : "false";
      const params = `includeSeries=true&monitored=${monitored}&page=${page}&pageSize=${pageSize}&sortKey=airDateUtc&sortDirection=descending`;
      const res = await this.api<SonarrPagedResponse>(
        `${endpoint}?${params}`
      );
      episodes.push(...res.records);

      if (episodes.length >= res.totalRecords || res.records.length < pageSize) {
        break;
      }
      page++;
    }

    return episodes;
  }

  private formatEpisode(ep: SonarrEpisode): string {
    const series = ep.series?.title ?? "Unknown";
    return `${series} - S${String(ep.seasonNumber).padStart(2, "0")}E${String(ep.episodeNumber).padStart(2, "0")}`;
  }

  private async fetchAllEpisodes(): Promise<SearchCandidate[]> {
    const candidates: SearchCandidate[] = [];
    const series = await this.api<SonarrSeries[]>("/api/v3/series");

    for (const s of series) {
      if (this.config.monitoredOnly && !s.monitored) continue;

      const episodes = await this.api<SonarrEpisode[]>(
        `/api/v3/episode?seriesId=${s.id}`
      );
      for (const ep of episodes) {
        if (this.config.monitoredOnly && !ep.monitored) continue;

        candidates.push({
          id: ep.id,
          title: this.formatEpisode({ ...ep, series: s }),
          type: ep.hasFile ? "existing" : "missing",
        });
      }
    }

    return candidates;
  }

  async getCandidates(): Promise<SearchCandidate[]> {
    const candidates: SearchCandidate[] = [];
    const { searchMode } = this.config;

    if (searchMode === "all") {
      return this.fetchAllEpisodes();
    }

    if (searchMode === "missing" || searchMode === "both") {
      const missing = await this.fetchAllPages("/api/v3/wanted/missing");
      for (const ep of missing) {
        candidates.push({
          id: ep.id,
          title: this.formatEpisode(ep),
          type: "missing",
        });
      }
    }

    if (searchMode === "upgrades" || searchMode === "both") {
      const cutoff = await this.fetchAllPages("/api/v3/wanted/cutoff");
      for (const ep of cutoff) {
        candidates.push({
          id: ep.id,
          title: this.formatEpisode(ep),
          type: "upgrade",
        });
      }
    }

    return candidates;
  }

  async search(ids: number[]): Promise<void> {
    await this.api("/api/v3/command", {
      method: "POST",
      body: JSON.stringify({ name: "EpisodeSearch", episodeIds: ids }),
    });
  }
}
