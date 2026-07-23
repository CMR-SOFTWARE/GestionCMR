-- Documentos (Presupuestos, Contratos y archivos subidos) — SQL Editor CMR

create extension if not exists "pgcrypto";

create table if not exists public.documentos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('presupuesto', 'contrato', 'archivo')),
  numero text not null,
  cliente text not null default '',
  proyecto text,
  fecha date not null default current_date,
  estado text not null default 'Borrador',
  origen text not null default 'generado' check (origen in ('generado', 'subido')),
  archivo_nombre text,
  archivo_mime text,
  contenido jsonb not null default '{}'::jsonb,
  created_by text not null check (created_by in ('Tomi', 'Chipi', 'Gena')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Migraciones suaves (bases ya creadas)
alter table public.documentos add column if not exists proyecto text;
alter table public.documentos add column if not exists origen text;
alter table public.documentos add column if not exists archivo_nombre text;
alter table public.documentos add column if not exists archivo_mime text;
alter table public.documentos add column if not exists updated_at timestamptz default now();

update public.documentos set origen = 'generado' where origen is null;
alter table public.documentos alter column origen set default 'generado';

-- Ampliar check de tipo si la tabla ya existía sin 'archivo'
do $$
begin
  alter table public.documentos drop constraint if exists documentos_tipo_check;
  alter table public.documentos add constraint documentos_tipo_check
    check (tipo in ('presupuesto', 'contrato', 'archivo'));
exception when others then null;
end $$;

do $$
begin
  alter table public.documentos drop constraint if exists documentos_origen_check;
  alter table public.documentos add constraint documentos_origen_check
    check (origen in ('generado', 'subido'));
exception when others then null;
end $$;

create index if not exists documentos_tipo_idx on public.documentos (tipo);
create index if not exists documentos_numero_idx on public.documentos (numero);
create index if not exists documentos_cliente_idx on public.documentos (cliente);
create index if not exists documentos_estado_idx on public.documentos (estado);
create index if not exists documentos_fecha_idx on public.documentos (fecha);

alter table public.documentos enable row level security;

drop policy if exists "documentos_select" on public.documentos;
drop policy if exists "documentos_insert" on public.documentos;
drop policy if exists "documentos_update" on public.documentos;
drop policy if exists "documentos_delete" on public.documentos;

-- Permisos A: todo el equipo ve y edita
create policy "documentos_select" on public.documentos for select using (true);
create policy "documentos_insert" on public.documentos for insert with check (true);
create policy "documentos_update" on public.documentos for update using (true);
create policy "documentos_delete" on public.documentos for delete using (true);
