import { useState } from "react";
import type { GameAction } from "@kader/engine";
import type { GameView } from "@kader/game";

export type Act = (action: GameAction, label: string) => void;
const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
const meters = (ft: number) => `${Math.round(ft * 0.3)} m`;

function Hp({ hp, max, temp }: { hp: number; max: number; temp: number }) {
  return (
    <div>
      <div className="row small"><b className="grow">HP {hp}/{max}</b>{temp > 0 && <span className="chip blue">+{temp} geçici</span>}</div>
      <div className="hpbar"><div style={{ width: `${Math.max(0, Math.min(100, (hp / max) * 100))}%` }} /></div>
    </div>
  );
}

/* ------------------------------------------------------------ Karakter */
export function SheetPanel({ view, act, busy }: { view: GameView; act: Act; busy: boolean }) {
  const s = view.sheet;
  const me = s.id;
  const hostiles = view.entities.filter((e) => e.hostile && e.alive);
  const friends = view.entities.filter((e) => !e.hostile && e.alive);
  const xpPct = s.xpNext ? Math.min(100, (s.xp / s.xpNext) * 100) : 100;
  const abilityButtons: Record<string, (() => void) | null> = {
    second_wind: () => act({ type: "class_ability", actorId: me, ability: "second_wind" }, "İkinci Soluk"),
    action_surge: view.encounter ? () => act({ type: "class_ability", actorId: me, ability: "action_surge" }, "Eylem Atılımı") : null,
    rage: () => act({ type: "class_ability", actorId: me, ability: "rage" }, "Öfkeleniyorum!"),
    lay_on_hands: () => act({ type: "class_ability", actorId: me, ability: "lay_on_hands", targetId: me }, "Şifa Eli"),
    bardic_inspiration: friends[0] ? () => act({ type: "class_ability", actorId: me, ability: "bardic_inspiration", targetId: friends[0]!.id }, `${friends[0]!.name}'a Ozan İlhamı`) : null,
    breath_weapon: hostiles.length ? () => act({ type: "class_ability", actorId: me, ability: "breath_weapon", targetIds: hostiles.slice(0, 4).map((h) => h.id) }, "Nefes silahı!") : null,
    ki: hostiles[0] ? () => act({ type: "class_ability", actorId: me, ability: "flurry_of_blows", targetId: hostiles[0]!.id }, `${hostiles[0]!.name}'a darbe yağmuru`) : null,
  };
  return (
    <>
      <div className="card">
        <h2 style={{ marginBottom: 2 }}>{s.name}</h2>
        <div className="muted small">{s.race} {s.className} · {s.level}. seviye{s.isAlive ? "" : " · ☠ ÖLÜ"}</div>
        <div style={{ marginTop: 10 }}><Hp hp={s.hp} max={s.maxHp} temp={s.tempHp} /></div>
        <div className="small muted" style={{ marginTop: 6 }}>XP {s.xp}{s.xpNext ? ` / ${s.xpNext}` : ""}</div>
        <div className="hpbar temp"><div style={{ width: `${xpPct}%` }} /></div>
        <div className="stat-big" style={{ marginTop: 10 }}>
          <div className="stat"><div className="v">{s.ac}</div><div className="k">AC</div></div>
          <div className="stat"><div className="v">{fmt(s.initiative)}</div><div className="k">İnisiyatif</div></div>
          <div className="stat"><div className="v">{meters(s.speed)}</div><div className="k">Hız</div></div>
          <div className="stat"><div className="v">+{s.proficiency}</div><div className="k">Yeterlilik</div></div>
        </div>
        {(s.conditions.length > 0 || s.buffs.length > 0 || s.exhaustion > 0) && (
          <div className="row" style={{ marginTop: 8 }}>
            {s.conditions.map((c) => <span key={c} className="chip red">{c}</span>)}
            {s.buffs.map((b) => <span key={b} className="chip blue">{b}</span>)}
            {s.exhaustion > 0 && <span className="chip red">Bitkinlik {s.exhaustion}</span>}
          </div>
        )}
        {s.hp === 0 && s.isAlive && (
          <div className="row" style={{ marginTop: 8 }}>
            <span className="chip green">Başarı {s.deathSaves.successes}/3</span>
            <span className="chip red">Başarısızlık {s.deathSaves.failures}/3</span>
            {s.deathSaves.stable && <span className="chip">Stabil</span>}
          </div>
        )}
      </div>

      {s.resources.length > 0 && (
        <div className="card">
          <h3>Yetenekler</h3>
          <div className="list">
            {s.resources.map((r) => (
              <div key={r.key} className="li">
                <div className="name">{r.name}<small>{r.current}/{r.max} · {r.recharge}</small></div>
                {abilityButtons[r.key] && <button className="btn small" disabled={busy || r.current <= 0} onClick={abilityButtons[r.key]!}>Kullan</button>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h3>Yetenek değerleri</h3>
        <div className="abil6">
          {s.abilities.map((a) => (
            <div key={a.key} className="stat" title={`Kurtarma ${fmt(a.save)}`}>
              <div className="v">{a.score}</div>
              <div className="k">{a.name}</div>
              <div className="small">{fmt(a.mod)} · K {fmt(a.save)}{a.proficient ? "●" : ""}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>Beceriler <span className="muted small">(pasif Algı {s.passivePerception})</span></h3>
        <div className="list">
          {s.skills.map((k) => (
            <div key={k.key} className="li" style={{ padding: "4px 10px" }}>
              <span>{k.expertise ? "◆" : k.proficient ? "●" : "○"}</span>
              <div className="name">{k.name} <small style={{ display: "inline" }}>({k.ability.slice(0, 3)})</small></div>
              <b>{fmt(k.mod)}</b>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------ Envanter */
export function InventoryPanel({ view, act, busy }: { view: GameView; act: Act; busy: boolean }) {
  const s = view.sheet;
  return (
    <div className="card">
      <div className="row"><h3 className="grow" style={{ margin: 0 }}>Envanter</h3><span className="chip gold">{s.wallet}</span></div>
      <div className="muted small" style={{ margin: "6px 0 10px" }}>Yük: {s.carried} / {s.capacity} lb</div>
      <div className="list">
        {s.inventory.map((i) => (
          <div key={i.key} className="li" title={i.description}>
            <div className="name">{i.name}{i.qty > 1 ? ` ×${i.qty}` : ""}<small>{i.description}</small></div>
            {(i.type === "armor" || i.type === "weapon") && (
              <button className={`btn small ${i.equipped ? "active" : ""}`} disabled={busy}
                onClick={() => act({ type: "equip", actorId: s.id, itemKey: i.key, equipped: !i.equipped }, `${i.name} ${i.equipped ? "çıkar" : "kuşan"}`)}>
                {i.equipped ? "Kuşanılı" : "Kuşan"}
              </button>
            )}
            {(i.type === "potion" || i.type === "scroll") && (
              <button className="btn small" disabled={busy} onClick={() => act({ type: "use_item", actorId: s.id, itemKey: i.key }, `${i.name} kullan`)}>Kullan</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ Büyüler */
export function SpellsPanel({ view, act, busy }: { view: GameView; act: Act; busy: boolean }) {
  const sc = view.sheet.spellcasting;
  const [picking, setPicking] = useState<string | null>(null);
  const [slot, setSlot] = useState<number>(1);
  if (!sc) return <div className="card muted">Bu karakter büyü yapamaz.</div>;
  const me = view.sheet.id;
  const hostiles = view.entities.filter((e) => e.alive && e.hostile);
  const allies = [{ id: me, name: `${view.sheet.name} (kendin)` }, ...view.entities.filter((e) => e.alive && !e.hostile && e.kind !== "monster")];
  const corpses = view.entities.filter((e) => !e.alive);
  const levels = sc.slots.filter((x) => x.current > 0).map((x) => x.level);
  return (
    <>
      <div className="card">
        <div className="row"><h3 className="grow" style={{ margin: 0 }}>Büyü</h3><span className="chip">DC {sc.dc}</span><span className="chip">Saldırı {fmt(sc.attack)}</span></div>
        <div className="row" style={{ marginTop: 8 }}>
          {sc.slots.map((x) => <span key={x.level} className={`chip ${x.current ? "gold" : ""}`}>{x.level}. sv: {"◆".repeat(x.current)}{"◇".repeat(Math.max(0, x.max - x.current))}</span>)}
        </div>
        {sc.concentratingOn && <div className="small" style={{ marginTop: 6 }}>Konsantrasyon: <b>{sc.concentratingOn}</b></div>}
      </div>
      <div className="list">
        {sc.spells.map((sp) => {
          const usable = sp.level === 0 || levels.some((l) => l >= sp.level);
          const open = picking === sp.key;
          const targets = sp.key === "revivify" ? corpses : /cure|heal|bless|shield_of_faith|aid|mage_armor|false_life|invisibility|restoration|guidance/.test(sp.key) ? allies : hostiles;
          return (
            <div key={sp.key} className="li" style={{ display: "block" }}>
              <div className="row">
                <div className="name grow">{sp.name} <span className="muted small">{sp.level === 0 ? "cantrip" : `${sp.level}. sv`}{sp.concentration ? " · K" : ""}{sp.castingTime === "bonus_action" ? " · bonus" : ""}</span><small>{sp.summary}</small></div>
                <button className="btn small" disabled={busy || !usable} onClick={() => { setPicking(open ? null : sp.key); setSlot(Math.max(sp.level, levels.find((l) => l >= sp.level) ?? sp.level)); }}>{open ? "Vazgeç" : "Yap"}</button>
              </div>
              {open && (
                <div className="row" style={{ marginTop: 8 }}>
                  {sp.level > 0 && (
                    <select className="input" style={{ width: "auto" }} value={slot} onChange={(e) => setSlot(Number(e.target.value))}>
                      {levels.filter((l) => l >= sp.level).map((l) => <option key={l} value={l}>{l}. seviye yuva</option>)}
                    </select>
                  )}
                  {targets.length === 0 && <span className="muted small">Uygun hedef yok</span>}
                  {targets.map((t) => (
                    <button key={t.id} className="btn small" onClick={() => { setPicking(null); act({ type: "cast_spell", actorId: me, spellKey: sp.key, slotLevel: sp.level === 0 ? 0 : slot, targetIds: [t.id] }, `${t.name} hedefine ${sp.name}`); }}>
                      → {t.name}
                    </button>
                  ))}
                  {hostiles.length > 1 && /fireball|burning|thunderwave|shatter|lightning|sleep|faerie|entangle|hypnotic|arms_of_hadar/.test(sp.key) && (
                    <button className="btn small primary" onClick={() => { setPicking(null); act({ type: "cast_spell", actorId: me, spellKey: sp.key, slotLevel: sp.level === 0 ? 0 : slot, targetIds: hostiles.map((h) => h.id) }, `Tüm düşmanlara ${sp.name}`); }}>
                      Tüm düşmanlar
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ------------------------------------------------------------ Görevler */
export function QuestsPanel({ view, act, busy }: { view: GameView; act: Act; busy: boolean }) {
  const order = { open: 0, available: 1, completed: 2, failed: 3 } as Record<string, number>;
  const quests = [...view.quests].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));
  if (!quests.length) return <div className="card muted">Henüz görev yok.</div>;
  return (
    <div className="list">
      {quests.map((q) => (
        <div key={q.id} className="card">
          <div className="row">
            <h3 className="grow" style={{ margin: 0 }}>{q.title}</h3>
            <span className={`chip ${q.status === "completed" ? "green" : q.status === "open" ? "gold" : ""}`}>
              {q.status === "open" ? "Açık" : q.status === "completed" ? "Tamamlandı" : q.status === "available" ? "Teklif" : "Başarısız"}
            </span>
          </div>
          <div className="muted small" style={{ margin: "6px 0" }}>{q.description}{q.giver ? ` — ${q.giver}` : ""}</div>
          <ul className="small" style={{ margin: "4px 0", paddingLeft: 18 }}>
            {q.objectives.map((o, i) => <li key={i} style={{ textDecoration: o.done ? "line-through" : "none" }}>{o.text}{o.progress ? ` (${o.progress})` : ""}</li>)}
          </ul>
          <div className="small">Ödül: <span className="muted">{q.rewards || "—"}</span></div>
          {q.status === "available" && (
            <button className="btn small primary" style={{ marginTop: 8 }} disabled={busy}
              onClick={() => act({ type: "accept_quest", actorId: view.sheet.id, questId: q.id }, `"${q.title}" görevini kabul ediyorum`)}>Görevi kabul et</button>
          )}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ Çevre / harita */
export function MapPanel({ view, act, busy, openShop }: { view: GameView; act: Act; busy: boolean; openShop: (merchantId: string) => void }) {
  const me = view.sheet.id;
  const [bribe, setBribe] = useState<string | null>(null);
  const [amount, setAmount] = useState(5);
  const inCombat = !!view.encounter;
  const weapon = view.sheet.inventory.find((i) => i.type === "weapon" && i.equipped) ?? view.sheet.inventory.find((i) => i.type === "weapon");
  return (
    <>
      <div className="card">
        <h3 style={{ marginBottom: 4 }}>{view.location.name}</h3>
        <div className="muted small">{view.location.description}</div>
        <div className="row" style={{ marginTop: 8 }}>
          {view.location.danger > 0 ? <span className="chip red">Tehlike {view.location.danger}/20</span> : <span className="chip green">Güvenli</span>}
          {view.location.safeRest && <span className="chip blue">Dinlenme yeri</span>}
        </div>
      </div>
      <div className="card">
        <h3>Yollar</h3>
        <div className="list">
          {view.exits.map((e) => (
            <button key={e.id} className="btn" disabled={busy || inCombat || e.locked} style={{ justifyContent: "space-between" }}
              onClick={() => act({ type: "move", actorId: me, toLocationId: e.id, minutes: e.minutes }, `${e.name} yönüne gidiyorum`)}>
              <span>→ {e.name}</span><span className="muted small">{e.locked ? "🔒 harita gerekli" : `${e.minutes} dk`}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="card">
        <h3>Burada</h3>
        {view.entities.length === 0 && <div className="muted small">Kimse yok.</div>}
        <div className="list">
          {view.entities.map((e) => (
            <div key={e.id} className={`li entity ${e.hostile ? "hostile" : ""} ${e.alive ? "" : "dead"}`} style={{ display: "block" }}>
              <div className="row">
                <div className="name grow">{e.name}<small>{e.alive ? `${e.health} · ${e.hostile ? "düşman" : e.attitude}` : e.looted ? "ceset (arandı)" : "ceset"}{e.conditions.length ? ` · ${e.conditions.join(", ")}` : ""}</small></div>
                {e.merchant && <button className="btn small" disabled={busy || inCombat} onClick={() => openShop(e.id)}>Dükkân</button>}
              </div>
              <div className="menu" style={{ marginTop: 6 }}>
                {e.alive && !e.hostile && !inCombat && (
                  <>
                    <button className="btn small" disabled={busy} onClick={() => act({ type: "talk", actorId: me, targetId: e.id, minutes: 2 }, `${e.name} ile konuşuyorum`)}>Konuş</button>
                    <button className="btn small" disabled={busy} onClick={() => act({ type: "social", actorId: me, targetId: e.id, approach: "persuade", risk: "minor" }, `${e.name}'i ikna etmeye çalışıyorum`)}>İkna</button>
                    <button className="btn small" disabled={busy} onClick={() => setBribe(bribe === e.id ? null : e.id)}>Rüşvet</button>
                    <button className="btn small" disabled={busy} onClick={() => act({ type: "social", actorId: me, targetId: e.id, approach: "intimidate", risk: "minor" }, `${e.name}'i tehdit ediyorum`)}>Gözdağı</button>
                  </>
                )}
                {e.alive && (
                  <button className="btn small danger" disabled={busy || (inCombat && !view.encounter?.myTurn)}
                    onClick={() => act({ type: "attack", actorId: me, targetId: e.id, weaponKey: weapon?.key ?? "unarmed" }, `${e.name}'e ${weapon?.name ?? "yumrukla"} saldırıyorum`)}>
                    Saldır
                  </button>
                )}
                {!e.alive && !e.looted && !inCombat && (
                  <button className="btn small" disabled={busy} onClick={() => act({ type: "loot", actorId: me, targetId: e.id }, `${e.name} cesedini arıyorum`)}>Ara</button>
                )}
              </div>
              {bribe === e.id && (
                <div className="row" style={{ marginTop: 6 }}>
                  <input className="input" type="number" min={1} max={500} value={amount} onChange={(ev) => setAmount(Math.max(1, Number(ev.target.value)))} style={{ width: 90 }} />
                  <span className="small">altın</span>
                  <button className="btn small primary" disabled={busy || view.sheet.walletCp < amount * 100}
                    onClick={() => { setBribe(null); act({ type: "social", actorId: me, targetId: e.id, approach: "bribe", risk: "significant", bribeCp: amount * 100 }, `${e.name}'e ${amount} altın rüşvet veriyorum`); }}>Ver</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------ Fraksiyonlar */
export function FactionsPanel({ view, act, busy }: { view: GameView; act: Act; busy: boolean }) {
  const me = view.sheet.id;
  const ids = view.factions.map((f) => f.id);
  return (
    <>
      <div className="card">
        <h3>Tarihin akışı</h3>
        <div className="muted small">Dünya senden bağımsız ilerler; ama başardıkların olayların hangi yönden gelişeceğini belirler.</div>
        {view.upcoming && (
          <div className="notice small" style={{ marginTop: 8 }}>⏳ <b>{view.upcoming.clock}</b> civarı: {view.upcoming.teaser}</div>
        )}
        {view.chronicle.length === 0 && <div className="muted small" style={{ marginTop: 8 }}>Henüz kayda değer bir olay yaşanmadı.</div>}
        {view.chronicle.map((c, i) => (
          <div key={i} className="chronicle small" style={{ marginTop: 8 }}>
            <div className="chronicle-title">📜 {c.title} <span className="muted">· {c.clock}</span></div>
            <p>{c.text}</p>
          </div>
        ))}
      </div>
      <div className="card">
        <h3>Bölgenin güçleri</h3>
        <div className="muted small">Fraksiyonların ekonomisi, ordusu ve istikrarı motor tarafından hesaplanır. Zamanı ilerletince dünya da ilerler.</div>
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn small" disabled={busy || !!view.encounter} onClick={() => act({ type: "time_skip", actorId: me, days: 7, factionIds: ids }, "Bir hafta geçsin")}>1 hafta geçir</button>
          <button className="btn small" disabled={busy || !!view.encounter} onClick={() => act({ type: "time_skip", actorId: me, days: 30, factionIds: ids }, "Bir ay geçsin")}>1 ay geçir</button>
        </div>
      </div>
      {view.factions.map((f) => (
        <div key={f.id} className="card small">
          <div className="row"><b className="grow" style={{ color: "var(--gold-2)" }}>{f.name}</b>{f.relationToPlayer !== null && <span className={`chip ${f.relationToPlayer < -25 ? "red" : f.relationToPlayer > 25 ? "green" : ""}`}>ilişki {f.relationToPlayer}</span>}</div>
          <div className="grid2" style={{ marginTop: 6 }}>
            <span>💰 {f.treasury.toLocaleString("tr")} altın</span>
            <span>⚔ {f.military.toLocaleString("tr")} asker</span>
            <span>🏛 istikrar {f.stability}</span>
            <span>👥 {f.population.toLocaleString("tr")}</span>
          </div>
          {f.atWar.length > 0 && <div style={{ marginTop: 4 }}>Savaşta: {f.atWar.join(", ")}</div>}
          {f.allies.length > 0 && <div>Müttefik: {f.allies.join(", ")}</div>}
          <div className="hpbar" style={{ marginTop: 6 }}><div style={{ width: `${f.stability}%`, background: "linear-gradient(90deg,#8a6a2a,#d6a648)" }} /></div>
        </div>
      ))}
    </>
  );
}
