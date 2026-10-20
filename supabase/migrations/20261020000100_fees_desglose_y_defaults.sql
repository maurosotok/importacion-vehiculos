alter table public.fee_schedule_versions
  add column contenido jsonb,
  add constraint fee_schedule_versions_contenido_check
    check (contenido is null or jsonb_typeof(contenido) = 'object');

create unique index fee_schedule_version_unica
  on public.fee_schedule_versions (owner_id, fee_profile_clave, etiqueta_version);

alter table public.quotes drop constraint quotes_modo_fees_check;
alter table public.quotes add constraint quotes_modo_fees_check
  check (modo_fees in ('total_fees', 'carro_mas_fees', 'tabla'));

alter table public.quotes
  add column modalidad_puja text check (modalidad_puja is null or length(modalidad_puja) between 1 and 40),
  add column fees_version text,
  add column fees_desglose jsonb not null default '[]'::jsonb check (jsonb_typeof(fees_desglose) = 'array');

alter table public.user_settings
  add column gastos_locales_predeterminado_hnl numeric(18,4) not null default 13557
    check (gastos_locales_predeterminado_hnl >= 0),
  add column papeleria_predeterminada_usd numeric(18,4) not null default 15
    check (papeleria_predeterminada_usd >= 0),
  add column tipo_cambio_predeterminado_hnl_por_usd numeric(12,6)
    check (tipo_cambio_predeterminado_hnl_por_usd is null or tipo_cambio_predeterminado_hnl_por_usd > 0);
