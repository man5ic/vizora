"use client";

import { useState } from "react";
import { Sparkles, Loader2, ArrowUp } from "lucide-react";

const EXAMPLES = [
  "Find everything important in these images",
  "Extract all movie names",
  "Find all images containing prices",
  "Find potential damage in these photos",
];

export function AskVizora({
  onAsk,
  busy,
  disabled,
  onTextChange,
}: {
  onAsk: (query: string) => void;
  busy: boolean;
  disabled?: boolean;
  /** Fires as the user types so the gallery can filter live (search and ask share one box). */
  onTextChange?: (text: string) => void;
}) {
  const [value, setValue] = useState("");

  const update = (v: string) => {
    setValue(v);
    onTextChange?.(v);
  };

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || busy) return;
    onAsk(trimmed);
    onTextChange?.(""); // a full question shouldn't leave the gallery filtered
  };

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <div className="flex items-center gap-2 px-2 pb-2 text-[var(--color-text-faint)] text-xs">
        <Sparkles size={13} className="text-[var(--color-accent)]" />
        Search or ask
        <span className="ml-auto text-[10px]">Type to filter the gallery · Enter to ask Vizora</span>
      </div>
      <div className="flex items-end gap-2">
        <textarea
          value={value}
          onChange={(e) => update(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          placeholder={disabled ? "Upload some images first…" : "Ask anything about your images…"}
          disabled={disabled}
          className="flex-1 resize-none bg-transparent outline-none text-sm placeholder:text-[var(--color-text-faint)] px-2 py-2 disabled:opacity-50"
        />
        <button
          onClick={submit}
          disabled={disabled || busy || !value.trim()}
          className="shrink-0 w-9 h-9 rounded-lg bg-[var(--color-accent)] text-white flex items-center justify-center disabled:opacity-40 hover:brightness-110 transition"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <ArrowUp size={16} />}
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5 px-2 pt-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => !disabled && !busy && onAsk(ex)}
            disabled={disabled || busy}
            className="text-[11px] px-2 py-1 rounded-full border border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-text)] transition disabled:opacity-40"
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}
