"""
Fire risk classification and alert ranking.
Performs spatial analysis to determine fire proximity to
AOI compartments and assigns risk levels.
"""

import pandas as pd
import geopandas as gpd


def classify_fire_risk(fire_df, aoi, source_name, lon_col="longitude", lat_col="latitude", conf_col=None):
    """
    Classify fire detections by proximity to AOI compartments.

    Risk levels:
    - High:   <= 2 km from compartment
    - Medium: <= 5 km from compartment
    - Low:    <= 10 km from compartment
    - Outside threshold: > 10 km
    """
    if fire_df.empty:
        return gpd.GeoDataFrame(columns=[
            "source", "latitude", "longitude", "nearest_cpt",
            "distance_km", "risk_level", "geometry"
        ], crs="EPSG:4326")

    fire_gdf = gpd.GeoDataFrame(
        fire_df.copy(),
        geometry=gpd.points_from_xy(fire_df[lon_col], fire_df[lat_col]),
        crs="EPSG:4326"
    )

    aoi_local = aoi.copy()
    if "name" not in aoi_local.columns:
        aoi_local["name"] = [f"CPT_{i+1}" for i in range(len(aoi_local))]

    # Project to Web Mercator for distance calculations
    fire_m = fire_gdf.to_crs("EPSG:3857")
    aoi_m = aoi_local.to_crs("EPSG:3857")[["name", "geometry"]].copy()

    # Spatial join to nearest compartment
    joined = gpd.sjoin_nearest(
        fire_m,
        aoi_m,
        how="left",
        distance_col="distance_m"
    )

    joined["distance_km"] = joined["distance_m"] / 1000.0
    joined["source_group"] = source_name

    def risk_label(d):
        if pd.isna(d):
            return "Unknown"
        if d <= 2:
            return "High"
        elif d <= 5:
            return "Medium"
        elif d <= 10:
            return "Low"
        else:
            return "Outside threshold"

    joined["risk_level"] = joined["distance_km"].apply(risk_label)
    joined = joined.rename(columns={"name": "nearest_cpt"})

    # Normalize confidence column
    if conf_col and conf_col in joined.columns:
        joined["confidence_out"] = joined[conf_col]
    elif "confidence" in joined.columns:
        joined["confidence_out"] = joined["confidence"]
    else:
        joined["confidence_out"] = None

    return joined.to_crs("EPSG:4326")


def build_ranked_alerts(risk_gdf, source_name):
    """
    Build a ranked, human-readable alert DataFrame from risk-classified detections.
    Sorts by risk level (High first) then by distance.
    """
    if risk_gdf.empty:
        return pd.DataFrame(columns=[
            "source", "nearest_cpt", "distance_km", "risk_level",
            "latitude", "longitude", "confidence", "alert_text"
        ])

    rows = []

    for _, row in risk_gdf.iterrows():
        if row["risk_level"] == "Outside threshold":
            continue

        confidence_value = row.get("confidence_out", None)
        conf_text = ""
        if pd.notna(confidence_value):
            try:
                conf_text = f" | Confidence: {float(confidence_value):.2f}"
            except Exception:
                conf_text = ""

        rows.append({
            "source": source_name,
            "nearest_cpt": row.get("nearest_cpt", "Unknown"),
            "distance_km": round(float(row["distance_km"]), 2) if pd.notna(row["distance_km"]) else None,
            "risk_level": row["risk_level"],
            "latitude": float(row["latitude"]),
            "longitude": float(row["longitude"]),
            "confidence": confidence_value,
            "alert_text": (
                f"{row['risk_level'].upper()} RISK FIRE ALERT | "
                f"Source: {source_name} | "
                f"Nearest compartment: {row.get('nearest_cpt', 'Unknown')} | "
                f"Distance: {float(row['distance_km']):.2f} km | "
                f"Lat,Lon: {float(row['latitude']):.5f}, {float(row['longitude']):.5f}"
                f"{conf_text}"
            )
        })

    alerts_df = pd.DataFrame(rows)
    if alerts_df.empty:
        return alerts_df

    risk_order = {"High": 1, "Medium": 2, "Low": 3, "Unknown": 4}
    alerts_df["risk_sort"] = alerts_df["risk_level"].map(risk_order)
    alerts_df = alerts_df.sort_values(["risk_sort", "distance_km"]).drop(columns="risk_sort")

    return alerts_df
