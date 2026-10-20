create table public.part_quote_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  vehicle_id uuid,
  marca text,
  modelo text,
  anio integer check (anio is null or anio between 1900 and 2100),
  pieza text not null,
  notas text,
  created_at timestamptz not null default now(),
  unique (owner_id, id),
  foreign key (owner_id, vehicle_id) references public.vehicles (owner_id, id)
);

create table public.part_supplier_offers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id uuid not null,
  supplier_id uuid not null,
  estado text not null check (estado in ('cotizado', 'no_disponible', 'sin_consultar')),
  precio numeric(18,4) check (precio is null or precio >= 0),
  moneda text not null default 'USD' check (moneda in ('USD', 'HNL')),
  disponibilidad text,
  fecha_oferta date,
  notas text,
  created_at timestamptz not null default now(),
  unique (owner_id, id),
  unique (item_id, supplier_id),
  check (estado <> 'no_disponible' or precio is null),
  foreign key (owner_id, item_id) references public.part_quote_items (owner_id, id) on delete cascade,
  foreign key (owner_id, supplier_id) references public.suppliers (owner_id, id)
);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  quote_id uuid not null,
  revision_id uuid not null,
  estado text not null default 'comprado' check (estado in ('comprado', 'recibido', 'vendido', 'cancelado')),
  fecha_compra date,
  fecha_recepcion date,
  precio_venta_hnl numeric(18,4) check (precio_venta_hnl is null or precio_venta_hnl >= 0),
  fecha_venta date,
  notas text,
  row_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, id),
  unique (revision_id),
  foreign key (owner_id, quote_id) references public.quotes (owner_id, id),
  foreign key (owner_id, revision_id) references public.quote_revisions (owner_id, id)
);

create trigger purchases_version before update on public.purchases
  for each row execute function public.tocar_version();

create table public.purchase_expenses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  purchase_id uuid not null,
  concepto text not null check (concepto in (
    'grua', 'barco', 'papeleria', 'carro', 'buyer_fee', 'bac_fees', 'paypal_fee',
    'bank_receiver_fee', 'impuestos_salida', 'repuesto', 'servicio', 'gasolina_aceite',
    'mano_obra', 'otro'
  )),
  descripcion text,
  monto numeric(18,4) not null check (monto >= 0),
  moneda text not null check (moneda in ('USD', 'HNL')),
  tipo_cambio_hnl_por_usd numeric(12,6) check (tipo_cambio_hnl_por_usd is null or tipo_cambio_hnl_por_usd >= 0),
  fecha_compra date,
  fecha_pago date,
  estimado boolean not null default false,
  oferta_repuesto_id uuid,
  monto_total_referencia numeric(18,4) check (monto_total_referencia is null or monto_total_referencia >= 0),
  motivo_reparto text,
  created_at timestamptz not null default now(),
  unique (owner_id, id),
  foreign key (owner_id, purchase_id) references public.purchases (owner_id, id) on delete cascade,
  foreign key (owner_id, oferta_repuesto_id) references public.part_supplier_offers (owner_id, id)
);

create unique index gasto_unico_por_oferta on public.purchase_expenses (oferta_repuesto_id)
  where oferta_repuesto_id is not null;

create table public.market_observations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  marca text not null,
  modelo text not null,
  version text,
  anio integer check (anio is null or anio between 1900 and 2100),
  precio_usd numeric(18,4) check (precio_usd is null or precio_usd >= 0),
  motor text,
  traccion text,
  millas integer check (millas is null or millas >= 0),
  fecha_consulta date,
  enlace text,
  recien_ingreso boolean not null default false,
  ubicacion text,
  alias_modelo text,
  created_at timestamptz not null default now(),
  unique (owner_id, id)
);

create table public.sale_price_targets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  marca text not null,
  modelo text not null,
  anio integer check (anio is null or anio between 1900 and 2100),
  precio_objetivo numeric(18,4) not null check (precio_objetivo >= 0),
  moneda text not null default 'HNL' check (moneda in ('USD', 'HNL')),
  fecha date,
  origen text not null default 'manual' check (origen in ('manual', 'sugerido_media')),
  created_at timestamptz not null default now(),
  unique (owner_id, id)
);

select public.aplicar_politica_propietario('public.part_quote_items');
select public.aplicar_politica_propietario('public.part_supplier_offers');
select public.aplicar_politica_propietario('public.purchases');
select public.aplicar_politica_propietario('public.purchase_expenses');
select public.aplicar_politica_propietario('public.market_observations');
select public.aplicar_politica_propietario('public.sale_price_targets');
