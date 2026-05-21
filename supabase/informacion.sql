-- Configuración CMR + recordatorios — ejecutar en Supabase SQL Editor

create table if not exists public.configuracion (
  id int primary key default 1 check (id = 1),
  empresa_nombre text not null default 'CMR Software Solutions',
  telefono_empresa text default '3364 57-8599',
  mensaje_wsp_cliente text not null default 'Hola {{nombre}}, somos {{empresa}}. Te recordamos que tu plan *{{plan}}* vence el *{{fecha}}* (monto: ${{monto}}). ¿Podés confirmar la renovación? WhatsApp CMR: {{telefono_cmr}}. Gracias.',
  dias_aviso_cliente int not null default 5 check (dias_aviso_cliente >= 0 and dias_aviso_cliente <= 60),
  email_tomi text,
  email_chipi text,
  email_gena text,
  wsp_tomi text,
  wsp_chipi text,
  wsp_gena text,
  mensaje_wsp_tarea_creada text not null default 'Hola {{destinatario}}, {{empresa}}: *nueva tarea* «{{titulo}}». Asignado: {{asignado}}. Prioridad: {{prioridad}}. Vence: {{vencimiento}}.',
  mensaje_wsp_tarea_vence text not null default 'Hola {{destinatario}}, {{empresa}}: recordatorio — la tarea «{{titulo}}» ({{asignado}}) {{vence_texto}}. Estado: {{estado}}.',
  dias_aviso_tarea int not null default 2 check (dias_aviso_tarea >= 0 and dias_aviso_tarea <= 30),
  notif_tarea_al_crear boolean not null default true,
  notif_tarea_por_vencer boolean not null default true,
  notif_tarea_wsp_crear boolean not null default true,
  notif_tarea_wsp_vencer boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Columnas nuevas en bases ya creadas
alter table public.configuracion add column if not exists wsp_tomi text;
alter table public.configuracion add column if not exists wsp_chipi text;
alter table public.configuracion add column if not exists wsp_gena text;
alter table public.configuracion add column if not exists mensaje_wsp_tarea_creada text;
alter table public.configuracion add column if not exists mensaje_wsp_tarea_vence text;
alter table public.configuracion add column if not exists notif_tarea_wsp_crear boolean default true;
alter table public.configuracion add column if not exists notif_tarea_wsp_vencer boolean default true;

update public.configuracion set telefono_empresa = '3364 57-8599'
where id = 1 and (telefono_empresa is null or trim(telefono_empresa) = '');

update public.configuracion set mensaje_wsp_tarea_creada = 'Hola {{destinatario}}, {{empresa}}: *nueva tarea* «{{titulo}}». Asignado: {{asignado}}. Prioridad: {{prioridad}}. Vence: {{vencimiento}}.'
where id = 1 and mensaje_wsp_tarea_creada is null;

update public.configuracion set mensaje_wsp_tarea_vence = 'Hola {{destinatario}}, {{empresa}}: recordatorio — la tarea «{{titulo}}» ({{asignado}}) {{vence_texto}}. Estado: {{estado}}.'
where id = 1 and mensaje_wsp_tarea_vence is null;

insert into public.configuracion (id) values (1)
on conflict (id) do nothing;

create table if not exists public.recordatorios_log (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  referencia_id text not null,
  fecha date not null default (current_date),
  created_at timestamptz not null default now(),
  unique (tipo, referencia_id, fecha)
);

alter table public.recordatorios_log drop constraint if exists recordatorios_log_tipo_check;
alter table public.recordatorios_log add constraint recordatorios_log_tipo_check check (
  tipo in ('wsp_cliente', 'email_tarea_creada', 'email_tarea_vence', 'wsp_tarea_creada', 'wsp_tarea_vence')
);

create index if not exists recordatorios_log_fecha_idx on public.recordatorios_log (fecha);

alter table public.configuracion enable row level security;
alter table public.recordatorios_log enable row level security;

drop policy if exists "configuracion_select" on public.configuracion;
drop policy if exists "configuracion_insert" on public.configuracion;
drop policy if exists "configuracion_update" on public.configuracion;
drop policy if exists "recordatorios_select" on public.recordatorios_log;
drop policy if exists "recordatorios_insert" on public.recordatorios_log;

create policy "configuracion_select" on public.configuracion for select using (true);
create policy "configuracion_insert" on public.configuracion for insert with check (true);
create policy "configuracion_update" on public.configuracion for update using (true);
create policy "recordatorios_select" on public.recordatorios_log for select using (true);
create policy "recordatorios_insert" on public.recordatorios_log for insert with check (true);
