# Sistema de Gestión CMR

## Estructura

```
├── index.html              ← HTML (solo markup + includes)
├── css/
│   ├── app.css             ← importa el resto
│   ├── theme.css           ← variables claro/oscuro
│   ├── login.css
│   ├── layout.css          ← header, nav, páginas
│   ├── components.css      ← botones, forms, tablas, modales
│   └── modules.css         ← tareas, documentos, info…
├── js/
│   ├── theme-boot.js       ← tema antes del CSS (anti-flash)
│   ├── supabase-config.js  ← URL y anon key
│   ├── core.js             ← login, sesión, nav, toast, tema
│   ├── movimientos.js
│   ├── clientes.js
│   ├── estadisticas.js
│   ├── tareas.js
│   ├── proyectos.js
│   ├── documentos.js
│   ├── informacion.js
│   └── exportar.js
├── supabase/               ← scripts SQL
└── scripts/                ← utilidades de mantenimiento
```

## Cómo trabajar

1. **HTML** (`index.html`): estructura de pantallas y modales.
2. **CSS** (`css/`): estilos por área; no mezclar lógica.
3. **JS** (`js/`): un archivo por módulo de negocio.
4. **SQL** (`supabase/`): ejecutar en el proyecto Supabase correcto (CMR).

Orden de scripts en el HTML: `core` → módulos de datos → `proyectos` / `documentos` / `informacion` → `exportar`.

## Entrada en Vercel

`vercel.json` sirve `index.html` en `/`.
