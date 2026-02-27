# Seekarr

A lightweight tool that triggers manual searches in Sonarr and Radarr to find missing items and upgrade existing ones to better quality. No UI, just a script that runs on a schedule in Docker. Configured via YAML.

## Features

- Searches for missing episodes/movies and quality upgrades
- Supports multiple Sonarr/Radarr instances
- Runs on a configurable schedule or once for external cron

## Quick Start

1. Create a `config.yml` (see [Configuration](#configuration) below)

2. Create a `docker-compose.yml`:

```yaml
services:
  seekarr:
    image: ghcr.io/scottrobertson/seekarr:latest
    volumes:
      - ./seekarr:/seekarr
    restart: unless-stopped
```

Place your `config.yml` at `./seekarr/config.yml`. Search history data will be stored in `./seekarr/data/`.

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
    limit: 10 # max items to search per run
    dryRun: false # log what would be searched without triggering searches
    searchFrequencyHours: 1 # skip items searched within this many hours

  - name: "radarr-main"
    type: "radarr"
    url: "http://radarr:7878"
    apiKey: "your-api-key"
    searchMode: "both"
    monitoredOnly: true
    limit: 15

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
| `limit`              | `10`     | Max items to search per run                          |
| `dryRun`             | `false`  | Log what would be searched without triggering searches |
| `searchFrequencyHours` | `1`   | Skip items searched within this many hours                                     |
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
2. Filters out recently searched items
3. Takes the first `limit` items
4. Sends a search command for the selected items

Errors on one instance don't affect others. If an instance is unreachable, Seekarr logs the error and moves on to the next one.

## Data Storage

Seekarr stores search history as JSON files in the data directory (one file per instance). This is how it tracks which items have been searched recently to avoid re-searching them. In Docker this is `/app/data/`, controlled by the `DATA_PATH` environment variable.
