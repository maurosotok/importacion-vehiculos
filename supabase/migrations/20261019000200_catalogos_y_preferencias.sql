create table public.fee_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  clave text not null,
  etiqueta text not null,
  subasta text not null check (subasta in ('IAA', 'COPART', 'OTRA')),
  segmento text,
  nivel_precio text,
  tipo_licencia text,
  es_predeterminado boolean not null default false,
  seleccionable boolean not null default true,
  permite_total_manual boolean not null default true,
  url_fuente text,
  estado_tabla text not null default 'no_incluida' check (estado_tabla in ('no_incluida', 'verificada')),
  parametros jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (owner_id, clave)
);

create table public.fee_schedule_versions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  fee_profile_clave text not null,
  etiqueta_version text not null,
  url_fuente text,
  vigente_desde date,
  capturado_en timestamptz not null default now(),
  es_activa boolean not null default false,
  estado_verificacion text not null default 'pendiente' check (estado_verificacion in ('pendiente', 'verificada')),
  notas text,
  unique (owner_id, id),
  foreign key (owner_id, fee_profile_clave) references public.fee_profiles (owner_id, clave) on delete cascade
);

create unique index fee_schedule_una_activa on public.fee_schedule_versions (owner_id, fee_profile_clave) where es_activa;

create table public.fee_rules (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  schedule_version_id uuid not null,
  orden integer not null check (orden >= 0),
  desde_usd numeric(18,4) not null check (desde_usd >= 0),
  hasta_usd numeric(18,4),
  tipo text not null check (tipo in ('porcentaje', 'monto_fijo', 'cargo_adicional')),
  valor numeric(18,6) not null check (valor >= 0),
  etiqueta_cargo text not null,
  condicion text,
  check (hasta_usd is null or hasta_usd > desde_usd),
  unique (schedule_version_id, orden),
  foreign key (owner_id, schedule_version_id) references public.fee_schedule_versions (owner_id, id) on delete cascade
);

create table public.towing_rates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  clave text not null,
  proveedor text not null,
  zona_salida text not null check (zona_salida in ('DELAWARE', 'FLORIDA', 'TEXAS', 'CALIFORNIA')),
  estado_origen text,
  etiqueta_origen text,
  etiqueta text not null,
  monto_usd numeric(18,4) check (monto_usd is null or monto_usd >= 0),
  precio_crudo numeric(18,4),
  nota_nieve text,
  estado text not null check (estado in ('manual_quote', 'usable_reference')),
  notas jsonb not null default '[]'::jsonb,
  permite_ajuste_manual boolean not null default true,
  fuente_archivo text,
  fuente_hoja text,
  fuente_fila integer,
  created_at timestamptz not null default now(),
  unique (owner_id, clave)
);

create index towing_rates_busqueda on public.towing_rates (owner_id, zona_salida);

create table public.shipping_rates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  clave text not null,
  proveedor text not null,
  servicio text not null,
  zona_salida text not null check (zona_salida in ('DELAWARE', 'FLORIDA', 'TEXAS', 'CALIFORNIA')),
  pais_destino text not null,
  puerto_destino text,
  categoria text not null,
  categoria_origen_texto text not null,
  largo_max_pulgadas numeric(6,2),
  monto numeric(18,4) not null check (monto >= 0),
  moneda text not null check (moneda in ('USD', 'HNL')),
  documento_fuente text not null,
  pagina integer,
  vigente_desde date,
  vigente_hasta date,
  estado_activacion text not null,
  condiciones_fuente text,
  version_documento text,
  permite_ajuste_manual boolean not null default true,
  created_at timestamptz not null default now(),
  unique (owner_id, clave)
);

create table public.vehicle_type_mappings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  clave text not null,
  tipo_codigo text not null check (tipo_codigo in ('sedan', 'suv', 'pickup', 'minivan', 'motorcycle', 'other')),
  zona_salida text not null check (zona_salida in ('DELAWARE', 'FLORIDA', 'TEXAS', 'CALIFORNIA')),
  categoria_origen text,
  base_asociacion text not null,
  created_at timestamptz not null default now(),
  unique (owner_id, clave)
);

create table public.logistics_providers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  clave text not null,
  nombre text not null,
  papeleria_predeterminada_usd numeric(18,4) check (papeleria_predeterminada_usd is null or papeleria_predeterminada_usd >= 0),
  papeleria_referencias jsonb not null default '[]'::jsonb,
  notas text,
  created_at timestamptz not null default now(),
  unique (owner_id, clave),
  unique (owner_id, id)
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  clave text not null,
  nombre text not null,
  nombre_original text not null,
  telefono_proporcionado text,
  telefono_verificado boolean not null default false,
  clasificacion text check (clasificacion is null or clasificacion in ('china', 'yonker', 'otro')),
  pais text,
  created_at timestamptz not null default now(),
  unique (owner_id, clave),
  unique (owner_id, id)
);

create table public.user_settings (
  owner_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  perfil_fees_clave text,
  proveedor_clave text,
  pago_unico_hnl numeric(18,4) check (pago_unico_hnl is null or pago_unico_hnl >= 0),
  gastos_locales_referencia_min_hnl numeric(18,4),
  gastos_locales_referencia_max_hnl numeric(18,4),
  updated_at timestamptz not null default now(),
  foreign key (owner_id, perfil_fees_clave) references public.fee_profiles (owner_id, clave),
  foreign key (owner_id, proveedor_clave) references public.logistics_providers (owner_id, clave),
  check (gastos_locales_referencia_max_hnl is null or gastos_locales_referencia_min_hnl is null
    or gastos_locales_referencia_max_hnl >= gastos_locales_referencia_min_hnl)
);

select public.aplicar_politica_propietario('public.fee_profiles');
select public.aplicar_politica_propietario('public.fee_schedule_versions');
select public.aplicar_politica_propietario('public.fee_rules');
select public.aplicar_politica_propietario('public.towing_rates');
select public.aplicar_politica_propietario('public.shipping_rates');
select public.aplicar_politica_propietario('public.vehicle_type_mappings');
select public.aplicar_politica_propietario('public.logistics_providers');
select public.aplicar_politica_propietario('public.suppliers');
select public.aplicar_politica_propietario('public.user_settings');
