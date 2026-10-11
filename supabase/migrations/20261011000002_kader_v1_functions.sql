-- Kader Zarı v1.0 — kampanya oluşturma, atomik tur yazma, hafıza, RLS

-- Ortak yardımcılar: yaratık/envanter/cüzdan/ilişki/fraksiyon/görev/gerçek yazımı.
create or replace function public.kz_write_world(p_campaign_id uuid, p jsonb, p_turn integer)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_owner jsonb;
begin
  insert into public.creatures (id, campaign_id, kind, name, template_key, race_key, class_key, level, cr, size, abilities, save_proficiencies, skill_proficiencies, expertise, weapon_proficiencies, armor_proficiencies, hp, max_hp, temp_hp, ac, speed, conditions, exhaustion, resistances, immunities, vulnerabilities, condition_immunities, death_saves, hit_dice, hit_dice_max, inspiration, spellcasting, features, resources, buffs, attacks, xp, is_alive, looted, stealth_disadvantage, darkvision, languages, background, location_id, faction_id)
  select
    r.id,
    p_campaign_id,
    r.kind,
    r.name,
    r.template_key,
    r.race_key,
    r.class_key,
    coalesce(r.level, 1),
    r.cr,
    coalesce(r.size, 'medium'),
    r.abilities,
    coalesce(r.save_proficiencies, '{}'),
    coalesce(r.skill_proficiencies, '{}'),
    coalesce(r.expertise, '{}'),
    r.weapon_proficiencies,
    r.armor_proficiencies,
    r.hp,
    r.max_hp,
    coalesce(r.temp_hp, 0),
    r.ac,
    coalesce(r.speed, 30),
    coalesce(r.conditions, '{}'),
    coalesce(r.exhaustion, 0),
    coalesce(r.resistances, '{}'),
    coalesce(r.immunities, '{}'),
    coalesce(r.vulnerabilities, '{}'),
    coalesce(r.condition_immunities, '{}'),
    coalesce(r.death_saves, '{"successes":0,"failures":0,"stable":false}'::jsonb),
    coalesce(r.hit_dice, '{}'::jsonb),
    coalesce(r.hit_dice_max, '{}'::jsonb),
    coalesce(r.inspiration, false),
    r.spellcasting,
    coalesce(r.features, '{}'::jsonb),
    r.resources,
    r.buffs,
    r.attacks,
    coalesce(r.xp, 0),
    coalesce(r.is_alive, true),
    coalesce(r.looted, false),
    coalesce(r.stealth_disadvantage, false),
    r.darkvision,
    r.languages,
    r.background,
    r.location_id,
    r.faction_id
  from jsonb_populate_recordset(null::public.creatures, coalesce(p -> 'creatures', '[]'::jsonb)) r
  on conflict (id) do update set
      kind = excluded.kind,
      name = excluded.name,
      template_key = excluded.template_key,
      race_key = excluded.race_key,
      class_key = excluded.class_key,
      level = excluded.level,
      cr = excluded.cr,
      size = excluded.size,
      abilities = excluded.abilities,
      save_proficiencies = excluded.save_proficiencies,
      skill_proficiencies = excluded.skill_proficiencies,
      expertise = excluded.expertise,
      weapon_proficiencies = excluded.weapon_proficiencies,
      armor_proficiencies = excluded.armor_proficiencies,
      hp = excluded.hp,
      max_hp = excluded.max_hp,
      temp_hp = excluded.temp_hp,
      ac = excluded.ac,
      speed = excluded.speed,
      conditions = excluded.conditions,
      exhaustion = excluded.exhaustion,
      resistances = excluded.resistances,
      immunities = excluded.immunities,
      vulnerabilities = excluded.vulnerabilities,
      condition_immunities = excluded.condition_immunities,
      death_saves = excluded.death_saves,
      hit_dice = excluded.hit_dice,
      hit_dice_max = excluded.hit_dice_max,
      inspiration = excluded.inspiration,
      spellcasting = excluded.spellcasting,
      features = excluded.features,
      resources = excluded.resources,
      buffs = excluded.buffs,
      attacks = excluded.attacks,
      xp = excluded.xp,
      is_alive = excluded.is_alive,
      looted = excluded.looted,
      stealth_disadvantage = excluded.stealth_disadvantage,
      darkvision = excluded.darkvision,
      languages = excluded.languages,
      background = excluded.background,
      location_id = excluded.location_id,
      faction_id = excluded.faction_id,
      updated_at = now()
  where public.creatures.campaign_id = p_campaign_id;

  insert into public.personas (creature_id, campaign_id, personality, goals, speech_style, secrets)
  select x.creature_id, p_campaign_id, coalesce(x.personality, ''), coalesce(x.goals, ''), coalesce(x.speech_style, ''), coalesce(x.secrets, '')
  from jsonb_to_recordset(coalesce(p -> 'personas', '[]'::jsonb))
    as x (creature_id uuid, personality text, goals text, speech_style text, secrets text)
  on conflict (creature_id) do nothing;

  -- Envanter: dokunulan sahiplerin envanteri tamamen yeniden yazılır
  for v_owner in select * from jsonb_array_elements(coalesce(p -> 'inventory', '[]'::jsonb)) loop
    delete from public.inventory i
    where i.campaign_id = p_campaign_id and i.owner_id = (v_owner ->> 'owner_id')::uuid;
    insert into public.inventory (campaign_id, owner_id, item_key, qty, equipped, attuned)
    select p_campaign_id, (v_owner ->> 'owner_id')::uuid, it.item_key, sum(it.qty)::integer,
           bool_or(coalesce(it.equipped, false)), bool_or(coalesce(it.attuned, false))
    from jsonb_to_recordset(coalesce(v_owner -> 'items', '[]'::jsonb))
      as it (item_key text, qty integer, equipped boolean, attuned boolean)
    where it.qty > 0
    group by it.item_key;
  end loop;

  insert into public.wallets (campaign_id, owner_id, cp)
  select p_campaign_id, w.owner_id, w.cp
  from jsonb_to_recordset(coalesce(p -> 'wallets', '[]'::jsonb)) as w (owner_id uuid, cp bigint)
  on conflict (campaign_id, owner_id) do update set cp = excluded.cp;

  insert into public.relationships (campaign_id, a, b, score)
  select p_campaign_id, least(r.a, r.b), greatest(r.a, r.b), r.score
  from jsonb_to_recordset(coalesce(p -> 'relationships', '[]'::jsonb)) as r (a uuid, b uuid, score integer)
  on conflict (campaign_id, a, b) do update set score = excluded.score;

  insert into public.factions (id, campaign_id, name, treasury, military, stability, population, tech, intelligence,
                               traits, region_ids, at_war_with, alliances)
  select r.id, p_campaign_id, r.name, r.treasury, r.military, r.stability, r.population, r.tech, r.intelligence,
         coalesce(r.traits, '{}'::jsonb), coalesce(r.region_ids, '{}'), coalesce(r.at_war_with, '{}'), coalesce(r.alliances, '{}')
  from jsonb_populate_recordset(null::public.factions, coalesce(p -> 'factions', '[]'::jsonb)) r
  on conflict (id) do update set
    treasury = excluded.treasury, military = excluded.military, stability = excluded.stability,
    population = excluded.population, tech = excluded.tech, intelligence = excluded.intelligence,
    traits = excluded.traits, region_ids = excluded.region_ids, at_war_with = excluded.at_war_with,
    alliances = excluded.alliances
  where public.factions.campaign_id = p_campaign_id;

  insert into public.quests (campaign_id, id, status, data)
  select p_campaign_id, q ->> 'id', q ->> 'status', q
  from jsonb_array_elements(coalesce(p -> 'quests', '[]'::jsonb)) as q
  on conflict (campaign_id, id) do update set status = excluded.status, data = excluded.data, updated_at = now();

  -- Yeni gerçekler mevcut kanonu EZMEZ
  insert into public.facts (campaign_id, subject, predicate, value, locked, source, source_turn)
  select p_campaign_id, f.subject, f.predicate, f.value, coalesce(f.locked, false), coalesce(f.source, 'narrator'), p_turn
  from jsonb_to_recordset(coalesce(p -> 'facts', '[]'::jsonb))
    as f (subject text, predicate text, value text, locked boolean, source text)
  on conflict (campaign_id, subject, lower(predicate)) do nothing;
end;
$$;

-- ---------------------------------------------------------------- create_campaign
create or replace function public.create_campaign(p_owner uuid, p jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  c jsonb := p -> 'campaign';
  v_id uuid := (c ->> 'id')::uuid;
begin
  insert into public.campaigns (id, owner_id, title, template_key, seed, turn_count, game_time, player_character_id,
                                rules, bible, world, encounter, chapter_summary, campaign_summary)
  values (v_id, p_owner, c ->> 'title', c ->> 'template_key', c ->> 'seed', 0, (c ->> 'game_time')::integer,
          (c ->> 'player_character_id')::uuid, c -> 'rules', c -> 'bible', c -> 'world', null, '', '');
  perform public.kz_write_world(v_id, p, 0);
  insert into public.turns (campaign_id, n, entry, narration_source)
  values (v_id, 0, p -> 'intro', 'template');
  return v_id;
end;
$$;

-- ---------------------------------------------------------------- apply_turn
-- Bir turun TÜM sonuçlarını tek transaction'da yazar. İyimser eşzamanlılık:
-- p_expected_turn mevcut turn_count'a eşit değilse 'turn_conflict' ve hiçbir şey yazılmaz.
create or replace function public.apply_turn(p_campaign_id uuid, p_expected_turn integer, p jsonb)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_count integer;
  v_n integer;
  v_time integer := (p ->> 'game_time')::integer;
begin
  select c.turn_count into v_count from public.campaigns c where c.id = p_campaign_id for update;
  if v_count is null then
    raise exception 'campaign_not_found' using errcode = 'P0002';
  end if;
  if v_count <> p_expected_turn then
    raise exception 'turn_conflict: expected %, found %', p_expected_turn, v_count using errcode = '40001';
  end if;
  v_n := v_count + 1;

  insert into public.turns (campaign_id, n, player_input, action, outcome, entry, narration_source, rng_nonce, usage)
  select p_campaign_id, v_n, coalesce(t.player_input, ''), t.action, t.outcome, t.entry, t.narration_source,
         coalesce(t.rng_nonce, ''), coalesce(t.usage, '[]'::jsonb)
  from jsonb_to_record(p -> 'turn') as t (player_input text, action jsonb, outcome jsonb, entry jsonb,
                                          narration_source text, rng_nonce text, usage jsonb);

  perform public.kz_write_world(p_campaign_id, p, v_n);

  insert into public.rolls (campaign_id, turn_n, seq, reason, notation, dice, total, natural_roll, mode,
                            actor_id, target_id, dc, tier, breakdown)
  select p_campaign_id, v_n, x.ord::integer, x.r ->> 'reason', x.r ->> 'notation',
         array(select jsonb_array_elements_text(x.r -> 'dice')::integer),
         (x.r ->> 'total')::integer, (x.r ->> 'natural')::integer, x.r ->> 'mode',
         x.r ->> 'actorId', x.r ->> 'targetId', (x.r ->> 'dc')::integer, x.r ->> 'tier', x.r ->> 'breakdown'
  from jsonb_array_elements(coalesce(p -> 'rolls', '[]'::jsonb)) with ordinality as x (r, ord);

  insert into public.state_deltas (campaign_id, turn_n, seq, op, payload)
  select p_campaign_id, v_n, x.ord::integer, x.e ->> 'op', x.e
  from jsonb_array_elements(coalesce(p -> 'effects', '[]'::jsonb)) with ordinality as x (e, ord);

  insert into public.events (campaign_id, turn_n, seq, type, payload, game_time)
  select p_campaign_id, v_n, x.ord::integer, x.e ->> 'type', x.e -> 'payload', v_time
  from jsonb_array_elements(coalesce(p -> 'effects', '[]'::jsonb)) with ordinality as x (e, ord)
  where x.e ->> 'op' = 'event';

  insert into public.hooks (campaign_id, turn_n, type, text)
  select p_campaign_id, v_n, h.type, h.text
  from jsonb_to_recordset(coalesce(p -> 'hooks', '[]'::jsonb)) as h (type text, text text);

  if p ? 'chapter_summary' then
    insert into public.summaries (campaign_id, to_turn, text) values (p_campaign_id, v_n, p ->> 'chapter_summary');
  end if;

  update public.campaigns c set
    turn_count = v_n,
    game_time = v_time,
    encounter = p -> 'encounter',
    chapter_summary = coalesce(p ->> 'chapter_summary', c.chapter_summary),
    campaign_summary = coalesce(p ->> 'campaign_summary', c.campaign_summary),
    updated_at = now()
  where c.id = p_campaign_id;

  return v_n;
end;
$$;

-- ---------------------------------------------------------------- hafıza araması
create or replace function public.match_memories(
  p_campaign_id uuid,
  p_embedding extensions.vector(384),
  p_limit integer default 4,
  p_min_similarity real default 0.75
)
returns table (turn_n integer, content text, similarity real)
language sql stable
set search_path = ''
as $$
  select m.turn_n, m.content, (1 - (m.embedding operator(extensions.<=>) p_embedding))::real as similarity
  from public.memory_chunks m
  where m.campaign_id = p_campaign_id
    and m.embedding is not null
    and 1 - (m.embedding operator(extensions.<=>) p_embedding) >= p_min_similarity
  order by m.embedding operator(extensions.<=>) p_embedding
  limit p_limit;
$$;

-- Yazma ve hafıza fonksiyonları yalnızca sunucu (service role) içindir
revoke all on function public.kz_write_world(uuid, jsonb, integer) from public, anon, authenticated;
revoke all on function public.create_campaign(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.apply_turn(uuid, integer, jsonb) from public, anon, authenticated;
revoke all on function public.match_memories(uuid, extensions.vector, integer, real) from public, anon, authenticated;
grant execute on function public.kz_write_world(uuid, jsonb, integer) to service_role;
grant execute on function public.create_campaign(uuid, jsonb) to service_role;
grant execute on function public.apply_turn(uuid, integer, jsonb) to service_role;
grant execute on function public.match_memories(uuid, extensions.vector, integer, real) to service_role;

-- ---------------------------------------------------------------- RLS
create or replace function public.owns_campaign(p_campaign_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.campaigns c where c.id = p_campaign_id and c.owner_id = (select auth.uid()));
$$;
revoke all on function public.owns_campaign(uuid) from public, anon;
grant execute on function public.owns_campaign(uuid) to authenticated;

alter table public.campaigns     enable row level security;
alter table public.creatures     enable row level security;
alter table public.personas      enable row level security;
alter table public.inventory     enable row level security;
alter table public.wallets       enable row level security;
alter table public.relationships enable row level security;
alter table public.factions      enable row level security;
alter table public.quests        enable row level security;
alter table public.turns         enable row level security;
alter table public.rolls         enable row level security;
alter table public.events        enable row level security;
alter table public.state_deltas  enable row level security;
alter table public.facts         enable row level security;
alter table public.hooks         enable row level security;
alter table public.summaries     enable row level security;
alter table public.memory_chunks enable row level security;

-- Oyuncu kendi kampanya verisini yalnızca OKUR; tüm yazmalar Edge Function'lardan.
create policy campaigns_read on public.campaigns for select to authenticated using (owner_id = (select auth.uid()));
create policy campaigns_delete on public.campaigns for delete to authenticated using (owner_id = (select auth.uid()));
create policy creatures_read on public.creatures for select to authenticated using (public.owns_campaign(campaign_id));
create policy inventory_read on public.inventory for select to authenticated using (public.owns_campaign(campaign_id));
create policy wallets_read on public.wallets for select to authenticated using (public.owns_campaign(campaign_id));
create policy relationships_read on public.relationships for select to authenticated using (public.owns_campaign(campaign_id));
create policy factions_read on public.factions for select to authenticated using (public.owns_campaign(campaign_id));
create policy quests_read on public.quests for select to authenticated using (public.owns_campaign(campaign_id));
create policy turns_read on public.turns for select to authenticated using (public.owns_campaign(campaign_id));
create policy rolls_read on public.rolls for select to authenticated using (public.owns_campaign(campaign_id));
create policy events_read on public.events for select to authenticated using (public.owns_campaign(campaign_id));
create policy summaries_read on public.summaries for select to authenticated using (public.owns_campaign(campaign_id));
-- personas (NPC sırları), facts, hooks, state_deltas, memory_chunks: politika yok → istemciye kapalı.
