import { loadConfig } from "./config.js";
import { log, logError } from "./logger.js";
import { SonarrProvider } from "./providers/sonarr.js";
import { RadarrProvider } from "./providers/radarr.js";
import type { ArrProvider } from "./providers/base.js";
import type { InstanceConfig } from "./types.js";

function createProvider(config: InstanceConfig): ArrProvider {
  switch (config.type) {
    case "sonarr":
      return new SonarrProvider(config);
    case "radarr":
      return new RadarrProvider(config);
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
  const configPath = process.env.CONFIG_PATH ?? "/config/config.yml";
  log("main", `Loading config from ${configPath}`);

  const config = loadConfig(configPath);
  log("main", `Loaded ${config.instances.length} instance(s)`);

  const providers = config.instances.map(createProvider);

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
