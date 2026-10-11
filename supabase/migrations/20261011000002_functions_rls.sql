-- Kader Zarı — atomik tur yazma, hafıza sorguları ve RLS

-- ---------------------------------------------------------------- apply_turn
-- Bir turun TÜM sonuçlarını tek transaction'da yazar. İyimser eşzamanlılık:
-- p_expected_turn kampanyanın mevcut turn_count'una eşit değilse (başka bir
-- istek araya girdiyse) 'turn_conflict' hatası verir ve hiçbir şey yazılmaz.
create or replace function public.apply_turn(p_campaign_id uuid, p_expected_turn integer, p jsonb)
returns table (turn_id uuid, turn_n integer)
language plpgsql
set search_path = ''
as $$
declare
  v_count integer;
  v_turn_id uuid;
  v_n integer;
  v_owner jsonb;
begin
  select c.turn_count into v_count
  from public.campaigns c
  where c.id = p_campaign_id
  for update;

  if v_count is null then
    raise exception 'campaign_not_found' using errcode = 'P0002';
  end if;
  if v_count <> p_expected_turn then
    raise exception 'turn_conflict: expected %, found %', p_expected_turn, v_count using errcode = '40001';
  end if;
  v_n := v_count + 1;

  insert into public.turns (
    campaign_id, n, player_input, intent, action, outcome, narration, narration_source,
    validation, rng_nonce, usage, game_time_before, game_time_after
  )
  select p_campaign_id, v_n, t.player_input, t.intent, t.action, t.outcome, t.narration,
         t.narration_source, coalesce(t.validation, '[]'::jsonb), t.rng_nonce,
         coalesce(t.usage, '[]'::jsonb), t.game_time_before, t.game_time_after
  from jsonb_to_record(p -> 'turn') as t (
    player_input text, intent jsonb, action jsonb, outcome jsonb, narration jsonb,
    narration_source text, validation jsonb, rng_nonce text, usage jsonb,
    game_time_before integer, game_time_after integer
  )
  returning id into v_turn_id;

  -- Yaratıklar: motorun ürettiği son hâl (yalnızca değişenler gönderilir)
  update public.creatures c set
    level = r.level, hp = r.hp, max_hp = r.max_hp, temp_hp = r.temp_hp, ac = r.ac, speed = r.speed,
    conditions = r.conditions, exhaustion = r.exhaustion, death_saves = r.death_saves,
    hit_dice = r.hit_dice, hit_dice_max = r.hit_dice_max, inspiration = r.inspiration,
    spellcasting = r.spellcasting, features = r.features, xp = r.xp, is_alive = r.is_alive,
    location_id = r.location_id, faction_id = r.faction_id, abilities = r.abilities,
    save_proficiencies = r.save_proficiencies, skill_proficiencies = r.skill_proficiencies,
    expertise = r.expertise, resistances = r.resistances, immunities = r.immunities,
    vulnerabilities = r.vulnerabilities, condition_immunities = r.condition_immunities,
    attacks = r.attacks, updated_at = now()
  from jsonb_populate_recordset(null::public.creatures, coalesce(p -> 'creatures', '[]'::jsonb)) r
  where c.id = r.id and c.campaign_id = p_campaign_id;

  -- Envanter: dokunulan sahiplerin envanteri tamamen yeniden yazılır
  for v_owner in select * from jsonb_array_elements(coalesce(p -> 'inventory', '[]'::jsonb)) loop
    delete from public.inventory i
    where i.campaign_id = p_campaign_id and i.owner_id = (v_owner ->> 'owner_id')::uuid;
    insert into public.inventory (campaign_id, owner_id, item_key, qty, equipped, attuned)
    select p_campaign_id, (v_owner ->> 'owner_id')::uuid, it.item_key, it.qty,
           coalesce(it.equipped, false), coalesce(it.attuned, false)
    from jsonb_to_recordset(coalesce(v_owner -> 'items', '[]'::jsonb))
      as it (item_key text, qty integer, equipped boolean, attuned boolean)
    where it.qty > 0;
  end loop;

  insert into public.wallets (campaign_id, owner_id, cp)
  select p_campaign_id, w.owner_id, w.cp
  from jsonb_to_recordset(coalesce(p -> 'wallets', '[]'::jsonb)) as w (owner_id uuid, cp bigint)
  on conflict (campaign_id, owner_id) do update set cp = excluded.cp;

  insert into public.relationships (campaign_id, a, b, score)
  select p_campaign_id, least(r.a, r.b), greatest(r.a, r.b), r.score
  from jsonb_to_recordset(coalesce(p -> 'relationships', '[]'::jsonb)) as r (a uuid, b uuid, score integer)
  on conflict (campaign_id, a, b) do update set score = excluded.score;

  update public.factions f set
    treasury = r.treasury, military = r.military, stability = r.stability, population = r.population,
    tech = r.tech, intelligence = r.intelligence, traits = r.traits, region_ids = r.region_ids,
    at_war_with = r.at_war_with, alliances = r.alliances, updated_at = now()
  from jsonb_populate_recordset(null::public.factions, coalesce(p -> 'factions', '[]'::jsonb)) r
  where f.id = r.id and f.campaign_id = p_campaign_id;

  update public.regions g set owner_faction_id = r.owner_faction_id
  from jsonb_to_recordset(coalesce(p -> 'regions', '[]'::jsonb)) as r (id uuid, owner_faction_id uuid)
  where g.id = r.id and g.campaign_id = p_campaign_id;

  insert into public.rolls (campaign_id, turn_id, seq, reason, notation, dice, total, natural_roll, mode,
                            actor_id, target_id, dc, tier, breakdown)
  select p_campaign_id, v_turn_id, x.ord::integer, x.r ->> 'reason', x.r ->> 'notation',
         array(select jsonb_array_elements_text(x.r -> 'dice')::integer),
         (x.r ->> 'total')::integer, (x.r ->> 'natural')::integer, x.r ->> 'mode',
         (x.r ->> 'actorId')::uuid, (x.r ->> 'targetId')::uuid, (x.r ->> 'dc')::integer,
         x.r ->> 'tier', x.r ->> 'breakdown'
  from jsonb_array_elements(coalesce(p -> 'rolls', '[]'::jsonb)) with ordinality as x (r, ord);

  insert into public.state_deltas (campaign_id, turn_id, seq, op, payload)
  select p_campaign_id, v_turn_id, x.ord::integer, x.e ->> 'op', x.e
  from jsonb_array_elements(coalesce(p -> 'effects', '[]'::jsonb)) with ordinality as x (e, ord);

  insert into public.events (campaign_id, turn_id, seq, type, payload, game_time)
  select p_campaign_id, v_turn_id, x.ord::integer, x.e ->> 'type', x.e -> 'payload', (p ->> 'game_time')::integer
  from jsonb_array_elements(coalesce(p -> 'effects', '[]'::jsonb)) with ordinality as x (e, ord)
  where x.e ->> 'op' = 'event';

  insert into public.hooks (campaign_id, turn_n, type, text)
  select p_campaign_id, v_n, h.type, h.text
  from jsonb_to_recordset(coalesce(p -> 'hooks', '[]'::jsonb)) as h (type text, text text);

  -- Anlatıcının yumuşak gerçek adayları: mevcut aktif gerçeği EZMEZ
  insert into public.facts (campaign_id, subject, predicate, value, source, source_turn, confidence)
  select p_campaign_id, f.subject, f.predicate, f.value, 'narrator', v_n, 0.6
  from jsonb_to_recordset(coalesce(p -> 'facts', '[]'::jsonb)) as f (subject text, predicate text, value text)
  on conflict (campaign_id, subject, lower(predicate)) where superseded_by is null do nothing;

  update public.campaigns c set
    turn_count = v_n,
    game_time = (p ->> 'game_time')::integer,
    encounter = p -> 'encounter',
    scene_location_id = coalesce((p ->> 'scene_location_id')::uuid, c.scene_location_id),
    updated_at = now()
  where c.id = p_campaign_id;

  return query select v_turn_id, v_n;
end;
$$;

-- ---------------------------------------------------------------- hafıza sorguları
-- Sahnedeki konular için ilgili gerçekler: kilitliler önce, sonra güven ve yenilik
create or replace function public.relevant_facts(p_campaign_id uuid, p_subjects text[], p_limit integer default 20)
returns setof public.facts
language sql stable
set search_path = ''
as $$
  select f.*
  from public.facts f
  where f.campaign_id = p_campaign_id
    and f.superseded_by is null
    and (f.subject = any (p_subjects) or f.locked)
  order by f.locked desc, (f.subject = any (p_subjects)) desc, f.confidence desc, f.created_at desc
  limit p_limit;
$$;

create or replace function public.match_memories(
  p_campaign_id uuid,
  p_embedding extensions.vector(384),
  p_limit integer default 5,
  p_min_similarity real default 0.75
)
returns table (id uuid, turn_n integer, content text, similarity real)
language sql stable
set search_path = ''
as $$
  select m.id, m.turn_n, m.content, (1 - (m.embedding operator(extensions.<=>) p_embedding))::real as similarity
  from public.memory_chunks m
  where m.campaign_id = p_campaign_id
    and m.embedding is not null
    and 1 - (m.embedding operator(extensions.<=>) p_embedding) >= p_min_similarity
  order by m.embedding operator(extensions.<=>) p_embedding
  limit p_limit;
$$;

-- Yazma ve hafıza fonksiyonları yalnızca sunucu (service role) içindir
revoke all on function public.apply_turn(uuid, integer, jsonb) from public, anon, authenticated;
revoke all on function public.relevant_facts(uuid, text[], integer) from public, anon, authenticated;
revoke all on function public.match_memories(uuid, extensions.vector, integer, real) from public, anon, authenticated;
grant execute on function public.apply_turn(uuid, integer, jsonb) to service_role;
grant execute on function public.relevant_facts(uuid, text[], integer) to service_role;
grant execute on function public.match_memories(uuid, extensions.vector, integer, real) to service_role;

-- ---------------------------------------------------------------- RLS
create or replace function public.owns_campaign(p_campaign_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.campaigns c
    where c.id = p_campaign_id and c.owner_id = (select auth.uid())
  );
$$;
revoke all on function public.owns_campaign(uuid) from public, anon;
grant execute on function public.owns_campaign(uuid) to authenticated;

alter table public.worlds        enable row level security;
alter table public.campaigns     enable row level security;
alter table public.places        enable row level security;
alter table public.place_exits   enable row level security;
alter table public.creatures     enable row level security;
alter table public.personas      enable row level security;
alter table public.inventory     enable row level security;
alter table public.wallets       enable row level security;
alter table public.relationships enable row level security;
alter table public.factions      enable row level security;
alter table public.regions       enable row level security;
alter table public.catalog       enable row level security;
alter table public.quests        enable row level security;
alter table public.hooks         enable row level security;
alter table public.turns         enable row level security;
alter table public.rolls         enable row level security;
alter table public.events        enable row level security;
alter table public.state_deltas  enable row level security;
alter table public.facts         enable row level security;
alter table public.summaries     enable row level security;
alter table public.memory_chunks enable row level security;

-- Dünyalar: sahibi her şeyi yapar; herkese açık olanlar okunabilir
create policy worlds_read on public.worlds for select to authenticated
  using (is_public or owner_id = (select auth.uid()));
create policy worlds_insert on public.worlds for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy worlds_update on public.worlds for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy places_read on public.places for select to authenticated
  using (exists (select 1 from public.worlds w where w.id = world_id and (w.is_public or w.owner_id = (select auth.uid()))));
create policy place_exits_read on public.place_exits for select to authenticated
  using (not hidden and exists (
    select 1 from public.places p join public.worlds w on w.id = p.world_id
    where p.id = from_id and (w.is_public or w.owner_id = (select auth.uid()))));

create policy catalog_read on public.catalog for select to authenticated using (true);

-- Kampanya verisi: oyuncu yalnızca OKUR. Tüm yazmalar Edge Function üzerinden.
create policy campaigns_read on public.campaigns for select to authenticated
  using (owner_id = (select auth.uid()));
create policy creatures_read on public.creatures for select to authenticated using (public.owns_campaign(campaign_id));
create policy inventory_read on public.inventory for select to authenticated using (public.owns_campaign(campaign_id));
create policy wallets_read on public.wallets for select to authenticated using (public.owns_campaign(campaign_id));
create policy relationships_read on public.relationships for select to authenticated using (public.owns_campaign(campaign_id));
create policy factions_read on public.factions for select to authenticated using (public.owns_campaign(campaign_id));
create policy regions_read on public.regions for select to authenticated using (public.owns_campaign(campaign_id));
create policy quests_read on public.quests for select to authenticated using (public.owns_campaign(campaign_id));
create policy turns_read on public.turns for select to authenticated using (public.owns_campaign(campaign_id));
create policy rolls_read on public.rolls for select to authenticated using (public.owns_campaign(campaign_id));
create policy events_read on public.events for select to authenticated using (public.owns_campaign(campaign_id));
create policy summaries_read on public.summaries for select to authenticated using (public.owns_campaign(campaign_id));
-- personas (NPC sırları), hooks, facts, state_deltas, memory_chunks: politika yok → istemciye kapalı.
