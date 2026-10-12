import { describe, expect, it } from "vitest";
import { SeededRng } from "@kader/dice";
import { CLASSES, type CharacterInput, ITEMS, MONSTERS, relKey, WEAPONS } from "@kader/engine";
import { advanceChronicle, buildContext, buildView, type Campaign, createCampaign, playCampaignTurn, TEMPLATES } from "../src/index.ts";

let n = 0;
const newId = () => `00000000-0000-4000-9000-${String(++n).padStart(12, "0")}`;

const base: Omit<CharacterInput, "classKey" | "skills"> = {
  name: "Piri", raceKey: "human", method: "standard_array",
  abilities: { str: 15, dex: 13, con: 14, int: 8, wis: 12, cha: 10 },
};

function katip(classKey = "fighter", skills: CharacterInput["skills"] = ["athletics", "perception"], extra: Partial<CharacterInput> = {}): Campaign {
  return createCampaign({ templateKey: "akdeniz1570", character: { ...base, classKey, skills, ...extra } }, newId, new Date("2026-10-11T00:00:00Z"));
}

async function say(c: Campaign, text: string, rng = new SeededRng(`a:${text}`)) {
  return playCampaignTurn(c, { text }, { caller: null, rng, newId });
}

describe("şablon bütünlüğü", () => {
  for (const t of Object.values(TEMPLATES)) {
    it(`${t.key}: tüm eşya, canavar, mekân ve hedef anahtarları geçerli`, () => {
      const places = new Set(t.places.map((p) => p.id));
      const npcKeys = new Set(t.npcs.map((x) => x.key));
      const item = (k: string) => expect(ITEMS[k], `eşya ${k}`).toBeDefined();
      expect(places.has(t.start.locationId)).toBe(true);
      t.start.playerItems.forEach((i) => item(i.key));
      for (const p of t.places) for (const e of p.encounters) expect(MONSTERS[e.templateKey], e.templateKey).toBeDefined();
      for (const [from, exits] of Object.entries(t.exits)) {
        expect(places.has(from), from).toBe(true);
        for (const e of exits) {
          expect(places.has(e.to), e.to).toBe(true);
          if (e.requiresItem) item(e.requiresItem);
        }
      }
      for (const x of t.npcs) {
        expect(MONSTERS[x.template], x.template).toBeDefined();
        expect(places.has(x.locationId), x.locationId).toBe(true);
        x.inventory?.forEach(([k]) => item(k));
      }
      for (const m of Object.values(MONSTERS)) {
        m.loot?.items?.forEach((i) => item(i.key));
        m.attacks.forEach((a) => expect(WEAPONS[a] ?? a, a).toBeTruthy());
      }
      for (const q of t.quests) {
        if (q.giverKey) expect(npcKeys.has(q.giverKey), q.giverKey).toBe(true);
        for (const o of q.objectives) {
          if (o.targetKey) expect(places.has(o.targetKey) || npcKeys.has(o.targetKey), o.targetKey).toBe(true);
          if (o.itemKey) item(o.itemKey);
          if (o.templateKey) expect(MONSTERS[o.templateKey]).toBeDefined();
        }
        q.rewards.items?.forEach((i) => item(i.key));
      }
      for (const f of t.facts) expect(npcKeys.has(f.subjectKey), f.subjectKey).toBe(true);
      const kit = t.setting?.kit;
      for (const list of Object.values(kit?.classEquipment ?? {})) list.forEach(([k]) => item(k));
      kit?.basics?.forEach(([k]) => item(k));
      const questIds = new Set(t.quests.map((q) => q.id));
      const factionKeys = new Set(t.factions.map((f) => f.key));
      for (const e of t.chronicle ?? []) {
        expect(e.variants.length, e.id).toBeGreaterThan(0);
        for (const v of e.variants) {
          [...(v.when?.questDone ?? []), ...(v.when?.questNotDone ?? [])].forEach((q) => expect(questIds.has(q), q).toBe(true));
          v.factions?.forEach((f) => expect(factionKeys.has(f.key), f.key).toBe(true));
          v.relations?.forEach(([a, b]) => expect(factionKeys.has(a) && factionKeys.has(b), `${a}-${b}`).toBe(true));
          v.npcRelations?.forEach(([k]) => expect(npcKeys.has(k), k).toBe(true));
        }
      }
    });
  }
});

describe("Rodos 1570 — Kadırga Kâtibi (büyüsüz tarihî dünya)", () => {
  it("oyuncu gemi kâtibi olarak kadırgada başlar; büyü yok, yerel donanım var", () => {
    const c = katip();
    const v = buildView(c);
    expect(v.world).toEqual({ key: "akdeniz1570", era: "historical", period: "Akdeniz, 1570", magic: false });
    expect(v.location.id).toBe("kadirga");
    expect(v.sheet.className).toBe("Levent");
    expect(v.sheet.background).toBe("Gemi Kâtibi");
    expect(v.sheet.spellcasting).toBeNull();
    const keys = v.sheet.inventory.map((i) => i.key);
    expect(keys).toEqual(expect.arrayContaining(["kilic", "arquebus", "ledger", "divit", "healing_salve"]));
    expect(keys).not.toContain("potion_of_healing");
    expect(keys).not.toContain("torch");
    expect(v.quests.find((q) => q.id === "q_defter")!.status).toBe("open");
    expect(c.journal[0]!.narration).toContain("Yeşil Yılan kadırgasının yeni kâtibisin");
    expect(c.bible.rules[0]).toContain("BÜYÜ YOKTUR");
  });

  it("büyücü sınıflar ve fantastik ırklar bu dünyada seçilemez", () => {
    expect(() => katip("wizard", ["arcana", "history"])).toThrow(/bu dünyada seçilemez/);
    expect(() => createCampaign({
      templateKey: "akdeniz1570",
      character: { ...base, raceKey: "high_elf", classKey: "fighter", skills: ["athletics", "history"] },
    }, newId)).toThrow(/bu dünyada seçilemez/);
    expect(CLASSES.wizard).toBeDefined();
  });

  it("Kurnaz (düzenbaz) yatağan ve tabancada yeterli", () => {
    const c = katip("rogue", ["stealth", "deception", "investigation", "sleight_of_hand"], { expertise: ["stealth", "investigation"] });
    const me = c.state.creatures[c.playerId]!;
    expect(buildView(c).sheet.className).toBe("Kurnaz");
    expect(me.weaponProficiencies).toEqual(expect.arrayContaining(["yatagan", "pistol"]));
  });

  it("ambar denetimi görevi ilerletir; depo anahtarsız kilitli", async () => {
    let c = katip();
    const r = await say(c, "ambara in");
    expect(r.result.status, JSON.stringify(r.result)).toBe("resolved");
    c = r.campaign;
    const v = buildView(c);
    expect(v.location.id).toBe("ambar");
    expect(v.quests.find((q) => q.id === "q_defter")!.objectives[0]!.done).toBe(true);
    expect(v.entities.map((e) => e.name)).toContain("Ambar Ağası Bekir");
    // meyhaneye git, depo kilitli
    c = (await say(c, "güverteye çık")).campaign;
    c = (await say(c, "limana in")).campaign;
    c = (await say(c, "meyhaneye git")).campaign;
    const m = buildView(c);
    expect(m.location.id).toBe("meyhane");
    expect(m.exits.find((e) => e.id === "kacakci_deposu")!.locked).toBe(true);
  });

  it("cerrahtan merhem alınır, kullanılınca iyileştirir", async () => {
    let c = katip();
    c = (await say(c, "limana in")).campaign;
    c = (await say(c, "çarşıya git")).campaign;
    c = (await say(c, "cerrah yakup'un dükkânına git")).campaign;
    expect(buildView(c).location.id).toBe("cerrah");
    const r = await say(c, "yakup'tan cerrah merhemi satın al");
    expect(r.result.status, JSON.stringify(r.result)).toBe("resolved");
    c = r.campaign;
    expect(buildView(c).sheet.inventory.find((i) => i.key === "healing_salve")!.qty).toBe(2);
    c.state.creatures[c.playerId]!.hp = 3;
    const u = await playCampaignTurn(c, { action: { type: "use_item", actorId: c.playerId, itemKey: "healing_salve" } }, { caller: null, rng: new SeededRng("salve"), newId });
    expect(u.result.status, JSON.stringify(u.result)).toBe("resolved");
    const after = buildView(u.campaign).sheet;
    expect(after.hp).toBeGreaterThanOrEqual(3 + 4);
    expect(after.inventory.find((i) => i.key === "healing_salve")!.qty).toBe(1);
  });

  it("görev zinciri: Bekir'i alt et, anahtarı al, kaçakçı deposunu bas, casusun belgelerini ele geçir", async () => {
    let c = katip();
    // Testi zar şansından bağımsız kılmak için kâtibe bol can ver.
    Object.assign(c.state.creatures[c.playerId]!, { hp: 300, maxHp: 300 });
    let i = 0;
    const fight = async () => {
      for (; i < 400 && c.state.encounter?.active; i++) {
        const v = buildView(c);
        const foe = v.entities.find((e) => e.hostile && e.alive);
        if (!foe) break;
        const action = v.encounter?.myTurn === false
          ? { type: "end_turn" as const, actorId: c.playerId }
          : { type: "attack" as const, actorId: c.playerId, targetId: foe.id, weaponKey: "kilic" };
        const r = await playCampaignTurn(c, { action }, { caller: null, rng: new SeededRng(`zincir:${i}`), newId });
        expect(r.result.status, JSON.stringify(r.result)).toBe("resolved");
        c = r.campaign;
      }
    };
    const go = async (text: string, place: string) => {
      const r = await say(c, text);
      expect(r.result.status, `${text}: ${JSON.stringify(r.result)}`).toBe("resolved");
      c = r.campaign;
      expect(buildView(c).location.id).toBe(place);
    };
    const loot = async (name: string) => {
      const t = Object.values(c.state.creatures).find((x) => x.name === name)!;
      expect(t.isAlive).toBe(false);
      const r = await playCampaignTurn(c, { action: { type: "loot", actorId: c.playerId, targetId: t.id } }, { caller: null, rng: new SeededRng(`loot:${name}`), newId });
      expect(r.result.status, JSON.stringify(r.result)).toBe("resolved");
      c = r.campaign;
    };

    await go("ambara in", "ambar");
    const r = await say(c, "bekir'e kılıçla saldırıyorum", new SeededRng("bekir"));
    expect(r.result.status, JSON.stringify(r.result)).toBe("resolved");
    c = r.campaign;
    await fight();
    expect(c.state.encounter?.active ?? false).toBe(false);
    await loot("Ambar Ağası Bekir");
    const inv = () => buildView(c).sheet.inventory.map((x) => x.key);
    expect(inv()).toContain("warehouse_key");
    expect(buildView(c).quests.find((q) => q.id === "q_defter")!.objectives[1]!.done).toBe(true);

    await go("güverteye çık", "kadirga");
    await go("limana in", "liman");
    await go("meyhaneye git", "meyhane");
    await go("kaçakçı deposuna gir", "kacakci_deposu");
    expect(buildView(c).quests.find((q) => q.id === "q_defter")!.status).toBe("completed");
    if (!c.state.encounter?.active) {
      const marco = Object.values(c.state.creatures).find((x) => x.name.startsWith("Venedikli Marco"))!;
      const a = await playCampaignTurn(c, { action: { type: "attack", actorId: c.playerId, targetId: marco.id, weaponKey: "kilic" } },
        { caller: null, rng: new SeededRng("marco"), newId });
      c = a.campaign;
    }
    await fight();
    expect(buildView(c).entities.filter((e) => e.hostile && e.alive)).toHaveLength(0);
    await loot("Venedikli Marco Davanzo");
    expect(inv()).toEqual(expect.arrayContaining(["cipher_letter", "pilot_chart"]));
    expect(buildView(c).sheet.isAlive).toBe(true);
  });
});

describe("tarih akışı (Rodos 1570)", () => {
  const donanma = (c: Campaign) => Object.values(c.state.factions).find((f) => f.name.startsWith("Osmanlı Donanması"))!;
  const venedik = (c: Campaign) => Object.values(c.state.factions).find((f) => f.name === "Venedik Cumhuriyeti")!;

  it("olay saati gelen turda tam bir kez gerçekleşir, günlüğe ve anlatı bağlamına girer", async () => {
    let c = katip();
    expect(buildView(c).upcoming?.teaser).toContain("duyuru");
    c.state.gameTime = 17 * 60 - 1;
    const before = donanma(c).stability;
    let r = await say(c, "ambara in");
    expect(r.result.status).toBe("resolved");
    expect(r.entry!.chronicle?.map((x) => x.id)).toEqual(["sefer_ilani"]);
    c = r.campaign;
    expect(donanma(c).stability).toBe(before + 5);
    expect(buildView(c).chronicle[0]!.title).toBe("Sefer ilan edildi");
    expect(buildContext(c).worldEvents?.[0]).toContain("Sefer ilan edildi");
    // Sonraki tur aynı olayı tekrar ateşlemez.
    r = await say(c, "güverteye çık");
    expect(r.entry!.chronicle).toBeUndefined();
    expect(donanma(r.campaign).stability).toBe(before + 5);
  });

  it("casus yakalanmadıysa sır sızar; yakalandıysa Venedik kör kalır", async () => {
    const at = 2 * 1440 + 8 * 60 - 1;
    let a = katip();
    a.state.gameTime = at;
    const milA = venedik(a).military;
    a = (await say(a, "ambara in")).campaign;
    expect(a.journal.at(-1)!.chronicle?.[0]!.title).toBe("Seferin sırrı sızdı");
    expect(venedik(a).military).toBe(milA + 300);

    let b = katip();
    b.state.gameTime = at;
    b.state.world!.quests.q_casus!.status = "completed";
    const intel = venedik(b).intelligence;
    b = (await say(b, "ambara in")).campaign;
    expect(b.journal.at(-1)!.chronicle?.[0]!.title).toBe("Casus şebekesi çöktü");
    expect(venedik(b).intelligence).toBe(intel - 25);
    const ferhat = Object.values(b.state.creatures).find((x) => x.name === "Dizdar Ferhat Ağa")!;
    expect(b.state.relationships[relKey(b.playerId, ferhat.id)]).toBe(20);
  });

  it("uzun bir zaman atlaması birden çok olayı sırayla işler", () => {
    const c = katip();
    const t = TEMPLATES.akdeniz1570!;
    const later = { ...c.state, gameTime: 7 * 1440 };
    const { entries } = advanceChronicle(t, later, c.playerId, c.state.gameTime);
    expect(entries.map((e) => e.id)).toEqual(["sefer_ilani", "venedik_haberi", "erzak_yolu", "donanma_denizde", "kibris_cikarma"]);
    expect(entries.at(-1)!.title).toBe("Kanlı çıkarma");
  });
});
