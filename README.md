# The Cookie Man Text Bot

A Node.js project set up to run in Docker.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine + Docker Compose)

## Quick start (container)

Build and run the app in a container:

```bash
docker compose up --build
```

Visit [http://localhost:3000](http://localhost:3000). Health check: [http://localhost:3000/health](http://localhost:3000/health).

Stop with `Ctrl+C`, or run detached with `docker compose up -d --build` and stop with `docker compose down`.

## Local development (without Docker)

```bash
npm install
npm run dev
```

`npm run dev` uses Node's built-in `--watch` flag to restart on file changes.

## Environment configuration

Copy `.env.example` to `.env` and fill in real values — `.env` is gitignored
and must never be committed:

```bash
cp .env.example .env
```

`npm start` / `npm run dev` load `.env` automatically via Node's
`--env-file-if-exists` flag (no `dotenv` dependency needed).

- `OPENAI_API_KEY` — if set, the app uses the real OpenAI provider. If unset,
  it falls back to a stub AI provider outside of production (with a console
  warning) and refuses to start in production (`NODE_ENV=production`).
- `OPENAI_MODEL`, `PORT`, `HOST` — optional overrides; see `.env.example`
  for defaults.

## How the container setup works

### `Dockerfile`

1. Starts from `node:22-alpine` (small Linux image with Node 22).
2. Copies `package.json` and installs dependencies with `npm ci`.
3. Copies application source into `/app`.
4. Runs as the non-root `node` user.
5. Exposes port 3000 and starts the app with `npm start`.

### `docker-compose.yml`

Compose is a convenience layer on top of Docker:

- **build** — builds the image from the `Dockerfile`.
- **ports** — maps host `3000` → container `3000`.
- **volumes** — mounts `./src` into the container so code changes apply without rebuilding (dev workflow).
- **command** — overrides the Dockerfile CMD to use `npm run dev` for auto-restart on changes.

### Production vs development

For production, build and run the image directly (no volume mount, no watch):

```bash
docker build -t cookie-man-text-bot .
docker run -p 3000:3000 cookie-man-text-bot
```

## Project structure

```
.
├── Dockerfile
├── docker-compose.yml
├── package.json
└── src/
    └── index.js
```
