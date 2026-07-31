# Seekarr

A lightweight tool that triggers manual searches in Sonarr, Radarr, and Lidarr to find missing items and upgrade existing ones to better quality. No UI, just a script that runs on a schedule in Docker. Configured via YAML.

## Features

- Searches for missing episodes/movies/albums, quality upgrades, or your entire library
- Randomises candidate selection so every item gets a fair chance across runs
- Supports multiple Sonarr/Radarr/Lidarr instances
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
    healthcheck:
      test: pgrep node
      interval: 5m00s
      timeout: 10s
      retries: 2
      start_period: 10s
```

Place your `config.yml` at `./seekarr/config.yml`. Search history data will be stored in `./seekarr/data/`. You have to set user owner and group as userID `1000`, execute if it is created under different user: `chown -R 1000:1000 ./seekarr`.

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
    searchMode: "both" # "upgrades" | "missing" | "both" | "all"
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

  - name: "lidarr-main"
    type: "lidarr"
    url: "http://lidarr:8686"
    apiKey: "your-api-key"
    searchMode: "both"
    monitoredOnly: true
    limit: 10

schedule:
  intervalMinutes: 60 # 0 = run once and exit (for external cron)
```

| Option               | Default  | Description                                          |
| -------------------- | -------- | ---------------------------------------------------- |
| `name`               | required | Label used in logs                                   |
| `type`               | required | `sonarr`, `radarr`, or `lidarr`                      |
| `url`                | required | Base URL of the instance                             |
| `apiKey`             | required | API key from Settings > General                      |
| `searchMode`         | `both`   | What to search for: `missing`, `upgrades`, `both`, or `all` |
| `monitoredOnly`      | `true`   | Only search monitored items                          |
| `limit`              | `10`     | Max items to search per run                          |
| `dryRun`             | `false`  | Log what would be searched without triggering searches |
| `searchFrequencyHours` | `1`   | Skip items searched within this many hours                                     |
| `intervalMinutes`    | `60`     | Minutes between runs. `0` runs once and exits.       |

### Search Modes

- **`missing`** searches for episodes/movies/albums that don't have a file yet.
- **`upgrades`** searches for items where the quality cutoff has not been met.
- **`both`** combines missing and upgrades.
- **`all`** searches every episode/movie/album regardless of status. This is useful when you use custom formats with scores, as better releases may be available even when the quality cutoff has already been met. Sonarr, Radarr, and Lidarr will only grab a new file if it scores higher than the existing one, so this is safe to run periodically.


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

1. Fetches candidates from the API based on the configured search mode
2. Filters out recently searched items
3. Randomly selects up to `limit` items from the remaining candidates
4. Sends a search command for the selected items

Errors on one instance don't affect others. If an instance is unreachable, Seekarr logs the error and moves on to the next one.

## Data Storage

Seekarr stores search history as JSON files in the data directory (one file per instance). This is how it tracks which items have been searched recently to avoid re-searching them. In Docker this is `/app/data/`, controlled by the `DATA_PATH` environment variable.
