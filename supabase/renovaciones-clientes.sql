-- Renovaciones automáticas de clientes
-- Ejecutar en Supabase → SQL Editor

alter table public.clientes
  add column if not exists periodicidad text not null default 'mensual';

update public.clientes set periodicidad = 'semestral' where periodicidad = 'trimestral';

alter table public.clientes drop constraint if exists clientes_periodicidad_check;

alter table public.clientes
  add constraint clientes_periodicidad_check
  check (periodicidad in ('mensual', 'semestral', 'anual'));

-- Primer pago: false hasta confirmar; clientes ya cargados quedan en true
alter table public.clientes
  add column if not exists pago_confirmado boolean not null default true;

alter table public.clientes add column if not exists fecha_confirmacion_pago timestamptz;

update public.clientes
set fecha_confirmacion_pago = coalesce(created_at, updated_at, now())
where pago_confirmado = true and fecha_confirmacion_pago is null;
