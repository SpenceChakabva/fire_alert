"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Save, RotateCcw, Clock, ShieldCheck, Timer, Info } from "lucide-react";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000") + "/api";

interface Settings {
  MIN_CONFIDENCE: number;
  LOOKBACK_HOURS: number;
  POLL_INTERVAL_SECONDS: number;
}

const defaults: Settings = {
  MIN_CONFIDENCE: 0.5,
  LOOKBACK_HOURS: 2,
  POLL_INTERVAL_SECONDS: 900,
};

type SaveState = "idle" | "saving" | "saved" | "error";

export default function SettingsPage() {
  const [form,      setForm]      = useState<Settings>(defaults);
  const [original,  setOriginal]  = useState<Settings>(defaults);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    fetch(`${API}/settings`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setForm(d); setOriginal(d); } })
      .finally(() => setLoading(false));
  }, []);

  const changed = JSON.stringify(form) !== JSON.stringify(original);

  const save = async () => {
    setSaveState("saving");
    try {
      const res = await fetch(`${API}/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setOriginal({ ...form });
        setSaveState("saved");
      } else {
        setSaveState("error");
      }
    } catch {
      setSaveState("error");
    }
    setTimeout(() => setSaveState("idle"), 3000);
  };

  const reset = () => setForm({ ...original });

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%",
      color: "var(--text-muted)", fontSize: 13 }}>
      Loading settings…
    </div>
  );

  const Field = ({
    id, label, description, icon: Icon, min, max, step, unit,
  }: {
    id: keyof Settings; label: string; description: string;
    icon: any; min: number; max: number; step: number; unit: string;
  }) => (
    <div style={{
      background: "var(--bg-surface)", border: "1px solid var(--border)",
      borderRadius: 12, padding: 20,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: "var(--forest-glow)", display: "flex",
            alignItems: "center", justifyContent: "center",
          }}>
            <Icon size={16} color="var(--forest-light)" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{label}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{description}</div>
          </div>
        </div>
        <div style={{
          fontSize: 22, fontWeight: 800, color: "var(--forest-light)",
          fontFamily: "monospace", letterSpacing: "-0.04em",
        }}>
          {form[id]}{unit}
        </div>
      </div>

      {/* Slider */}
      <input
        type="range"
        min={min} max={max} step={step}
        value={form[id]}
        onChange={e => setForm(f => ({ ...f, [id]: id === "MIN_CONFIDENCE" ? parseFloat(e.target.value) : parseInt(e.target.value) }))}
        style={{ width: "100%", accentColor: "var(--forest-light)", cursor: "pointer" }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>

      {/* Number input */}
      <input
        type="number"
        min={min} max={max} step={step}
        value={form[id]}
        onChange={e => {
          const v = id === "MIN_CONFIDENCE" ? parseFloat(e.target.value) : parseInt(e.target.value);
          if (!isNaN(v) && v >= min && v <= max) setForm(f => ({ ...f, [id]: v }));
        }}
        style={{
          marginTop: 10, width: "100%",
          background: "var(--bg-elevated)", border: "1px solid var(--border)",
          color: "var(--text-primary)", borderRadius: 8, padding: "8px 12px",
          fontSize: 13, fontFamily: "monospace",
        }}
      />
    </div>
  );

  return (
    <div style={{ height: "100vh", overflowY: "auto", padding: 20 }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            Pipeline Settings
          </h1>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
            Adjust detection thresholds and polling intervals. Changes apply on the next pipeline run.
          </p>
        </div>

        {/* Info banner */}
        <div style={{
          display: "flex", gap: 10, alignItems: "flex-start",
          background: "var(--forest-glow)", border: "1px solid var(--forest)",
          borderRadius: 10, padding: "12px 16px", marginBottom: 20,
        }}>
          <Info size={14} color="var(--forest-light)" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12, color: "var(--forest-light)", lineHeight: 1.6 }}>
            API keys and credentials are managed in the <code style={{ fontFamily: "monospace" }}>.env</code> file
            and are not editable here for security reasons.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field
            id="MIN_CONFIDENCE"
            label="Minimum Confidence"
            description="Only fire detections above this confidence score will trigger alerts."
            icon={ShieldCheck}
            min={0.1} max={1.0} step={0.05} unit=""
          />
          <Field
            id="LOOKBACK_HOURS"
            label="Lookback Hours"
            description="How many hours back to search for fire data in each pipeline run."
            icon={Clock}
            min={1} max={24} step={1} unit="h"
          />
          <Field
            id="POLL_INTERVAL_SECONDS"
            label="Poll Interval"
            description="Seconds between automatic background pipeline runs."
            icon={Timer}
            min={300} max={7200} step={60} unit="s"
          />
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "flex-end" }}>
          <button
            onClick={reset}
            disabled={!changed}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "9px 16px", borderRadius: 8, fontSize: 13,
              background: "var(--bg-elevated)", border: "1px solid var(--border)",
              color: changed ? "var(--text-secondary)" : "var(--text-muted)",
              cursor: changed ? "pointer" : "not-allowed",
            }}
          >
            <RotateCcw size={13} /> Discard
          </button>

          <button
            onClick={save}
            disabled={!changed || saveState === "saving"}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "9px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: saveState === "error" ? "var(--risk-high-bg)" :
                          saveState === "saved" ? "var(--risk-low-bg)"  : "var(--forest)",
              border: "1px solid transparent",
              color: saveState === "error" ? "var(--risk-high)" :
                     saveState === "saved" ? "var(--risk-low)"  : "#fff",
              cursor: changed && saveState !== "saving" ? "pointer" : "not-allowed",
              opacity: !changed ? 0.5 : 1,
              transition: "all 200ms",
            }}
          >
            <Save size={13} />
            {saveState === "saving" ? "Saving…"  :
             saveState === "saved"  ? "Saved ✓"  :
             saveState === "error"  ? "Error ✗"  : "Save Changes"}
          </button>
        </div>

        {/* Preview */}
        <div style={{
          marginTop: 20, background: "var(--bg-elevated)", border: "1px solid var(--border)",
          borderRadius: 10, padding: "12px 16px",
        }}>
          <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700,
            letterSpacing: "0.08em", marginBottom: 8 }}>
            CURRENT SETTINGS PREVIEW
          </div>
          <pre style={{
            fontSize: 12, color: "var(--forest-light)", fontFamily: "monospace",
            lineHeight: 1.8, margin: 0,
          }}>
{JSON.stringify(form, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
