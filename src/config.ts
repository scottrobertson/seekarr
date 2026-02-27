import { readFileSync } from "fs";
import { parse } from "yaml";
import type { Config, InstanceConfig } from "./types.js";

const INSTANCE_DEFAULTS: Partial<InstanceConfig> = {
  searchMode: "both",
  monitoredOnly: true,
  searchLimit: 10,
  rateLimitPerMinute: 5,
  dryRun: false,
  searchFrequencyHours: 0,
};

export function loadConfig(path: string): Config {
  const raw = readFileSync(path, "utf-8");
  const parsed = parse(raw);

  if (!parsed?.instances || !Array.isArray(parsed.instances)) {
    throw new Error("Config must contain an 'instances' array");
  }

  if (parsed.instances.length === 0) {
    throw new Error("Config must contain at least one instance");
  }

  const instances: InstanceConfig[] = parsed.instances.map(
    (inst: Record<string, unknown>, i: number) => {
      if (!inst.name) throw new Error(`Instance ${i} missing 'name'`);
      if (!inst.type) throw new Error(`Instance ${i} missing 'type'`);
      if (!inst.url) throw new Error(`Instance ${i} missing 'url'`);
      if (!inst.apiKey) throw new Error(`Instance ${i} missing 'apiKey'`);

      if (inst.type !== "sonarr" && inst.type !== "radarr") {
        throw new Error(
          `Instance ${i} has invalid type '${inst.type}', must be 'sonarr' or 'radarr'`
        );
      }

      if (
        inst.searchMode &&
        !["upgrades", "missing", "both"].includes(inst.searchMode as string)
      ) {
        throw new Error(
          `Instance ${i} has invalid searchMode '${inst.searchMode}'`
        );
      }

      return { ...INSTANCE_DEFAULTS, ...inst } as InstanceConfig;
    }
  );

  const schedule = {
    intervalMinutes: parsed.schedule?.intervalMinutes ?? 60,
  };

  return { instances, schedule };
}
