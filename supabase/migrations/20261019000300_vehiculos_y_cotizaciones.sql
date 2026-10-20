create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  vin text check (vin is null or (vin <> '' and vin = upper(btrim(vin)) and length(vin) <= 17)),
  marca text,
  modelo text,
  version text,
  anio integer check (anio is null or anio between 1900 and 2100),
  row_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, id)
);

create index vehicles_por_vin on public.vehicles (owner_id, vin);

create trigger vehicles_version before update on public.vehicles
  for each row execute function public.tocar_version();

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  vehicle_id uuid not null,
  estado text not null default 'borrador' check (estado in ('borrador', 'comprada', 'no_ganada')),
  referencia text,
  fecha_negocio date not null default (now() at time zone 'America/Tegucigalpa')::date,
  subasta text check (subasta is null or subasta in ('IAA', 'COPART', 'OTRA')),
  ubicacion text,
  zona_salida text check (zona_salida is null or zona_salida in ('DELAWARE', 'FLORIDA', 'TEXAS', 'CALIFORNIA')),
  tipo_vehiculo text check (tipo_vehiculo is null or tipo_vehiculo in ('sedan', 'suv', 'pickup', 'minivan', 'motorcycle', 'other')),
  perfil_fees_clave text,
  modo_fees text not null default 'total_fees' check (modo_fees in ('total_fees', 'carro_mas_fees')),
  puja_usd numeric(18,4) check (puja_usd is null or puja_usd >= 0),
  fees_usd numeric(18,4) check (fees_usd is null or fees_usd >= 0),
  carro_mas_fees_usd numeric(18,4) check (carro_mas_fees_usd is null or carro_mas_fees_usd >= 0),
  grua_usd numeric(18,4) check (grua_usd is null or grua_usd >= 0),
  grua_fuente text check (grua_fuente is null or grua_fuente in ('manual', 'referencia')),
  grua_referencia_clave text,
  barco_usd numeric(18,4) check (barco_usd is null or barco_usd >= 0),
  barco_fuente text check (barco_fuente is null or barco_fuente in ('manual', 'referencia')),
  barco_referencia_clave text,
  papeleria_usd numeric(18,4) check (papeleria_usd is null or papeleria_usd >= 0),
  tipo_cambio_hnl_por_usd numeric(12,6) check (tipo_cambio_hnl_por_usd is null or tipo_cambio_hnl_por_usd >= 0),
  modo_impuestos text not null default 'pendiente' check (modo_impuestos in ('pendiente', 'combinado', 'desglose')),
  total_combinado_hnl numeric(18,4) check (total_combinado_hnl is null or total_combinado_hnl >= 0),
  total_combinado_referencia_hnl numeric(18,4) check (total_combinado_referencia_hnl is null or total_combinado_referencia_hnl >= 0),
  impuesto_hnl numeric(18,4) check (impuesto_hnl is null or impuesto_hnl >= 0),
  gastos_locales_hnl numeric(18,4) check (gastos_locales_hnl is null or gastos_locales_hnl >= 0),
  reparacion_hnl numeric(18,4) check (reparacion_hnl is null or reparacion_hnl >= 0),
  precio_venta_hnl numeric(18,4) check (precio_venta_hnl is null or precio_venta_hnl >= 0),
  fecha_subasta date,
  vendedor text,
  motivo_no_ganada text,
  notas text,
  max_bid_manual_usd numeric(18,4) check (max_bid_manual_usd is null or max_bid_manual_usd >= 0),
  verificacion_bidcars text,
  row_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, id),
  foreign key (owner_id, vehicle_id) references public.vehicles (owner_id, id),
  foreign key (owner_id, perfil_fees_clave) references public.fee_profiles (owner_id, clave),
  foreign key (owner_id, grua_referencia_clave) references public.towing_rates (owner_id, clave),
  foreign key (owner_id, barco_referencia_clave) references public.shipping_rates (owner_id, clave)
);

create index quotes_recientes on public.quotes (owner_id, updated_at desc);
create index quotes_por_vehiculo on public.quotes (owner_id, vehicle_id);

create trigger quotes_version before update on public.quotes
  for each row execute function public.tocar_version();

create table public.quote_revisions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  quote_id uuid not null,
  numero integer not null check (numero >= 1),
  motor_version text not null,
  snapshot jsonb not null,
  tipo_cambio_hnl_por_usd numeric(12,6),
  total_importado_hnl numeric(18,4),
  total_importado_usd_equivalente numeric(18,4),
  utilidad_estimada_hnl numeric(18,4),
  confirmado_en timestamptz not null default now(),
  unique (quote_id, numero),
  unique (owner_id, id),
  foreign key (owner_id, quote_id) references public.quotes (owner_id, id)
);

create trigger quote_revisions_inmutables before update or delete on public.quote_revisions
  for each row execute function public.bloquear_cambios();

create table public.logistics_offers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  quote_id uuid not null,
  provider_id uuid not null,
  grua_usd numeric(18,4) check (grua_usd is null or grua_usd >= 0),
  barco_usd numeric(18,4) check (barco_usd is null or barco_usd >= 0),
  papeleria_usd numeric(18,4) check (papeleria_usd is null or papeleria_usd >= 0),
  moneda text not null default 'USD' check (moneda in ('USD', 'HNL')),
  fecha_oferta date,
  notas text,
  created_at timestamptz not null default now(),
  unique (owner_id, id),
  foreign key (owner_id, quote_id) references public.quotes (owner_id, id) on delete cascade,
  foreign key (owner_id, provider_id) references public.logistics_providers (owner_id, id)
);

select public.aplicar_politica_propietario('public.vehicles');
select public.aplicar_politica_propietario('public.quotes');
select public.aplicar_politica_propietario('public.logistics_offers');

alter table public.quote_revisions enable row level security;
revoke all on public.quote_revisions from anon, public;
grant select on public.quote_revisions to authenticated;

create policy revisiones_leer_propias on public.quote_revisions
  for select to authenticated
  using (owner_id = auth.uid() and public.es_propietario());
