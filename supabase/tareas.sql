-- Lista de tareas — ejecutar en Supabase SQL Editor
-- Si falló antes con "column asignado_a does not exist", este script repara la tabla.

create extension if not exists "pgcrypto";

-- Tabla nueva (completa)
create table if not exists public.tareas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descripcion text,
  asignado_a text not null check (asignado_a in ('Tomi', 'Chipi', 'Gena')),
  prioridad text not null default 'Media' check (prioridad in ('Alta', 'Media', 'Baja')),
  estado text not null default 'Pendiente' check (estado in ('Pendiente', 'En progreso', 'Completada')),
  fecha_vencimiento date,
  created_at timestamptz not null default now()
);

-- Reparar tabla creada incompleta (solo agrega lo que falta)
alter table public.tareas add column if not exists id uuid default gen_random_uuid();
alter table public.tareas add column if not exists titulo text;
alter table public.tareas add column if not exists descripcion text;
alter table public.tareas add column if not exists asignado_a text;
alter table public.tareas add column if not exists prioridad text default 'Media';
alter table public.tareas add column if not exists estado text default 'Pendiente';
alter table public.tareas add column if not exists fecha_vencimiento date;
alter table public.tareas add column if not exists created_at timestamptz default now();

update public.tareas set id = gen_random_uuid() where id is null;
update public.tareas set titulo = 'Sin título' where titulo is null;
update public.tareas set asignado_a = 'Tomi' where asignado_a is null;
update public.tareas set prioridad = 'Media' where prioridad is null;
update public.tareas set estado = 'Pendiente' where estado is null;
update public.tareas set created_at = now() where created_at is null;

-- Primary key si la tabla no la tenía
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.tareas'::regclass and contype = 'p'
  ) then
    alter table public.tareas add primary key (id);
  end if;
end $$;

create index if not exists tareas_estado_idx on public.tareas (estado);
create index if not exists tareas_asignado_idx on public.tareas (asignado_a);

alter table public.tareas enable row level security;

drop policy if exists "tareas_select" on public.tareas;
drop policy if exists "tareas_insert" on public.tareas;
drop policy if exists "tareas_update" on public.tareas;
drop policy if exists "tareas_delete" on public.tareas;

create policy "tareas_select" on public.tareas for select using (true);
create policy "tareas_insert" on public.tareas for insert with check (true);
create policy "tareas_update" on public.tareas for update using (true);
create policy "tareas_delete" on public.tareas for delete using (true);
