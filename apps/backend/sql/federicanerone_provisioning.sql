-- Provisioning SOLO tenant federicanerone
create schema if not exists federicanerone;

-- CLIENTI
create table if not exists federicanerone.clienti (
  id bigserial primary key,
  full_name text not null,
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists federicanerone_clienti_email_idx on federicanerone.clienti (email);
create index if not exists federicanerone_clienti_phone_idx on federicanerone.clienti (phone);

-- TRATTAMENTI
create table if not exists federicanerone.trattamenti (
  id bigserial primary key,
  name text not null,
  duration_minutes int not null default 60,
  price_cents int not null default 0,
  category text,
  badge_color text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists federicanerone_trattamenti_active_idx on federicanerone.trattamenti (is_active);

-- APPUNTAMENTI
create table if not exists federicanerone.appuntamenti (
  id bigserial primary key,
  client_id bigint not null references federicanerone.clienti(id) on delete restrict,
  treatment_id bigint not null references federicanerone.trattamenti(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz,
  final_price_cents int,
  notes text,
  status text not null default 'booked',
  google_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists federicanerone_appuntamenti_starts_at_idx on federicanerone.appuntamenti (starts_at);
create index if not exists federicanerone_appuntamenti_client_idx on federicanerone.appuntamenti (client_id);
create index if not exists federicanerone_appuntamenti_treatment_idx on federicanerone.appuntamenti (treatment_id);
create index if not exists federicanerone_appuntamenti_google_event_idx on federicanerone.appuntamenti (google_event_id);
