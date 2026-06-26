"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import StatsBar from "@/components/StatsBar";
import AlertCard, { Alert } from "@/components/AlertCard";
import { RefreshCw, Play, Loader2, CheckCircle2, XCircle } from "lucide-react";

const FireMap = dynamic(() => import("@/components/FireMap"), {
  ssr: false,
  loading: () => (
    <div style={{
      width: "100%", height: "100%", borderRadius: 12,
      background: "var(--bg-surface)", border: "1px solid var(--border)",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "var(--text-muted)", fontSize: 13,
    }}>
      Loading Map…
    </div>
  ),
});

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000") + "/api";

type PipelineState = "idle" | "running" | "success" | "error";

export default function DashboardPage() {
  const [stats,    setStats]    = useState({ high: 0, medium: 0, low: 0, total: 0 });
  const [alerts,   setAlerts]   = useState<Alert[]>([]);
  const [aoiData,  setAoiData]  = useState<any>(null);
  const [viirsData, setViirs]   = useState<any>(null);
  const [mtgData,  setMtg]      = useState<any>(null);
  const [loading,  setLoading]  = useState(true);
  const [focusPt,  setFocusPt]  = useState<[number, number] | null>(null);
  const [pipeline, setPipeline] = useState<PipelineState>("idle");
  const [lastRun,  setLastRun]  = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [s, a, aoi, v, m] = await Promise.all([
        fetch(`${API}/stats`).catch(() => null),
        fetch(`${API}/alerts`).catch(() => null),
        fetch(`${API}/geojson/aoi`).catch(() => null),
        fetch(`${API}/geojson/zim/viirs`).catch(() => null),
        fetch(`${API}/geojson/zim/mtg`).catch(() => null),
      ]);
      if (s?.ok)   setStats(await s.json());
      if (a?.ok)   setAlerts(await a.json());
      if (aoi?.ok) setAoiData(await aoi.json());
      if (v?.ok)   setViirs(await v.json());
      if (m?.ok)   setMtg(await m.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const int = setInterval(fetchData, 300_000);
    return () => clearInterval(int);
  }, [fetchData]);

  // Poll pipeline status when running
  useEffect(() => {
    if (pipeline !== "running") return;
    const id = setInterval(async () => {
      const res = await fetch(`${API}/pipeline/status`).catch(() => null);
      if (!res?.ok) return;
      const data = await res.json();
      if (!data.running) {
        const ok = data.last_status === "success";
        setPipeline(ok ? "success" : "error");
        setLastRun(data.last_run);
        if (ok) fetchData();
        setTimeout(() => setPipeline("idle"), 4000);
        clearInterval(id);
      }
    }, 3000);
    return () => clearInterval(id);
  }, [pipeline, fetchData]);

  const runPipeline = async () => {
    if (pipeline === "running") return;
    setPipeline("running");
    const res = await fetch(`${API}/pipeline/run`, { method: "POST" }).catch(() => null);
    if (!res?.ok) { setPipeline("error"); setTimeout(() => setPipeline("idle"), 3000); }
  };

  const pipelineBtn = {
    idle:    { label: "Run Manual Check", icon: <Play size={14} />,       bg: "var(--forest)",      color: "#fff" },
    running: { label: "Running…",         icon: <Loader2 size={14} className="spin" />, bg: "var(--bg-card)", color: "var(--forest-light)" },
    success: { label: "Complete",         icon: <CheckCircle2 size={14} />, bg: "rgba(82,183,136,0.2)", color: "var(--risk-low)" },
    error:   { label: "Failed",           icon: <XCircle size={14} />,     bg: "var(--risk-high-bg)", color: "var(--risk-high)" },
  }[pipeline];

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", padding: 16, gap: 14 }}>

      {/* ── Left: Map ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              Zimbabwe Fire Monitoring
            </h1>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
              VIIRS + MTG Hotspot Detection · Live
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={fetchData}
              disabled={loading}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "7px 12px", borderRadius: 8,
                background: "var(--bg-elevated)", border: "1px solid var(--border)",
                color: "var(--text-secondary)", fontSize: 12, cursor: "pointer",
                opacity: loading ? 0.5 : 1,
              }}
            >
              <RefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
              Refresh
            </button>
            <button
              onClick={runPipeline}
              disabled={pipeline === "running"}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "7px 14px", borderRadius: 8,
                background: pipelineBtn.bg, border: "1px solid transparent",
                color: pipelineBtn.color, fontSize: 12, fontWeight: 600,
                cursor: pipeline === "running" ? "not-allowed" : "pointer",
                transition: "all 200ms",
              }}
            >
              {pipelineBtn.icon}
              {pipelineBtn.label}
            </button>
          </div>
        </div>

        {lastRun && (
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 8 }}>
            Last run: {new Date(lastRun).toLocaleString()}
          </div>
        )}

        <div style={{ flex: 1, minHeight: 0 }}>
          <FireMap aoiData={aoiData} viirsData={viirsData} mtgData={mtgData} focusPoint={focusPt} />
        </div>
      </div>

      {/* ── Right: Stats + Alerts ── */}
      <div style={{ width: 360, display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <StatsBar stats={stats} />

        <div style={{
          flex: 1, background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: 12, padding: "14px", display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)",
              letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Active Alerts
            </span>
            <span style={{
              background: "var(--bg-elevated)", color: "var(--text-muted)",
              fontSize: 11, padding: "2px 8px", borderRadius: 20,
            }}>
              {alerts.length}
            </span>
          </div>

          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
            <AnimatePresence>
              {alerts.length === 0 ? (
                <div style={{ height: "100%", display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", gap: 10 }}>
                  <div style={{ width: 48, height: 48, borderRadius: "50%",
                    background: "var(--bg-elevated)", display: "flex",
                    alignItems: "center", justifyContent: "center",
                    color: "var(--text-muted)", fontSize: 22 }}>
                    🔥
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    No active fire detections
                  </p>
                </div>
              ) : (
                alerts.map((alert, i) => (
                  <AlertCard
                    key={`${alert.source}-${alert.latitude}-${alert.longitude}`}
                    alert={alert}
                    index={i}
                    onFocus={(lat, lon) => setFocusPt([lat, lon])}
                  />
                ))
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}
