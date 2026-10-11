import { useMemo, useState } from "react";
import {
  ABILITIES, ABILITY_NAMES_TR, type Ability, type AbilityMethod, type AbilityScores, abilityModifier, buildCharacter,
  type CharacterInput, CLASSES, POINT_BUY_BUDGET, POINT_BUY_COST, RACES, SKILL_LIST, SKILL_NAMES_TR, SKILLS,
  CLASS_ABILITY_TR, ITEMS, type Skill, SPELLS, STANDARD_ARRAY, validateCharacter,
} from "@kader/engine";
import { TEMPLATES } from "@kader/game";
import type { Backend, CampaignData } from "../backend/types.ts";
import { BackendError } from "../backend/types.ts";

const STEPS = ["Dünya", "Irk", "Sınıf", "Yetenekler", "Beceriler", "Kimlik", "Özet"];
const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

/** Sınıfın birincil yeteneğine göre standart dizinin önerilen dağılımı. */
function suggested(classKey: string): AbilityScores {
  const order: Record<string, Ability[]> = {
    barbarian: ["str", "con", "dex", "wis", "cha", "int"], bard: ["cha", "dex", "con", "wis", "int", "str"],
    cleric: ["wis", "con", "str", "cha", "dex", "int"], druid: ["wis", "con", "dex", "int", "cha", "str"],
    fighter: ["str", "con", "dex", "wis", "cha", "int"], monk: ["dex", "wis", "con", "str", "int", "cha"],
    paladin: ["str", "cha", "con", "wis", "dex", "int"], ranger: ["dex", "wis", "con", "str", "int", "cha"],
    rogue: ["dex", "con", "int", "wis", "cha", "str"], sorcerer: ["cha", "con", "dex", "wis", "int", "str"],
    warlock: ["cha", "con", "dex", "wis", "int", "str"], wizard: ["int", "con", "dex", "wis", "cha", "str"],
  };
  const o = order[classKey] ?? [...ABILITIES];
  const s = {} as AbilityScores;
  o.forEach((a, i) => { s[a] = STANDARD_ARRAY[i]!; });
  return s;
}

export function Create({ backend, onCancel, onCreated }: { backend: Backend; onCancel: () => void; onCreated: (c: CampaignData) => void }) {
  const [step, setStep] = useState(0);
  const [templateKey, setTemplate] = useState("karacam");
  const [raceKey, setRace] = useState("human");
  const [classKey, setClass] = useState("fighter");
  const [method, setMethod] = useState<AbilityMethod>("standard_array");
  const [abilities, setAbilities] = useState<AbilityScores>(suggested("fighter"));
  const [rolled, setRolled] = useState<{ values: number[]; token?: string } | null>(null);
  const [bonusAbilities, setBonus] = useState<Ability[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [expertise, setExpertise] = useState<Skill[]>([]);
  const [name, setName] = useState("");
  const [background, setBackground] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const world = TEMPLATES[templateKey]!;
  const setting = world.setting!;
  const limits = setting.limits ?? {};
  const races = Object.values(RACES).filter((r) => !limits.races || limits.races.includes(r.key));
  const classes = Object.values(CLASSES).filter((c) => !limits.classes || limits.classes.includes(c.key));
  const clsName = (k: string) => setting.classNames?.[k]?.name ?? CLASSES[k]?.name ?? k;
  const race = RACES[raceKey]!;
  const cls = CLASSES[classKey]!;
  const raceSkills = race.skillProficiencies ?? [];
  const classPool = cls.skillChoices === "any" ? SKILL_LIST : cls.skillChoices;
  const extra = race.chooseSkills ?? 0;

  const input: CharacterInput = {
    name: name || "Adsız",
    raceKey, classKey, method, abilities,
    skills,
    ...(race.chooseAbilityBonuses ? { bonusAbilities } : {}),
    ...(classKey === "rogue" ? { expertise } : {}),
    ...(background ? { background } : {}),
    ...(method === "rolled" && rolled ? { rolledValues: rolled.values } : {}),
  };
  const errors = useMemo(() => validateCharacter(input, limits), [JSON.stringify(input), templateKey]);
  const preview = useMemo(() => {
    try {
      return buildCharacter({ ...input, name: input.name }, "preview", "x", setting.kit, limits);
    } catch {
      return null;
    }
  }, [JSON.stringify(input), templateKey]);

  const changeWorld = (k: string) => {
    setTemplate(k);
    const l = TEMPLATES[k]!.setting?.limits ?? {};
    if (l.races && !l.races.includes(raceKey)) changeRace(l.races[0]!);
    if (l.classes && !l.classes.includes(classKey)) changeClass(l.classes[0]!);
  };

  const changeClass = (k: string) => {
    setClass(k);
    setSkills([]);
    setExpertise([]);
    if (method === "standard_array") setAbilities(suggested(k));
  };
  const changeRace = (k: string) => {
    setRace(k);
    setSkills([]);
    setBonus([]);
  };
  const changeMethod = (m: AbilityMethod) => {
    setMethod(m);
    if (m === "standard_array") setAbilities(suggested(classKey));
    if (m === "point_buy") setAbilities({ str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 });
    if (m === "rolled") setRolled(null);
  };

  const pointsUsed = method === "point_buy" ? ABILITIES.reduce((s, a) => s + (POINT_BUY_COST[abilities[a]] ?? 99), 0) : 0;
  const pool = method === "standard_array" ? [...STANDARD_ARRAY] : rolled?.values ?? [];

  /** Dizi/zar yönteminde iki yeteneğin değerini takas et. */
  const assign = (a: Ability, value: number) => {
    const other = ABILITIES.find((x) => x !== a && abilities[x] === value);
    setAbilities((s) => ({ ...s, [a]: value, ...(other ? { [other]: s[a] } : {}) }));
  };

  const roll = async () => {
    setError(null);
    try {
      const r = await backend.rollAbilities();
      setRolled(r);
      const sorted = [...r.values].sort((x, y) => y - x);
      const sug = suggested(classKey);
      const order = [...ABILITIES].sort((x, y) => sug[y] - sug[x]);
      const s = {} as AbilityScores;
      order.forEach((a, i) => { s[a] = sorted[i]!; });
      setAbilities(s);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const toggleSkill = (s: Skill) => {
    if (raceSkills.includes(s)) return;
    const removing = skills.includes(s);
    setSkills((cur) => (removing ? cur.filter((x) => x !== s) : [...cur, s]));
    if (removing) setExpertise((cur) => cur.filter((x) => x !== s));
  };
  const classChosen = skills.filter((s) => classPool.includes(s)).length;
  const skillTarget = cls.skillCount + extra;

  const stepOk = [
    true,
    true,
    true,
    method === "rolled" ? !!rolled && !errors.some((e) => /Yetenek|zar|dizi|Puan/.test(e)) : !errors.some((e) => /Yetenek|dizi|Puan/.test(e)),
    !errors.some((e) => /beceri|uzmanlık|Yarı Elf|seç/i.test(e)),
    name.trim().length > 0,
    errors.length === 0,
  ];

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const c = await backend.createCampaign({
        templateKey,
        character: { ...input, name: name.trim() },
        ...(title.trim() ? { title: title.trim() } : {}),
        ...(rolled?.token ? { rollToken: rolled.token } : {}),
      });
      onCreated(c);
    } catch (e) {
      const d = e instanceof BackendError && Array.isArray(e.details) ? `: ${(e.details as string[]).join("; ")}` : "";
      setError(`${(e as Error).message}${d}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wizard">
      <div className="row" style={{ marginBottom: 12 }}>
        <h1 className="grow" style={{ margin: 0 }}>Yeni kahraman</h1>
        <button className="btn ghost" onClick={onCancel}>İptal</button>
      </div>
      <div className="steps">
        {STEPS.map((s, i) => (
          <button key={s} className={`step ${i === step ? "on" : i < step ? "done" : ""}`} onClick={() => i <= step && setStep(i)} style={{ background: "none" }}>
            {i + 1}. {s}
          </button>
        ))}
      </div>

      {step === 0 && (
        <div className="choices">
          {Object.values(TEMPLATES).map((t) => (
            <button key={t.key} className={`card choice ${t.key === templateKey ? "selected" : ""}`} onClick={() => changeWorld(t.key)}>
              <h3>{t.bible.title}</h3>
              <div className="small" style={{ color: "var(--gold-2)" }}>
                {t.setting?.era === "historical" ? "Tarihî · büyüsüz" : "Fantastik · büyülü"}{t.setting?.period ? ` · ${t.setting.period}` : ""}
              </div>
              <div className="muted small">{t.setting?.tagline}</div>
              {t.setting?.role && <div className="small" style={{ marginTop: 6 }}>Rolün: <b>{t.setting.role.name}</b></div>}
            </button>
          ))}
        </div>
      )}

      {step === 1 && (
        <div className="choices">
          {races.map((r) => (
            <button key={r.key} className={`card choice ${r.key === raceKey ? "selected" : ""}`} onClick={() => changeRace(r.key)}>
              <h3>{r.name}</h3>
              <div className="small" style={{ color: "var(--gold-2)" }}>
                {Object.entries(r.abilityBonuses).map(([a, v]) => `${ABILITY_NAMES_TR[a as Ability]} +${v}`).join(", ")}
                {r.chooseAbilityBonuses ? ` · seçeceğin ${r.chooseAbilityBonuses} yetenek +1` : ""}
              </div>
              <div className="muted small">Hız {r.speed / 5 * 1.5} m{r.darkvision ? " · karanlık görüş" : ""}</div>
              <div className="muted small">{r.traits.join(" · ")}</div>
            </button>
          ))}
        </div>
      )}

      {step === 2 && (
        <div className="choices">
          {classes.map((c) => (
            <button key={c.key} className={`card choice ${c.key === classKey ? "selected" : ""}`} onClick={() => changeClass(c.key)}>
              <h3>{clsName(c.key)}</h3>
              <div className="small" style={{ color: "var(--gold-2)" }}>d{c.hitDie} · {ABILITY_NAMES_TR[c.primary]}{c.caster !== "none" ? " · büyücü" : ""}{setting.classNames?.[c.key] ? ` · (SRD: ${c.name})` : ""}</div>
              <div className="muted small">{setting.classNames?.[c.key]?.description ?? c.description}</div>
            </button>
          ))}
        </div>
      )}

      {step === 3 && (
        <div className="card" style={{ display: "grid", gap: 14 }}>
          <div className="row">
            <button className={`btn small ${method === "standard_array" ? "active" : ""}`} onClick={() => changeMethod("standard_array")}>Standart dizi</button>
            <button className={`btn small ${method === "point_buy" ? "active" : ""}`} onClick={() => changeMethod("point_buy")}>Puan alımı (27)</button>
            <button className={`btn small ${method === "rolled" ? "active" : ""}`} onClick={() => changeMethod("rolled")}>Zar at (4d6, en düşüğü at)</button>
            {method === "point_buy" && <span className={`chip ${pointsUsed > POINT_BUY_BUDGET ? "red" : "gold"}`}>{POINT_BUY_BUDGET - pointsUsed} puan kaldı</span>}
            {method === "rolled" && <button className="btn primary small" onClick={roll}>🎲 {rolled ? "Yeniden at" : "Zarları at"}</button>}
          </div>
          {method === "rolled" && rolled && <div className="muted small">Atılan değerler: {rolled.values.join(", ")} — yetenekler arasında takas edebilirsin.</div>}
          <div className="abil-grid">
            {ABILITIES.map((a) => {
              const bonus = (race.abilityBonuses[a] ?? 0) + (bonusAbilities.includes(a) ? 1 : 0);
              const total = abilities[a] + bonus;
              return (
                <div key={a} className="card abil">
                  <div className="muted small">{ABILITY_NAMES_TR[a]}{a === cls.primary ? " ★" : ""}</div>
                  <div className="score">{total}</div>
                  <div className="mod">{fmt(abilityModifier(total))}{bonus ? ` (ırk +${bonus})` : ""}</div>
                  {method === "point_buy" ? (
                    <div className="row" style={{ justifyContent: "center", marginTop: 6 }}>
                      <button className="btn small" disabled={abilities[a] <= 8} onClick={() => setAbilities((s) => ({ ...s, [a]: s[a] - 1 }))}>−</button>
                      <span>{abilities[a]}</span>
                      <button className="btn small" disabled={abilities[a] >= 15} onClick={() => setAbilities((s) => ({ ...s, [a]: s[a] + 1 }))}>+</button>
                    </div>
                  ) : (
                    <select className="input" style={{ marginTop: 6 }} value={abilities[a]} onChange={(e) => assign(a, Number(e.target.value))} disabled={method === "rolled" && !rolled}>
                      {[...new Set(pool.length ? pool : [abilities[a]])].sort((x, y) => y - x).map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  )}
                </div>
              );
            })}
          </div>
          {race.chooseAbilityBonuses && (
            <div>
              <div className="small muted">{race.name}: Karizma dışında {race.chooseAbilityBonuses} yetenek seç (+1)</div>
              <div className="row" style={{ marginTop: 6 }}>
                {ABILITIES.filter((a) => a !== "cha").map((a) => (
                  <button key={a} className={`btn small ${bonusAbilities.includes(a) ? "active" : ""}`}
                    onClick={() => setBonus((b) => (b.includes(a) ? b.filter((x) => x !== a) : b.length < race.chooseAbilityBonuses! ? [...b, a] : b))}>
                    {ABILITY_NAMES_TR[a]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {step === 4 && (
        <div className="card" style={{ display: "grid", gap: 12 }}>
          <div className="row">
            <span className={`chip ${classChosen === cls.skillCount ? "green" : "gold"}`}>{clsName(cls.key)}: {classChosen}/{cls.skillCount} sınıf becerisi</span>
            {extra > 0 && <span className="chip gold">{race.name}: +{extra} serbest beceri</span>}
            <span className={`chip ${skills.length === skillTarget ? "green" : "gold"}`}>Toplam {skills.length}/{skillTarget}</span>
          </div>
          <div className="skill-list">
            {SKILL_LIST.map((s) => {
              const fromRace = raceSkills.includes(s);
              const on = fromRace || skills.includes(s);
              const allowed = classPool.includes(s) || extra > 0;
              return (
                <div key={s} className={`skill-item ${on ? "on" : ""} ${fromRace || !allowed ? "locked" : ""}`} onClick={() => allowed && toggleSkill(s)} role="checkbox" aria-checked={on}>
                  <input type="checkbox" readOnly checked={on} />
                  <span className="grow">{SKILL_NAMES_TR[s]}</span>
                  <span className="muted small">{ABILITY_NAMES_TR[SKILLS[s]].slice(0, 3)}</span>
                  {fromRace && <span className="chip">ırk</span>}
                </div>
              );
            })}
          </div>
          {classKey === "rogue" && (
            <div>
              <div className="small muted">Uzmanlık (yeterlilik ×2): yeterli olduğun 2 beceriyi seç</div>
              <div className="row" style={{ marginTop: 6 }}>
                {[...raceSkills, ...skills].map((s) => (
                  <button key={s} className={`btn small ${expertise.includes(s) ? "active" : ""}`}
                    onClick={() => setExpertise((x) => (x.includes(s) ? x.filter((y) => y !== s) : x.length < 2 ? [...x, s] : x))}>
                    {SKILL_NAMES_TR[s]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {step === 5 && (
        <div className="card" style={{ display: "grid", gap: 12 }}>
          <label className="field">Karakterin adı<input className="input" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="ör. Arda, Elif, Kara Murat" autoFocus /></label>
          <label className="field">Kısa geçmiş / görünüm (anlatıcı kullanır)<textarea className="input" rows={3} maxLength={400} value={background} onChange={(e) => setBackground(e.target.value)} placeholder={setting.role ? `Boş bırakırsan: ${setting.role.name}. ör. Kalemi kılıcından keskin, Midillili bir kâtip.` : "ör. Güneyli bir demircinin kaçak oğlu; sol yanağında yanık izi."} /></label>
          <label className="field">Kampanya başlığı (isteğe bağlı)<input className="input" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`ör. ${world.bible.title} Günlükleri`} /></label>
        </div>
      )}

      {step === 6 && preview && (
        <div className="grid2">
          <div className="card">
            <h2>{name || "Adsız"}</h2>
            <div className="muted">{race.name} {clsName(cls.key)}, 1. seviye{setting.role ? ` · ${setting.role.name}` : ""}</div>
            <div className="stat-big" style={{ marginTop: 10 }}>
              <div className="stat"><div className="v">{preview.creature.maxHp}</div><div className="k">HP</div></div>
              <div className="stat"><div className="v">{preview.creature.ac}</div><div className="k">AC</div></div>
              <div className="stat"><div className="v">{fmt(abilityModifier(preview.creature.abilities.dex))}</div><div className="k">İnisiyatif</div></div>
              <div className="stat"><div className="v">{Math.round(preview.creature.speed * 0.3)} m</div><div className="k">Hız</div></div>
            </div>
            <div className="abil6" style={{ marginTop: 10 }}>
              {ABILITIES.map((a) => (
                <div key={a} className="stat"><div className="v">{preview.creature.abilities[a]}</div><div className="k">{ABILITY_NAMES_TR[a]} {fmt(abilityModifier(preview.creature.abilities[a]))}</div></div>
              ))}
            </div>
          </div>
          <div className="card small">
            <h3>Beceriler</h3>
            <div>{preview.creature.skillProficiencies.map((s) => SKILL_NAMES_TR[s]).join(", ")}</div>
            <h3 style={{ marginTop: 10 }}>Başlangıç ekipmanı</h3>
            <div>{[...preview.inventory, ...world.start.playerItems.map((i) => ({ itemKey: i.key, qty: i.qty, equipped: false }))]
              .map((i) => `${i.qty > 1 ? `${i.qty}× ` : ""}${ITEMS[i.itemKey]?.name ?? i.itemKey}${i.equipped ? " (kuşanılı)" : ""}`).join(", ")}</div>
            {preview.creature.spellcasting && (
              <>
                <h3 style={{ marginTop: 10 }}>Büyüler</h3>
                <div>{preview.creature.spellcasting.known.map((k) => SPELLS[k]?.name ?? k).join(", ")}</div>
              </>
            )}
            {Object.keys(preview.creature.resources ?? {}).length > 0 && (
              <>
                <h3 style={{ marginTop: 10 }}>Yetenekler</h3>
                <div>{Object.keys(preview.creature.resources ?? {}).map((k) => CLASS_ABILITY_TR[k as keyof typeof CLASS_ABILITY_TR] ?? k.replace(/_/g, " ")).join(", ")}</div>
              </>
            )}
            <div className="notice" style={{ marginTop: 12 }}>
              {world.bible.title}: {world.places.find((p) => p.id === world.start.locationId)?.name} konumunda başlayacaksın.
              {setting.magic ? "" : " Bu dünyada büyü yok; tehlike insandan ve denizden gelir."}
            </div>
          </div>
        </div>
      )}

      {step > 2 && errors.length > 0 && step < 6 && !stepOk[step] && <div className="notice" style={{ marginTop: 12 }}>{errors.join(" · ")}</div>}
      {step === 6 && errors.length > 0 && <div className="error" style={{ marginTop: 12 }}>{errors.join(" · ")}</div>}
      {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}

      <div className="wizard-nav">
        <button className="btn" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>← Geri</button>
        {step < 6 ? (
          <button className="btn primary" disabled={!stepOk[step]} onClick={() => setStep((s) => s + 1)}>İleri →</button>
        ) : (
          <button className="btn primary" disabled={busy || errors.length > 0} onClick={create}>{busy ? "Dünya kuruluyor…" : "Maceraya başla"}</button>
        )}
      </div>
    </div>
  );
}
