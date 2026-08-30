-- Resumen diario (IA) — caché por fecha
-- Ejecutá en Supabase → SQL Editor (proyecto GESTION CRM)

create table if not exists public.resumenes_diarios (
  id bigint generated always as identity primary key,
  fecha date not null unique default current_date,
  contenido text not null,
  created_at timestamptz not null default now()
);

create index if not exists resumenes_diarios_fecha_idx on public.resumenes_diarios (fecha desc);

alter table public.resumenes_diarios enable row level security;

drop policy if exists "resumenes_diarios_select" on public.resumenes_diarios;
drop policy if exists "resumenes_diarios_insert" on public.resumenes_diarios;
drop policy if exists "resumenes_diarios_update" on public.resumenes_diarios;

create policy "resumenes_diarios_select" on public.resumenes_diarios for select using (true);
create policy "resumenes_diarios_insert" on public.resumenes_diarios for insert with check (true);
create policy "resumenes_diarios_update" on public.resumenes_diarios for update using (true);
