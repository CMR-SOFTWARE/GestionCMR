/**
 * Parte css/app.css en archivos por área.
 * Uso: node scripts/partir-css.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const cssDir = path.join(root, 'css');
const full = fs.readFileSync(path.join(cssDir, 'app.css'), 'utf8');

// Quitar header previo si existe
const body = full.replace(/^\/\*[\s\S]*?═+\s*\*\/\s*/, '');

const markers = [
  { file: 'theme.css', title: 'Tema y variables', start: ':root' },
  { file: 'login.css', title: 'Pantalla de login', start: '.login-wrap{' },
  { file: 'layout.css', title: 'Layout: header, nav, páginas', start: '.app{display:none}' },
  { file: 'components.css', title: 'Componentes UI compartidos', start: '.btn-primary{' },
];

// Encontrar índices
const starts = markers.map((m) => {
  const i = body.indexOf(m.start);
  if (i < 0) throw new Error('No encontrado: ' + m.start);
  return { ...m, index: i };
});

// Módulos: desde .board- o .kanban o tareas-related — buscar .tarea- o .board-
let modulesIdx = body.indexOf('.board-wrap');
if (modulesIdx < 0) modulesIdx = body.indexOf('.doc-subtabs');
if (modulesIdx < 0) modulesIdx = body.indexOf('.kanban');
if (modulesIdx < 0) {
  // fallback: última parte grande después de components
  modulesIdx = body.indexOf('.theme-switch');
}

starts.push({
  file: 'modules.css',
  title: 'Módulos: tareas, documentos, info, avisos',
  start: '',
  index: modulesIdx > 0 ? modulesIdx : body.length,
});

starts.sort((a, b) => a.index - b.index);

const files = [];
for (let i = 0; i < starts.length; i++) {
  const cur = starts[i];
  const next = starts[i + 1];
  const chunk = body.slice(cur.index, next ? next.index : body.length).trim() + '\n';
  const header = `/* ─── ${cur.title} ─── */\n\n`;
  fs.writeFileSync(path.join(cssDir, cur.file), header + chunk, 'utf8');
  files.push(cur.file);
  console.log(cur.file, Math.round(chunk.length / 1024) + 'KB');
}

// app.css pasa a ser un barrel (imports) — CSS nativo no tiene @import obligatorio
// Usamos @import para un solo punto de entrada
const barrel = `/* CMR — punto de entrada de estilos
   Orden: tema → login → layout → componentes → módulos
*/
@import url('theme.css');
@import url('login.css');
@import url('layout.css');
@import url('components.css');
@import url('modules.css');
`;
fs.writeFileSync(path.join(cssDir, 'app.css'), barrel, 'utf8');
console.log('app.css barrel OK →', files.join(', '));
