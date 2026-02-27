import { describe, it, expect, vi, beforeEach } from "vitest";
import { RadarrProvider } from "../../src/providers/radarr.js";
import type { InstanceConfig } from "../../src/types.js";

function makeConfig(overrides: Partial<InstanceConfig> = {}): InstanceConfig {
  return {
    name: "radarr-test",
    type: "radarr",
    url: "http://localhost:7878",
    apiKey: "test-key",
    searchMode: "both",
    monitoredOnly: true,
    limit: 10,
    dryRun: false,
    searchFrequencyHours: 24,
    ...overrides,
  };
}

describe("RadarrProvider.getCandidates()", () => {
  let provider: RadarrProvider;
  let apiSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    provider = new RadarrProvider(makeConfig());
    apiSpy = vi
      .spyOn(provider as any, "api")
      .mockResolvedValue([]);
  });

  it("returns missing movies (no file, monitored)", async () => {
    apiSpy.mockResolvedValue([
      { id: 1, title: "Missing Movie", monitored: true, hasFile: false },
    ]);

    const candidates = await provider.getCandidates();

    expect(candidates).toEqual([
      { id: 1, title: "Missing Movie", type: "missing" },
    ]);
  });

  it("returns upgrade movies (has file, cutoff not met)", async () => {
    apiSpy.mockResolvedValue([
      {
        id: 2,
        title: "Upgrade Movie",
        monitored: true,
        hasFile: true,
        movieFile: { qualityCutoffNotMet: true },
      },
    ]);

    const candidates = await provider.getCandidates();

    expect(candidates).toEqual([
      { id: 2, title: "Upgrade Movie", type: "upgrade" },
    ]);
  });

  it('respects searchMode: "missing" (no upgrades returned)', async () => {
    provider = new RadarrProvider(makeConfig({ searchMode: "missing" }));
    apiSpy = vi.spyOn(provider as any, "api").mockResolvedValue([
      { id: 1, title: "Missing", monitored: true, hasFile: false },
      {
        id: 2,
        title: "Upgrade",
        monitored: true,
        hasFile: true,
        movieFile: { qualityCutoffNotMet: true },
      },
    ]);

    const candidates = await provider.getCandidates();

    expect(candidates).toEqual([
      { id: 1, title: "Missing", type: "missing" },
    ]);
  });

  it('respects searchMode: "upgrades" (no missing returned)', async () => {
    provider = new RadarrProvider(makeConfig({ searchMode: "upgrades" }));
    apiSpy = vi.spyOn(provider as any, "api").mockResolvedValue([
      { id: 1, title: "Missing", monitored: true, hasFile: false },
      {
        id: 2,
        title: "Upgrade",
        monitored: true,
        hasFile: true,
        movieFile: { qualityCutoffNotMet: true },
      },
    ]);

    const candidates = await provider.getCandidates();

    expect(candidates).toEqual([
      { id: 2, title: "Upgrade", type: "upgrade" },
    ]);
  });

  it("filters out unmonitored movies when monitoredOnly: true", async () => {
    apiSpy.mockResolvedValue([
      { id: 1, title: "Monitored", monitored: true, hasFile: false },
      { id: 2, title: "Unmonitored", monitored: false, hasFile: false },
    ]);

    const candidates = await provider.getCandidates();

    expect(candidates).toEqual([
      { id: 1, title: "Monitored", type: "missing" },
    ]);
  });

  it("includes unmonitored movies when monitoredOnly: false", async () => {
    provider = new RadarrProvider(makeConfig({ monitoredOnly: false }));
    apiSpy = vi.spyOn(provider as any, "api").mockResolvedValue([
      { id: 1, title: "Monitored", monitored: true, hasFile: false },
      { id: 2, title: "Unmonitored", monitored: false, hasFile: false },
    ]);

    const candidates = await provider.getCandidates();

    expect(candidates).toEqual([
      { id: 1, title: "Monitored", type: "missing" },
      { id: 2, title: "Unmonitored", type: "missing" },
    ]);
  });
});
