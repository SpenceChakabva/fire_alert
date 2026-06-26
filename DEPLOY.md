# Fire Alerts — Portainer Deployment Guide

## Pre-requisites
- Docker host with Portainer running
- Ports **8000** (backend API) and **3000** (frontend) open on the host firewall

---

## 1. Upload the project

Copy the project folder to your Docker host, e.g.:
```bash
scp -r Fire_Alerts_deploy/ user@your-server:/opt/stacks/fire-alerts
```

---

## 2. Set environment variables

**Option A — Edit `.env` directly on the server**

Copy `.env.example` to `.env` and fill in your credentials:
```bash
cp .env.example .env
nano .env
```

Set `NEXT_PUBLIC_API_URL` to the public IP/hostname of your server:
```
NEXT_PUBLIC_API_URL=http://192.168.1.100:8000
```

**Option B — Portainer Stack environment variables**

In Portainer → Stacks → Add Stack, paste `docker-compose.yml` and add each variable from `.env.example` in the **Environment variables** section. This avoids storing secrets in files on disk.

---

## 3. Deploy via Portainer

### Using the UI
1. Portainer → **Stacks** → **+ Add stack**
2. Name: `fire-alerts`
3. Build method: **Upload** → upload `docker-compose.yml`
4. Add environment variables (if using Option B above)
5. Click **Deploy the stack**

### Using the CLI
```bash
cd /opt/stacks/fire-alerts
docker compose up -d --build
```

---

## 4. First-run note — database

The `alerts.db` SQLite file is initialised automatically on first start by `init_db()`. It persists in the `fire_db` named Docker volume across restarts and redeployments. Do **not** bind-mount the old `src/alerts.db` file — the volume takes precedence.

---

## 5. Verify

| Service  | URL |
|----------|-----|
| API health | `http://YOUR_SERVER:8000/api/health` |
| API docs   | `http://YOUR_SERVER:8000/docs` |
| Dashboard  | `http://YOUR_SERVER:3000` |

---

## 6. Updating

```bash
docker compose pull   # if using pre-built images
docker compose up -d --build   # rebuild from source
```

Named volumes (`fire_output`, `fire_db`) are preserved across rebuilds.

---

## Architecture

```
[pipeline]  ──┐
               ├── fire_output volume (/app/output)
[backend]   ──┤── fire_db volume (/app/src)
               │
[frontend]  ───── calls backend on NEXT_PUBLIC_API_URL:8000
```

- **backend** — FastAPI serving the REST API (port 8000)
- **pipeline** — polling loop fetching EUMETSAT/VIIRS data every 15 min, writing GeoJSON + CSV to the shared volume; waits for backend to be healthy before starting
- **frontend** — Next.js dashboard (port 3000), API URL baked in at build time via `NEXT_PUBLIC_API_URL`
