-- Ejecutá en Supabase → SQL Editor (si ya tenés movimientos, solo este archivo)

create table if not exists public.clientes (
  id bigint generated always as identity primary key,
  nombre text not null,
  plan text not null,
  monto_plan numeric(12, 2) not null default 0 check (monto_plan >= 0),
  fecha_vencimiento date not null,
  contacto text,
  notas text,
  periodicidad text not null default 'mensual' check (periodicidad in ('mensual', 'semestral', 'anual')),
  pago_confirmado boolean not null default false,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clientes_vencimiento_idx on public.clientes (fecha_vencimiento);
create index if not exists clientes_nombre_idx on public.clientes (nombre);

alter table public.clientes enable row level security;

drop policy if exists "clientes_select" on public.clientes;
drop policy if exists "clientes_insert" on public.clientes;
drop policy if exists "clientes_update" on public.clientes;
drop policy if exists "clientes_delete" on public.clientes;

create policy "clientes_select" on public.clientes for select using (true);
create policy "clientes_insert" on public.clientes for insert with check (true);
create policy "clientes_update" on public.clientes for update using (true);
create policy "clientes_delete" on public.clientes for delete using (true);
