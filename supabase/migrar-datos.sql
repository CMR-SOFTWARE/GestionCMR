-- ═══════════════════════════════════════════════════════════════════
-- MIGRAR DATOS: proyecto viejo → proyecto nuevo
-- Viejo: vkmmvuxugzqmlwqdlpas.supabase.co
-- Nuevo: nvducffscqjksmgyzvlu.supabase.co
-- ═══════════════════════════════════════════════════════════════════
--
-- PASO 0 — En el proyecto NUEVO, crear tablas primero (si no existen):
--   schema.sql, clientes.sql, renovaciones-clientes.sql, tareas.sql, documentos.sql
--
-- PASO 1 — En el proyecto VIEJO (SQL Editor), ejecutá cada bloque "EXPORTAR"
--   Copiá el resultado de la columna "sql_insert" (un solo texto largo).
--
-- PASO 2 — En el proyecto NUEVO, pegá y ejecutá lo copiado.
--   Luego ejecutá el bloque "AJUSTAR SECUENCIAS" al final de este archivo.
-- ═══════════════════════════════════════════════════════════════════


-- ┌─────────────────────────────────────────────────────────────────┐
-- │ PASO 1 — PROYECTO VIEJO: ejecutar cada EXPORTAR por separado   │
-- └─────────────────────────────────────────────────────────────────┘

-- ─── EXPORTAR movimientos ─────────────────────────────────────────
SELECT string_agg(
  format(
    'INSERT INTO public.movimientos (fecha, tipo, descripcion, categoria, monto, socio, created_at) VALUES (%L, %L, %L, %L, %s, %L, %L);',
    fecha::text, tipo, descripcion, categoria, monto, socio, created_at::text
  ),
  E'\n'
) AS sql_insert
FROM public.movimientos;


-- ─── EXPORTAR clientes ────────────────────────────────────────────
-- Si en el viejo no tenés periodicidad / pago_confirmado, usá defaults:
SELECT string_agg(
  format(
    'INSERT INTO public.clientes (nombre, plan, monto_plan, fecha_vencimiento, contacto, notas, periodicidad, pago_confirmado, activo, created_at, updated_at) VALUES (%L, %L, %s, %L, %L, %L, %L, %s, %s, %L, %L);',
    nombre,
    plan,
    monto_plan,
    fecha_vencimiento::text,
    COALESCE(contacto, ''),
    COALESCE(notas, ''),
    COALESCE(periodicidad, 'mensual'),
    COALESCE(pago_confirmado, true),
    activo,
    created_at::text,
    COALESCE(updated_at, created_at)::text
  ),
  E'\n'
) AS sql_insert
FROM public.clientes;


-- Si falla clientes por columnas inexistentes en el viejo, usá esta versión:
/*
SELECT string_agg(
  format(
    'INSERT INTO public.clientes (nombre, plan, monto_plan, fecha_vencimiento, contacto, notas, periodicidad, pago_confirmado, activo, created_at, updated_at) VALUES (%L, %L, %s, %L, %L, %L, ''mensual'', true, %s, %L, %L);',
    nombre, plan, monto_plan, fecha_vencimiento::text,
    COALESCE(contacto, ''), COALESCE(notas, ''),
    activo, created_at::text, COALESCE(updated_at, created_at)::text
  ),
  E'\n'
) AS sql_insert
FROM public.clientes;
*/


-- ─── EXPORTAR tareas ──────────────────────────────────────────────
SELECT string_agg(
  format(
    'INSERT INTO public.tareas (id, titulo, descripcion, asignado_a, prioridad, estado, fecha_vencimiento, created_at) VALUES (%L, %L, %L, %L, %L, %L, %L, %L);',
    id::text,
    titulo,
    COALESCE(descripcion, ''),
    asignado_a,
    prioridad,
    estado,
    COALESCE(fecha_vencimiento::text, NULL),
    created_at::text
  ),
  E'\n'
) AS sql_insert
FROM public.tareas;


-- ─── EXPORTAR documentos (si existe la tabla) ─────────────────────
SELECT string_agg(
  format(
    'INSERT INTO public.documentos (id, tipo, numero, cliente, fecha, estado, contenido, created_by, created_at) VALUES (%L, %L, %L, %L, %L, %L, %L::jsonb, %L, %L);',
    id::text,
    tipo,
    numero,
    cliente,
    fecha::text,
    estado,
    contenido::text,
    created_by,
    created_at::text
  ),
  E'\n'
) AS sql_insert
FROM public.documentos;


-- ─── EXPORTAR proyectos (opcional) ────────────────────────────────
SELECT string_agg(
  format(
    'INSERT INTO public.proyectos (nombre, cliente, descripcion, responsable, estado, monto, fecha_inicio, fecha_entrega, avance, notas, created_at) VALUES (%L, %L, %L, %L, %L, %s, %L, %L, %s, %L, %L);',
    nombre,
    cliente,
    COALESCE(descripcion, ''),
    responsable,
    estado,
    COALESCE(monto::text, 'NULL'),
    COALESCE(fecha_inicio::text, NULL),
    COALESCE(fecha_entrega::text, NULL),
    avance,
    COALESCE(notas, ''),
    created_at::text
  ),
  E'\n'
) AS sql_insert
FROM public.proyectos;


-- ┌─────────────────────────────────────────────────────────────────┐
-- │ PASO 2 — PROYECTO NUEVO: pegar aquí los INSERT generados      │
-- │ (reemplazá este comentario por el SQL copiado del paso 1)     │
-- └─────────────────────────────────────────────────────────────────┘

-- INSERT INTO public.movimientos ...
-- INSERT INTO public.clientes ...
-- etc.


-- ┌─────────────────────────────────────────────────────────────────┐
-- │ PASO 3 — PROYECTO NUEVO: ejecutar después de importar          │
-- └─────────────────────────────────────────────────────────────────┘

-- Ajustar secuencias de IDs (movimientos, clientes, proyectos)
SELECT setval(
  pg_get_serial_sequence('public.movimientos', 'id'),
  COALESCE((SELECT MAX(id) FROM public.movimientos), 1)
);

SELECT setval(
  pg_get_serial_sequence('public.clientes', 'id'),
  COALESCE((SELECT MAX(id) FROM public.clientes), 1)
);

SELECT setval(
  pg_get_serial_sequence('public.proyectos', 'id'),
  COALESCE((SELECT MAX(id) FROM public.proyectos), 1)
);

-- Verificar conteos
SELECT 'movimientos' AS tabla, COUNT(*) AS filas FROM public.movimientos
UNION ALL SELECT 'clientes', COUNT(*) FROM public.clientes
UNION ALL SELECT 'tareas', COUNT(*) FROM public.tareas
UNION ALL SELECT 'documentos', COUNT(*) FROM public.documentos
UNION ALL SELECT 'proyectos', COUNT(*) FROM public.proyectos;
