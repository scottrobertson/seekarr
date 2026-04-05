import { describe, it, expect, vi, beforeEach } from "vitest";
import { LidarrProvider } from "../../src/providers/lidarr.js";
import type { InstanceConfig } from "../../src/types.js";
import type { SearchHistoryStore } from "../../src/search-history.js";

function makeConfig(overrides: Partial<InstanceConfig> = {}): InstanceConfig {
  return {
    name: "lidarr-test",
    type: "lidarr",
    url: "http://localhost:8686",
    apiKey: "test-key",
    searchMode: "both",
    monitoredOnly: true,
    limit: 10,
    dryRun: false,
    searchFrequencyHours: 24,
    ...overrides,
  };
}

function makeHistory(): SearchHistoryStore {
  return { filterRecent: vi.fn(() => []), record: vi.fn(), save: vi.fn() };
}

function makeAlbum(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    title: "Album Title",
    artist: { id: 1, artistName: "Artist Name", monitored: true },
    artistId: 1,
    monitored: true,
    statistics: { trackFileCount: 0, trackCount: 12 },
    ...overrides,
  };
}

describe("LidarrProvider.getCandidates()", () => {
  let provider: LidarrProvider;
  let apiSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    provider = new LidarrProvider(makeConfig(), makeHistory());
    apiSpy = vi
      .spyOn(provider as any, "api")
      .mockResolvedValue({ page: 1, pageSize: 50, totalRecords: 0, records: [] });
  });

  it("returns missing albums (no track files)", async () => {
    provider = new LidarrProvider(makeConfig({ searchMode: "missing" }), makeHistory());
    apiSpy = vi.spyOn(provider as any, "api").mockResolvedValue({
      page: 1,
      pageSize: 50,
      totalRecords: 1,
      records: [
        makeAlbum({ id: 1, title: "Missing Album", statistics: { trackFileCount: 0, trackCount: 10 } }),
      ],
    });

    const candidates = await provider.getCandidates();

    expect(candidates).toEqual([
      { id: 1, title: "Artist Name - Missing Album", type: "missing" },
    ]);
  });

  it("returns upgrade albums from cutoff endpoint", async () => {
    provider = new LidarrProvider(makeConfig({ searchMode: "upgrades" }), makeHistory());
    apiSpy = vi.spyOn(provider as any, "api").mockResolvedValue({
      page: 1,
      pageSize: 50,
      totalRecords: 1,
      records: [
        makeAlbum({ id: 2, title: "Upgrade Album" }),
      ],
    });

    const candidates = await provider.getCandidates();

    expect(candidates).toEqual([
      { id: 2, title: "Artist Name - Upgrade Album", type: "upgrade" },
    ]);
  });

  it('respects searchMode: "missing" (no upgrades returned)', async () => {
    provider = new LidarrProvider(makeConfig({ searchMode: "missing" }), makeHistory());
    apiSpy = vi.spyOn(provider as any, "api").mockResolvedValue({
      page: 1,
      pageSize: 50,
      totalRecords: 1,
      records: [
        makeAlbum({ id: 1, title: "Missing" }),
      ],
    });

    const candidates = await provider.getCandidates();

    expect(candidates).toEqual([
      { id: 1, title: "Artist Name - Missing", type: "missing" },
    ]);
    // Should only call wanted/missing, not wanted/cutoff
    expect(apiSpy).toHaveBeenCalledTimes(1);
    expect(apiSpy).toHaveBeenCalledWith(expect.stringContaining("/api/v1/wanted/missing"));
  });

  it('respects searchMode: "upgrades" (no missing returned)', async () => {
    provider = new LidarrProvider(makeConfig({ searchMode: "upgrades" }), makeHistory());
    apiSpy = vi.spyOn(provider as any, "api").mockResolvedValue({
      page: 1,
      pageSize: 50,
      totalRecords: 1,
      records: [
        makeAlbum({ id: 2, title: "Upgrade" }),
      ],
    });

    const candidates = await provider.getCandidates();

    expect(candidates).toEqual([
      { id: 2, title: "Artist Name - Upgrade", type: "upgrade" },
    ]);
    expect(apiSpy).toHaveBeenCalledTimes(1);
    expect(apiSpy).toHaveBeenCalledWith(expect.stringContaining("/api/v1/wanted/cutoff"));
  });

  it('calls both wanted endpoints when searchMode is "both"', async () => {
    apiSpy
      .mockResolvedValueOnce({
        page: 1, pageSize: 50, totalRecords: 1,
        records: [makeAlbum({ id: 1, title: "Missing Album" })],
      })
      .mockResolvedValueOnce({
        page: 1, pageSize: 50, totalRecords: 1,
        records: [makeAlbum({ id: 2, title: "Upgrade Album" })],
      });

    const candidates = await provider.getCandidates();

    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toEqual({ id: 1, title: "Artist Name - Missing Album", type: "missing" });
    expect(candidates[1]).toEqual({ id: 2, title: "Artist Name - Upgrade Album", type: "upgrade" });
    expect(apiSpy).toHaveBeenCalledTimes(2);
  });

  it("paginates when totalRecords > pageSize", async () => {
    const page1Records = Array.from({ length: 50 }, (_, i) =>
      makeAlbum({ id: i + 1, title: `Album ${i + 1}` })
    );

    const page2Records = [makeAlbum({ id: 51, title: "Album 51" })];

    provider = new LidarrProvider(makeConfig({ searchMode: "missing" }), makeHistory());
    apiSpy = vi
      .spyOn(provider as any, "api")
      .mockResolvedValueOnce({
        page: 1, pageSize: 50, totalRecords: 51, records: page1Records,
      })
      .mockResolvedValueOnce({
        page: 2, pageSize: 50, totalRecords: 51, records: page2Records,
      });

    const candidates = await provider.getCandidates();

    expect(candidates).toHaveLength(51);
    expect(apiSpy).toHaveBeenCalledTimes(2);
  });

  it('formats album title as "Unknown" when artist is missing', async () => {
    apiSpy.mockResolvedValue({
      page: 1,
      pageSize: 50,
      totalRecords: 1,
      records: [
        { id: 99, title: "Orphan Album", artistId: 1, monitored: true, statistics: { trackFileCount: 0, trackCount: 5 } },
      ],
    });

    const candidates = await provider.getCandidates();

    expect(candidates).toContainEqual({
      id: 99,
      title: "Unknown - Orphan Album",
      type: "missing",
    });
  });

  it('fetches all albums when searchMode is "all"', async () => {
    provider = new LidarrProvider(makeConfig({ searchMode: "all" }), makeHistory());
    apiSpy = vi.spyOn(provider as any, "api")
      // /api/v1/artist
      .mockResolvedValueOnce([
        { id: 1, artistName: "Radiohead", monitored: true },
      ])
      // /api/v1/album?artistId=1
      .mockResolvedValueOnce([
        { id: 10, title: "OK Computer", artistId: 1, monitored: true, statistics: { trackFileCount: 0, trackCount: 12 } },
        { id: 20, title: "Kid A", artistId: 1, monitored: true, statistics: { trackFileCount: 10, trackCount: 10 } },
      ]);

    const candidates = await provider.getCandidates();

    expect(candidates).toEqual([
      { id: 10, title: "Radiohead - OK Computer", type: "missing" },
      { id: 20, title: "Radiohead - Kid A", type: "existing" },
    ]);
    expect(apiSpy).toHaveBeenCalledTimes(2);
  });

  it('skips unmonitored artists in "all" mode when monitoredOnly is true', async () => {
    provider = new LidarrProvider(makeConfig({ searchMode: "all" }), makeHistory());
    apiSpy = vi.spyOn(provider as any, "api")
      .mockResolvedValueOnce([
        { id: 1, artistName: "Monitored", monitored: true },
        { id: 2, artistName: "Unmonitored", monitored: false },
      ])
      .mockResolvedValueOnce([
        { id: 10, title: "Album", artistId: 1, monitored: true, statistics: { trackFileCount: 0, trackCount: 5 } },
      ]);

    const candidates = await provider.getCandidates();

    expect(candidates).toHaveLength(1);
    expect(candidates[0].title).toBe("Monitored - Album");
    // Should only fetch albums for the monitored artist
    expect(apiSpy).toHaveBeenCalledTimes(2);
  });

  it('skips unmonitored albums in "all" mode when monitoredOnly is true', async () => {
    provider = new LidarrProvider(makeConfig({ searchMode: "all" }), makeHistory());
    apiSpy = vi.spyOn(provider as any, "api")
      .mockResolvedValueOnce([
        { id: 1, artistName: "Artist", monitored: true },
      ])
      .mockResolvedValueOnce([
        { id: 10, title: "Monitored Album", artistId: 1, monitored: true, statistics: { trackFileCount: 0, trackCount: 5 } },
        { id: 11, title: "Unmonitored Album", artistId: 1, monitored: false, statistics: { trackFileCount: 0, trackCount: 5 } },
      ]);

    const candidates = await provider.getCandidates();

    expect(candidates).toHaveLength(1);
    expect(candidates[0].title).toBe("Artist - Monitored Album");
  });

  it("includes unmonitored when monitoredOnly is false in all mode", async () => {
    provider = new LidarrProvider(makeConfig({ searchMode: "all", monitoredOnly: false }), makeHistory());
    apiSpy = vi.spyOn(provider as any, "api")
      .mockResolvedValueOnce([
        { id: 1, artistName: "Artist", monitored: true },
        { id: 2, artistName: "Unmonitored Artist", monitored: false },
      ])
      .mockResolvedValueOnce([
        { id: 10, title: "Album 1", artistId: 1, monitored: true, statistics: { trackFileCount: 0, trackCount: 5 } },
      ])
      .mockResolvedValueOnce([
        { id: 20, title: "Album 2", artistId: 2, monitored: false, statistics: { trackFileCount: 3, trackCount: 5 } },
      ]);

    const candidates = await provider.getCandidates();

    expect(candidates).toHaveLength(2);
  });
});

describe("LidarrProvider.search()", () => {
  it("sends AlbumSearch command with album IDs", async () => {
    const provider = new LidarrProvider(makeConfig(), makeHistory());
    const apiSpy = vi.spyOn(provider as any, "api").mockResolvedValue({});

    await provider.search([1, 2, 3]);

    expect(apiSpy).toHaveBeenCalledWith("/api/v1/command", {
      method: "POST",
      body: JSON.stringify({ name: "AlbumSearch", albumIds: [1, 2, 3] }),
    });
  });
});
