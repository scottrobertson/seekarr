export interface InstanceConfig {
  name: string;
  type: "sonarr" | "radarr";
  url: string;
  apiKey: string;
  searchMode: "upgrades" | "missing" | "both";
  monitoredOnly: boolean;
  searchLimit: number;
  rateLimitPerMinute: number;
  dryRun: boolean;
  searchFrequencyHours: number;
}

export interface ScheduleConfig {
  intervalMinutes: number;
}

export interface Config {
  instances: InstanceConfig[];
  schedule: ScheduleConfig;
}

export interface SearchCandidate {
  id: number;
  title: string;
  type: "missing" | "upgrade";
}
