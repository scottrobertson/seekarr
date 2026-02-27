import { loadConfig } from "./config.js";
import { log, logError } from "./logger.js";
import { JsonSearchHistoryStore } from "./search-history.js";
import type { SearchHistoryStore } from "./search-history.js";
import { SonarrProvider } from "./providers/sonarr.js";
import { RadarrProvider } from "./providers/radarr.js";
import type { ArrProvider } from "./providers/base.js";
import type { InstanceConfig } from "./types.js";

function createSearchHistory(
  config: InstanceConfig,
  dataDir: string
): SearchHistoryStore | undefined {
  if (config.searchFrequencyHours <= 0) return undefined;
  return new JsonSearchHistoryStore(
    dataDir,
    config.name,
    config.searchFrequencyHours
  );
}

function createProvider(
  config: InstanceConfig,
  dataDir: string
): ArrProvider {
  const history = createSearchHistory(config, dataDir);
  switch (config.type) {
    case "sonarr":
      return new SonarrProvider(config, history);
    case "radarr":
      return new RadarrProvider(config, history);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runAll(providers: ArrProvider[]): Promise<void> {
  for (const provider of providers) {
    try {
      await provider.run();
    } catch (err) {
      logError("main", `Provider failed: ${err}`);
    }
  }
}

async function main(): Promise<void> {
  const configPath = process.env.CONFIG_PATH ?? "/app/config/config.yml";
  const dataDir = process.env.DATA_PATH ?? "/app/data";
  log("main", `Loading config from ${configPath}`);

  const config = loadConfig(configPath);
  log("main", `Loaded ${config.instances.length} instance(s)`);

  const providers = config.instances.map((inst) =>
    createProvider(inst, dataDir)
  );

  if (config.schedule.intervalMinutes === 0) {
    log("main", "Running once (intervalMinutes = 0)");
    await runAll(providers);
    log("main", "Done");
    return;
  }

  while (true) {
    await runAll(providers);
    log(
      "main",
      `Sleeping for ${config.schedule.intervalMinutes} minutes...`
    );
    await sleep(config.schedule.intervalMinutes * 60 * 1000);
  }
}

main().catch((err) => {
  logError("main", `Fatal: ${err}`);
  process.exit(1);
});
