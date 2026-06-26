"""
EUMETSAT / Meteosat Third Generation (MTG) data source.
Handles authentication, product search, download, and
parsing of MTG Active Fire NetCDF products.
"""

import os
import glob
import zipfile
import tempfile
from datetime import datetime, timedelta, timezone

import numpy as np
import pandas as pd
import xarray as xr
import eumdac
from pyproj import CRS, Transformer

from config import EUM_COLLECTION


def get_datastore():
    """Authenticate with EUMETSAT and return a DataStore instance."""
    key = os.environ.get("EUMETSAT_CONSUMER_KEY", "")
    secret = os.environ.get("EUMETSAT_CONSUMER_SECRET", "")
    if not key or not secret:
        raise ValueError("Missing EUMETSAT credentials in .env")

    token = eumdac.AccessToken((key, secret))
    return eumdac.DataStore(token)


def search_recent_products(datastore, collection_id=None, lookback_hours=2):
    """Search for recent MTG Active Fire products."""
    collection_id = collection_id or EUM_COLLECTION
    collection = datastore.get_collection(collection_id)
    end_time = datetime.now(timezone.utc)
    start_time = end_time - timedelta(hours=lookback_hours)

    products = collection.search(
        dtstart=start_time,
        dtend=end_time,
        type="MTIFCI2FIR",
        coverage="FD",
        sat="MTI1",
        sort="publicationDate"
    )
    return list(products)


def download_product(product, out_dir):
    """Download all entries from an EUMETSAT product to a local directory."""
    os.makedirs(out_dir, exist_ok=True)
    files = []

    for entry in product.entries:
        entry_name = entry.name if hasattr(entry, "name") else str(entry)
        safe_name = os.path.basename(entry_name)
        outfile = os.path.join(out_dir, safe_name)

        try:
            with product.open(entry=entry) as src, open(outfile, "wb") as dst:
                dst.write(src.read())
        except Exception:
            with product.open(entry=entry_name) as src, open(outfile, "wb") as dst:
                dst.write(src.read())

        files.append(outfile)

    return files


def find_netcdf_files(files):
    """Find NetCDF files among downloaded files, extracting ZIPs if needed."""
    nc_files = [f for f in files if f.lower().endswith((".nc", ".nc4"))]
    if nc_files:
        return nc_files

    extracted_nc = []
    for f in files:
        if f.lower().endswith(".zip"):
            extract_dir = tempfile.mkdtemp(prefix="mtg_unzip_")
            with zipfile.ZipFile(f, "r") as zf:
                zf.extractall(extract_dir)

            extracted_nc.extend(glob.glob(os.path.join(extract_dir, "**", "*.nc"), recursive=True))
            extracted_nc.extend(glob.glob(os.path.join(extract_dir, "**", "*.nc4"), recursive=True))

    return extracted_nc


def parse_mtg_fire_netcdf(nc_path):
    """
    Parse an MTG Active Fire NetCDF file into a DataFrame of fire detections.
    Converts geostationary projection coordinates to WGS84 lat/lon,
    filters for high-probability fire pixels in the Southern Africa region.
    """
    ds = xr.open_dataset(nc_path)

    required = ["x", "y", "fire_result", "fire_probability", "mtg_geos_projection"]
    missing = [v for v in required if v not in ds.variables]
    if missing:
        print("Available variables:", list(ds.variables))
        raise ValueError(f"Missing required variables: {missing}")

    x = ds["x"].values
    y = ds["y"].values
    fire_result = ds["fire_result"].values
    fire_probability = ds["fire_probability"].values

    attrs = ds["mtg_geos_projection"].attrs
    h = attrs["perspective_point_height"]

    # Convert scan angles to projected metres
    x = x * h
    y = y * h

    xx, yy = np.meshgrid(x, y)

    # Transform from geostationary to WGS84
    geos_crs = CRS.from_cf(attrs)
    transformer = Transformer.from_crs(geos_crs, CRS.from_epsg(4326), always_xy=True)
    lon, lat = transformer.transform(xx, yy)

    df = pd.DataFrame({
        "longitude": lon.ravel(),
        "latitude": lat.ravel(),
        "fire_result": fire_result.ravel(),
        "fire_probability": fire_probability.ravel(),
    })

    # Clean up invalid coordinates
    df = df.replace([np.inf, -np.inf], np.nan)
    df = df.dropna(subset=["longitude", "latitude"])
    df = df[(df["latitude"] >= -90) & (df["latitude"] <= 90)]
    df = df[(df["longitude"] >= -180) & (df["longitude"] <= 180)]

    # Keep only high-confidence fire pixels
    df = df[
        (df["fire_result"] >= 2) &
        (df["fire_probability"] >= 0.5)
    ].copy()

    # Restrict to Southern Africa region
    df = df[
        (df["longitude"] >= 10) & (df["longitude"] <= 42) &
        (df["latitude"] >= -35) & (df["latitude"] <= -5)
    ].copy()

    df["confidence"] = df["fire_probability"].astype(float)
    df["event_time"] = datetime.now(timezone.utc).isoformat()
    df["source"] = "MTG"

    print(f"\nParsed {len(df)} MTG fire pixels from {os.path.basename(nc_path)}")
    return df
