import { describe, it, expect, vi, beforeEach } from "vitest";
import { ArrProvider } from "../../src/providers/base.js";
import type { InstanceConfig, SearchCandidate } from "../../src/types.js";
import type { SearchHistoryStore } from "../../src/search-history.js";

function makeConfig(overrides: Partial<InstanceConfig> = {}): InstanceConfig {
  return {
    name: "test-instance",
    type: "radarr",
    url: "http://localhost:7878",
    apiKey: "test-key",
    searchMode: "both",
    monitoredOnly: true,
    searchLimit: 10,
    rateLimitPerMinute: 60,
    dryRun: false,
    searchFrequencyHours: 24,
    ...overrides,
  };
}

class TestProvider extends ArrProvider {
  public candidateResult: SearchCandidate[] = [];
  public searchCalls: number[][] = [];

  async getCandidates(): Promise<SearchCandidate[]> {
    return this.candidateResult;
  }

  async search(ids: number[]): Promise<void> {
    this.searchCalls.push(ids);
  }
}

function makeHistory(recentIds: number[] = []): SearchHistoryStore {
  return {
    filterRecent: vi.fn((ids: number[]) =>
      ids.filter((id) => recentIds.includes(id))
    ),
    record: vi.fn(),
    save: vi.fn(),
  };
}

describe("ArrProvider.run()", () => {
  let provider: TestProvider;

  beforeEach(() => {
    provider = new TestProvider(makeConfig());
    // Prevent shuffle from randomizing order in tests
    vi.spyOn(Math, "random").mockReturnValue(0);
  });

  it("calls search() with candidate IDs", async () => {
    provider.candidateResult = [
      { id: 1, title: "A", type: "missing" },
      { id: 2, title: "B", type: "upgrade" },
    ];

    await provider.run();

    expect(provider.searchCalls).toHaveLength(1);
    expect(provider.searchCalls[0]).toContain(1);
    expect(provider.searchCalls[0]).toContain(2);
  });

  it("respects searchLimit (only searches up to the limit)", async () => {
    provider = new TestProvider(makeConfig({ searchLimit: 2 }));
    vi.spyOn(Math, "random").mockReturnValue(0);
    provider.candidateResult = [
      { id: 1, title: "A", type: "missing" },
      { id: 2, title: "B", type: "missing" },
      { id: 3, title: "C", type: "missing" },
      { id: 4, title: "D", type: "missing" },
    ];

    await provider.run();

    const allSearched = provider.searchCalls.flat();
    expect(allSearched).toHaveLength(2);
  });

  it("dry run mode logs but does not call search()", async () => {
    provider = new TestProvider(makeConfig({ dryRun: true }));
    provider.candidateResult = [
      { id: 1, title: "A", type: "missing" },
    ];

    await provider.run();

    expect(provider.searchCalls).toHaveLength(0);
  });

  it("skips recently searched items when search history is provided", async () => {
    const history = makeHistory([1]);
    provider = new TestProvider(makeConfig(), history);
    vi.spyOn(Math, "random").mockReturnValue(0);
    provider.candidateResult = [
      { id: 1, title: "Recently Searched", type: "missing" },
      { id: 2, title: "Not Searched", type: "missing" },
    ];

    await provider.run();

    const allSearched = provider.searchCalls.flat();
    expect(allSearched).toContain(2);
    expect(allSearched).not.toContain(1);
  });

  it("records searched IDs to history after searching", async () => {
    const history = makeHistory();
    provider = new TestProvider(makeConfig(), history);
    vi.spyOn(Math, "random").mockReturnValue(0);
    provider.candidateResult = [
      { id: 5, title: "Movie", type: "missing" },
    ];

    await provider.run();

    expect(history.record).toHaveBeenCalledWith([5]);
    expect(history.save).toHaveBeenCalled();
  });
});
