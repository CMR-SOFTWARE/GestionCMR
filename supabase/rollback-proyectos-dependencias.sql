-- ═══════════════════════════════════════════════════════════════
-- ROLLBACK — deshacer proyectos / estados / dependencias
-- Ejecutá esto en la BASE EQUIVOCADA (la que no querías tocar).
-- ⚠️ Borra tablas y columnas. Si había datos ahí, se pierden.
-- ═══════════════════════════════════════════════════════════════

-- 1) Dependencias entre tareas
drop table if exists public.tarea_dependencias cascade;

-- 2) Estados y proyectos
drop table if exists public.proyecto_estados cascade;
drop table if exists public.proyectos cascade;

-- 3) Columnas agregadas a tareas (si la tabla existe)
do $$
begin
  if to_regclass('public.tareas') is not null then
    alter table public.tareas drop constraint if exists tareas_proyecto_id_fkey;
    alter table public.tareas drop constraint if exists tareas_estado_id_fkey;
    alter table public.tareas drop column if exists proyecto_id;
    alter table public.tareas drop column if exists estado_id;
    alter table public.tareas drop column if exists estado_final;
    alter table public.tareas drop column if exists fecha_inicio;
  end if;
end $$;

-- 4) OPCIONAL — solo si en ESA base creaste "tareas" de cero y querés borrarla toda:
-- drop table if exists public.tareas cascade;

-- Verificación rápida (debería devolver 0 filas o solo tablas que ya existían antes)
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('proyectos', 'proyecto_estados', 'tarea_dependencias')
order by 1;
