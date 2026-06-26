"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Alert {
  alert_id: string;
  latitude: number;
  longitude: number;
  risk_level: string | null;
  field_name: string | null;
  created_at: string;
  source: string | null;
}

const riskColor = (r?: string | null) => {
  const l = r?.toLowerCase();
  if (l === "high")   return "#e05c3a";
  if (l === "medium") return "#d4a017";
  if (l === "low")    return "#52b788";
  return "#6da5c0";
};

export default function HistoryMap({ alerts }: { alerts: Alert[] }) {
  const ref   = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const lgRef  = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, { zoomControl: false })
      .setView([-19.0154, 29.1549], 6);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: "&copy; OpenStreetMap &copy; CARTO", subdomains: "abcd", maxZoom: 20,
    }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    lgRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; lgRef.current = null; };
  }, []);

  useEffect(() => {
    const lg = lgRef.current;
    if (!lg) return;
    lg.clearLayers();
    alerts.forEach(a => {
      if (!a.latitude || !a.longitude) return;
      const color = riskColor(a.risk_level);
      const marker = L.circleMarker([a.latitude, a.longitude], {
        radius: 5, fillColor: color, color: "#0a110d",
        weight: 1, fillOpacity: 0.75,
      });
      marker.bindPopup(`
        <div style="font-family:inherit">
          <b style="color:${color}">${a.risk_level ?? "?"} Risk</b><br/>
          ${a.field_name ?? ""}<br/>
          <small style="color:#8aab8e">${a.source ?? ""} · ${a.created_at ? new Date(a.created_at).toLocaleDateString() : ""}</small>
        </div>
      `);
      lg.addLayer(marker);
    });
  }, [alerts]);

  return (
    <div ref={ref}
      style={{ width: "100%", height: "100%", borderRadius: 10, overflow: "hidden" }}
    />
  );
}
