"""
Area of Interest (AOI) loader.
Reads compartment boundary GeoJSON for spatial fire analysis.
"""

import geopandas as gpd

from config import AOI_FILE


def load_aoi():
    """Load and normalize the AOI/compartment boundaries GeoJSON."""
    aoi = gpd.read_file(AOI_FILE)

    if aoi.crs is None:
        aoi = aoi.set_crs("EPSG:4326")
    else:
        aoi = aoi.to_crs("EPSG:4326")

    if "name" not in aoi.columns:
        aoi["name"] = [f"CPT_{i+1}" for i in range(len(aoi))]

    return aoi
