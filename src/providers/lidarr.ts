import { ArrProvider } from "./base.js";
import type { SearchCandidate } from "../types.js";

interface LidarrArtist {
  id: number;
  artistName: string;
  monitored: boolean;
}

interface LidarrAlbum {
  id: number;
  title: string;
  artist?: LidarrArtist;
  artistId: number;
  monitored: boolean;
  statistics: {
    trackFileCount: number;
    trackCount: number;
  };
}

interface LidarrPagedResponse {
  page: number;
  pageSize: number;
  totalRecords: number;
  records: LidarrAlbum[];
}

export class LidarrProvider extends ArrProvider {
  private async fetchAllPages(endpoint: string): Promise<LidarrAlbum[]> {
    const albums: LidarrAlbum[] = [];
    let page = 1;
    const pageSize = 50;

    while (true) {
      const monitored = this.config.monitoredOnly ? "true" : "false";
      const params = `includeArtist=true&monitored=${monitored}&page=${page}&pageSize=${pageSize}&sortKey=releaseDate&sortDirection=descending`;
      const res = await this.api<LidarrPagedResponse>(
        `${endpoint}?${params}`
      );
      albums.push(...res.records);

      if (albums.length >= res.totalRecords || res.records.length < pageSize) {
        break;
      }
      page++;
    }

    return albums;
  }

  private formatAlbum(album: LidarrAlbum): string {
    const artist = album.artist?.artistName ?? "Unknown";
    return `${artist} - ${album.title}`;
  }

  private async fetchAllAlbums(): Promise<SearchCandidate[]> {
    const candidates: SearchCandidate[] = [];
    const artists = await this.api<LidarrArtist[]>("/api/v1/artist");

    for (const a of artists) {
      if (this.config.monitoredOnly && !a.monitored) continue;

      const albums = await this.api<LidarrAlbum[]>(
        `/api/v1/album?artistId=${a.id}`
      );
      for (const album of albums) {
        if (this.config.monitoredOnly && !album.monitored) continue;

        candidates.push({
          id: album.id,
          title: this.formatAlbum({ ...album, artist: a }),
          type: album.statistics.trackFileCount === 0 ? "missing" : "existing",
        });
      }
    }

    return candidates;
  }

  async getCandidates(): Promise<SearchCandidate[]> {
    const candidates: SearchCandidate[] = [];
    const { searchMode } = this.config;

    if (searchMode === "all") {
      return this.fetchAllAlbums();
    }

    if (searchMode === "missing" || searchMode === "both") {
      const missing = await this.fetchAllPages("/api/v1/wanted/missing");
      for (const album of missing) {
        candidates.push({
          id: album.id,
          title: this.formatAlbum(album),
          type: "missing",
        });
      }
    }

    if (searchMode === "upgrades" || searchMode === "both") {
      const cutoff = await this.fetchAllPages("/api/v1/wanted/cutoff");
      for (const album of cutoff) {
        candidates.push({
          id: album.id,
          title: this.formatAlbum(album),
          type: "upgrade",
        });
      }
    }

    return candidates;
  }

  async search(ids: number[]): Promise<void> {
    await this.api("/api/v1/command", {
      method: "POST",
      body: JSON.stringify({ name: "AlbumSearch", albumIds: ids }),
    });
  }
}
