"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface FireMapProps {
  aoiData: any;
  viirsData: any;
  mtgData: any;
  /** If provided, fly to this location */
  focusPoint?: [number, number] | null;
}

const getRiskColor = (risk?: string) => {
  const r = risk?.toLowerCase();
  if (r === "high")   return "#e05c3a";
  if (r === "medium") return "#d4a017";
  if (r === "low")    return "#52b788";
  return "#6da5c0";
};

export default function FireMap({ aoiData, viirsData, mtgData, focusPoint }: FireMapProps) {
  const mapRef       = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Zimbabwe centre
    const map = L.map(containerRef.current, { zoomControl: false })
      .setView([-19.0154, 29.1549], 7);

    // Earthy dark tiles
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: "abcd",
      maxZoom: 20,
    }).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);

    layerGroupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
    };
  }, []);

  // Fly to focused point
  useEffect(() => {
    if (focusPoint && mapRef.current) {
      mapRef.current.flyTo(focusPoint, 11, { duration: 1.2 });
    }
  }, [focusPoint]);

  // Update data layers
  useEffect(() => {
    const map = mapRef.current;
    const group = layerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    // AOI boundaries
    if (aoiData?.features?.length) {
      L.geoJSON(aoiData, {
        style: {
          color: "#d4a017",
          weight: 1.5,
          fillColor: "#d4a017",
          fillOpacity: 0.06,
          dashArray: "5,4",
        },
        onEachFeature: (feature, layer) => {
          const name = feature.properties?.name || feature.properties?.["Cpt Number"] || "Compartment";
          layer.bindTooltip(`<b style="color:#f5c842">${name}</b>`, { direction: "center" });
        },
      }).addTo(group);
    }

    const makePopup = (source: string, props: any, latlng: L.LatLng, color: string) => `
      <div style="font-family:inherit;min-width:200px">
        <div style="font-weight:700;color:${color};text-transform:uppercase;letter-spacing:0.06em;
          font-size:11px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:8px;margin-bottom:8px">
          ${props.risk_level || "Unknown"} Risk · ${source}
        </div>
        <table style="width:100%;font-size:12px;border-collapse:collapse">
          <tr><td style="color:var(--text-secondary);padding:3px 8px 3px 0">Nearest CPT</td>
              <td style="font-weight:600;text-align:right">${props.nearest_cpt || "N/A"}</td></tr>
          <tr><td style="color:var(--text-secondary);padding:3px 8px 3px 0">Distance</td>
              <td style="text-align:right">${props.distance_km ? props.distance_km.toFixed(2) + " km" : "N/A"}</td></tr>
          <tr><td style="color:var(--text-secondary);padding:3px 8px 3px 0">Lat / Lon</td>
              <td style="text-align:right;font-family:monospace;font-size:10px">
                ${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}</td></tr>
          ${props.confidence != null ? `<tr><td style="color:var(--text-secondary);padding:3px 8px 3px 0">Confidence</td>
              <td style="text-align:right">${(props.confidence * 100).toFixed(0)}%</td></tr>` : ""}
        </table>
      </div>`;

    const addLayer = (data: any, source: string) => {
      if (!data?.features?.length) return;
      L.geoJSON(data, {
        pointToLayer: (feature, latlng) => {
          const risk  = feature.properties?.risk_level;
          const color = getRiskColor(risk);
          const isHigh = risk?.toLowerCase() === "high";
          const marker = L.circleMarker(latlng, {
            radius:      isHigh ? 8 : 6,
            fillColor:   color,
            color:       "#0a110d",
            weight:      1,
            fillOpacity: 0.85,
          });
          marker.bindPopup(makePopup(source, feature.properties || {}, latlng, color));
          return marker;
        },
      }).addTo(group);
    };

    addLayer(mtgData,  "MTG");
    addLayer(viirsData, "VIIRS");

  }, [aoiData, viirsData, mtgData]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", borderRadius: 12,
        overflow: "hidden", border: "1px solid var(--border)" }}
    />
  );
}
