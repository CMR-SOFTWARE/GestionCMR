/**
 * Extrae CSS y JS embebidos de index.html a carpetas css/ y js/
 * Uso: node scripts/reorganizar.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const htmlPath = path.join(root, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const lines = html.split(/\r?\n/);

function sliceLines(start1, end1) {
  return lines.slice(start1 - 1, end1).join('\n');
}

fs.mkdirSync(path.join(root, 'css'), { recursive: true });
fs.mkdirSync(path.join(root, 'js'), { recursive: true });

const cssBody = sliceLines(18, 466);
const cssHeader = `/* ═══════════════════════════════════════════
   CMR — estilos de la app
   1. Tema / variables
   2. Reset y base
   3. Login
   4. Layout (nav, pages)
   5. Componentes (botones, forms, tablas, modales)
   6. Módulos (movimientos, clientes, tareas, docs…)
   ═══════════════════════════════════════════ */

`;
fs.writeFileSync(path.join(root, 'css', 'app.css'), cssHeader + cssBody + '\n', 'utf8');
console.log('css/app.css OK');

fs.writeFileSync(
  path.join(root, 'js', 'theme-boot.js'),
  `/* Evita flash de tema incorrecto antes de cargar CSS */
(function () {
  try {
    var t = localStorage.getItem('cmr-theme') || 'light';
    if (t !== 'dark' && t !== 'light') t = 'light';
    document.documentElement.setAttribute('data-theme', t);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
`,
  'utf8'
);
console.log('js/theme-boot.js OK');

const jsAll = sliceLines(1085, 3052);

function extractBetween(src, startMarker, endMarker) {
  const si = src.indexOf(startMarker);
  if (si < 0) throw new Error('Missing start: ' + startMarker);
  const ei = endMarker ? src.indexOf(endMarker, si + startMarker.length) : src.length;
  if (endMarker && ei < 0) throw new Error('Missing end: ' + endMarker);
  return src.slice(si, endMarker ? ei : src.length);
}

const coreStart = '// ══════════════════════════════════════════\n// CONFIG';
const clientesStart = '// ─── clientes ────────────────────────────';
const statsStart = '// ─── estadísticas ────────────────────────';
const tareasStart = '// ─── tareas ──────────────────────────────';
const exportStart = '// ─── exportar ────────────────────────────';
const toastStart = '// ─── toast ───────────────────────────────';
const movStart = '// ─── supabase ────────────────────────────';
const navStart = '// ─── navegación ──────────────────────────';

const corePart = extractBetween(jsAll, coreStart, clientesStart);
const clientesPart = extractBetween(jsAll, clientesStart, statsStart);
const statsPart = extractBetween(jsAll, statsStart, tareasStart);
const tareasPart = extractBetween(jsAll, tareasStart, exportStart);
const exportPart = extractBetween(jsAll, exportStart, toastStart);
const toastPart = jsAll.slice(jsAll.indexOf(toastStart));

const beforeMov = extractBetween(corePart, coreStart, movStart);
const movAndNav = corePart.slice(corePart.indexOf(movStart));
const navIdx = movAndNav.indexOf(navStart);
const movimientosPart = movAndNav.slice(0, navIdx);
const navPart = movAndNav.slice(navIdx);

function writeJs(name, header, body) {
  fs.writeFileSync(
    path.join(root, 'js', name),
    header + '\n' + body.replace(/\s+$/, '') + '\n',
    'utf8'
  );
  console.log(name, 'OK', Math.round(body.length / 1024) + 'KB');
}

writeJs('core.js', '// ─── Core: auth, sesión, navegación, toast, tema ───', beforeMov + '\n' + navPart + '\n' + toastPart);
writeJs('movimientos.js', '// ─── Movimientos: sync, CRUD, tabla, totales ───', movimientosPart);
writeJs('clientes.js', '// ─── Clientes y renovaciones ───', clientesPart);
writeJs('estadisticas.js', '// ─── Estadísticas y gráficos ───', statsPart);
writeJs('tareas.js', '// ─── Tareas: board, calendar, timeline ───', tareasPart);
writeJs('exportar.js', '// ─── Exportar CSV / análisis IA ───', exportPart);

const bodyStart = html.indexOf('<body>');
const toastDiv = html.indexOf('<div class="toast" id="toast"></div>');
const afterToast = html.indexOf('\n', toastDiv);
const bodyMarkup = html.slice(bodyStart, afterToast + 1);

const newHtml = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CMR Software Solutions — Sistema de Gestión</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/app.css">
<script src="js/theme-boot.js"></script>
</head>
${bodyMarkup}
<!-- Librerías -->
<script src="js/supabase-config.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<!-- App (orden: core → módulos de negocio) -->
<script src="js/core.js"></script>
<script src="js/movimientos.js"></script>
<script src="js/clientes.js"></script>
<script src="js/estadisticas.js"></script>
<script src="js/tareas.js"></script>
<script src="js/proyectos.js"></script>
<script src="js/documentos.js"></script>
<script src="js/informacion.js"></script>
<script src="js/exportar.js"></script>
</body>
</html>
`;

fs.writeFileSync(htmlPath, newHtml, 'utf8');
console.log('index.html OK', newHtml.split(/\n/).length, 'líneas');
