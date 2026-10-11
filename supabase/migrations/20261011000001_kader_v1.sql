-- Kader Zarı v1.0 şeması
-- İlke: oyunun TEK doğruluk kaynağı bu veritabanıdır. LLM hiçbir tabloya
-- doğrudan yazmaz; tüm yazmalar Edge Function'lardan (service role) ve
-- create_campaign() / apply_turn() transaction'larıyla yapılır.

create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------- kampanyalar
create table public.campaigns (
  id                   uuid primary key,
  owner_id             uuid not null references auth.users (id) on delete cascade,
  title                text not null check (char_length(title) between 1 and 120),
  template_key         text not null,
  seed                 text not null,
  turn_count           integer not null default 0 check (turn_count >= 0),
  game_time            integer not null default 0,
  player_character_id  uuid not null,
  -- Motor kural seçenekleri (RuleOptions)
  rules                jsonb not null,
  -- Dünya öncülü (WorldBible): anlatıcının sabit bağlamı
  bible                jsonb not null,
  -- Mekânlar, çıkışlar, dükkânlar (görevler ayrı tabloda)
  world                jsonb not null,
  -- Aktif savaş (Encounter) ya da null
  encounter            jsonb,
  chapter_summary      text not null default '',
  campaign_summary     text not null default '',
  status               text not null default 'active' check (status in ('active', 'ended')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index campaigns_owner_idx on public.campaigns (owner_id, updated_at desc);

-- ---------------------------------------------------------------- yaratıklar
create table public.creatures (
  id                    uuid primary key,
  campaign_id           uuid not null references public.campaigns (id) on delete cascade,
  kind                  text not null check (kind in ('pc', 'npc', 'monster')),
  name                  text not null,
  template_key          text,
  race_key              text,
  class_key             text,
  level                 integer not null default 1 check (level between 0 and 30),
  cr                    numeric,
  size                  text not null default 'medium',
  abilities             jsonb not null,
  save_proficiencies    text[] not null default '{}',
  skill_proficiencies   text[] not null default '{}',
  expertise             text[] not null default '{}',
  weapon_proficiencies  text[],
  armor_proficiencies   text[],
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
  resources             jsonb,
  buffs                 jsonb,
  attacks               text[],
  xp                    integer not null default 0,
  is_alive              boolean not null default true,
  looted                boolean not null default false,
  stealth_disadvantage  boolean not null default false,
  darkvision            integer,
  languages             text[],
  background            text,
  location_id           text,
  faction_id            uuid,
  updated_at            timestamptz not null default now()
);
create index creatures_campaign_idx on public.creatures (campaign_id);
create index creatures_location_idx on public.creatures (campaign_id, location_id);

-- NPC kişiliği: anlatıcıya giden "yumuşak" bilgi (sırlar istemciye kapalı)
create table public.personas (
  creature_id   uuid primary key references public.creatures (id) on delete cascade,
  campaign_id   uuid not null references public.campaigns (id) on delete cascade,
  personality   text not null default '',
  goals         text not null default '',
  speech_style  text not null default '',
  secrets       text not null default ''
);
create index personas_campaign_idx on public.personas (campaign_id);

-- ---------------------------------------------------------------- ekonomi
create table public.inventory (
  campaign_id  uuid not null references public.campaigns (id) on delete cascade,
  owner_id     uuid not null,
  item_key     text not null,
  qty          integer not null check (qty > 0),
  equipped     boolean not null default false,
  attuned      boolean not null default false,
  primary key (campaign_id, owner_id, item_key)
);

create table public.wallets (
  campaign_id  uuid not null references public.campaigns (id) on delete cascade,
  owner_id     uuid not null,
  cp           bigint not null default 0 check (cp >= 0),
  primary key (campaign_id, owner_id)
);

create table public.relationships (
  campaign_id  uuid not null references public.campaigns (id) on delete cascade,
  a            uuid not null,
  b            uuid not null,
  score        integer not null default 0 check (score between -100 and 100),
  primary key (campaign_id, a, b),
  check (a < b)
);

-- ---------------------------------------------------------------- strateji katmanı
create table public.factions (
  id            uuid primary key,
  campaign_id   uuid not null references public.campaigns (id) on delete cascade,
  name          text not null,
  treasury      bigint not null default 0,
  military      integer not null default 0 check (military >= 0),
  stability     integer not null default 50 check (stability between 0 and 100),
  population    bigint not null default 0 check (population >= 0),
  tech          numeric not null default 0 check (tech between 0 and 10),
  intelligence  integer not null default 0 check (intelligence between 0 and 100),
  traits        jsonb not null default '{}'::jsonb,
  region_ids    text[] not null default '{}',
  at_war_with   uuid[] not null default '{}',
  alliances     uuid[] not null default '{}'
);
create index factions_campaign_idx on public.factions (campaign_id);

-- ---------------------------------------------------------------- görevler
create table public.quests (
  campaign_id  uuid not null references public.campaigns (id) on delete cascade,
  id           text not null,
  status       text not null check (status in ('available', 'open', 'completed', 'failed')),
  data         jsonb not null,
  updated_at   timestamptz not null default now(),
  primary key (campaign_id, id)
);

-- ---------------------------------------------------------------- tur günlüğü (değişmez)
create table public.turns (
  campaign_id       uuid not null references public.campaigns (id) on delete cascade,
  n                 integer not null check (n >= 0),
  player_input      text not null default '',
  action            jsonb,
  outcome           jsonb,
  -- Arayüzün gösterdiği günlük kaydı (JournalEntry)
  entry             jsonb not null,
  narration_source  text not null check (narration_source in ('model', 'model_retry', 'template')),
  rng_nonce         text not null default '',
  usage             jsonb not null default '[]'::jsonb,
  created_at        timestamptz not null default now(),
  primary key (campaign_id, n)
);

create table public.rolls (
  id            bigint generated always as identity primary key,
  campaign_id   uuid not null references public.campaigns (id) on delete cascade,
  turn_n        integer not null,
  seq           integer not null,
  reason        text not null,
  notation      text not null,
  dice          integer[] not null,
  total         integer not null,
  natural_roll  integer,
  mode          text,
  actor_id      text,
  target_id     text,
  dc            integer,
  tier          text,
  breakdown     text not null
);
create index rolls_turn_idx on public.rolls (campaign_id, turn_n);

create table public.events (
  id           bigint generated always as identity primary key,
  campaign_id  uuid not null references public.campaigns (id) on delete cascade,
  turn_n       integer not null,
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
  turn_n       integer not null,
  seq          integer not null,
  op           text not null,
  payload      jsonb not null
);
create index state_deltas_turn_idx on public.state_deltas (campaign_id, turn_n);

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
  created_at     timestamptz not null default now()
);
create unique index facts_unique on public.facts (campaign_id, subject, lower(predicate));

create table public.hooks (
  id           bigint generated always as identity primary key,
  campaign_id  uuid not null references public.campaigns (id) on delete cascade,
  turn_n       integer not null,
  type         text not null,
  text         text not null,
  created_at   timestamptz not null default now()
);
create index hooks_campaign_idx on public.hooks (campaign_id);

create table public.summaries (
  id           bigint generated always as identity primary key,
  campaign_id  uuid not null references public.campaigns (id) on delete cascade,
  to_turn      integer not null,
  text         text not null,
  created_at   timestamptz not null default now()
);
create index summaries_campaign_idx on public.summaries (campaign_id);

-- Anlatı parçaları için semantik arama (Supabase gte-small: 384 boyut)
create table public.memory_chunks (
  id           bigint generated always as identity primary key,
  campaign_id  uuid not null references public.campaigns (id) on delete cascade,
  turn_n       integer not null,
  content      text not null,
  embedding    extensions.vector(384),
  created_at   timestamptz not null default now()
);
create index memory_chunks_embedding_idx on public.memory_chunks using hnsw (embedding extensions.vector_cosine_ops);
create index memory_chunks_campaign_idx on public.memory_chunks (campaign_id, turn_n desc);
