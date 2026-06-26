"""
FastAPI Server — Zimbabwe Fire Alerts Dashboard.
"""

import os
import json
import asyncio
from typing import Optional
from fastapi import FastAPI, HTTPException, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import pandas as pd

from config import OUTPUT_DIR, BASE_DIR, load_settings, save_settings
from src.core.database import (
    get_all_alerts, get_system_messages,
    get_alert_stats_by_date, init_db
)

init_db()

app = FastAPI(title="Zimbabwe Fire Alerts API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Pipeline state ─────────────────────────────────────────────────────────
_pipeline_running = False
_pipeline_last_run: Optional[str] = None
_pipeline_last_status: str = "idle"

# ─── Helpers ────────────────────────────────────────────────────────────────

def read_geojson(filepath: str) -> dict:
    if not os.path.exists(filepath):
        return {"type": "FeatureCollection", "features": []}
    try:
        with open(filepath, "r") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
        return {"type": "FeatureCollection", "features": []}


def filter_zimbabwe(geojson: dict) -> dict:
    """Filter features to Zimbabwe bounding box."""
    ZIM = dict(lon_min=25, lon_max=34, lat_min=-23, lat_max=-15)
    features = []
    for feat in geojson.get("features", []):
        try:
            coords = feat["geometry"]["coordinates"]
            if feat["geometry"]["type"] == "Point":
                lon, lat = coords[0], coords[1]
            else:
                lon, lat = coords[0][0], coords[0][1]
            if (ZIM["lon_min"] <= lon <= ZIM["lon_max"] and
                    ZIM["lat_min"] <= lat <= ZIM["lat_max"]):
                features.append(feat)
        except Exception:
            continue
    return {"type": "FeatureCollection", "features": features}


# ─── Health ─────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health_check():
    return {"status": "ok", "pipeline_running": _pipeline_running}


# ─── Live data ──────────────────────────────────────────────────────────────

@app.get("/api/alerts")
def get_alerts():
    filepath = os.path.join(OUTPUT_DIR, "ranked_fire_alerts.csv")
    if not os.path.exists(filepath):
        return []
    try:
        df = pd.read_csv(filepath)
        df = df.where(pd.notnull(df), None)
        return df.to_dict(orient="records")
    except Exception as e:
        print(f"Error reading alerts CSV: {e}")
        return []


@app.get("/api/stats")
def get_stats():
    filepath = os.path.join(OUTPUT_DIR, "ranked_fire_alerts.csv")
    stats = {"high": 0, "medium": 0, "low": 0, "total": 0}
    if os.path.exists(filepath):
        try:
            df = pd.read_csv(filepath)
            stats["total"] = len(df)
            counts = df["risk_level"].str.lower().value_counts()
            stats["high"]   = int(counts.get("high", 0))
            stats["medium"] = int(counts.get("medium", 0))
            stats["low"]    = int(counts.get("low", 0))
        except Exception:
            pass
    return stats


# ─── GeoJSON layers ─────────────────────────────────────────────────────────

@app.get("/api/geojson/aoi")
def get_aoi():
    return read_geojson(os.path.join(BASE_DIR, "src", "aoi.geojson"))


@app.get("/api/geojson/viirs")
def get_viirs():
    return read_geojson(os.path.join(OUTPUT_DIR, "viirs_risk_alerts.geojson"))


@app.get("/api/geojson/mtg")
def get_mtg():
    return read_geojson(os.path.join(OUTPUT_DIR, "mtg_risk_alerts.geojson"))


@app.get("/api/geojson/zim/viirs")
def get_zim_viirs():
    raw = read_geojson(os.path.join(OUTPUT_DIR, "viirs_risk_alerts.geojson"))
    return filter_zimbabwe(raw)


@app.get("/api/geojson/zim/mtg")
def get_zim_mtg():
    raw = read_geojson(os.path.join(OUTPUT_DIR, "mtg_risk_alerts.geojson"))
    return filter_zimbabwe(raw)


# ─── History ────────────────────────────────────────────────────────────────

@app.get("/api/history/alerts")
def history_alerts(
    limit: int = Query(200, le=1000),
    date_from: Optional[str] = None,
    date_to:   Optional[str] = None,
    risk_level: Optional[str] = None,
):
    return get_all_alerts(limit=limit, date_from=date_from, date_to=date_to, risk_level=risk_level)


@app.get("/api/history/logs")
def history_logs(limit: int = Query(100, le=500)):
    return get_system_messages(limit=limit)


@app.get("/api/history/stats")
def history_stats():
    return get_alert_stats_by_date()


# ─── Settings ───────────────────────────────────────────────────────────────

@app.get("/api/settings")
def get_app_settings():
    return load_settings()


class SettingsPayload(BaseModel):
    MIN_CONFIDENCE: float
    LOOKBACK_HOURS: int
    POLL_INTERVAL_SECONDS: int


@app.post("/api/settings")
def update_app_settings(payload: SettingsPayload):
    data = payload.model_dump()
    save_settings(data)
    return {"status": "success", "settings": data}


# ─── Pipeline trigger ───────────────────────────────────────────────────────

@app.get("/api/pipeline/status")
def pipeline_status():
    return {
        "running": _pipeline_running,
        "last_run": _pipeline_last_run,
        "last_status": _pipeline_last_status,
    }


@app.post("/api/pipeline/run")
async def trigger_pipeline(background_tasks: BackgroundTasks):
    global _pipeline_running
    if _pipeline_running:
        return {"status": "already_running"}
    background_tasks.add_task(_run_pipeline_task)
    return {"status": "triggered"}


async def _run_pipeline_task():
    global _pipeline_running, _pipeline_last_run, _pipeline_last_status
    from datetime import datetime, timezone
    _pipeline_running = True
    _pipeline_last_status = "running"
    try:
        from main import run_pipeline
        await asyncio.get_event_loop().run_in_executor(None, run_pipeline)
        _pipeline_last_status = "success"
    except Exception as e:
        print(f"Pipeline error: {e}")
        _pipeline_last_status = f"error: {e}"
    finally:
        from datetime import datetime, timezone
        _pipeline_running = False
        _pipeline_last_run = datetime.now(timezone.utc).isoformat()
