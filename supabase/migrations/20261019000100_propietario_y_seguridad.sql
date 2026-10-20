create table public.app_owner (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index app_owner_unico on public.app_owner ((true));

alter table public.app_owner enable row level security;
revoke all on public.app_owner from public, anon;
grant select on public.app_owner to authenticated;

create policy app_owner_leer_propia on public.app_owner
  for select to authenticated
  using (user_id = auth.uid());

create or replace function public.es_propietario()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.app_owner o where o.user_id = auth.uid()
  );
$$;

revoke all on function public.es_propietario() from public;
grant execute on function public.es_propietario() to authenticated;

create or replace function public.tocar_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.row_version := old.row_version + 1;
  return new;
end;
$$;

create or replace function public.aplicar_politica_propietario(tabla regclass)
returns void
language plpgsql
set search_path = ''
as $$
begin
  execute format('alter table %s enable row level security', tabla);
  execute format('revoke all on %s from anon, public', tabla);
  execute format('grant select, insert, update, delete on %s to authenticated', tabla);
  execute format(
    'create policy propietario_todo on %s for all to authenticated '
    'using (owner_id = auth.uid() and public.es_propietario()) '
    'with check (owner_id = auth.uid() and public.es_propietario())',
    tabla
  );
end;
$$;

create or replace function public.bloquear_cambios()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Registro inmutable: %', tg_table_name using errcode = 'P0001';
end;
$$;

revoke all on function public.aplicar_politica_propietario(regclass) from public, anon, authenticated;
revoke all on function public.tocar_version() from public, anon, authenticated;
revoke all on function public.bloquear_cambios() from public, anon, authenticated;
