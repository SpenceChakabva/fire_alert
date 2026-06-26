"""
GeoJSON export utilities.
Handles writing fire detection DataFrames to GeoJSON files
and geographic subsetting.
"""

import os
import geopandas as gpd

from config import OUTPUT_DIR


def export_geojson(df, filename, lon_col="longitude", lat_col="latitude"):
    """Export a DataFrame with lat/lon columns to a GeoJSON file in the output directory."""
    if df.empty:
        return False

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    filepath = os.path.join(OUTPUT_DIR, filename)

    gdf = gpd.GeoDataFrame(
        df.copy(),
        geometry=gpd.points_from_xy(df[lon_col], df[lat_col]),
        crs="EPSG:4326"
    )
    gdf.to_file(filepath, driver="GeoJSON")
    print(f"Exported {filepath}")
    return True


def zimbabwe_subset(df, lon_col="longitude", lat_col="latitude"):
    """Filter a DataFrame to only include points within Zimbabwe's bounding box."""
    if df.empty:
        return df.copy()

    return df[
        (df[lon_col] >= 25) & (df[lon_col] <= 34) &
        (df[lat_col] >= -23) & (df[lat_col] <= -15)
    ].copy()
