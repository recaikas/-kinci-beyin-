/**
 * Effect listesinden anlatıcıya verilecek Türkçe, değişmez gerçek cümleleri.
 * Anlatıcı bu cümlelerle çelişemez; doğrulayıcı da bunlara göre denetler.
 */
import { CONDITION_NAMES_TR } from "./conditions.ts";
import { dative } from "./tr.ts";
import { ITEMS } from "./srd/items.ts";
import { ATTITUDE_TR } from "./social.ts";
import type { Attitude } from "./types.ts";
import type { Effect, GameState } from "./state.ts";
import type { Condition } from "./conditions.ts";

function nm(s: GameState, id: unknown): string {
  const key = String(id);
  return s.creatures[key]?.name ?? s.factions[key]?.name ?? key;
}

export function formatCp(cp: number): string {
  const gp = Math.floor(Math.abs(cp) / 100);
  const sp = Math.floor((Math.abs(cp) % 100) / 10);
  const c = Math.abs(cp) % 10;
  const parts = [gp && `${gp} altın`, sp && `${sp} gümüş`, c && `${c} bakır`].filter(Boolean);
  return parts.length ? parts.join(" ") : "0 bakır";
}

export function describeEffects(effects: Effect[], s: GameState): string[] {
  const out: string[] = [];
  for (const e of effects) {
    switch (e.op) {
      case "wallet":
        out.push(`${nm(s, e.ownerId)} ${e.deltaCp >= 0 ? "kazandı" : "harcadı"}: ${formatCp(e.deltaCp)} (kalan ${formatCp(e.afterCp)})`);
        break;
      case "inventory.add":
        if (e.qty > 0) out.push(`${nm(s, e.ownerId)} envanterine eklendi: ${ITEMS[e.itemKey]?.name ?? e.itemKey} ×${e.qty}`);
        break;
      case "inventory.remove":
        out.push(`${nm(s, e.ownerId)} envanterinden çıktı: ${ITEMS[e.itemKey]?.name ?? e.itemKey} ×${e.qty}`);
        break;
      case "move":
        out.push(`${nm(s, e.id)} artık burada: ${s.world?.places[e.to]?.name ?? e.to}`);
        break;
      case "event": {
        const p = e.payload;
        switch (e.type) {
          case "creature.died": out.push(`${nm(s, p.id)} ÖLDÜ (${String(p.cause)})`); break;
          case "creature.dropped": out.push(`${nm(s, p.id)} 0 HP'ye düştü ve bilincini kaybetti`); break;
          case "creature.stabilized": out.push(`${nm(s, p.id)} stabilize oldu`); break;
          case "creature.revived": out.push(`${nm(s, p.id)} kendine geldi (${String(p.hp)} HP)`); break;
          case "condition.added": out.push(`${nm(s, p.id)} artık ${CONDITION_NAMES_TR[p.condition as Condition] ?? String(p.condition)}`); break;
          case "condition.removed": out.push(`${nm(s, p.id)} artık ${CONDITION_NAMES_TR[p.condition as Condition] ?? String(p.condition)} değil`); break;
          case "concentration.broken": out.push(`${nm(s, p.id)} ${String(p.spell)} büyüsündeki konsantrasyonunu kaybetti`); break;
          case "level.up": out.push(`${nm(s, p.id)} ${String(p.to)}. seviyeye ulaştı`); break;
          case "attitude.changed": out.push(`${nm(s, p.b)} artık ${dative(nm(s, p.a))} karşı ${ATTITUDE_TR[p.to as Attitude] ?? String(p.to)}`); break;
          case "faction.war": out.push(`${nm(s, p.attacker)} ile ${nm(s, p.defender)} arasında SAVAŞ başladı`); break;
          case "faction.treaty": out.push(`${nm(s, p.a)} ile ${nm(s, p.b)} ${p.kind === "peace" ? "barış" : "ittifak"} imzaladı`); break;
          case "faction.event":
            if (p.kind === "battle") {
              out.push(`Muharebe: ${nm(s, p.attackerId)} ${String(p.attHits)} – ${String(p.defHits)} ${nm(s, p.defenderId)}; kayıplar ${String(p.attLoss)} / ${String(p.defLoss)}${p.capturedRegion ? `; ${String(p.capturedRegion)} bölgesi el değiştirdi` : ""}`);
            }
            break;
          case "creature.spawned": out.push(`${String(p.name)} ortaya çıktı`); break;
          case "quest.completed": break;
          default: break;
        }
        break;
      }
      default:
        break;
    }
  }
  return out;
}
