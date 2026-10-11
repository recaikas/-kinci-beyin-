import { useMemo, useRef, useState } from "react";
import type { GameAction } from "@kader/engine";
import type { GameView, JournalEntry } from "@kader/game";
import type { Backend, CampaignData } from "../backend/types.ts";
import { LocalBackend } from "../backend/local.ts";
import { Journal, type SystemMessage } from "../components/Journal.tsx";
import { DiceToasts } from "../components/Dice.tsx";
import { ShopModal } from "../components/Shop.tsx";
import { FactionsPanel, InventoryPanel, MapPanel, QuestsPanel, SheetPanel, SpellsPanel } from "../components/Panels.tsx";

type Tab = "map" | "sheet" | "inventory" | "spells" | "quests" | "factions";
const TABS: [Tab, string][] = [["map", "Çevre"], ["sheet", "Karakter"], ["inventory", "Envanter"], ["spells", "Büyü"], ["quests", "Görevler"], ["factions", "Güçler"]];

let msgSeq = 0;

export function Game({ backend, initial, onExit }: { backend: Backend; initial: CampaignData; onExit: () => void }) {
  const [view, setView] = useState<GameView>(initial.view);
  const [journal, setJournal] = useState<JournalEntry[]>(initial.journal);
  const [messages, setMessages] = useState<SystemMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [tab, setTab] = useState<Tab>("map");
  const [shopId, setShopId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [lastEntry, setLastEntry] = useState<JournalEntry | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const me = view.sheet.id;
  const enc = view.encounter;
  const dying = view.sheet.isAlive && view.sheet.hp === 0 && !view.sheet.deathSaves.stable;
  const dead = !view.sheet.isAlive;

  const send = async (input: { text: string } | { action: GameAction; text: string }) => {
    if (busy) return;
    setBusy(true);
    setMessages([]);
    try {
      const r = await backend.playTurn(initial.id, input);
      if (r.status === "resolved") {
        setJournal((j) => [...j, r.entry]);
        setView(r.view);
        setLastEntry(r.entry);
        if ("text" in input && !("action" in input)) setText("");
      } else if (r.status === "clarify") {
        setMessages([{ id: ++msgSeq, kind: "clarify", text: r.question }]);
      } else if (r.status === "rejected") {
        setMessages([{ id: ++msgSeq, kind: "rejected", text: r.reason }]);
      } else {
        setMessages([{ id: ++msgSeq, kind: "info", text: `Oyun dışı: ${r.summary}. Kurallar ve arayüz için yan paneldeki sekmelere bak.` }]);
      }
    } catch (e) {
      setMessages([{ id: ++msgSeq, kind: "error", text: (e as Error).message }]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  const act = (action: GameAction, label: string) => send({ action, text: label });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (t) send({ text: t });
  };

  const quick = useMemo(() => {
    const q: { label: string; run: () => void; tone?: string }[] = [];
    if (dead) return q;
    if (dying) {
      q.push({ label: "🎲 Ölüm kurtarma atışı", run: () => act({ type: "death_save", actorId: me }, "Ölüm kurtarma atışı"), tone: "primary" });
      return q;
    }
    const weapon = view.sheet.inventory.find((i) => i.type === "weapon" && i.equipped) ?? view.sheet.inventory.find((i) => i.type === "weapon");
    const potion = view.sheet.inventory.find((i) => i.type === "potion" && i.key.includes("healing"));
    if (enc) {
      if (enc.myTurn) {
        for (const h of view.entities.filter((e) => e.hostile && e.alive).slice(0, 4)) {
          q.push({ label: `⚔ ${h.name}`, run: () => act({ type: "attack", actorId: me, targetId: h.id, weaponKey: weapon?.key ?? "unarmed" }, `${h.name}'e saldırıyorum`), tone: "danger" });
        }
        q.push({ label: "🛡 Kaçın", run: () => act({ type: "dodge", actorId: me }, "Kaçınmaya odaklanıyorum") });
        q.push({ label: "↩ Geri çekil", run: () => act({ type: "disengage", actorId: me }, "Geri çekiliyorum") });
        if (potion) q.push({ label: "🧪 İksir", run: () => act({ type: "use_item", actorId: me, itemKey: potion.key }, "İksir içiyorum") });
        q.push({ label: "⏭ Turu bitir", run: () => act({ type: "end_turn", actorId: me }, "Turumu bitiriyorum") });
      }
      return q;
    }
    q.push({ label: "👁 Etrafa bak", run: () => act({ type: "look", actorId: me }, "Etrafa bakıyorum") });
    q.push({ label: "🔍 Araştır", run: () => act({ type: "skill_check", actorId: me, skill: "investigation", difficulty: "medium" }, "Çevreyi dikkatle araştırıyorum") });
    q.push({ label: "🥷 Saklan", run: () => act({ type: "hide", actorId: me }, "Gölgelere saklanıyorum") });
    if (view.sheet.hp < view.sheet.maxHp) q.push({ label: "☕ Kısa dinlen", run: () => act({ type: "rest", actorId: me, kind: "short", hitDice: { [hitDie(view)]: 1 } }, "Kısa bir mola veriyorum") });
    q.push({ label: "🌙 Uzun dinlen", run: () => act({ type: "rest", actorId: me, kind: "long" }, "Kamp kurup uyuyorum") });
    if (potion && view.sheet.hp < view.sheet.maxHp) q.push({ label: "🧪 İksir iç", run: () => act({ type: "use_item", actorId: me, itemKey: potion.key }, "İyileştirme iksiri içiyorum") });
    return q;
  }, [view, busy]);

  const shop = view.shops.find((s) => s.merchantId === shopId) ?? null;

  const exportSave = () => {
    if (!(backend instanceof LocalBackend)) return;
    const blob = new Blob([backend.exportCampaign(initial.id)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `kader-zari-${view.sheet.name}-${view.turn}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="game">
      <div className="topbar">
        <button className="btn small" onClick={onExit} aria-label="Ana sayfa">←</button>
        <div className="title grow">{view.title}</div>
        <span className="chip">{view.clock}</span>
        <span className="chip gold" title="Konum">📍 {view.location.name}</span>
        <span className="chip" title="Anlatıcı">{backend.aiLabel()}</span>
        {backend instanceof LocalBackend && <button className="btn small" onClick={exportSave} title="Kaydı indir">💾</button>}
      </div>

      <div className="main">
        {enc && (
          <div className="combat">
            <div className="row">
              <b className="grow">⚔ Savaş — {enc.round}. raunt</b>
              <span className={`chip ${enc.myTurn ? "gold" : ""}`}>{enc.myTurn ? "Sıra sende" : `Sıra: ${enc.currentName}`}</span>
              {enc.economy && <span className="chip small">Eylem {enc.economy.action ? "●" : "○"} · Bonus {enc.economy.bonusAction ? "●" : "○"} · {Math.round(enc.economy.movement * 0.3)} m</span>}
            </div>
            <div className="order">
              {enc.order.map((o) => (
                <span key={o.id} className={`slot ${o.id === enc.current ? "cur" : ""} ${o.alive && o.health !== "baygın" ? "" : "down"}`}>
                  {o.initiative} · {o.name} <span className="muted">({o.health})</span>
                </span>
              ))}
            </div>
          </div>
        )}
        <Journal entries={journal} messages={messages} busy={busy} />
        <div className="composer">
          {dead ? (
            <div className="error">Karakterin öldü. Hikâyesi burada sona eriyor — ana sayfadan yeni bir kahramanla başlayabilirsin.</div>
          ) : (
            <>
              <div className="quick">
                {quick.map((q) => (
                  <button key={q.label} className={`btn small ${q.tone ?? ""}`} disabled={busy} onClick={q.run}>{q.label}</button>
                ))}
              </div>
              <form onSubmit={submit}>
                <textarea
                  ref={inputRef}
                  className="input"
                  placeholder={enc ? (enc.myTurn ? "Hamleni yaz… (ör. goblin'e kılıçla saldırıyorum)" : "Sıra düşmanda…") : "Ne yapıyorsun? (ör. Muhafıza mektubu gösterip kapıdan geçmek istiyorum)"}
                  value={text}
                  maxLength={1000}
                  disabled={busy}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(e); } }}
                  aria-label="Eylem"
                />
                <button className="btn primary" disabled={busy || !text.trim()}>{busy ? <span className="spinner" /> : "Gönder"}</button>
              </form>
            </>
          )}
        </div>
      </div>

      <div className={`side ${collapsed ? "collapsed" : ""}`}>
        <div className="tabs" role="tablist">
          {TABS.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={`tab ${tab === k ? "on" : ""}`}
              onClick={() => { if (tab === k) setCollapsed((c) => !c); else { setTab(k); setCollapsed(false); } }}>
              {label}{k === "quests" && view.quests.some((q) => q.status === "available") ? " •" : ""}
            </button>
          ))}
        </div>
        <div className="panel">
          {tab === "map" && <MapPanel view={view} act={act} busy={busy} openShop={setShopId} />}
          {tab === "sheet" && <SheetPanel view={view} act={act} busy={busy} />}
          {tab === "inventory" && <InventoryPanel view={view} act={act} busy={busy} />}
          {tab === "spells" && <SpellsPanel view={view} act={act} busy={busy} />}
          {tab === "quests" && <QuestsPanel view={view} act={act} busy={busy} />}
          {tab === "factions" && <FactionsPanel view={view} act={act} busy={busy} />}
        </div>
      </div>

      {shop && (
        <ShopModal
          shop={shop}
          view={view}
          busy={busy}
          onClose={() => setShopId(null)}
          onBuy={(itemKey, qty, haggle) => act({ type: "buy", actorId: me, merchantId: shop.merchantId, itemKey, qty, haggle }, `${shop.name}'den satın alıyorum`)}
          onSell={(itemKey, qty, haggle) => act({ type: "sell", actorId: me, merchantId: shop.merchantId, itemKey, qty, haggle }, `${shop.name}'e satıyorum`)}
        />
      )}
      <DiceToasts entry={lastEntry} />
    </div>
  );
}

function hitDie(view: GameView): number {
  const cls = view.sheet.className;
  if (/Barbar/.test(cls)) return 12;
  if (/Savaşçı|Paladin|Korucu/.test(cls)) return 10;
  if (/Sihirbaz|Büyücü/.test(cls)) return 6;
  return 8;
}
