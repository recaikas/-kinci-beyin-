/**
 * Terminal demosu — veritabanı olmadan, bellekte oynanır.
 *
 *   ANTHROPIC_API_KEY=... npm run play     → Haiku 5.5 ile serbest metin
 *   npm run play                           → AI'sız mod: komutlar + şablon anlatı
 *
 * AI'sız mod motoru doğrudan dener; komutlar:
 *   bak | saldır <id> [silah] | ikna <id> | rüşvet <id> <altın> | gözdağı <id>
 *   git <konum> | iksir | saklan | dinlen | savaş <id...> | tur | bitir | durum | çık
 */
import { createInterface } from "node:readline/promises";
import { CryptoRng } from "@kader/dice";
import { combatAutopilot, type GameAction, type GameState, resolveAction } from "@kader/engine";
import {
  createCaller, gameClock, playTurn, type RecentTurn, type TurnPacketInput, templateNarration,
} from "@kader/llm";
import { DEMO_WORLD, demoState, EXITS, PERSONAS, PLACES } from "./demo-world.ts";

const rng = new CryptoRng();
let state: GameState = demoState();
const recent: RecentTurn[] = [];
let turn = 0;
const useAi = !!process.env.ANTHROPIC_API_KEY;
const caller = useAi ? createCaller() : null;

const placeOf = (id: string) => Object.values(PLACES).find((p) => p.id === id)!;

function context(): TurnPacketInput {
  const loc = placeOf(state.creatures.arda!.locationId!);
  return {
    state,
    playerId: "arda",
    location: loc,
    personas: PERSONAS,
    recentTurns: recent,
    facts: [{ subject: "kerem", predicate: "kızının adı", value: "Elif", locked: true }],
    chapterSummary: "",
    campaignSummary: "",
    openQuests: ["Mektubu Karaçam muhtarına teslim et"],
  };
}

function offlineAction(line: string): GameAction | string {
  const [cmd, ...args] = line.trim().split(/\s+/);
  const me = "arda";
  switch (cmd) {
    case "bak": return { type: "look", actorId: me };
    case "saldır": return { type: "attack", actorId: me, targetId: args[0] ?? "", weaponKey: args[1] ?? "rapier" };
    case "ikna": return { type: "social", actorId: me, targetId: args[0] ?? "", approach: "persuade", risk: "significant" };
    case "gözdağı": return { type: "social", actorId: me, targetId: args[0] ?? "", approach: "intimidate", risk: "significant" };
    case "rüşvet": return { type: "social", actorId: me, targetId: args[0] ?? "", approach: "bribe", risk: "significant", bribeCp: Number(args[1] ?? 0) * 100 };
    case "git": {
      const exit = EXITS[state.creatures.arda!.locationId!]?.find((e) => e.id === args[0]);
      return exit ? { type: "move", actorId: me, toLocationId: exit.id, minutes: exit.minutes } : "Bilinmeyen çıkış";
    }
    case "iksir": return { type: "use_item", actorId: me, itemKey: "potion_of_healing" };
    case "saklan": return { type: "hide", actorId: me };
    case "dinlen": return { type: "rest", actorId: me, kind: "short", hitDice: { 8: 1 } };
    case "savaş": return { type: "start_combat", actorId: me, participantIds: args };
    case "tur": return { type: "end_turn", actorId: me };
    case "bitir": return { type: "end_combat", actorId: me };
    default: return "Bilinmeyen komut";
  }
}

function status(): string {
  const a = state.creatures.arda!;
  const here = Object.values(state.creatures).filter((c) => c.locationId === a.locationId && c.id !== "arda");
  return [
    `🕯  ${gameClock(state.gameTime)} — ${placeOf(a.locationId!).name}`,
    `❤  ${a.hp}/${a.maxHp} HP  💰 ${((state.wallets.arda ?? 0) / 100).toFixed(2)} altın  ${a.conditions.length ? `⚠ ${a.conditions.join(", ")}` : ""}`,
    `👥 ${here.map((c) => `${c.name} [${c.id}]${c.isAlive ? "" : " (ölü)"}`).join(", ") || "kimse yok"}`,
    `🚪 ${(EXITS[a.locationId!] ?? []).map((e) => `${e.name} [${e.id}]`).join(", ")}`,
    state.encounter?.active ? `⚔  Raunt ${state.encounter.round}, sıra: ${state.encounter.order[state.encounter.turnIndex]!.id}` : "",
  ].filter(Boolean).join("\n");
}

async function step(line: string): Promise<void> {
  if (line === "durum") { console.log(status()); return; }
  if (caller) {
    const r = await playTurn({ caller, world: DEMO_WORLD, context: context(), input: { text: line }, exits: EXITS[state.creatures.arda!.locationId!] ?? [], rng });
    if (r.status !== "resolved") {
      console.log(`(${r.status}) ${"question" in r ? r.question : "reason" in r ? r.reason : r.summary}`);
      return;
    }
    state = r.resolution.state;
    turn++;
    recent.push({ n: turn, playerInput: line, headline: r.resolution.outcome.headline, narration: r.narration.narration });
    for (const roll of r.resolution.rolls) console.log(`  🎲 ${roll.reason}: ${roll.breakdown}`);
    console.log(`\n${r.narration.narration}\n`);
    if (r.narration.suggested_hooks.length) console.log(`  💡 ${r.narration.suggested_hooks.map((h) => h.text).join(" | ")}`);
    const tokens = r.usage.reduce((s, u) => s + u.inputTokens + u.outputTokens, 0);
    console.log(`  [${r.narrationSource}, ${tokens} token, önbellekten ${r.usage.reduce((s, u) => s + u.cacheReadTokens, 0)}]\n`);
  } else {
    const a = offlineAction(line);
    if (typeof a === "string") { console.log(a); return; }
    const r = resolveAction(state, a, { rng });
    if (!r.ok) { console.log(`✗ ${r.error}`); return; }
    const auto = combatAutopilot(r.state, "arda", { rng });
    state = auto.state;
    for (const step of [r, ...auto.steps]) {
      if (step.action.type === "end_turn") continue;
      for (const roll of step.rolls) console.log(`  🎲 ${roll.reason}: ${roll.breakdown}`);
      console.log(`\n${templateNarration(step.outcome).narration}\n`);
    }
  }
  console.log(status(), "\n");
}

async function main() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  console.log(`\n=== ${DEMO_WORLD.title} === (${useAi ? "Claude Haiku 5.5 anlatıcı" : "AI'sız mod — komutlar için dosya başına bak"})\n`);
  console.log(DEMO_WORLD.premise, "\n");
  console.log(status(), "\n");

  rl.setPrompt("> ");
  rl.prompt();
  for await (const raw of rl) {
    const line = raw.trim();
    if (!line) { rl.prompt(); continue; }
    if (line === "çık") break;
    await step(line);
    rl.prompt();
  }
  rl.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
