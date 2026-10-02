"use client";

import { Images, Layers, Database, FileBarChart2, Eye, ShieldCheck } from "lucide-react";

export type ViewKey = "images" | "groups" | "extracted" | "evidence" | "reports";

const NAV: Array<{ key: ViewKey; label: string; icon: typeof Images }> = [
  { key: "images", label: "All images", icon: Images },
  { key: "groups", label: "Smart groups", icon: Layers },
  { key: "extracted", label: "Extracted data", icon: Database },
  { key: "evidence", label: "Evidence", icon: ShieldCheck },
  { key: "reports", label: "Reports", icon: FileBarChart2 },
];

export function Sidebar({
  active,
  onNavigate,
  imageCount,
}: {
  active: ViewKey;
  onNavigate: (v: ViewKey) => void;
  imageCount: number;
}) {
  return (
    <aside className="w-60 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col h-screen sticky top-0">
      <div className="px-5 py-6 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-[var(--color-accent)] flex items-center justify-center">
          <Eye size={17} strokeWidth={2.25} className="text-white" />
        </div>
        <span className="font-display text-lg font-semibold tracking-tight">Vizora</span>
      </div>

      <nav className="px-3 flex flex-col gap-0.5 mt-2">
        {NAV.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left ${
                isActive
                  ? "bg-[var(--color-accent-soft)] text-white"
                  : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text)]"
              }`}
            >
              <Icon size={16} strokeWidth={2} className={isActive ? "text-[var(--color-accent)]" : ""} />
              {item.label}
              {item.key === "images" && imageCount > 0 && (
                <span className="ml-auto text-xs text-[var(--color-text-faint)]">{imageCount}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto px-5 py-5 text-xs text-[var(--color-text-faint)] leading-relaxed">
        Ask your images anything. Get answers with evidence — every result traces back to the
        pixels it came from.
      </div>
    </aside>
  );
}
