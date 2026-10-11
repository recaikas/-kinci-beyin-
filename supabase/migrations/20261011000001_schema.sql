-- Kader Zarı — çekirdek şema
-- İlke: oyunun TEK doğruluk kaynağı bu veritabanıdır. LLM hiçbir tabloya
-- doğrudan yazmaz; tüm yazmalar Edge Function (service role) üzerinden,
-- motorun ürettiği sonuçla ve apply_turn() transaction'ıyla yapılır.

create extension if not exists vector with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- dünyalar
create table public.worlds (
  id          uuid primary key default gen_random_uuid(),
  -- null = sistem dünyası (seed ile gelir)
  owner_id    uuid references auth.users (id) on delete cascade,
  title       text not null,
  premise     text not null,
  tone        text not null default '',
  rules       text[] not null default '{}',
  is_public   boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- kampanyalar
create table public.campaigns (
  id                   uuid primary key default gen_random_uuid(),
  owner_id             uuid not null references auth.users (id) on delete cascade,
  world_id             uuid not null references public.worlds (id),
  title                text not null,
  -- Motor kural seçenekleri (RuleOptions)
  settings             jsonb not null default '{}'::jsonb,
  -- Zar tohumu: her tur için seed = seed:turn:nonce
  seed                 text not null default encode(extensions.gen_random_bytes(16), 'hex'),
  turn_count           integer not null default 0,
  -- Kampanya başından beri geçen dakika
  game_time            integer not null default 0,
  player_character_id  uuid,
  scene_location_id    uuid,
  -- Aktif savaş (Encounter) ya da null
  encounter            jsonb,
  chapter_summary      text not null default '',
  campaign_summary     text not null default '',
  status               text not null default 'active' check (status in ('active', 'paused', 'ended')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index campaigns_owner_idx on public.campaigns (owner_id);

-- ---------------------------------------------------------------- mekânlar
create table public.places (
  id           uuid primary key default gen_random_uuid(),
  world_id     uuid not null references public.worlds (id) on delete cascade,
  -- Kampanyaya özgü (sonradan oluşan) mekânlar için
  campaign_id  uuid references public.campaigns (id) on delete cascade,
  parent_id    uuid references public.places (id) on delete set null,
  name         text not null,
  description  text not null default '',
  tags         text[] not null default '{}',
  created_at   timestamptz not null default now()
);
create index places_world_idx on public.places (world_id);

create table public.place_exits (
  from_id         uuid not null references public.places (id) on delete cascade,
  to_id           uuid not null references public.places (id) on delete cascade,
  travel_minutes  integer not null default 1 check (travel_minutes > 0),
  description     text not null default '',
  hidden          boolean not null default false,
  primary key (from_id, to_id)
);

alter table public.campaigns
  add constraint campaigns_scene_fk foreign key (scene_location_id) references public.places (id);

-- ---------------------------------------------------------------- yaratıklar
create table public.creatures (
  id                    uuid primary key default gen_random_uuid(),
  campaign_id           uuid not null references public.campaigns (id) on delete cascade,
  kind                  text not null check (kind in ('pc', 'npc', 'monster')),
  name                  text not null,
  template_key          text,
  level                 integer not null default 1 check (level between 0 and 30),
  cr                    numeric,
  size                  text not null default 'medium',
  abilities             jsonb not null,
  save_proficiencies    text[] not null default '{}',
  skill_proficiencies   text[] not null default '{}',
  expertise             text[] not null default '{}',
  hp                    integer not null check (hp >= 0),
  max_hp                integer not null check (max_hp > 0),
  temp_hp               integer not null default 0 check (temp_hp >= 0),
  ac                    integer not null,
  speed                 integer not null default 30,
  conditions            text[] not null default '{}',
  exhaustion            integer not null default 0 check (exhaustion between 0 and 6),
  resistances           text[] not null default '{}',
  immunities            text[] not null default '{}',
  vulnerabilities       text[] not null default '{}',
  condition_immunities  text[] not null default '{}',
  death_saves           jsonb not null default '{"successes":0,"failures":0,"stable":false}'::jsonb,
  hit_dice              jsonb not null default '{}'::jsonb,
  hit_dice_max          jsonb not null default '{}'::jsonb,
  inspiration           boolean not null default false,
  spellcasting          jsonb,
  features              jsonb not null default '{}'::jsonb,
  xp                    integer not null default 0,
  is_alive              boolean not null default true,
  -- NPC/canavar saldırı anahtarları (catalog weapon key)
  attacks               text[] not null default '{}',
  location_id           uuid references public.places (id) on delete set null,
  faction_id            uuid,
  updated_at            timestamptz not null default now()
);
create index creatures_campaign_idx on public.creatures (campaign_id);
create index creatures_location_idx on public.creatures (campaign_id, location_id);

alter table public.campaigns
  add constraint campaigns_pc_fk foreign key (player_character_id) references public.creatures (id) deferrable initially deferred;

-- NPC kişiliği: anlatıcıya giden "yumuşak" bilgi
create table public.personas (
  creature_id   uuid primary key references public.creatures (id) on delete cascade,
  personality   text not null default '',
  goals         text not null default '',
  speech_style  text not null default '',
  -- Anlatıcıya gönderilmez; yalnızca motor/olay tetikleyicileri kullanır
  secrets       text not null default ''
);

-- ---------------------------------------------------------------- ekonomi
create table public.inventory (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references public.campaigns (id) on delete cascade,
  owner_id     uuid not null,
  item_key     text not null,
  qty          integer not null check (qty > 0),
  equipped     boolean not null default false,
  attuned      boolean not null default false,
  unique (campaign_id, owner_id, item_key)
);
create index inventory_owner_idx on public.inventory (campaign_id, owner_id);

create table public.wallets (
  campaign_id  uuid not null references public.campaigns (id) on delete cascade,
  owner_id     uuid not null,
  -- Bakır para (1 gp = 100 cp)
  cp           bigint not null default 0 check (cp >= 0),
  primary key (campaign_id, owner_id)
);

create table public.relationships (
  campaign_id  uuid not null references public.campaigns (id) on delete cascade,
  a            uuid not null,
  b            uuid not null,
  score        integer not null default 0 check (score between -100 and 100),
  tags         text[] not null default '{}',
  primary key (campaign_id, a, b),
  check (a < b)
);

-- ---------------------------------------------------------------- strateji katmanı
create table public.factions (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null references public.campaigns (id) on delete cascade,
  name          text not null,
  treasury      bigint not null default 0,
  military      integer not null default 0 check (military >= 0),
  stability     integer not null default 50 check (stability between 0 and 100),
  population    bigint not null default 0 check (population >= 0),
  tech          numeric not null default 0 check (tech between 0 and 10),
  intelligence  integer not null default 0 check (intelligence between 0 and 100),
  traits        jsonb not null default '{}'::jsonb,
  region_ids    uuid[] not null default '{}',
  at_war_with   uuid[] not null default '{}',
  alliances     uuid[] not null default '{}',
  updated_at    timestamptz not null default now()
);
create index factions_campaign_idx on public.factions (campaign_id);

create table public.regions (
  id                uuid primary key default gen_random_uuid(),
  campaign_id       uuid not null references public.campaigns (id) on delete cascade,
  name              text not null,
  owner_faction_id  uuid references public.factions (id) on delete set null,
  geometry          jsonb,
  resources         jsonb not null default '{}'::jsonb
);

-- ---------------------------------------------------------------- içerik kataloğu (SRD + özel)
create table public.catalog (
  kind      text not null check (kind in ('weapon', 'spell', 'item', 'monster')),
  key       text not null,
  world_id  uuid references public.worlds (id) on delete cascade,
  source    text not null default 'srd-5.1',
  data      jsonb not null,
  primary key (kind, key)
);

-- ---------------------------------------------------------------- görevler & kancalar
create table public.quests (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references public.campaigns (id) on delete cascade,
  title        text not null,
  status       text not null default 'open' check (status in ('open', 'completed', 'failed', 'abandoned')),
  giver_id     uuid,
  objectives   jsonb not null default '[]'::jsonb,
  rewards      jsonb not null default '{}'::jsonb,
  created_turn integer,
  closed_turn  integer
);

create table public.hooks (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references public.campaigns (id) on delete cascade,
  turn_n       integer not null,
  type         text not null check (type in ('rumor', 'quest', 'complication', 'discovery')),
  text         text not null,
  status       text not null default 'proposed' check (status in ('proposed', 'accepted', 'rejected', 'used')),
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------- tur günlüğü (değişmez)
create table public.turns (
  id                uuid primary key default gen_random_uuid(),
  campaign_id       uuid not null references public.campaigns (id) on delete cascade,
  n                 integer not null,
  player_input      text not null,
  intent            jsonb,
  action            jsonb not null,
  outcome           jsonb not null,
  narration         jsonb not null,
  narration_source  text not null check (narration_source in ('model', 'model_retry', 'template')),
  validation        jsonb not null default '[]'::jsonb,
  rng_nonce         text not null,
  usage             jsonb not null default '[]'::jsonb,
  game_time_before  integer not null,
  game_time_after   integer not null,
  created_at        timestamptz not null default now(),
  unique (campaign_id, n)
);

create table public.rolls (
  id           bigint generated always as identity primary key,
  campaign_id  uuid not null references public.campaigns (id) on delete cascade,
  turn_id      uuid not null references public.turns (id) on delete cascade,
  seq          integer not null,
  reason       text not null,
  notation     text not null,
  dice         integer[] not null,
  total        integer not null,
  natural_roll integer,
  mode         text,
  actor_id     uuid,
  target_id    uuid,
  dc           integer,
  tier         text,
  breakdown    text not null
);
create index rolls_turn_idx on public.rolls (turn_id);

create table public.events (
  id           bigint generated always as identity primary key,
  campaign_id  uuid not null references public.campaigns (id) on delete cascade,
  turn_id      uuid not null references public.turns (id) on delete cascade,
  seq          integer not null,
  type         text not null,
  payload      jsonb not null,
  game_time    integer not null
);
create index events_campaign_type_idx on public.events (campaign_id, type);

-- Geri alma ve denetim için ham Effect listesi
create table public.state_deltas (
  id           bigint generated always as identity primary key,
  campaign_id  uuid not null references public.campaigns (id) on delete cascade,
  turn_id      uuid not null references public.turns (id) on delete cascade,
  seq          integer not null,
  op           text not null,
  payload      jsonb not null
);
create index state_deltas_turn_idx on public.state_deltas (turn_id);

-- ---------------------------------------------------------------- hafıza
-- Kanon gerçekler: "AI unutur, Supabase unutmaz"
create table public.facts (
  id             uuid primary key default gen_random_uuid(),
  campaign_id    uuid not null references public.campaigns (id) on delete cascade,
  subject        text not null,
  predicate      text not null,
  value          text not null,
  locked         boolean not null default false,
  source         text not null default 'narrator' check (source in ('engine', 'narrator', 'summarizer', 'author')),
  source_turn    integer,
  confidence     real not null default 0.7 check (confidence between 0 and 1),
  superseded_by  uuid references public.facts (id),
  created_at     timestamptz not null default now()
);
-- Aynı konu+yüklem için yalnızca bir aktif gerçek
create unique index facts_active_unique on public.facts (campaign_id, subject, lower(predicate)) where superseded_by is null;
create index facts_subject_idx on public.facts (campaign_id, subject);

create table public.summaries (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references public.campaigns (id) on delete cascade,
  level        text not null check (level in ('scene', 'chapter', 'campaign')),
  from_turn    integer not null,
  to_turn      integer not null,
  text         text not null,
  open_threads text[] not null default '{}',
  created_at   timestamptz not null default now()
);
create index summaries_campaign_idx on public.summaries (campaign_id, level, to_turn desc);

-- Anlatı parçaları için semantik arama (Supabase gte-small: 384 boyut)
create table public.memory_chunks (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references public.campaigns (id) on delete cascade,
  turn_n       integer not null,
  subjects     text[] not null default '{}',
  content      text not null,
  embedding    extensions.vector(384),
  created_at   timestamptz not null default now()
);
create index memory_chunks_embedding_idx on public.memory_chunks
  using hnsw (embedding extensions.vector_cosine_ops);
create index memory_chunks_campaign_idx on public.memory_chunks (campaign_id, turn_n desc);
