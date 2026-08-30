# Conectar Supabase con CMR Software

## 1. Crear proyecto (si no tenés uno)

1. Entrá a [supabase.com](https://supabase.com) e iniciá sesión.
2. **New project** → elegí nombre y contraseña de base de datos.
3. Esperá a que termine de crearse.

## 2. Crear las tablas

1. En el dashboard: **SQL Editor** → **New query**.
2. Abrí el archivo `supabase/schema.sql` de esta carpeta.
3. Copiá todo el contenido, pegalo en el editor y pulsá **Run**.

## 3. Copiar credenciales

1. **Settings** → **API**.
2. Copiá **Project URL** (ej: `https://xxxxx.supabase.co`).
3. Copiá **anon public** key (empieza con `eyJ...` o el formato nuevo `sb_publishable_...`).

## 4. Configurar la app

Editá `js/supabase-config.js`:

```js
window.SUPABASE_CONFIG = {
  url: 'https://TU_PROYECTO.supabase.co',
  anonKey: 'TU_ANON_KEY'
};
```

## 5. Probar

Abrí `registro_empresa_v3 - VERSION 1.html` en Chrome.  
Si la conexión es correcta, el header mostrará **Sincronizado** en verde.  
Si falla, verás **Error de conexión** en rojo: revisá URL, key y que hayas ejecutado `schema.sql`.

### Sección Clientes

Si ya tenías la base creada antes, ejecutá también en el SQL Editor:
- `supabase/clientes.sql` — tabla de clientes
- `supabase/tareas.sql` — lista de tareas
- `supabase/informacion.sql` — configuración CMR, emails del equipo y log de recordatorios
- `supabase/resumenes-diarios.sql` — caché del resumen diario con IA

## Resumen diario con IA (Gemini)

El resumen del dashboard y el botón "Analizar con IA" llaman a la API de Gemini (tier gratuito) a través de **Supabase Edge Functions** — la app no tiene backend propio, así que la API key nunca puede vivir en el frontend.

1. Instalá la [Supabase CLI](https://supabase.com/docs/guides/cli) si no la tenés, y logueate: `supabase login`
2. Enlazá el proyecto: `supabase link --project-ref nvducffscqjksmgyzvlu`
3. Generá una API key gratis en [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
4. Cargala como secret (nunca la pegues en el código):
   ```
   supabase secrets set GEMINI_API_KEY=tu-key-acá
   ```
5. Deployá las dos funciones:
   ```
   supabase functions deploy resumen-diario
   supabase functions deploy analizar-financiero
   ```

El widget "Resumen del día" se genera una vez por día (se cachea en `resumenes_diarios`) y se puede forzar con el botón "↻ Actualizar".

## Usuarios de prueba

| Usuario | Contraseña |
|---------|------------|
| tomi    | tomi2025   |
| chipi   | chipi2025  |
| gena    | gena2025   |
