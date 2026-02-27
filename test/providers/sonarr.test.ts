import { describe, it, expect, vi, beforeEach } from "vitest";
import { SonarrProvider } from "../../src/providers/sonarr.js";
import type { InstanceConfig } from "../../src/types.js";

function makeConfig(overrides: Partial<InstanceConfig> = {}): InstanceConfig {
  return {
    name: "sonarr-test",
    type: "sonarr",
    url: "http://localhost:8989",
    apiKey: "test-key",
    searchMode: "both",
    monitoredOnly: true,
    limit: 10,
    dryRun: false,
    searchFrequencyHours: 24,
    ...overrides,
  };
}

describe("SonarrProvider.getCandidates()", () => {
  let provider: SonarrProvider;
  let apiSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    provider = new SonarrProvider(makeConfig());
    apiSpy = vi
      .spyOn(provider as any, "api")
      .mockResolvedValue({ page: 1, pageSize: 50, totalRecords: 0, records: [] });
  });

  it("returns missing episodes with formatted titles", async () => {
    apiSpy.mockResolvedValue({
      page: 1,
      pageSize: 50,
      totalRecords: 1,
      records: [
        {
          id: 10,
          title: "Pilot",
          series: { title: "Breaking Bad" },
          seasonNumber: 1,
          episodeNumber: 2,
        },
      ],
    });

    const candidates = await provider.getCandidates();

    expect(candidates).toContainEqual({
      id: 10,
      title: "Breaking Bad - S01E02",
      type: "missing",
    });
  });

  it("returns upgrade episodes from cutoff endpoint", async () => {
    provider = new SonarrProvider(makeConfig({ searchMode: "upgrades" }));
    apiSpy = vi.spyOn(provider as any, "api").mockResolvedValue({
      page: 1,
      pageSize: 50,
      totalRecords: 1,
      records: [
        {
          id: 20,
          title: "Cutoff Ep",
          series: { title: "The Wire" },
          seasonNumber: 3,
          episodeNumber: 12,
        },
      ],
    });

    const candidates = await provider.getCandidates();

    expect(candidates).toEqual([
      { id: 20, title: "The Wire - S03E12", type: "upgrade" },
    ]);
  });

  it("paginates when totalRecords > pageSize", async () => {
    const page1Records = Array.from({ length: 50 }, (_, i) => ({
      id: i + 1,
      title: `Ep ${i + 1}`,
      series: { title: "Show" },
      seasonNumber: 1,
      episodeNumber: i + 1,
    }));

    const page2Records = [
      {
        id: 51,
        title: "Ep 51",
        series: { title: "Show" },
        seasonNumber: 2,
        episodeNumber: 1,
      },
    ];

    provider = new SonarrProvider(makeConfig({ searchMode: "missing" }));
    apiSpy = vi
      .spyOn(provider as any, "api")
      .mockResolvedValueOnce({
        page: 1,
        pageSize: 50,
        totalRecords: 51,
        records: page1Records,
      })
      .mockResolvedValueOnce({
        page: 2,
        pageSize: 50,
        totalRecords: 51,
        records: page2Records,
      });

    const candidates = await provider.getCandidates();

    expect(candidates).toHaveLength(51);
    expect(apiSpy).toHaveBeenCalledTimes(2);
  });

  it('formats episode title as "Unknown" when series is missing', async () => {
    apiSpy.mockResolvedValue({
      page: 1,
      pageSize: 50,
      totalRecords: 1,
      records: [
        {
          id: 99,
          title: "Orphan",
          seasonNumber: 5,
          episodeNumber: 10,
        },
      ],
    });

    const candidates = await provider.getCandidates();

    expect(candidates).toContainEqual({
      id: 99,
      title: "Unknown - S05E10",
      type: "missing",
    });
  });
});
