"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import {
  Filter, Download, Map as MapIcon, Table, ChevronLeft, ChevronRight,
} from "lucide-react";

const HistoryMap = dynamic(() => import("@/components/HistoryMap"), { ssr: false });

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000") + "/api";
const PAGE_SIZE = 25;

interface HistoryAlert {
  alert_id: string;
  event_time: string | null;
  latitude: number;
  longitude: number;
  confidence: number | null;
  field_name: string | null;
  risk_level: string | null;
  source: string | null;
  created_at: string;
}

const riskColor = (r?: string | null) => {
  const l = r?.toLowerCase();
  if (l === "high")   return "var(--risk-high)";
  if (l === "medium") return "var(--risk-medium)";
  if (l === "low")    return "var(--risk-low)";
  return "var(--text-muted)";
};

const badge = (r?: string | null) => ({
  display: "inline-block", padding: "2px 8px", borderRadius: 4,
  fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
  textTransform: "uppercase" as const,
  background: `${riskColor(r)}22`, color: riskColor(r),
});

export default function HistoryPage() {
  const [rows,       setRows]       = useState<HistoryAlert[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [view,       setView]       = useState<"table" | "map">("table");
  const [page,       setPage]       = useState(1);
  const [sortField,  setSortField]  = useState<keyof HistoryAlert>("created_at");
  const [sortDir,    setSortDir]    = useState<"asc"|"desc">("desc");
  const [filterRisk, setFilterRisk] = useState("all");
  const [dateFrom,   setDateFrom]   = useState("");
  const [dateTo,     setDateTo]     = useState("");

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "1000" });
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo)   params.set("date_to",   dateTo + "T23:59:59");
    if (filterRisk !== "all") params.set("risk_level", filterRisk);
    try {
      const res = await fetch(`${API}/history/alerts?${params}`);
      if (res.ok) setRows(await res.json());
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, filterRisk]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // Sort
  const sorted = [...rows].sort((a, b) => {
    const av = a[sortField] ?? "";
    const bv = b[sortField] ?? "";
    return sortDir === "asc"
      ? String(av).localeCompare(String(bv))
      : String(bv).localeCompare(String(av));
  });

  const total = sorted.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSort = (f: keyof HistoryAlert) => {
    if (sortField === f) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(f); setSortDir("desc"); }
    setPage(1);
  };

  const exportCSV = () => {
    const header = "alert_id,event_time,latitude,longitude,confidence,field_name,risk_level,source,created_at";
    const body = sorted.map(r =>
      [r.alert_id, r.event_time, r.latitude, r.longitude,
       r.confidence, r.field_name, r.risk_level, r.source, r.created_at].join(",")
    ).join("\n");
    const blob = new Blob([header + "\n" + body], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `fire_alerts_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  const Th = ({ field, label }: { field: keyof HistoryAlert; label: string }) => (
    <th
      onClick={() => toggleSort(field)}
      style={{
        padding: "10px 12px", textAlign: "left", cursor: "pointer",
        fontSize: 10, fontWeight: 700, color: sortField === field ? "var(--forest-light)" : "var(--text-muted)",
        letterSpacing: "0.08em", textTransform: "uppercase",
        borderBottom: "1px solid var(--border)",
        userSelect: "none",
        whiteSpace: "nowrap",
      }}
    >
      {label} {sortField === field ? (sortDir === "asc" ? "↑" : "↓") : ""}
    </th>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", padding: 16, gap: 12 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            Alert History
          </h1>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
            {total} record{total !== 1 ? "s" : ""} · Zimbabwe fire detections
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {/* View toggle */}
          {(["table", "map"] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "7px 12px", borderRadius: 8, fontSize: 12,
              background: view === v ? "var(--forest-glow)" : "var(--bg-elevated)",
              border: `1px solid ${view === v ? "var(--forest)" : "var(--border)"}`,
              color: view === v ? "var(--forest-light)" : "var(--text-secondary)",
              cursor: "pointer",
            }}>
              {v === "table" ? <Table size={13} /> : <MapIcon size={13} />}
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
          <button onClick={exportCSV} style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "7px 12px", borderRadius: 8, fontSize: 12,
            background: "var(--bg-elevated)", border: "1px solid var(--border)",
            color: "var(--text-secondary)", cursor: "pointer",
          }}>
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        display: "flex", gap: 10, alignItems: "center",
        background: "var(--bg-surface)", border: "1px solid var(--border)",
        borderRadius: 10, padding: "10px 14px", flexShrink: 0,
      }}>
        <Filter size={13} color="var(--text-muted)" />
        <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.06em" }}>
          FILTER
        </span>

        <select
          value={filterRisk}
          onChange={e => { setFilterRisk(e.target.value); setPage(1); }}
          style={{
            background: "var(--bg-elevated)", border: "1px solid var(--border)",
            color: "var(--text-primary)", borderRadius: 6, padding: "4px 10px",
            fontSize: 12, cursor: "pointer",
          }}
        >
          {["all", "high", "medium", "low"].map(r => (
            <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
          ))}
        </select>

        <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
          placeholder="From"
          style={{
            background: "var(--bg-elevated)", border: "1px solid var(--border)",
            color: "var(--text-primary)", borderRadius: 6, padding: "4px 10px",
            fontSize: 12,
          }} />
        <span style={{ color: "var(--text-muted)", fontSize: 12 }}>→</span>
        <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
          style={{
            background: "var(--bg-elevated)", border: "1px solid var(--border)",
            color: "var(--text-primary)", borderRadius: 6, padding: "4px 10px",
            fontSize: 12,
          }} />
        {(filterRisk !== "all" || dateFrom || dateTo) && (
          <button onClick={() => { setFilterRisk("all"); setDateFrom(""); setDateTo(""); setPage(1); }}
            style={{
              marginLeft: "auto", fontSize: 11, color: "var(--risk-high)", cursor: "pointer",
              background: "none", border: "none",
            }}>
            Clear
          </button>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "hidden", borderRadius: 10,
        border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
        {view === "table" ? (
          <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ flex: 1, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead style={{ position: "sticky", top: 0, background: "var(--bg-elevated)", zIndex: 1 }}>
                  <tr>
                    <Th field="created_at"  label="Detected" />
                    <Th field="risk_level"  label="Risk" />
                    <Th field="field_name"  label="Field / CPT" />
                    <Th field="source"      label="Source" />
                    <Th field="latitude"    label="Lat" />
                    <Th field="longitude"   label="Lon" />
                    <Th field="confidence"  label="Confidence" />
                    <Th field="event_time"  label="Event Time" />
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                      Loading…
                    </td></tr>
                  ) : paged.length === 0 ? (
                    <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                      No records match the current filters.
                    </td></tr>
                  ) : paged.map((row, i) => (
                    <motion.tr key={row.alert_id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.015 }}
                      style={{
                        borderBottom: "1px solid var(--border)",
                        background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)",
                      }}
                    >
                      <td style={{ padding: "9px 12px", fontSize: 12, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                        {row.created_at ? new Date(row.created_at).toLocaleString() : "—"}
                      </td>
                      <td style={{ padding: "9px 12px" }}>
                        <span style={badge(row.risk_level)}>{row.risk_level ?? "—"}</span>
                      </td>
                      <td style={{ padding: "9px 12px", fontSize: 12, color: "var(--text-primary)" }}>
                        {row.field_name ?? "—"}
                      </td>
                      <td style={{ padding: "9px 12px", fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>
                        {row.source ?? "—"}
                      </td>
                      <td style={{ padding: "9px 12px", fontSize: 11, fontFamily: "monospace", color: "var(--text-secondary)" }}>
                        {row.latitude?.toFixed(4)}
                      </td>
                      <td style={{ padding: "9px 12px", fontSize: 11, fontFamily: "monospace", color: "var(--text-secondary)" }}>
                        {row.longitude?.toFixed(4)}
                      </td>
                      <td style={{ padding: "9px 12px", fontSize: 12, color: "var(--text-secondary)" }}>
                        {row.confidence != null ? `${(row.confidence * 100).toFixed(0)}%` : "—"}
                      </td>
                      <td style={{ padding: "9px 12px", fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                        {row.event_time ? new Date(row.event_time).toLocaleString() : "—"}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 16px", borderTop: "1px solid var(--border)",
              background: "var(--bg-elevated)", flexShrink: 0,
            }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                Showing {Math.min((page - 1) * PAGE_SIZE + 1, total)}–{Math.min(page * PAGE_SIZE, total)} of {total}
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  style={{
                    padding: "5px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer",
                    background: "var(--bg-card)", border: "1px solid var(--border)",
                    color: page === 1 ? "var(--text-muted)" : "var(--text-primary)",
                  }}>
                  <ChevronLeft size={13} />
                </button>
                <span style={{ padding: "5px 12px", fontSize: 12, color: "var(--text-secondary)" }}>
                  {page} / {pages}
                </span>
                <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
                  style={{
                    padding: "5px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer",
                    background: "var(--bg-card)", border: "1px solid var(--border)",
                    color: page === pages ? "var(--text-muted)" : "var(--text-primary)",
                  }}>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ height: "100%" }}>
            <HistoryMap alerts={rows} />
          </div>
        )}
      </div>
    </div>
  );
}
