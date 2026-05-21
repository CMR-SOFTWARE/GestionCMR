-- CMR Software — Base de datos
-- Ejecutá todo este archivo en Supabase → SQL Editor → Run

-- Tabla de movimientos financieros
create table if not exists public.movimientos (
  id bigint generated always as identity primary key,
  fecha date not null default current_date,
  tipo text not null check (tipo in ('ingreso', 'gasto')),
  descripcion text not null,
  categoria text not null,
  monto numeric(12, 2) not null check (monto > 0),
  socio text not null check (socio in ('tomi', 'chipi', 'gena')),
  created_at timestamptz not null default now()
);

create index if not exists movimientos_fecha_idx on public.movimientos (fecha desc);
create index if not exists movimientos_socio_idx on public.movimientos (socio);

-- Tabla de proyectos (para cmr-site / versión completa)
create table if not exists public.proyectos (
  id bigint generated always as identity primary key,
  nombre text not null,
  cliente text not null,
  descripcion text,
  responsable text not null check (responsable in ('tomi', 'chipi', 'gena')),
  estado text not null default 'Presupuestado',
  monto numeric(12, 2),
  fecha_inicio date,
  fecha_entrega date,
  avance int not null default 0 check (avance >= 0 and avance <= 100),
  notas text,
  created_at timestamptz not null default now()
);

-- RLS: la app usa la anon key desde el navegador (sin Supabase Auth)
alter table public.movimientos enable row level security;
alter table public.proyectos enable row level security;

drop policy if exists "movimientos_select" on public.movimientos;
drop policy if exists "movimientos_insert" on public.movimientos;
drop policy if exists "movimientos_update" on public.movimientos;
drop policy if exists "movimientos_delete" on public.movimientos;

create policy "movimientos_select" on public.movimientos for select using (true);
create policy "movimientos_insert" on public.movimientos for insert with check (true);
create policy "movimientos_update" on public.movimientos for update using (true);
create policy "movimientos_delete" on public.movimientos for delete using (true);

drop policy if exists "proyectos_select" on public.proyectos;
drop policy if exists "proyectos_insert" on public.proyectos;
drop policy if exists "proyectos_update" on public.proyectos;
drop policy if exists "proyectos_delete" on public.proyectos;

create policy "proyectos_select" on public.proyectos for select using (true);
create policy "proyectos_insert" on public.proyectos for insert with check (true);
create policy "proyectos_update" on public.proyectos for update using (true);
create policy "proyectos_delete" on public.proyectos for delete using (true);

-- Tabla de clientes y planes
create table if not exists public.clientes (
  id bigint generated always as identity primary key,
  nombre text not null,
  plan text not null,
  monto_plan numeric(12, 2) not null default 0 check (monto_plan >= 0),
  fecha_vencimiento date not null,
  contacto text,
  notas text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clientes_vencimiento_idx on public.clientes (fecha_vencimiento);

alter table public.clientes enable row level security;

drop policy if exists "clientes_select" on public.clientes;
drop policy if exists "clientes_insert" on public.clientes;
drop policy if exists "clientes_update" on public.clientes;
drop policy if exists "clientes_delete" on public.clientes;

create policy "clientes_select" on public.clientes for select using (true);
create policy "clientes_insert" on public.clientes for insert with check (true);
create policy "clientes_update" on public.clientes for update using (true);
create policy "clientes_delete" on public.clientes for delete using (true);

-- Tabla de tareas
create extension if not exists "pgcrypto";

create table if not exists public.tareas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descripcion text,
  asignado_a text not null check (asignado_a in ('Tomi', 'Chipi', 'Gena')),
  prioridad text not null default 'Media' check (prioridad in ('Alta', 'Media', 'Baja')),
  estado text not null default 'Pendiente' check (estado in ('Pendiente', 'En progreso', 'Completada')),
  fecha_vencimiento date,
  colaborador_1 text check (colaborador_1 is null or colaborador_1 in ('Tomi', 'Chipi', 'Gena')),
  colaborador_2 text check (colaborador_2 is null or colaborador_2 in ('Tomi', 'Chipi', 'Gena')),
  created_at timestamptz not null default now()
);

alter table public.tareas enable row level security;

drop policy if exists "tareas_select" on public.tareas;
drop policy if exists "tareas_insert" on public.tareas;
drop policy if exists "tareas_update" on public.tareas;
drop policy if exists "tareas_delete" on public.tareas;

create policy "tareas_select" on public.tareas for select using (true);
create policy "tareas_insert" on public.tareas for insert with check (true);
create policy "tareas_update" on public.tareas for update using (true);
create policy "tareas_delete" on public.tareas for delete using (true);
