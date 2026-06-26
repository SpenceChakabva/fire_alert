"use client";

import { motion } from "framer-motion";
import { AlertTriangle, MapPin, Radio, Ruler } from "lucide-react";

export interface Alert {
  source: string;
  nearest_cpt: string;
  distance_km: number;
  risk_level: string;
  latitude: number;
  longitude: number;
  confidence: number | null;
}

const risk = (r: string) => {
  const l = r?.toLowerCase();
  if (l === "high")   return { bg: "var(--risk-high-bg)",   border: "var(--risk-high)",   text: "var(--risk-high)" };
  if (l === "medium") return { bg: "var(--risk-medium-bg)", border: "var(--risk-medium)", text: "var(--risk-medium)" };
  if (l === "low")    return { bg: "var(--risk-low-bg)",    border: "var(--risk-low)",    text: "var(--risk-low)" };
  return { bg: "rgba(255,255,255,0.04)", border: "var(--border)", text: "var(--text-secondary)" };
};

export default function AlertCard({
  alert, index, onFocus,
}: {
  alert: Alert;
  index: number;
  onFocus?: (lat: number, lon: number) => void;
}) {
  const c = risk(alert.risk_level);
  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, delay: index * 0.04 }}
      onClick={() => onFocus?.(alert.latitude, alert.longitude)}
      style={{
        padding: "12px 14px", borderRadius: 10,
        background: c.bg,
        border: `1px solid ${c.border}30`,
        cursor: onFocus ? "pointer" : "default",
        transition: "border-color 150ms",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{
          display: "flex", alignItems: "center", gap: 5,
          fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
          textTransform: "uppercase", color: c.text,
        }}>
          <AlertTriangle size={12} /> {alert.risk_level} Risk
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-muted)" }}>
          <Radio size={11} /> {alert.source}
        </span>
      </div>

      <div style={{ display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 6 }}>
        <MapPin size={13} color="var(--text-secondary)" style={{ marginTop: 2, flexShrink: 0 }} />
        <div>
          <span style={{ fontSize: 13, color: "var(--text-primary)" }}>
            Near <b>{alert.nearest_cpt}</b>
          </span>
          <div style={{ fontSize: 10, fontFamily: "monospace", color: "var(--text-muted)", marginTop: 2 }}>
            {alert.latitude.toFixed(4)}, {alert.longitude.toFixed(4)}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-secondary)", paddingLeft: 19 }}>
        <Ruler size={12} />
        {alert.distance_km?.toFixed(2) ?? "N/A"} km away
        {alert.confidence != null && (
          <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>
            {(alert.confidence * 100).toFixed(0)}% conf.
          </span>
        )}
      </div>
    </motion.div>
  );
}
