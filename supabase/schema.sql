-- =====================================================================
--  Budget familial — schéma Supabase
--  À coller dans Supabase > SQL Editor > New query, puis « Run ».
--  Le script peut être relancé sans risque (idempotent).
-- =====================================================================

-- ---------- Tables ----------------------------------------------------

-- Un foyer = un budget partagé.
create table if not exists public.households (
  id           uuid primary key default gen_random_uuid(),
  name         text not null default 'Notre foyer',
  invite_code  text not null unique default upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10)),
  created_by   uuid references auth.users(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now()
);

-- Qui appartient à quel foyer.
create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  display_name text not null default '',
  joined_at    timestamptz not null default now(),
  primary key (household_id, user_id)
);

-- Toutes les lignes du budget (réglages, livrets, revenus, charges,
-- provisions, enveloppes, dépenses, catégories). Une ligne = un élément, ce qui
-- permet à deux personnes de modifier le budget en même temps sans
-- s'écraser. Les suppressions sont « douces » (deleted = true) pour
-- que l'autre téléphone les reçoive aussi.
create table if not exists public.items (
  household_id uuid not null references public.households(id) on delete cascade,
  id           text not null,
  kind         text not null check (kind in
                 ('settings','livret','revenu','charge','provision','enveloppe','depense','categorie')),
  data         jsonb not null default '{}'::jsonb,
  deleted      boolean not null default false,
  updated_at   timestamptz not null default now(),
  updated_by   uuid default auth.uid(),
  primary key (household_id, id)
);
-- Mise à jour d'une base existante : autorise le type « categorie » (onglet Analyse).
-- Sans effet sur une base neuve ; à relancer sans risque.
alter table public.items drop constraint if exists items_kind_check;
alter table public.items add constraint items_kind_check check (kind in
  ('settings','livret','revenu','charge','provision','enveloppe','depense','categorie'));

create index if not exists items_household_updated_idx
  on public.items (household_id, updated_at);

-- Horodatage serveur à chaque écriture (sert de curseur de synchro).
create or replace function public.items_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  new.updated_by := auth.uid();
  return new;
end $$;

drop trigger if exists items_touch on public.items;
create trigger items_touch before insert or update on public.items
  for each row execute function public.items_touch();

-- ---------- Droits d'accès (Row Level Security) -----------------------

create or replace function public.is_member(h uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.household_members
    where household_id = h and user_id = auth.uid()
  );
$$;

alter table public.households        enable row level security;
alter table public.household_members enable row level security;
alter table public.items             enable row level security;

drop policy if exists households_select on public.households;
create policy households_select on public.households
  for select to authenticated using (public.is_member(id));

drop policy if exists households_update on public.households;
create policy households_update on public.households
  for update to authenticated using (public.is_member(id)) with check (public.is_member(id));

drop policy if exists members_select on public.household_members;
create policy members_select on public.household_members
  for select to authenticated using (public.is_member(household_id));

drop policy if exists members_update_self on public.household_members;
create policy members_update_self on public.household_members
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists members_leave on public.household_members;
create policy members_leave on public.household_members
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists items_select on public.items;
create policy items_select on public.items
  for select to authenticated using (public.is_member(household_id));

drop policy if exists items_insert on public.items;
create policy items_insert on public.items
  for insert to authenticated with check (public.is_member(household_id));

drop policy if exists items_update on public.items;
create policy items_update on public.items
  for update to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));
-- Pas de policy DELETE sur items : on ne supprime jamais physiquement depuis l'app.

-- ---------- Créer / rejoindre un foyer --------------------------------

create or replace function public.create_household(p_name text, p_display_name text)
returns public.households
language plpgsql security definer set search_path = public as $$
declare h public.households;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  insert into public.households (name, created_by)
    values (coalesce(nullif(trim(p_name), ''), 'Notre foyer'), auth.uid())
    returning * into h;
  insert into public.household_members (household_id, user_id, display_name)
    values (h.id, auth.uid(), coalesce(trim(p_display_name), ''));
  return h;
end $$;

create or replace function public.join_household(p_code text, p_display_name text)
returns public.households
language plpgsql security definer set search_path = public as $$
declare h public.households; n int;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  select * into h from public.households where invite_code = upper(trim(p_code));
  if not found then raise exception 'Code d''invitation inconnu'; end if;
  select count(*) into n from public.household_members where household_id = h.id;
  if n >= 6 then raise exception 'Ce foyer est complet'; end if;
  insert into public.household_members (household_id, user_id, display_name)
    values (h.id, auth.uid(), coalesce(trim(p_display_name), ''))
    on conflict (household_id, user_id) do update set display_name = excluded.display_name;
  return h;
end $$;

-- Nouveau code d'invitation (si l'ancien a circulé).
create or replace function public.rotate_invite_code(p_household uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if not public.is_member(p_household) then raise exception 'Accès refusé'; end if;
  c := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10));
  update public.households set invite_code = c where id = p_household;
  return c;
end $$;

revoke all on function public.create_household(text, text)  from public, anon;
revoke all on function public.join_household(text, text)    from public, anon;
revoke all on function public.rotate_invite_code(uuid)      from public, anon;
revoke all on function public.is_member(uuid)               from public, anon;
grant execute on function public.create_household(text, text) to authenticated;
grant execute on function public.join_household(text, text)   to authenticated;
grant execute on function public.rotate_invite_code(uuid)     to authenticated;
grant execute on function public.is_member(uuid)              to authenticated;

grant select, update on public.households to authenticated;
grant select, update, delete on public.household_members to authenticated;
grant select, insert, update on public.items to authenticated;

-- ---------- Temps réel ------------------------------------------------
-- Les changements de l'un apparaissent instantanément chez l'autre.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'items'
  ) then
    alter publication supabase_realtime add table public.items;
  end if;
end $$;
