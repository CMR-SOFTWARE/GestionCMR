-- FKs cliente_id + backfill + presupuesto Casella N°0009
-- Ejecutar en Supabase CMR (GESTION CRM) → SQL Editor

-- ─── 1. Columnas ─────────────────────────────────────────────────
alter table public.documentos
  add column if not exists cliente_id bigint references public.clientes(id) on delete set null;

alter table public.movimientos
  add column if not exists cliente_id bigint references public.clientes(id) on delete set null;

alter table public.proyectos
  add column if not exists cliente_id bigint references public.clientes(id) on delete set null;

create index if not exists documentos_cliente_id_idx on public.documentos (cliente_id);
create index if not exists movimientos_cliente_id_idx on public.movimientos (cliente_id);
create index if not exists proyectos_cliente_id_idx on public.proyectos (cliente_id);

-- ─── 2. Backfill por nombre ──────────────────────────────────────
update public.documentos d
set cliente_id = c.id
from public.clientes c
where d.cliente_id is null
  and d.cliente <> ''
  and (
    d.cliente ilike c.nombre
    or d.cliente ilike '%' || c.nombre || '%'
    or c.nombre ilike '%' || d.cliente || '%'
    or (c.nombre ilike '%Casella%' and (d.cliente ilike '%Casella%' or d.cliente ilike '%Tenis%'))
    or (c.nombre ilike '%Ferreteria%' and d.cliente ilike '%Ferreteria%')
    or (c.nombre ilike '%Automóvil%' and (d.cliente ilike '%Automóvil%' or d.cliente ilike '%Automovil%'))
    or (c.nombre ilike '%Canito%' and d.cliente ilike '%Canito%')
  );

update public.movimientos m
set cliente_id = c.id
from public.clientes c
where m.cliente_id is null
  and (
    m.descripcion ilike '%' || c.nombre || '%'
    or (c.nombre ilike '%Casella%' and (
         m.descripcion ilike '%Casella%'
      or m.descripcion ilike '%Profesor Tenis%'
      or m.descripcion ilike '%Plataforma Tenis%'
    ))
    or (c.nombre ilike '%Ferreteria%' and m.descripcion ilike '%Ferreteria%')
    or (c.nombre ilike '%Automóvil%' and (
         m.descripcion ilike '%Automóvil Club%'
      or m.descripcion ilike '%Automovil Club%'
    ))
    or (c.nombre ilike '%Canito%' and m.descripcion ilike '%Canito%')
  );

update public.proyectos p
set cliente_id = c.id
from public.clientes c
where p.cliente_id is null
  and (
    p.nombre ilike '%' || c.nombre || '%'
    or (c.nombre ilike '%Casella%' and (
         p.nombre ilike '%Tenis%'
      or p.nombre ilike '%Casella%'
      or p.nombre ilike '%Sistema App Tenis%'
    ))
  )
  and p.nombre is distinct from 'General';

-- ─── 3. Presupuesto N°0009 Casella ───────────────────────────────
insert into public.documentos (
  tipo, numero, cliente, cliente_id, proyecto, fecha, estado, origen, contenido, created_by
)
select
  'presupuesto',
  'N0009',
  c.nombre,
  c.id,
  'Sistema App Tenis',
  current_date,
  'Aceptado',
  'generado',
  jsonb_build_object(
    'numero', '0009',
    'formatoItems', 'modulo',
    'empresaCliente', c.nombre,
    'proyecto', 'Sistema App Tenis',
    'total_usd', 3000,
    'mantenimiento_mensual_usd', 100,
    'clausula_early_adopter', '70/30 sobre ingresos de la plataforma una vez recuperada la inversión del cliente',
    'precioTotal', 3000,
    'cuotas', 1,
    'modulos', jsonb_build_array(
      jsonb_build_object('nombre','Academia y Gestión de Alumnos','precio_usd',500,'estado','pendiente'),
      jsonb_build_object('nombre','Integraciones de Pago y Automatizaciones','precio_usd',500,'estado','pendiente'),
      jsonb_build_object('nombre','Clubes y Reservas de Canchas','precio_usd',500,'estado','pendiente'),
      jsonb_build_object('nombre','Torneos Internos','precio_usd',500,'estado','pendiente'),
      jsonb_build_object('nombre','Ranking Amateur','precio_usd',500,'estado','entregado_no_cobrado'),
      jsonb_build_object('nombre','Tienda Online','precio_usd',500,'estado','pendiente')
    ),
    'items', jsonb_build_array(
      jsonb_build_object('num','01','nombre','Academia y Gestión de Alumnos','descripcion','','precio',500,'dependencia','','estado','pendiente'),
      jsonb_build_object('num','02','nombre','Integraciones de Pago y Automatizaciones','descripcion','','precio',500,'dependencia','','estado','pendiente'),
      jsonb_build_object('num','03','nombre','Clubes y Reservas de Canchas','descripcion','','precio',500,'dependencia','','estado','pendiente'),
      jsonb_build_object('num','04','nombre','Torneos Internos','descripcion','','precio',500,'dependencia','','estado','pendiente'),
      jsonb_build_object('num','05','nombre','Ranking Amateur','descripcion','Entregado, pendiente de cobro','precio',500,'dependencia','','estado','entregado_no_cobrado'),
      jsonb_build_object('num','06','nombre','Tienda Online','descripcion','','precio',500,'dependencia','','estado','pendiente')
    ),
    'pagos', jsonb_build_array(
      jsonb_build_object('nombre','Seña','cuando','Al firmar','monto',0)
    ),
    'mantenimiento', jsonb_build_object(
      'activo', true,
      'precioMensual', 100,
      'descripcion', 'Corrección de bugs · Actualizaciones menores · Backups · Soporte técnico',
      'excluye', 'No incluye nuevas funcionalidades, rediseños mayores ni integraciones no acordadas.'
    ),
    'bloques', jsonb_build_object(
      'resumenModulos', jsonb_build_object('activo', true),
      'participacionIngresos', jsonb_build_object(
        'activo', true,
        'texto', '70/30 sobre ingresos de la plataforma una vez recuperada la inversión del cliente'
      )
    ),
    'validezDias', 15,
    'notas', 'Presupuesto N°0009. Total USD 3.000 (6 módulos × USD 500). Mantenimiento USD 100/mes al entregar el 1er módulo.'
  ),
  'Tomi'
from public.clientes c
where (c.nombre ilike '%Casella%' or c.nombre ilike '%Plataforma Tenis%')
  and not exists (
    select 1 from public.documentos d
    where d.tipo = 'presupuesto'
      and (d.numero ilike '%0009%' or d.numero in ('N0009', 'P0009', '0009'))
      and (
        d.cliente_id = c.id
        or d.cliente ilike '%Casella%'
        or d.cliente ilike '%Tenis%'
      )
  )
limit 1;

-- Vincular seña al presupuesto
update public.movimientos m
set
  documento_id = d.id,
  cliente_id = coalesce(m.cliente_id, d.cliente_id),
  categoria = 'Proyecto',
  tipo_pago = 'seña'
from public.documentos d
where d.tipo = 'presupuesto'
  and (d.numero ilike '%0009%' or d.numero in ('N0009', 'P0009', '0009'))
  and m.tipo = 'ingreso'
  and (
    m.descripcion ilike '%Casella%'
    or m.descripcion ilike '%Profesor Tenis%'
    or m.descripcion ilike '%Plataforma Tenis%'
  )
  and m.monto >= 999000;
