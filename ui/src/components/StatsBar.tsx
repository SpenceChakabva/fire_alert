"use client";

import { motion } from "framer-motion";
import AnimatedCounter from "./AnimatedCounter";

interface StatsBarProps {
  stats: { high: number; medium: number; low: number; total: number };
}

const items = [
  { key: "high",   label: "High",   bg: "var(--risk-high-bg)",   color: "var(--risk-high)",   border: "rgba(224,92,58,0.25)" },
  { key: "medium", label: "Medium", bg: "var(--risk-medium-bg)", color: "var(--risk-medium)", border: "rgba(212,160,23,0.25)" },
  { key: "low",    label: "Low",    bg: "var(--risk-low-bg)",    color: "var(--risk-low)",    border: "rgba(82,183,136,0.25)" },
];

export default function StatsBar({ stats }: StatsBarProps) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 14 }}>
      {items.map(({ key, label, bg, color, border }, i) => (
        <motion.div key={key}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: i * 0.08 }}
          style={{
            background: bg, border: `1px solid ${border}`,
            borderRadius: 10, padding: "14px 10px",
            display: "flex", flexDirection: "column", alignItems: "center",
          }}
        >
          <div style={{ fontSize: 10, color, fontWeight: 700, letterSpacing: "0.08em",
            textTransform: "uppercase", marginBottom: 4 }}>
            {label}
          </div>
          <AnimatedCounter
            value={(stats as any)[key]}
            className=""
            style={{ fontSize: 28, fontWeight: 800, color, letterSpacing: "-0.03em" } as any}
          />
        </motion.div>
      ))}
    </div>
  );
}
