-- Movimientos: tipo_pago + vínculo presupuesto | Clientes: mantenimiento_activo
-- Ejecutar en Supabase CMR (GESTION CRM) → SQL Editor

-- ─── 1. Schema movimientos ───────────────────────────────────────
alter table public.movimientos
  add column if not exists tipo_pago text not null default 'pago_total';

alter table public.movimientos
  add column if not exists documento_id uuid references public.documentos(id);

alter table public.movimientos drop constraint if exists movimientos_tipo_pago_check;
alter table public.movimientos add constraint movimientos_tipo_pago_check
  check (tipo_pago = any (array[
    'seña'::text,
    'pago_parcial'::text,
    'pago_total'::text,
    'mensual'::text,
    'otro'::text
  ]));

create index if not exists movimientos_tipo_pago_idx on public.movimientos (tipo_pago);
create index if not exists movimientos_documento_id_idx on public.movimientos (documento_id);

-- Gastos operativos / retiros → otro (por si quedaron en pago_total)
update public.movimientos
set tipo_pago = 'otro'
where tipo = 'gasto' and tipo_pago = 'pago_total';

-- Ingresos de renovación / alta de clientes → mensual
update public.movimientos
set tipo_pago = 'mensual'
where tipo = 'ingreso'
  and tipo_pago = 'pago_total'
  and (
    descripcion ilike 'Alta —%'
    or descripcion ilike 'Renovación —%'
  );

-- ─── 2. Schema clientes ──────────────────────────────────────────
alter table public.clientes
  add column if not exists mantenimiento_activo boolean not null default true;

-- ─── 3. Corrección: Sistema Profesor Tenis / Casella ─────────────
-- Seña de proyecto (USD 3.000 total), mantenimiento USD 100/mes aún no activo.

update public.clientes
set
  monto_plan = 150000,
  mantenimiento_activo = false,
  pago_confirmado = true,
  notas = trim(both E'\n' from coalesce(notas, '') || E'\nProyecto en desarrollo (Presupuesto N°0009). Seña cobrada a cuenta de USD 3.000. Mantenimiento USD 100/mes — arranca al entregar el 1er módulo.')
where nombre ilike '%Sistema Profesor Tenis%'
   or nombre ilike '%Casella%';

update public.movimientos
set
  categoria = 'Proyecto',
  tipo_pago = 'seña',
  descripcion = 'Seña — Plataforma Tenis (Casella) — a cuenta de USD 3.000 total'
where tipo = 'ingreso'
  and (
    descripcion ilike '%Sistema Profesor Tenis%'
    or descripcion ilike '%Profesor Tenis%'
  )
  and monto >= 999000;

-- Vincular al presupuesto N0009 si existe
update public.movimientos m
set documento_id = d.id
from public.documentos d
where m.tipo_pago = 'seña'
  and m.descripcion ilike '%Plataforma Tenis (Casella)%'
  and d.tipo = 'presupuesto'
  and (
    d.numero ilike '%0009%'
    or d.numero in ('N0009', 'P0009', '0009')
  );

-- ─── 4. Periodicidad «único» (pago no recurrente) ───────────────
alter table public.clientes drop constraint if exists clientes_periodicidad_check;
alter table public.clientes add constraint clientes_periodicidad_check
  check (periodicidad in ('mensual', 'semestral', 'anual', 'unico'));

update public.clientes
set periodicidad = 'unico'
where nombre ilike '%Sistema Profesor Tenis%'
   or nombre ilike '%Casella%';
