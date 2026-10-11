import { useEffect, useRef } from "react";
import type { JournalEntry } from "@kader/game";

export interface SystemMessage {
  id: number;
  kind: "clarify" | "rejected" | "info" | "error";
  text: string;
}

const TIER_TR: Record<string, string> = {
  critical_success: "Kritik başarı",
  success: "Başarı",
  partial: "Kısmi başarı",
  failure: "Başarısızlık",
  critical_failure: "Kritik başarısızlık",
};

export function Journal({ entries, messages, busy }: { entries: JournalEntry[]; messages: SystemMessage[]; busy: boolean }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [entries.length, messages.length, busy]);

  return (
    <div className="journal" aria-live="polite">
      {entries.map((e) => (
        <article key={e.n} className={`entry card tier-${e.tier}`} data-turn={e.n}>
          {e.input && <div className="you">› {e.input}</div>}
          <div className="narr">{e.narration.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}</div>
          {e.dialogue.length > 0 && (
            <div className="dialogue">
              {e.dialogue.map((d, i) => <div key={i}><b>{d.speaker}:</b> “{d.line}”</div>)}
            </div>
          )}
          {e.n > 0 && (
            <div className="meta">
              <span className={`chip ${e.tier.includes("success") ? "green" : e.tier === "partial" ? "gold" : "red"}`}>{TIER_TR[e.tier] ?? e.tier}</span>
              {e.rolls.slice(0, 6).map((r, i) => <span key={i} className="chip" title={r.breakdown}>🎲 {r.reason}: {r.breakdown.split(" = ").pop()}</span>)}
              {e.rolls.length > 6 && <span className="chip">+{e.rolls.length - 6} zar</span>}
              {e.source !== "template" && <span className="chip blue" title="Anlatıcı">✦ Haiku</span>}
            </div>
          )}
          {e.hooks.length > 0 && (
            <div className="meta">{e.hooks.map((h, i) => <span key={i} className="chip gold">💡 {h.text}</span>)}</div>
          )}
          {e.n > 0 && (e.facts.length > 0 || e.rolls.length > 0) && (
            <details>
              <summary>Motorun kayıtları (değişmez gerçekler, zarlar)</summary>
              <ul>
                {e.facts.map((f, i) => <li key={`f${i}`}>{f}</li>)}
                {e.rolls.map((r, i) => <li key={`r${i}`}>🎲 {r.reason}: {r.breakdown}</li>)}
              </ul>
            </details>
          )}
        </article>
      ))}
      {messages.map((m) => (
        <div key={m.id} className={`system-msg ${m.kind === "error" || m.kind === "rejected" ? "error" : "notice"}`}>
          {m.kind === "clarify" ? "❓ " : m.kind === "rejected" ? "⛔ " : "ℹ️ "}{m.text}
        </div>
      ))}
      {busy && <div className="system-msg row muted"><div className="spinner" /> Zarlar atılıyor, anlatıcı yazıyor…</div>}
      <div ref={end} />
    </div>
  );
}
