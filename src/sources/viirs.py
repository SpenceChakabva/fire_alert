"""
NASA FIRMS VIIRS data source.
Fetches near-real-time fire hotspot data from the FIRMS API
for VIIRS sensors (NOAA-21, NOAA-20, Suomi NPP).
"""

import io
import os
from datetime import datetime, timezone

import pandas as pd
import requests


def fetch_firms_viirs():
    """
    Fetch recent VIIRS fire detections from NASA FIRMS API.
    Queries multiple VIIRS datasets and combines results,
    filtered to the Southern Africa region.
    """
    FIRMS_MAP_KEY = os.environ.get("FIRMS_MAP_KEY", "")
    if not FIRMS_MAP_KEY:
        raise ValueError("Missing FIRMS_MAP_KEY in .env")

    datasets = ["VIIRS_NOAA21_NRT", "VIIRS_NOAA20_NRT", "VIIRS_SNPP_NRT"]
    bbox = "10,-35,42,-5"

    all_rows = []

    for dataset in datasets:
        url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{FIRMS_MAP_KEY}/{dataset}/{bbox}/1"
        r = requests.get(url, timeout=60)
        r.raise_for_status()

        text = r.text.strip()
        if not text:
            continue

        df = pd.read_csv(io.StringIO(text))
        if df.empty:
            continue

        df["source"] = dataset
        all_rows.append(df)

    if not all_rows:
        return pd.DataFrame()

    df = pd.concat(all_rows, ignore_index=True)

    # Clean coordinates
    df = df.dropna(subset=["latitude", "longitude"])
    df = df[(df["latitude"] >= -90) & (df["latitude"] <= 90)]
    df = df[(df["longitude"] >= -180) & (df["longitude"] <= 180)]

    # Restrict to Southern Africa
    df = df[
        (df["longitude"] >= 10) & (df["longitude"] <= 42) &
        (df["latitude"] >= -35) & (df["latitude"] <= -5)
    ].copy()

    # Normalize confidence
    if "confidence" in df.columns:
        df["confidence_std"] = pd.to_numeric(df["confidence"], errors="coerce")
    else:
        df["confidence_std"] = None

    # Build event timestamp
    if "acq_date" in df.columns and "acq_time" in df.columns:
        df["event_time"] = df["acq_date"].astype(str) + " " + df["acq_time"].astype(str)
    else:
        df["event_time"] = datetime.now(timezone.utc).isoformat()

    print(f"Parsed {len(df)} VIIRS fire pixels from FIRMS")
    return df
