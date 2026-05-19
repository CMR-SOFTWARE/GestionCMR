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
