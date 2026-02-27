import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { JsonSearchHistoryStore } from "../src/search-history.js";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "seekarr-history-"));
  vi.useRealTimers();
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("JsonSearchHistoryStore", () => {
  it("starts empty when no file exists", () => {
    const store = new JsonSearchHistoryStore(tempDir, "test", 24);
    const recent = store.filterRecent([1, 2, 3]);
    expect(recent).toEqual([]);
  });

  it("record() + filterRecent() returns recently recorded IDs", () => {
    const store = new JsonSearchHistoryStore(tempDir, "test", 24);
    store.record([10, 20]);
    const recent = store.filterRecent([10, 20, 30]);
    expect(recent).toEqual([10, 20]);
  });

  it("filterRecent() does not return IDs older than the frequency window", () => {
    vi.useFakeTimers();

    const now = new Date("2026-01-15T12:00:00Z");
    vi.setSystemTime(now);

    const store = new JsonSearchHistoryStore(tempDir, "test", 1); // 1 hour window
    store.record([10]);

    // Advance past the 1-hour window
    vi.setSystemTime(new Date("2026-01-15T13:00:01Z"));

    const recent = store.filterRecent([10]);
    expect(recent).toEqual([]);
  });

  it("save() writes to disk and a new instance loads it back", () => {
    const store = new JsonSearchHistoryStore(tempDir, "test", 24);
    store.record([1, 2, 3]);
    store.save();

    const store2 = new JsonSearchHistoryStore(tempDir, "test", 24);
    const recent = store2.filterRecent([1, 2, 3, 4]);
    expect(recent).toEqual([1, 2, 3]);
  });

  it("save() prunes old entries", () => {
    vi.useFakeTimers();

    const now = new Date("2026-01-15T12:00:00Z");
    vi.setSystemTime(now);

    const store = new JsonSearchHistoryStore(tempDir, "test", 1);
    store.record([1]);

    // Advance past window, record a new ID
    vi.setSystemTime(new Date("2026-01-15T13:00:01Z"));
    store.record([2]);
    store.save();

    // Load fresh: ID 1 should have been pruned, ID 2 should remain
    const store2 = new JsonSearchHistoryStore(tempDir, "test", 1);
    expect(store2.filterRecent([1])).toEqual([]);
    expect(store2.filterRecent([2])).toEqual([2]);
  });
});
