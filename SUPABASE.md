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

## Usuarios de prueba

| Usuario | Contraseña |
|---------|------------|
| tomi    | tomi2025   |
| chipi   | chipi2025  |
| gena    | gena2025   |
