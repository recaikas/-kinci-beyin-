import { describe, expect, it } from "vitest";
import { FixedRng, SeededRng } from "@kader/dice";
import { buildView, type Campaign, createCampaign, playCampaignTurn } from "../src/index.ts";

let n = 0;
const newId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

function fighter(): Campaign {
  return createCampaign({
    templateKey: "karacam",
    character: {
      name: "Arda", raceKey: "human", classKey: "fighter", method: "standard_array",
      abilities: { str: 15, dex: 13, con: 14, int: 8, wis: 12, cha: 10 }, skills: ["athletics", "perception"],
    },
  }, newId, new Date("2026-10-11T00:00:00Z"));
}

async function say(c: Campaign, text: string, rng = new SeededRng(`t:${text}`)) {
  const r = await playCampaignTurn(c, { text }, { caller: null, rng, newId });
  return r;
}

describe("Karaçam kampanyası (AI'sız)", () => {
  it("kampanya kurulur: oyuncu kapıda, mektup envanterde, görev açık", () => {
    const c = fighter();
    const v = buildView(c);
    expect(v.location.name).toBe("Karaçam Kuzey Kapısı");
    expect(v.sheet.inventory.some((i) => i.key === "sealed_letter")).toBe(true);
    expect(v.quests.find((q) => q.id === "q_mektup")!.status).toBe("open");
    expect(v.entities.map((e) => e.name)).toContain("Muhafız Kerem");
    expect(v.exits.map((e) => e.name)).toContain("Karaçam Pazarı");
    expect(v.factions).toHaveLength(4);
    expect(c.journal[0]!.narration).toContain("Karaçam");
  });

  it("mektup görevi baştan sona: yürü, ver, ödül al, seviye atla", async () => {
    let c = fighter();
    let r = await say(c, "pazara git");
    expect(r.result.status).toBe("resolved");
    c = r.campaign;
    expect(buildView(c).location.id).toBe("pazar");
    r = await say(c, "muhtar konağına yürüyorum");
    c = r.campaign;
    expect(buildView(c).location.id).toBe("muhtarlik");
    r = await say(c, "mühürlü mektubu muhtar davut'a ver");
    expect(r.result.status, JSON.stringify(r.result)).toBe("resolved");
    c = r.campaign;
    const v = buildView(c);
    expect(v.quests.find((q) => q.id === "q_mektup")!.status).toBe("completed");
    expect(v.sheet.xp).toBe(150);
    expect(v.sheet.walletCp).toBe(1500 + 2000);
    expect(r.entry!.facts.some((f) => f.includes("GÖREV TAMAMLANDI"))).toBe(true);
    // muhtardan görev kabulü
    r = await say(c, "görevi kabul ediyorum");
    c = r.campaign;
    expect(buildView(c).quests.find((q) => q.id === "q_goblin")!.status).toBe("open");
    expect(c.journal).toHaveLength(5);
    expect(c.turnCount).toBe(4);
  });

  it("dükkân: Selin'den erzak al; parası yetmeyen eşya reddedilir", async () => {
    let c = fighter();
    c = (await say(c, "pazara git")).campaign;
    const before = buildView(c).sheet.walletCp;
    const r = await say(c, "selin'den 2 erzak satın al");
    expect(r.result.status, JSON.stringify(r.result)).toBe("resolved");
    c = r.campaign;
    expect(buildView(c).sheet.walletCp).toBe(before - 2 * 55);
    expect(buildView(c).sheet.inventory.find((i) => i.key === "rations")!.qty).toBe(7);
    const poor = await say(c, "selin'den iyileştirme iksiri satın al");
    expect(poor.result.status).toBe("rejected");
    expect(JSON.stringify(poor.result)).toContain("Arda için yetersiz para");
  });

  it("kapıda muhafıza saldırmak savaş başlatır ve NPC düşman olur", async () => {
    const c = fighter();
    const r = await say(c, "kerem'e kılıçla saldırıyorum", new SeededRng("fight"));
    expect(r.result.status).toBe("resolved");
    const v = buildView(r.campaign);
    const kerem = v.entities.find((e) => e.name === "Muhafız Kerem")!;
    expect(kerem.hostile || !kerem.alive).toBe(true);
    expect(r.entry!.rolls.some((x) => x.reason === "inisiyatif")).toBe(true);
  });

  it("anlaşılamayan girdi netleştirme ister, tur sayılmaz", async () => {
    const c = fighter();
    const r = await say(c, "xyzzy plugh");
    expect(r.result.status).toBe("clarify");
    expect(r.campaign.turnCount).toBe(0);
  });

  it("ormanda uzun yolculuk: pusu, savaş ve ganimet akışı tutarlı", async () => {
    let c = fighter();
    // Zorla pusu: tohumu bulana kadar dene (deterministik).
    let ambushed = false;
    for (let i = 0; i < 30 && !ambushed; i++) {
      const r = await playCampaignTurn(c, { text: "ormana git" }, { caller: null, rng: new SeededRng(`orman:${i}`), newId });
      if (r.result.status === "resolved" && r.campaign.state.encounter?.active) {
        c = r.campaign;
        ambushed = true;
      }
    }
    expect(ambushed).toBe(true);
    for (let i = 0; i < 40 && c.state.encounter?.active; i++) {
      const v = buildView(c);
      const foe = v.entities.find((e) => e.hostile && e.alive);
      if (!v.sheet.isAlive || v.sheet.hp <= 0 || !foe) break;
      const r = await playCampaignTurn(c, { action: { type: "attack", actorId: c.playerId, targetId: foe.id, weaponKey: "longsword" } },
        { caller: null, rng: new SeededRng(`savas:${i}`), newId });
      expect(r.result.status, JSON.stringify(r.result)).toBe("resolved");
      c = r.campaign;
    }
    const v = buildView(c);
    if (v.sheet.isAlive && v.sheet.hp > 0) {
      expect(c.state.encounter).toBeNull();
      const corpse = v.entities.find((e) => !e.alive && !e.looted);
      if (corpse) {
        const r = await say(c, "cesedi ara");
        expect(r.result.status).toBe("resolved");
      }
      expect(v.sheet.xp).toBeGreaterThan(0);
    }
  });

  it("AI'sız mod: kaba bir LLM gerekmeden butonla eylemler", async () => {
    const c = fighter();
    const r = await playCampaignTurn(c, { action: { type: "look", actorId: c.playerId } }, { caller: null, rng: new FixedRng([]), newId });
    expect(r.result.status).toBe("resolved");
    expect(r.entry!.source).toBe("template");
  });
});
