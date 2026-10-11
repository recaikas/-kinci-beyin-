import { useEffect, useState } from "react";
import type { JournalEntry } from "@kader/game";

interface Toast { id: number; label: string; value: string; kind: "crit" | "fumble" | "normal" }

let seq = 0;

/** Yeni bir turdaki d20 atışlarını kısa bir animasyonla gösterir. */
export function DiceToasts({ entry }: { entry: JournalEntry | null }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => {
    if (!entry || entry.n === 0) return;
    const items: Toast[] = entry.rolls
      .filter((r) => /d20\[/.test(r.breakdown))
      .slice(0, 3)
      .map((r) => {
        const m = /d20\[(\d+)(?:, (\d+))?\]/.exec(r.breakdown);
        const nat = r.tier === "critical_success" && m ? 20 : 0;
        const total = r.breakdown.split(" = ").pop() ?? "";
        const kept = m ? (r.breakdown.includes("dezavantaj") ? Math.min(Number(m[1]), Number(m[2] ?? m[1])) : Math.max(Number(m[1]), Number(m[2] ?? m[1]))) : 0;
        return {
          id: ++seq,
          label: r.reason,
          value: total,
          kind: kept === 20 || nat === 20 ? "crit" : kept === 1 ? "fumble" : "normal",
          face: kept,
        } as Toast & { face: number };
      });
    if (!items.length) return;
    setToasts(items);
    const t = setTimeout(() => setToasts([]), 2600);
    return () => clearTimeout(t);
  }, [entry?.n]);

  return (
    <div className="dice-toast" aria-hidden>
      {toasts.map((t) => (
        <div key={t.id} className={`die ${t.kind}`}>
          <div className="face">{(t as Toast & { face: number }).face || "?"}</div>
          <div>
            <div className="small muted">{t.label}</div>
            <b>{t.value}</b>
          </div>
        </div>
      ))}
    </div>
  );
}
