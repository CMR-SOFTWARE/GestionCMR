-- Proyectos + estados configurables — ejecutar en Supabase SQL Editor
-- Repara FKs rotas y estado_id huérfanos de intentos anteriores.

create extension if not exists "pgcrypto";

-- 1) Quitar FKs viejas en tareas
do $$
declare r record;
begin
  if to_regclass('public.tareas') is not null then
    for r in (
      select conname from pg_constraint
      where conrelid = 'public.tareas'::regclass
        and contype = 'f'
        and (
          pg_get_constraintdef(oid) ilike '%proyecto%'
          or pg_get_constraintdef(oid) ilike '%estado_id%'
        )
    ) loop
      execute format('alter table public.tareas drop constraint %I', r.conname);
    end loop;
  end if;
end $$;

-- 2) Recrear proyecto_estados; recrear proyectos solo si el id no es uuid
drop table if exists public.proyecto_estados cascade;

do $$
declare id_type text;
begin
  if to_regclass('public.proyectos') is not null then
    select format_type(a.atttypid, a.atttypmod) into id_type
    from pg_attribute a
    where a.attrelid = 'public.proyectos'::regclass
      and a.attname = 'id' and not a.attisdropped;
    if id_type is distinct from 'uuid' then
      drop table public.proyectos cascade;
    end if;
  end if;
end $$;

create table if not exists public.proyectos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  color text not null default '#0a9d8f',
  icono text not null default 'folder',
  descripcion text,
  created_at timestamptz not null default now()
);

create table if not exists public.proyecto_estados (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.proyectos(id) on delete cascade,
  nombre text not null,
  color text not null default '#8896ab',
  orden int not null default 0,
  es_final boolean not null default false,
  unique (proyecto_id, nombre)
);

create index if not exists proyecto_estados_proyecto_idx
  on public.proyecto_estados (proyecto_id, orden);

-- 3) Columnas en tareas (tipo uuid)
do $$
declare t text;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='tareas' and column_name='proyecto_id'
  ) then
    select data_type into t from information_schema.columns
    where table_schema='public' and table_name='tareas' and column_name='proyecto_id';
    if t is distinct from 'uuid' then
      alter table public.tareas drop column proyecto_id;
    end if;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='tareas' and column_name='estado_id'
  ) then
    select data_type into t from information_schema.columns
    where table_schema='public' and table_name='tareas' and column_name='estado_id';
    if t is distinct from 'uuid' then
      alter table public.tareas drop column estado_id;
    end if;
  end if;
end $$;

alter table public.tareas add column if not exists proyecto_id uuid;
alter table public.tareas add column if not exists estado_id uuid;
alter table public.tareas add column if not exists estado_final boolean not null default false;
alter table public.tareas add column if not exists fecha_inicio date;

-- IMPORTANTE: limpiar IDs huérfanos ANTES de crear las FKs
-- (quedaron de cuando se recreó proyecto_estados con UUIDs nuevos)
update public.tareas set estado_id = null;
update public.tareas t
set proyecto_id = null
where t.proyecto_id is not null
  and not exists (select 1 from public.proyectos p where p.id = t.proyecto_id);

-- Quitar check fijo de 3 estados (si existe)
do $$
declare r record;
begin
  for r in (
    select conname from pg_constraint
    where conrelid = 'public.tareas'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%estado%'
      and pg_get_constraintdef(oid) not ilike '%estado_id%'
      and pg_get_constraintdef(oid) not ilike '%estado_final%'
  ) loop
    execute format('alter table public.tareas drop constraint %I', r.conname);
  end loop;
end $$;

-- 4) Proyecto General + estados + reasignar tareas
do $$
declare
  pid uuid;
  e_pend uuid;
  e_prog uuid;
  e_done uuid;
begin
  select id into pid from public.proyectos where nombre = 'General' limit 1;
  if pid is null then
    insert into public.proyectos (nombre, color, icono, descripcion)
    values ('General', '#0a9d8f', 'folder', 'Proyecto por defecto')
    returning id into pid;
  end if;

  select id into e_pend from public.proyecto_estados where proyecto_id = pid and nombre = 'Pendiente' limit 1;
  if e_pend is null then
    insert into public.proyecto_estados (proyecto_id, nombre, color, orden, es_final)
    values (pid, 'Pendiente', '#8896ab', 0, false) returning id into e_pend;
  end if;

  select id into e_prog from public.proyecto_estados where proyecto_id = pid and nombre = 'En progreso' limit 1;
  if e_prog is null then
    insert into public.proyecto_estados (proyecto_id, nombre, color, orden, es_final)
    values (pid, 'En progreso', '#1a6fc4', 1, false) returning id into e_prog;
  end if;

  select id into e_done from public.proyecto_estados where proyecto_id = pid and nombre = 'Completada' limit 1;
  if e_done is null then
    insert into public.proyecto_estados (proyecto_id, nombre, color, orden, es_final)
    values (pid, 'Completada', '#0a9d6e', 2, true) returning id into e_done;
  end if;

  update public.tareas set proyecto_id = pid where proyecto_id is null;

  -- Reasignar TODOS los estado_id según el nombre de estado
  update public.tareas t set
    estado_id = case
      when t.estado = 'En progreso' then e_prog
      when t.estado = 'Completada' then e_done
      else e_pend
    end,
    estado_final = (t.estado = 'Completada')
  where t.proyecto_id = pid;
end $$;

-- 5) Crear FKs recién ahora (datos ya coherentes)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tareas_proyecto_id_fkey'
  ) then
    alter table public.tareas
      add constraint tareas_proyecto_id_fkey
      foreign key (proyecto_id) references public.proyectos(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'tareas_estado_id_fkey'
  ) then
    alter table public.tareas
      add constraint tareas_estado_id_fkey
      foreign key (estado_id) references public.proyecto_estados(id) on delete set null;
  end if;
end $$;

create index if not exists tareas_proyecto_idx on public.tareas (proyecto_id);
create index if not exists tareas_estado_id_idx on public.tareas (estado_id);

alter table public.proyectos enable row level security;
alter table public.proyecto_estados enable row level security;

drop policy if exists "proyectos_all" on public.proyectos;
drop policy if exists "proyecto_estados_all" on public.proyecto_estados;
create policy "proyectos_all" on public.proyectos for all using (true) with check (true);
create policy "proyecto_estados_all" on public.proyecto_estados for all using (true) with check (true);
