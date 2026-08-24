-- Movimientos: cotización del dólar al momento del pago (para presupuestos en USD cobrados en ARS)
-- Ejecutar en Supabase CMR (GESTION CRM) → SQL Editor

alter table public.movimientos
  add column if not exists cotizacion_usd numeric;

comment on column public.movimientos.cotizacion_usd is
  'Cotización del dólar (ej: blue) del día del pago, para convertir monto en ARS a USD equivalente. Null si el monto ya está en USD o no aplica.';
