# Upgradarr

A lightweight tool that triggers manual searches in Sonarr and Radarr to find missing items and upgrade existing ones to better quality. No UI, just a script that runs on a schedule in Docker. Configured via YAML.

## Features

- Searches for missing episodes/movies and quality upgrades
- Supports multiple Sonarr/Radarr instances
- Rate limited to avoid hammering your indexers
- Randomizes search order so different items get picked up across runs
- Runs on a configurable schedule or once for external cron

## Quick Start

1. Create a `config.yml` (see [Configuration](#configuration) below)

2. Create a `docker-compose.yml`:

```yaml
services:
  upgradarr:
    image: ghcr.io/scottrobertson/upgradarr:latest
    volumes:
      - ./upgradarr:/app
    restart: unless-stopped
```

Place your `config.yml` at `./upgradarr/config/config.yml`. Search history data will be stored in `./upgradarr/data/`.

3. Start it:

```bash
docker compose up -d
```

## Configuration

```yaml
instances:
  - name: "sonarr-main"
    type: "sonarr"
    url: "http://sonarr:8989"
    apiKey: "your-api-key"
    searchMode: "both" # "upgrades" | "missing" | "both"
    monitoredOnly: true # only search monitored items
    searchLimit: 10 # max items to search per run
    rateLimitPerMinute: 5 # max search commands per minute
    dryRun: false # log what would be searched without triggering searches
    searchFrequencyHours: 24 # skip items searched within this many hours (0 = disabled)

  - name: "radarr-main"
    type: "radarr"
    url: "http://radarr:7878"
    apiKey: "your-api-key"
    searchMode: "both"
    monitoredOnly: true
    searchLimit: 15
    rateLimitPerMinute: 5

schedule:
  intervalMinutes: 60 # 0 = run once and exit (for external cron)
```

| Option               | Default  | Description                                          |
| -------------------- | -------- | ---------------------------------------------------- |
| `name`               | required | Label used in logs                                   |
| `type`               | required | `sonarr` or `radarr`                                 |
| `url`                | required | Base URL of the instance                             |
| `apiKey`             | required | API key from Settings > General                      |
| `searchMode`         | `both`   | What to search for: `missing`, `upgrades`, or `both` |
| `monitoredOnly`      | `true`   | Only search monitored items                          |
| `searchLimit`        | `10`     | Max items to search per run                          |
| `rateLimitPerMinute` | `5`      | Max search commands sent per minute                  |
| `dryRun`             | `false`  | Log what would be searched without triggering searches |
| `searchFrequencyHours` | `0`   | Skip items searched within this many hours. `0` disables (searches every run). |
| `intervalMinutes`    | `60`     | Minutes between runs. `0` runs once and exits.       |

## Running Without Docker

Requires Node.js 22+.

```bash
npm install
npm run build
CONFIG_PATH=./config.yml DATA_PATH=./data npm start
```

For development:

```bash
CONFIG_PATH=./config.yml DATA_PATH=./data npm run dev
```

## How It Works

Each run, per instance:

1. Fetches candidates from the API (missing items, quality upgrades, or both)
2. Shuffles the list randomly
3. Takes the first `searchLimit` items
4. Sends search commands in batches, respecting `rateLimitPerMinute`

Shuffling matters. The APIs return items in a consistent order, so without it the same items would be searched every run. Randomizing ensures everything gets a chance over time.

Errors on one instance don't affect others. If an instance is unreachable, Upgradarr logs the error and moves on to the next one.

## Data Storage

When `searchFrequencyHours` is enabled, Upgradarr stores search history as JSON files in the data directory (one file per instance). In Docker this is `/app/data/`, controlled by the `DATA_PATH` environment variable.
