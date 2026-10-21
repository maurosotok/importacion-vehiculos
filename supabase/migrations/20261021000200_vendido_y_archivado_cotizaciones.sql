-- Vendido por evento de subasta, archivado lógico de cotizaciones y listado por fecha.
-- Archivar no borra compras, gastos, revisiones ni ofertas: solo marca deleted_at.

alter table public.quotes
  add column if not exists vendido_en_subasta boolean not null default false,
  add column if not exists deleted_at timestamptz;

create index if not exists quotes_activas_por_fecha
  on public.quotes (owner_id, fecha_subasta)
  where deleted_at is null;

create index if not exists quotes_activas_por_vehiculo
  on public.quotes (owner_id, vehicle_id)
  where deleted_at is null;

revoke delete on public.quotes from authenticated;

create or replace function public.archivar_cotizacion(p_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  update public.quotes
  set deleted_at = now()
  where id = p_id
    and owner_id = auth.uid()
    and deleted_at is null
  returning id into v_id;
  return v_id is not null;
end;
$$;

create or replace function public.restaurar_cotizacion(p_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  update public.quotes
  set deleted_at = null
  where id = p_id
    and owner_id = auth.uid()
    and deleted_at is not null
  returning id into v_id;
  return v_id is not null;
end;
$$;

revoke all on function public.archivar_cotizacion(uuid) from public;
revoke all on function public.restaurar_cotizacion(uuid) from public;
grant execute on function public.archivar_cotizacion(uuid) to authenticated;
grant execute on function public.restaurar_cotizacion(uuid) to authenticated;
