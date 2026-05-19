-- Documentos (Presupuestos y Contratos) — ejecutar en Supabase SQL Editor

create extension if not exists "pgcrypto";

create table if not exists public.documentos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('presupuesto', 'contrato')),
  numero text not null,
  cliente text not null,
  fecha date not null default current_date,
  estado text not null default 'Borrador',
  contenido jsonb not null default '{}'::jsonb,
  created_by text not null check (created_by in ('Tomi', 'Chipi', 'Gena')),
  created_at timestamptz not null default now()
);

create index if not exists documentos_tipo_idx on public.documentos (tipo);
create index if not exists documentos_numero_idx on public.documentos (numero);
create index if not exists documentos_cliente_idx on public.documentos (cliente);
create index if not exists documentos_estado_idx on public.documentos (estado);

alter table public.documentos enable row level security;

drop policy if exists "documentos_select" on public.documentos;
drop policy if exists "documentos_insert" on public.documentos;
drop policy if exists "documentos_update" on public.documentos;
drop policy if exists "documentos_delete" on public.documentos;

create policy "documentos_select" on public.documentos for select using (true);
create policy "documentos_insert" on public.documentos for insert with check (true);
create policy "documentos_update" on public.documentos for update using (true);
create policy "documentos_delete" on public.documentos for delete using (true);
