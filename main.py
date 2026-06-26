"""
Main pipeline execution script.
Orchestrates fetching data, classifying risk, saving exports, and triggering alerts.
"""

import os
import time
import tempfile
from datetime import datetime

import pandas as pd
import geopandas as gpd

from config import POLL_INTERVAL_SECONDS, LOOKBACK_HOURS, OUTPUT_DIR
from src.core.database import init_db
from src.core.aoi import load_aoi
from src.core.exports import export_geojson, zimbabwe_subset
from src.sources.eumetsat import (
    get_datastore, search_recent_products, download_product,
    find_netcdf_files, parse_mtg_fire_netcdf
)
from src.sources.viirs import fetch_firms_viirs
from src.processing.risk import classify_fire_risk, build_ranked_alerts
from src.alerts.telerivet import process_forester_alerts


def run_pipeline():
    """Run a single iteration of the fire monitoring pipeline."""
    print(f"\n--- Starting Pipeline Run at {datetime.now().isoformat()} ---")

    print("Loading compartments/AOI...")
    aoi = load_aoi()

    print("Connecting to EUMETSAT...")
    try:
        datastore = get_datastore()
        print("Searching recent MTG products...")
        products = search_recent_products(datastore, lookback_hours=LOOKBACK_HOURS)
        print(f"Found {len(products)} MTG products")
    except Exception as e:
        print(f"EUMETSAT Error: {e}")
        products = []

    mtg_df = pd.DataFrame()

    if products:
        # Process the most recent product
        for product in products[-1:]:
            print(f"Downloading MTG product: {product}")

            with tempfile.TemporaryDirectory(prefix="mtg_") as tmpdir:
                files = download_product(product, tmpdir)
                nc_files = find_netcdf_files(files)

                for nc in nc_files:
                    try:
                        df = parse_mtg_fire_netcdf(nc)
                        if not df.empty:
                            mtg_df = pd.concat([mtg_df, df], ignore_index=True)
                    except Exception as e:
                        print(f"Failed parsing MTG {nc}: {e}")

    if not mtg_df.empty:
        mtg_df = mtg_df.drop_duplicates(
            subset=["latitude", "longitude", "fire_result", "fire_probability"]
        ).copy()

    print("Fetching VIIRS from FIRMS...")
    try:
        viirs_df = fetch_firms_viirs()
    except Exception as e:
        print(f"Failed fetching VIIRS: {e}")
        viirs_df = pd.DataFrame()

    # Exports
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    if not mtg_df.empty:
        export_geojson(mtg_df, "mtg_southern_africa.geojson")
    else:
        print("No MTG detections after filtering.")

    if not viirs_df.empty:
        export_geojson(viirs_df, "viirs_southern_africa.geojson")
    else:
        print("No VIIRS detections after filtering.")

    mtg_zim = zimbabwe_subset(mtg_df)
    viirs_zim = zimbabwe_subset(viirs_df)

    if not mtg_zim.empty:
        export_geojson(mtg_zim, "mtg_zimbabwe.geojson")
    else:
        print("No MTG detections in Zimbabwe for this timestamp.")

    if not viirs_zim.empty:
        export_geojson(viirs_zim, "viirs_zimbabwe.geojson")
    else:
        print("No VIIRS detections in Zimbabwe for this timestamp.")

    # Risk Classification
    mtg_risk = classify_fire_risk(mtg_df, aoi, "MTG", conf_col="confidence") if not mtg_df.empty else gpd.GeoDataFrame()
    viirs_risk = classify_fire_risk(viirs_df, aoi, "VIIRS", conf_col="confidence_std") if not viirs_df.empty else gpd.GeoDataFrame()

    if not mtg_risk.empty:
        mtg_risk.to_file(os.path.join(OUTPUT_DIR, "mtg_risk_alerts.geojson"), driver="GeoJSON")
        print("Exported mtg_risk_alerts.geojson")

    if not viirs_risk.empty:
        viirs_risk.to_file(os.path.join(OUTPUT_DIR, "viirs_risk_alerts.geojson"), driver="GeoJSON")
        print("Exported viirs_risk_alerts.geojson")

    mtg_alerts = build_ranked_alerts(mtg_risk, "MTG")
    viirs_alerts = build_ranked_alerts(viirs_risk, "VIIRS")

    combined_alerts = pd.concat([mtg_alerts, viirs_alerts], ignore_index=True)

    if not combined_alerts.empty:
        risk_order = {"High": 1, "Medium": 2, "Low": 3, "Unknown": 4}
        combined_alerts["risk_sort"] = combined_alerts["risk_level"].map(risk_order)
        combined_alerts = combined_alerts.sort_values(["risk_sort", "distance_km"]).drop(columns="risk_sort")
        
        alerts_csv = os.path.join(OUTPUT_DIR, "ranked_fire_alerts.csv")
        combined_alerts.to_csv(alerts_csv, index=False)
        print(f"Exported {alerts_csv}")

        print("\nTop ranked alerts:")
        for msg in combined_alerts["alert_text"].head(10).tolist():
            print(msg)
            print("-" * 80)
    else:
        print("No ranked alerts within 10 km of compartments.")
        print("Presentation message: No active fire detected near monitored compartments at acquisition time.")

    # Send SMS alerts
    print("\nProcessing SMS alerts...")
    process_forester_alerts()
    print("--- Pipeline Run Complete ---\n")


if __name__ == "__main__":
    init_db()
    while True:
        try:
            run_pipeline()
        except Exception as e:
            print(f"Pipeline error: {e}")
        print(f"Sleeping for {POLL_INTERVAL_SECONDS} seconds...")
        time.sleep(POLL_INTERVAL_SECONDS)
