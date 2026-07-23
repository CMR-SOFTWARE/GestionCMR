-- ═══════════════════════════════════════════════════════════════
-- DEPENDENCIAS ENTRE TAREAS — pegá TODO este archivo en SQL Editor
-- ═══════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- Crear tareas si no existe (sin depender de gen_random_uuid en el DEFAULT
-- por si la extensión aún no está activa en la misma pasada)
create table if not exists public.tareas (
  id uuid primary key,
  titulo text not null default 'Sin título',
  descripcion text,
  asignado_a text not null default 'Tomi',
  prioridad text not null default 'Media',
  estado text not null default 'Pendiente',
  fecha_inicio date,
  fecha_vencimiento date,
  colaborador_1 text,
  colaborador_2 text,
  created_at timestamptz not null default now()
);

-- Default de id (por si la tabla ya existía sin default)
alter table public.tareas alter column id set default gen_random_uuid();

alter table public.tareas add column if not exists titulo text;
alter table public.tareas add column if not exists descripcion text;
alter table public.tareas add column if not exists asignado_a text;
alter table public.tareas add column if not exists prioridad text;
alter table public.tareas add column if not exists estado text;
alter table public.tareas add column if not exists fecha_inicio date;
alter table public.tareas add column if not exists fecha_vencimiento date;
alter table public.tareas add column if not exists colaborador_1 text;
alter table public.tareas add column if not exists colaborador_2 text;
alter table public.tareas add column if not exists created_at timestamptz;

-- Verificar que tareas exista antes de seguir
do $$
begin
  if to_regclass('public.tareas') is null then
    raise exception 'No se pudo crear public.tareas. Revisá permisos del rol en Supabase.';
  end if;
end $$;

-- Dependencias
create table if not exists public.tarea_dependencias (
  id uuid primary key default gen_random_uuid(),
  tarea_id uuid not null,
  predecesora_id uuid not null,
  created_at timestamptz not null default now()
);

-- Constraints / FKs (idempotente)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tarea_dependencias_pkey'
      and conrelid = 'public.tarea_dependencias'::regclass
  ) then
    begin
      alter table public.tarea_dependencias add primary key (id);
    exception when others then null;
    end;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'tarea_dep_no_self') then
    alter table public.tarea_dependencias
      add constraint tarea_dep_no_self check (tarea_id <> predecesora_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'tarea_dep_unique') then
    alter table public.tarea_dependencias
      add constraint tarea_dep_unique unique (tarea_id, predecesora_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'tarea_dependencias_tarea_id_fkey') then
    alter table public.tarea_dependencias
      add constraint tarea_dependencias_tarea_id_fkey
      foreign key (tarea_id) references public.tareas(id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'tarea_dependencias_predecesora_id_fkey') then
    alter table public.tarea_dependencias
      add constraint tarea_dependencias_predecesora_id_fkey
      foreign key (predecesora_id) references public.tareas(id) on delete cascade;
  end if;
end $$;

create index if not exists tarea_dep_tarea_idx on public.tarea_dependencias (tarea_id);
create index if not exists tarea_dep_pred_idx on public.tarea_dependencias (predecesora_id);

alter table public.tareas enable row level security;
alter table public.tarea_dependencias enable row level security;

drop policy if exists "tareas_select" on public.tareas;
drop policy if exists "tareas_insert" on public.tareas;
drop policy if exists "tareas_update" on public.tareas;
drop policy if exists "tareas_delete" on public.tareas;
create policy "tareas_select" on public.tareas for select using (true);
create policy "tareas_insert" on public.tareas for insert with check (true);
create policy "tareas_update" on public.tareas for update using (true);
create policy "tareas_delete" on public.tareas for delete using (true);

drop policy if exists "tarea_dependencias_all" on public.tarea_dependencias;
create policy "tarea_dependencias_all" on public.tarea_dependencias
  for all using (true) with check (true);
