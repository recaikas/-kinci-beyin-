/**
 * supabase/seed.sql üretir: SRD kataloğu (motorun içeriğinden) + demo dünyası +
 * start_demo_campaign() fonksiyonu. Çalıştır: npm run gen:seed
 */
import { writeFileSync } from "node:fs";
import { ITEMS, MONSTERS, NATURAL_WEAPONS, SPELLS, WEAPONS } from "@kader/engine";
import { DEMO_WORLD, demoState, EXITS, PERSONAS, PLACES } from "./demo-world.ts";

const q = (v: unknown) => (v === null || v === undefined ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const j = (v: unknown) => `${q(JSON.stringify(v))}::jsonb`;
const arr = (v: string[]) => `array[${v.map(q).join(", ")}]::text[]`;

const WORLD_ID = "5eed0000-0000-4000-8000-000000000001";
const placeId = (key: string) => {
  const i = Object.values(PLACES).findIndex((p) => p.id === key);
  return `5eed0000-0000-4000-8000-00000000010${i}`;
};

const out: string[] = [];
out.push(`-- OTOMATİK ÜRETİLDİ: npm run gen:seed (scripts/gen-seed.ts). Elle düzenleme.
-- This work includes material taken from the System Reference Document 5.1 ("SRD 5.1")
-- by Wizards of the Coast LLC, licensed under CC-BY-4.0.
`);

out.push("-- SRD kataloğu");
const cat: [string, string, unknown][] = [
  ...Object.values({ ...WEAPONS, ...NATURAL_WEAPONS }).map((w) => ["weapon", w.key, w] as [string, string, unknown]),
  ...Object.values(SPELLS).map((s) => ["spell", s.key, s] as [string, string, unknown]),
  ...Object.values(ITEMS).map((i) => ["item", i.key, i] as [string, string, unknown]),
  ...Object.entries(MONSTERS).map(([k, m]) => ["monster", k, m] as [string, string, unknown]),
];
out.push(`insert into public.catalog (kind, key, data) values\n${cat.map(([k, key, d]) => `  (${q(k)}, ${q(key)}, ${j(d)})`).join(",\n")}\non conflict (kind, key) do update set data = excluded.data;\n`);

out.push("-- Demo dünyası (sistem dünyası, herkese açık)");
out.push(`insert into public.worlds (id, owner_id, title, premise, tone, rules, is_public) values
  (${q(WORLD_ID)}, null, ${q(DEMO_WORLD.title)}, ${q(DEMO_WORLD.premise)}, ${q(DEMO_WORLD.tone)}, ${arr(DEMO_WORLD.rules)}, true)
on conflict (id) do nothing;\n`);
out.push(`insert into public.places (id, world_id, name, description) values\n${Object.values(PLACES)
  .map((p) => `  (${q(placeId(p.id))}, ${q(WORLD_ID)}, ${q(p.name)}, ${q(p.description)})`).join(",\n")}\non conflict (id) do nothing;\n`);
out.push(`insert into public.place_exits (from_id, to_id, travel_minutes) values\n${Object.entries(EXITS)
  .flatMap(([from, list]) => list.map((e) => `  (${q(placeId(from))}, ${q(placeId(e.id))}, ${e.minutes})`)).join(",\n")}\non conflict do nothing;\n`);

// start_demo_campaign(): çağıran kullanıcı için demo kampanyası kurar.
const s = demoState();
const creatures = Object.values(s.creatures);
const creatureInserts = creatures.map((c) => `
  insert into public.creatures (id, campaign_id, kind, name, level, cr, size, abilities, save_proficiencies,
    skill_proficiencies, expertise, hp, max_hp, ac, speed, resistances, immunities, vulnerabilities,
    condition_immunities, hit_dice, hit_dice_max, features, xp, attacks, location_id)
  values (ids.${c.id}, v_campaign, ${q(c.kind)}, ${q(c.name)}, ${c.level}, ${c.cr ?? "null"}, ${q(c.size)}, ${j(c.abilities)},
    ${arr(c.saveProficiencies)}, ${arr(c.skillProficiencies)}, ${arr(c.expertise)}, ${c.hp}, ${c.maxHp}, ${c.ac}, ${c.speed},
    ${arr(c.resistances)}, ${arr(c.immunities)}, ${arr(c.vulnerabilities)}, ${arr(c.conditionImmunities)},
    ${j(c.hitDice)}, ${j(c.hitDiceMax)}, ${j(c.features)}, ${c.xp}, ${arr(c.attacks ?? [])}, ${q(placeId(c.locationId!))});`).join("");

const personaInserts = Object.values(PERSONAS).map((p) =>
  `\n  insert into public.personas (creature_id, personality, goals, speech_style) values (ids.${p.id}, ${q(p.personality)}, ${q(p.goals)}, ${q(p.speechStyle)});`).join("");
const invInserts = Object.entries(s.inventories).flatMap(([owner, items]) => items.map((i) =>
  `\n  insert into public.inventory (campaign_id, owner_id, item_key, qty) values (v_campaign, ids.${owner}, ${q(i.itemKey)}, ${i.qty});`)).join("");
const walletInserts = Object.entries(s.wallets).map(([owner, cp]) =>
  `\n  insert into public.wallets (campaign_id, owner_id, cp) values (v_campaign, ids.${owner}, ${cp});`).join("");
const relInserts = Object.entries(s.relationships).map(([k, score]) => {
  const [a, b] = k.split("|");
  return `\n  insert into public.relationships (campaign_id, a, b, score) values (v_campaign, least(ids.${a}, ids.${b}), greatest(ids.${a}, ids.${b}), ${score});`;
}).join("");

out.push(`-- Oturumdaki kullanıcı için demo kampanyası başlatır; kampanya id döner.
create or replace function public.start_demo_campaign(p_title text default 'Karaçam Günlükleri')
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user uuid := auth.uid();
  v_campaign uuid := gen_random_uuid();
  ids record;
begin
  if v_user is null then
    raise exception 'oturum gerekli' using errcode = '28000';
  end if;
  select ${creatures.map((c) => `gen_random_uuid() as ${c.id}`).join(", ")} into ids;

  insert into public.campaigns (id, owner_id, world_id, title, game_time, scene_location_id)
  values (v_campaign, v_user, ${q(WORLD_ID)}, p_title, ${s.gameTime}, ${q(placeId(s.sceneLocationId!))});
${creatureInserts}
  update public.campaigns set player_character_id = ids.arda where id = v_campaign;${personaInserts}${invInserts}${walletInserts}${relInserts}
  insert into public.facts (campaign_id, subject, predicate, value, locked, source)
  values (v_campaign, ids.kerem::text, 'kızının adı', 'Elif', true, 'author');
  insert into public.quests (campaign_id, title, objectives, created_turn)
  values (v_campaign, 'Mektubu Karaçam muhtarına teslim et', '[{"text":"Kasabaya gir"},{"text":"Muhtarı bul"}]'::jsonb, 0);
  return v_campaign;
end;
$$;
revoke all on function public.start_demo_campaign(text) from public, anon;
grant execute on function public.start_demo_campaign(text) to authenticated;
`);

writeFileSync(new URL("../supabase/seed.sql", import.meta.url), out.join("\n"));
console.log(`seed.sql yazıldı: ${cat.length} katalog kaydı, ${creatures.length} yaratık`);
