import { describe, it, expect, afterEach } from "vitest";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { stringify } from "yaml";
import { loadConfig } from "../src/config.js";

const files: string[] = [];

function writeTmp(name: string, data: Record<string, unknown>): string {
  const path = join(tmpdir(), `seekarr-test-${name}-${Date.now()}.yaml`);
  writeFileSync(path, stringify(data));
  files.push(path);
  return path;
}

const validInstance = {
  name: "sonarr-main",
  type: "sonarr",
  url: "http://localhost:8989",
  apiKey: "abc123",
};

afterEach(() => {
  for (const f of files.splice(0)) {
    try {
      unlinkSync(f);
    } catch {}
  }
});

describe("loadConfig", () => {
  it("loads a valid config and applies defaults", () => {
    const path = writeTmp("valid", { instances: [validInstance] });
    const config = loadConfig(path);

    expect(config.instances).toHaveLength(1);
    const inst = config.instances[0];
    expect(inst.name).toBe("sonarr-main");
    expect(inst.type).toBe("sonarr");
    expect(inst.url).toBe("http://localhost:8989");
    expect(inst.apiKey).toBe("abc123");
    expect(inst.searchMode).toBe("both");
    expect(inst.monitoredOnly).toBe(true);
    expect(inst.limit).toBe(10);
    expect(inst.dryRun).toBe(false);
    expect(inst.searchFrequencyHours).toBe(1);
    expect(config.schedule.intervalMinutes).toBe(60);
  });

  it("throws on missing instances array", () => {
    const path = writeTmp("no-instances", { schedule: { intervalMinutes: 30 } });
    expect(() => loadConfig(path)).toThrow("Config must contain an 'instances' array");
  });

  it("throws on empty instances array", () => {
    const path = writeTmp("empty", { instances: [] });
    expect(() => loadConfig(path)).toThrow("Config must contain at least one instance");
  });

  it("throws on missing required fields", () => {
    const { name: _, ...noName } = validInstance;
    const { type: _t, ...noType } = validInstance;
    const { url: _u, ...noUrl } = validInstance;
    const { apiKey: _k, ...noKey } = validInstance;

    const cases = [
      { field: "name", instance: noName },
      { field: "type", instance: noType },
      { field: "url", instance: noUrl },
      { field: "apiKey", instance: noKey },
    ];

    for (const { field, instance } of cases) {
      const path = writeTmp(`missing-${field}`, { instances: [instance] });
      expect(() => loadConfig(path)).toThrow(`missing '${field}'`);
    }
  });

  it("throws on invalid type", () => {
    const path = writeTmp("bad-type", {
      instances: [{ ...validInstance, type: "lidarr" }],
    });
    expect(() => loadConfig(path)).toThrow("invalid type 'lidarr'");
  });

  it("throws on invalid searchMode", () => {
    const path = writeTmp("bad-mode", {
      instances: [{ ...validInstance, searchMode: "everything" }],
    });
    expect(() => loadConfig(path)).toThrow("invalid searchMode 'everything'");
  });
});
