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

interface Props {
  entries: JournalEntry[];
  messages: SystemMessage[];
  busy: boolean;
  /** Gönderilmekte olan oyuncu girdisi ve anlatıcının o ana kadar yazdığı metin. */
  pending?: { input: string; narration: string } | null;
  /** Öneriye dokununca o metni hamle olarak gönder. */
  onSuggest?: (text: string) => void;
}

export function Journal({ entries, messages, busy, pending, onSuggest }: Props) {
  const end = useRef<HTMLDivElement>(null);
  const last = entries[entries.length - 1];
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [entries.length, messages.length, busy, pending?.narration.length]);

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
            <div className="suggest">
              {e.hooks.map((h, i) => (
                e === last && onSuggest && !busy
                  ? <button key={i} className="btn small suggest-btn" onClick={() => onSuggest(h.text)}>➜ {h.text}</button>
                  : <span key={i} className="chip">💡 {h.text}</span>
              ))}
            </div>
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
          {e.chronicle?.map((x) => (
            <aside key={x.id} className="chronicle">
              <div className="chronicle-title">📜 {x.title}</div>
              <p>{x.text}</p>
            </aside>
          ))}
        </article>
      ))}
      {messages.map((m) => (
        <div key={m.id} className={`system-msg ${m.kind === "error" || m.kind === "rejected" ? "error" : "notice"}`}>
          {m.kind === "clarify" ? "❓ " : m.kind === "rejected" ? "⛔ " : "ℹ️ "}{m.text}
        </div>
      ))}
      {busy && pending && (
        <article className="entry card pending">
          {pending.input && <div className="you">› {pending.input}</div>}
          {pending.narration
            ? <div className="narr">{pending.narration.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}<span className="caret" /></div>
            : <div className="row muted"><div className="spinner" /> Zarlar atılıyor, anlatıcı düşünüyor…</div>}
        </article>
      )}
      {busy && !pending && <div className="system-msg row muted"><div className="spinner" /> Zarlar atılıyor, anlatıcı yazıyor…</div>}
      <div ref={end} />
    </div>
  );
}
