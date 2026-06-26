"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flame, LayoutDashboard, Database, Settings } from "lucide-react";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/history", label: "Database", icon: Database },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const path = usePathname();
  return (
    <aside style={{
      width: "var(--sidebar-w)",
      background: "var(--bg-surface)",
      borderRight: "1px solid var(--border)",
      display: "flex",
      flexDirection: "column",
      padding: "20px 12px",
      gap: 4,
      flexShrink: 0,
    }}>
      {/* Brand */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px 20px" }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: "var(--risk-high-bg)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Flame size={18} color="var(--risk-high)" />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            ZimFire
          </div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.05em" }}>
            MONITORING
          </div>
        </div>
      </div>

      {nav.map(({ href, label, icon: Icon }) => {
        const active = path === href;
        return (
          <Link key={href} href={href} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "9px 12px", borderRadius: 8,
            background: active ? "var(--forest-glow)" : "transparent",
            border: `1px solid ${active ? "var(--forest)" : "transparent"}`,
            color: active ? "var(--forest-light)" : "var(--text-secondary)",
            textDecoration: "none", fontSize: 13, fontWeight: active ? 600 : 400,
            transition: "all 150ms ease",
          }}>
            <Icon size={16} />
            {label}
          </Link>
        );
      })}

      {/* Footer */}
      <div style={{ marginTop: "auto", fontSize: 10, color: "var(--text-muted)", padding: "0 10px" }}>
        Zimbabwe · VIIRS + MTG
      </div>
    </aside>
  );
}
