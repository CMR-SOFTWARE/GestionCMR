// ─── Tareas: board, calendar, timeline ───
// ─── tareas ──────────────────────────────
let todasTareas = [];
let editandoTareaId = null;
let buscarTareasTimer = null;
let vistaTareas = 'board';
let calCursor = new Date();
let calGranularity = 'month';
let tlCursor = new Date();
let tlZoom = 'weeks';
let tlCollapsed = {};
let tlDrag = null;
let tlDragMoved = false;
let dependenciasTareas = [];
let tlLinkFromId = null;
const ESTADO_SIG = { 'Pendiente':'En progreso', 'En progreso':'Completada', 'Completada':'Completada' };
const MESES_CORTO = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const MESES_LARGO = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DIAS_SEM = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
const CAL_MAX_PILLS = 3;

function pillPrioridad(p){
  if(p==='Alta') return 'pill-prio-alta';
  if(p==='Media') return 'pill-prio-media';
  return 'pill-prio-baja';
}
function pillEstadoT(e){
  if(e==='En progreso') return 'pill-est-progreso';
  if(e==='Completada') return 'pill-est-completada';
  return 'pill-est-pendiente';
}
function esMiTarea(t){
  const n = USUARIOS[sesion]?.nombre;
  return n && (t.asignado_a === n || t.colaborador_1 === n || t.colaborador_2 === n);
}
function colaboradorDesdeSelect(id){
  const v = document.getElementById(id)?.value;
  return v || null;
}
function textoColaboradores(t){
  const c = [t.colaborador_1, t.colaborador_2].filter(Boolean);
  return c.length ? c.join(', ') : '—';
}
function colorUsuarioPorNombre(nombre){
  const u = Object.values(USUARIOS).find(x => x.nombre === nombre);
  return u?.color || '#8896ab';
}
function inicialesNombre(nombre){
  return (nombre||'?').charAt(0).toUpperCase();
}
function formatearFechaBadge(iso){
  if(!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  if(Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${MESES_CORTO[d.getMonth()]}`;
}
function fechaVencida(iso){
  if(!iso) return false;
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const d = new Date(iso + 'T12:00:00');
  return d < hoy;
}
function toggleFormTarea(abrir, estado, fecha){
  if(!proyectoActual){ toast('Abrí un proyecto primero'); return; }
  const panel = document.getElementById('kanban-form-panel');
  if(!panel) return;
  const open = abrir === true || (abrir !== false && !panel.classList.contains('open'));
  panel.classList.toggle('open', open);
  const est = estado || primerEstadoProyecto()?.nombre || '';
  document.getElementById('ta-estado-nuevo').value = est;
  if(open){
    initTareaForm();
    if(fecha) document.getElementById('ta-vence').value = fecha;
    document.getElementById('ta-titulo')?.focus();
    panel.scrollIntoView({ behavior:'smooth', block:'nearest' });
  }
  cerrarQuickAdds();
  cerrarCalPopover();
}
function cerrarQuickAdds(){
  document.querySelectorAll('.kb-quick-add.open').forEach(el => el.classList.remove('open'));
}
function abrirQuickAdd(estado){
  cerrarQuickAdds();
  toggleFormTarea(false);
  const box = document.getElementById('qa-' + slugEstado(estado));
  if(!box){ toggleFormTarea(true, estado); return; }
  box.classList.add('open');
  const inp = box.querySelector('input');
  if(inp){ inp.value=''; inp.focus(); }
  const ta = box.querySelector('textarea');
  if(ta) ta.value='';
}
function ordenarTareasPorVencimiento(lista){
  return [...lista].sort((a, b) => {
    if(!a.fecha_vencimiento && !b.fecha_vencimiento) return 0;
    if(!a.fecha_vencimiento) return 1;
    if(!b.fecha_vencimiento) return -1;
    return a.fecha_vencimiento.localeCompare(b.fecha_vencimiento);
  });
}

function renderKanbanMembers(){
  const el = document.getElementById('kanban-members');
  if(!el) return;
  el.innerHTML = Object.values(USUARIOS).map(u =>
    `<span class="kb-avatar" title="${esc(u.nombre)}" style="background:${u.color}">${esc(inicialesNombre(u.nombre))}</span>`
  ).join('');
}

function htmlAvataresTarea(t){
  const nombres = [t.asignado_a, t.colaborador_1, t.colaborador_2].filter(Boolean);
  const uniq = [...new Set(nombres)];
  if(!uniq.length) return '';
  return `<div class="kb-avatars">${uniq.map(n =>
    `<span class="kb-avatar" title="${esc(n)}" style="background:${colorUsuarioPorNombre(n)}">${esc(inicialesNombre(n))}</span>`
  ).join('')}</div>`;
}

function htmlBadgesTarea(t){
  const parts = [];
  if(t.descripcion){
    parts.push(`<span class="kb-badge" title="Tiene descripción"><svg width="12" height="12" fill="none" viewBox="0 0 24 24"><path d="M4 6h16M4 12h10M4 18h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></span>`);
  }
  if(t.fecha_inicio){
    parts.push(`<span class="kb-badge" title="Inicio"><svg width="12" height="12" fill="none" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>${esc(formatearFechaBadge(t.fecha_inicio))}</span>`);
  }
  const depN = (dependenciasTareas||[]).filter(d => d.tarea_id === t.id).length;
  if(depN){
    parts.push(`<span class="kb-badge" title="Depende de otra tarea">🔗 ${depN}</span>`);
  }
  if(t.fecha_vencimiento){
    const done = typeof esEstadoFinalTarea === 'function' ? esEstadoFinalTarea(t) : t.estado === 'Completada';
    const overdue = !done && fechaVencida(t.fecha_vencimiento);
    const cls = done ? 'kb-badge kb-badge-done' : (overdue ? 'kb-badge kb-badge-overdue' : 'kb-badge');
    parts.push(`<span class="${cls}" title="Vencimiento"><svg width="12" height="12" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>${esc(formatearFechaBadge(t.fecha_vencimiento))}</span>`);
  }
  return parts.length ? `<div class="kb-badges">${parts.join('')}</div>` : '<div class="kb-badges"></div>';
}

function htmlTarjetaTarea(t){
  const miNombre = USUARIOS[sesion]?.nombre;
  const mia = t.asignado_a === miNombre;
  const prioCls = t.prioridad==='Alta' ? 'kb-label-alta' : (t.prioridad==='Media' ? 'kb-label-media' : 'kb-label-baja');
  const desc = t.descripcion ? `<div class="kb-card-desc">${esc(t.descripcion)}</div>` : '';
  return `<article class="kb-card${mia?' mia':''}" draggable="true" data-id="${t.id}" data-estado="${esc(t.estado)}" ondragstart="onKanbanDragStart(event)" ondragend="onKanbanDragEnd(event)" onclick="onKanbanCardClick(event,'${t.id}')">
    <div class="kb-labels"><span class="kb-label ${prioCls}" title="Prioridad: ${esc(t.prioridad)}"></span></div>
    <div class="kb-card-title">${esc(t.titulo)}</div>
    ${desc}
    <div class="kb-card-meta">
      ${htmlBadgesTarea(t)}
      ${htmlAvataresTarea(t)}
    </div>
    <div class="kb-card-actions">
      <button type="button" class="btn-ghost-edit" onclick="event.stopPropagation();abrirEditarTarea('${t.id}')" title="Editar">✎</button>
      <button type="button" class="btn-ghost-danger" onclick="event.stopPropagation();eliminarTarea('${t.id}')" title="Eliminar">×</button>
    </div>
  </article>`;
}

function slugEstado(estado){
  return String(estado||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}
function jsStr(s){ return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }

function renderKanbanTareas(lista){
  const board = document.getElementById('kanban-board');
  if(!board) return;
  const cols = typeof kanbanColumnas === 'function' ? kanbanColumnas() : [];
  if(!cols.length){
    board.innerHTML = '<div class="proy-empty" style="color:var(--text3);padding:2rem">Configurá al menos un estado.</div>';
    return;
  }
  board.innerHTML = cols.map(col => {
    const items = ordenarTareasPorVencimiento(lista.filter(t =>
      (col.id && t.estado_id === col.id) || t.estado === col.estado
    ));
    const cards = items.map(htmlTarjetaTarea).join('');
    const estadoAttr = esc(col.estado);
    const slug = slugEstado(col.estado);
    const jsEst = jsStr(col.estado);
    return `<section class="kb-col" data-estado="${estadoAttr}" data-estado-id="${col.id||''}" ondragover="onKanbanDragOver(event)" ondragleave="onKanbanDragLeave(event)" ondrop="onKanbanDrop(event)">
      <div class="kb-col-accent" style="background:${esc(col.color||'#8896ab')}"></div>
      <div class="kb-col-head">
        <div class="kb-col-title">${esc(col.titulo)} <span class="kb-col-count">${items.length}</span></div>
        <button type="button" class="kb-col-menu" title="Agregar tarjeta" onclick="abrirQuickAdd('${jsEst}')">⋯</button>
      </div>
      <div class="kb-col-cards" data-estado="${estadoAttr}">${cards}</div>
      <div class="kb-quick-add" id="qa-${slug}" data-estado="${estadoAttr}">
        <input type="text" placeholder="Título de la tarjeta" onkeydown="if(event.key==='Enter'){event.preventDefault();guardarQuickAdd('${jsEst}');}">
        <textarea placeholder="Descripción (opcional)"></textarea>
        <div class="kb-quick-add-actions">
          <button type="button" class="btn-success" onclick="guardarQuickAdd('${jsEst}')">Agregar</button>
          <button type="button" onclick="cerrarQuickAdds()">Cancelar</button>
        </div>
      </div>
      <button type="button" class="kb-add-card" onclick="abrirQuickAdd('${jsEst}')">+ Agregar tarjeta</button>
    </section>`;
  }).join('');
}

let kanbanDragId = null;
function onKanbanDragStart(e){
  const card = e.target.closest('.kb-card');
  if(!card) return;
  kanbanDragId = card.dataset.id;
  card.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', kanbanDragId);
}
function onKanbanDragEnd(e){
  e.target.closest('.kb-card')?.classList.remove('dragging');
  document.querySelectorAll('.kb-col.drag-over').forEach(c => c.classList.remove('drag-over'));
  kanbanDragId = null;
}
function onKanbanDragOver(e){
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('drag-over');
}
function onKanbanDragLeave(e){
  if(!e.currentTarget.contains(e.relatedTarget)) e.currentTarget.classList.remove('drag-over');
}
async function onKanbanDrop(e){
  e.preventDefault();
  const col = e.currentTarget;
  col.classList.remove('drag-over');
  const id = e.dataTransfer.getData('text/plain') || kanbanDragId;
  const nuevoEstado = col.dataset.estado;
  const nuevoEstadoId = col.dataset.estadoId || null;
  if(!id || !nuevoEstado) return;
  const t = todasTareas.find(x => x.id === id);
  if(t && t.estado === nuevoEstado && (!nuevoEstadoId || t.estado_id === nuevoEstadoId)) return;
  await setEstadoTarea(id, nuevoEstado, nuevoEstadoId);
}
function onKanbanCardClick(e, id){
  if(e.target.closest('button')) return;
  abrirEditarTarea(id);
}

async function cargarTareas(){
  if(!sb || !requiereSupabase()) return;
  if(!proyectoActual){ await cargarProyectos(); return; }
  const fEst = document.getElementById('f-ta-estado')?.value || '';
  const fAsg = document.getElementById('f-ta-asignado')?.value || '';
  const fPrio = document.getElementById('f-ta-prio')?.value || '';
  const fBus = (document.getElementById('f-ta-buscar')?.value || '').trim().toLowerCase();
  let { data, error } = await sb.from('tareas').select('*').eq('proyecto_id', proyectoActual.id).order('fecha_vencimiento', { ascending: true, nullsFirst: false });
  if(error){
    const retry = await sb.from('tareas').select('*').order('fecha_vencimiento', { ascending: true, nullsFirst: false });
    if(retry.error){ toast(supabaseErrMsg(error).replace('movimientos','tareas')); console.error(error); return; }
    toast('Ejecutá supabase/proyectos.sql para activar proyectos');
    data = retry.data || [];
  }
  let lista = data || [];
  const full = lista;
  if(fEst) lista = lista.filter(t=>t.estado===fEst);
  if(fAsg) lista = lista.filter(t=>t.asignado_a===fAsg);
  if(fPrio) lista = lista.filter(t=>t.prioridad===fPrio);
  if(fBus) lista = lista.filter(t=>
    t.titulo.toLowerCase().includes(fBus) ||
    (t.descripcion||'').toLowerCase().includes(fBus)
  );
  todasTareas = lista;
  await cargarDependencias();
  const stats = document.getElementById('kanban-stats-dynamic');
  if(stats){
    const cols = typeof kanbanColumnas === 'function' ? kanbanColumnas() : [];
    let html = `<span class="kanban-stat">Total<strong id="t-total">${full.length}</strong></span>`;
    cols.forEach(c => {
      const n = full.filter(t => (c.id && t.estado_id === c.id) || t.estado === c.estado).length;
      html += `<span class="kanban-stat"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${esc(c.color)};margin-right:4px"></span>${esc(c.titulo)}<strong>${n}</strong></span>`;
    });
    stats.innerHTML = html;
  } else {
    const el = document.getElementById('t-total');
    if(el) el.textContent = full.length;
  }
  renderVistaTareas(lista);
}

function setVistaTareas(vista){
  vistaTareas = vista === 'calendar' || vista === 'timeline' ? vista : 'board';
  ['board','calendar','timeline'].forEach(v => {
    document.getElementById('vista-' + v)?.classList.toggle('active', v === vistaTareas);
    document.getElementById('vista-btn-' + v)?.classList.toggle('active', v === vistaTareas);
  });
  cerrarCalPopover();
  hideTlTooltip();
  renderVistaTareas(todasTareas);
}

function renderVistaTareas(lista){
  renderKanbanMembers();
  if(vistaTareas === 'calendar') renderCalendarioTareas(lista || []);
  else if(vistaTareas === 'timeline') renderTimelineTareas(lista || []);
  else renderKanbanTareas(lista || []);
}

function colorPrioCls(p){
  if(p==='Alta') return 'alta';
  if(p==='Media') return 'media';
  return 'baja';
}
function isoDate(d){
  const x = d instanceof Date ? d : new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth()+1).padStart(2,'0');
  const day = String(x.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function parseIsoDate(iso){
  if(!iso) return null;
  const s = String(iso).slice(0,10);
  const d = new Date(s + 'T12:00:00');
  return Number.isNaN(d.getTime()) ? null : d;
}
function addDays(d, n){
  const x = new Date(d); x.setDate(x.getDate()+n); return x;
}
function startOfWeekMon(d){
  const x = new Date(d); x.setHours(12,0,0,0);
  const day = (x.getDay()+6)%7;
  x.setDate(x.getDate()-day);
  return x;
}
function avanceTarea(t){
  if(typeof esEstadoFinalTarea === 'function' && esEstadoFinalTarea(t)) return 1;
  const cols = typeof kanbanColumnas === 'function' ? kanbanColumnas() : [];
  if(cols.length){
    const idx = cols.findIndex(c => (c.id && t.estado_id === c.id) || c.estado === t.estado);
    if(idx >= 0) return idx / Math.max(1, cols.length - 1);
  }
  if(t.estado==='Completada') return 1;
  if(t.estado==='En progreso') return 0.5;
  return 0;
}
function fechaInicioTarea(t){
  return parseIsoDate(t.fecha_inicio) || parseIsoDate(t.fecha_vencimiento) || parseIsoDate(t.created_at);
}
function fechaFinTarea(t){
  return parseIsoDate(t.fecha_vencimiento) || parseIsoDate(t.fecha_inicio) || parseIsoDate(t.created_at);
}

/* ─── Calendario ─── */
function setCalGranularity(g){
  calGranularity = g === 'day' || g === 'week' ? g : 'month';
  document.querySelectorAll('#cal-granularity button').forEach(b => b.classList.toggle('active', b.dataset.g === calGranularity));
  renderCalendarioTareas(todasTareas);
}
function calNav(dir){
  if(calGranularity==='day') calCursor = addDays(calCursor, dir);
  else if(calGranularity==='week') calCursor = addDays(calCursor, dir*7);
  else calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth()+dir, 1);
  renderCalendarioTareas(todasTareas);
}
function calHoy(){ calCursor = new Date(); renderCalendarioTareas(todasTareas); }
function cerrarCalPopover(){ document.getElementById('cal-popover')?.classList.remove('open'); }
function tareasPorFecha(lista){
  const map = {};
  (lista||[]).forEach(t => {
    if(!t.fecha_vencimiento) return;
    const k = String(t.fecha_vencimiento).slice(0,10);
    (map[k] = map[k] || []).push(t);
  });
  Object.keys(map).forEach(k => { map[k] = ordenarTareasPorVencimiento(map[k]); });
  return map;
}
function htmlCalPill(t){
  const color = typeof colorEstadoPorTarea === 'function' ? colorEstadoPorTarea(t) : '#8896ab';
  return `<button type="button" class="cal-pill" style="background:${esc(color)};border-left-color:rgba(0,0,0,.25)" title="${esc(t.titulo)} · ${esc(t.estado||'')}" onclick="event.stopPropagation();abrirEditarTarea('${t.id}')">${esc(t.titulo)}</button>`;
}
function abrirCalMore(e, iso){
  e.stopPropagation();
  const pop = document.getElementById('cal-popover');
  if(!pop) return;
  const items = (tareasPorFecha(todasTareas)[iso] || []);
  pop.innerHTML = `<div class="cal-popover-title">${esc(formatearFechaBadge(iso))}</div>` + items.map(htmlCalPill).join('');
  pop.classList.add('open');
  const r = e.currentTarget.getBoundingClientRect();
  const wrap = document.getElementById('vista-calendar')?.getBoundingClientRect();
  pop.style.left = Math.max(8, r.left - (wrap?.left||0)) + 'px';
  pop.style.top = Math.max(8, r.bottom - (wrap?.top||0) + 4) + 'px';
}
function crearTareaEnDia(iso){ toggleFormTarea(true, 'Pendiente', iso); }

function renderCalendarioTareas(lista){
  const wrap = document.getElementById('cal-wrap');
  const title = document.getElementById('cal-title');
  if(!wrap || !title) return;
  cerrarCalPopover();
  const byDate = tareasPorFecha(lista);
  const hoyIso = isoDate(new Date());

  if(calGranularity === 'day'){
    const iso = isoDate(calCursor);
    title.textContent = `${calCursor.getDate()} ${MESES_LARGO[calCursor.getMonth()]} ${calCursor.getFullYear()}`;
    const items = byDate[iso] || [];
    wrap.innerHTML = `<div class="cal-grid" style="grid-template-columns:1fr">
      <div class="cal-dow">${DIAS_SEM[(calCursor.getDay()+6)%7]}</div>
      <div class="cal-day${iso===hoyIso?' today':''}" style="min-height:280px" onclick="crearTareaEnDia('${iso}')">
        <div class="cal-day-num">${calCursor.getDate()}</div>
        <div class="cal-pills">${items.map(htmlCalPill).join('') || '<span style="font-size:12px;color:var(--text3)">Sin tareas — clic para crear</span>'}</div>
      </div>
    </div>`;
    return;
  }

  if(calGranularity === 'week'){
    const start = startOfWeekMon(calCursor);
    title.textContent = `Semana del ${start.getDate()} ${MESES_CORTO[start.getMonth()]}`;
    let html = DIAS_SEM.map(d => `<div class="cal-dow">${d}</div>`).join('');
    for(let i=0;i<7;i++){
      const d = addDays(start, i);
      const iso = isoDate(d);
      const items = byDate[iso] || [];
      const shown = items.slice(0, CAL_MAX_PILLS);
      const more = items.length - shown.length;
      html += `<div class="cal-day${iso===hoyIso?' today':''}" onclick="crearTareaEnDia('${iso}')">
        <div class="cal-day-num">${d.getDate()}</div>
        <div class="cal-pills">${shown.map(htmlCalPill).join('')}${more>0?`<button type="button" class="cal-more" onclick="abrirCalMore(event,'${iso}')">+${more} más</button>`:''}</div>
      </div>`;
    }
    wrap.innerHTML = `<div class="cal-grid">${html}</div>`;
    return;
  }

  const y = calCursor.getFullYear();
  const m = calCursor.getMonth();
  title.textContent = `${MESES_LARGO[m]} ${y}`;
  const first = new Date(y, m, 1);
  const start = startOfWeekMon(first);
  let html = DIAS_SEM.map(d => `<div class="cal-dow">${d}</div>`).join('');
  for(let i=0;i<42;i++){
    const d = addDays(start, i);
    const iso = isoDate(d);
    const out = d.getMonth() !== m;
    const items = byDate[iso] || [];
    const shown = items.slice(0, CAL_MAX_PILLS);
    const more = items.length - shown.length;
    html += `<div class="cal-day${out?' out':''}${iso===hoyIso?' today':''}" onclick="crearTareaEnDia('${iso}')">
      <div class="cal-day-num">${d.getDate()}</div>
      <div class="cal-pills">${shown.map(htmlCalPill).join('')}${more>0?`<button type="button" class="cal-more" onclick="abrirCalMore(event,'${iso}')">+${more} más</button>`:''}</div>
    </div>`;
  }
  wrap.innerHTML = `<div class="cal-grid">${html}</div>`;
}

/* ─── Timeline ─── */
function setTlZoom(z){
  tlZoom = ['days','weeks','months','quarters'].includes(z) ? z : 'weeks';
  document.querySelectorAll('#tl-zoom button').forEach(b => b.classList.toggle('active', b.dataset.z === tlZoom));
  renderTimelineTareas(todasTareas);
}
function tlNav(dir){
  if(tlZoom==='days') tlCursor = addDays(tlCursor, dir*7);
  else if(tlZoom==='weeks') tlCursor = addDays(tlCursor, dir*28);
  else if(tlZoom==='months') tlCursor = new Date(tlCursor.getFullYear(), tlCursor.getMonth()+dir*3, 1);
  else tlCursor = new Date(tlCursor.getFullYear(), tlCursor.getMonth()+dir*6, 1);
  renderTimelineTareas(todasTareas);
}
function tlHoy(){ tlCursor = new Date(); renderTimelineTareas(todasTareas); }
function toggleTlGroup(estado){
  tlCollapsed[estado] = !tlCollapsed[estado];
  renderTimelineTareas(todasTareas);
}
function hideTlTooltip(){ document.getElementById('tl-tooltip')?.classList.remove('open'); }
function showTlTooltip(e, t){
  const tip = document.getElementById('tl-tooltip');
  if(!tip || !t || !t.id) return;
  const ini = fechaInicioTarea(t);
  const fin = fechaFinTarea(t);
  const miembros = [t.asignado_a, t.colaborador_1, t.colaborador_2].filter(Boolean).join(', ') || '—';
  tip.innerHTML = `<strong>${esc(t.titulo)}</strong><span>${ini?isoDate(ini):'—'} → ${fin?isoDate(fin):'—'}</span><span>${esc(miembros)}</span><span>${esc(t.estado)} · ${esc(t.prioridad)}</span>`;
  tip.classList.add('open');
  tip.style.left = Math.min(window.innerWidth - 250, e.clientX + 12) + 'px';
  tip.style.top = Math.min(window.innerHeight - 100, e.clientY + 12) + 'px';
}
function tlRangeConfig(){
  const anchor = new Date(tlCursor); anchor.setHours(12,0,0,0);
  let start, days, tickDays, tickLabel;
  if(tlZoom==='days'){
    start = addDays(anchor, -3);
    days = 21; tickDays = 1;
    tickLabel = d => `${d.getDate()} ${MESES_CORTO[d.getMonth()]}`;
  } else if(tlZoom==='weeks'){
    start = startOfWeekMon(addDays(anchor, -14));
    days = 70; tickDays = 7;
    tickLabel = d => `${d.getDate()} ${MESES_CORTO[d.getMonth()]}`;
  } else if(tlZoom==='months'){
    start = new Date(anchor.getFullYear(), anchor.getMonth()-2, 1);
    days = 150; tickDays = 14;
    tickLabel = d => `${MESES_CORTO[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
  } else {
    start = new Date(anchor.getFullYear(), Math.floor(anchor.getMonth()/3)*3 - 3, 1);
    days = 365; tickDays = 30;
    tickLabel = d => `T${Math.floor(d.getMonth()/3)+1} ${d.getFullYear()}`;
  }
  return { start, days, tickDays, tickLabel, pxPerDay: tlZoom==='days' ? 44 : (tlZoom==='weeks' ? 18 : (tlZoom==='months' ? 10 : 6)) };
}
function renderTimelineTareas(lista){
  const wrap = document.getElementById('tl-wrap');
  const title = document.getElementById('tl-title');
  if(!wrap || !title) return;
  hideTlTooltip();
  const cfg = tlRangeConfig();
  const end = addDays(cfg.start, cfg.days);
  title.textContent = `${cfg.start.getDate()} ${MESES_CORTO[cfg.start.getMonth()]} — ${end.getDate()} ${MESES_CORTO[end.getMonth()]} ${end.getFullYear()}`;
  const width = cfg.days * cfg.pxPerDay;
  const hoy = new Date(); hoy.setHours(12,0,0,0);
  const hoyOffset = ((hoy - cfg.start) / 86400000) * cfg.pxPerDay;
  const barMeta = {}; // id -> {left, width, rowTop}

  let ticks = '';
  for(let i=0;i<cfg.days;i+=cfg.tickDays){
    const d = addDays(cfg.start, i);
    const w = cfg.tickDays * cfg.pxPerDay;
    ticks += `<div class="tl-tick" style="width:${w}px">${cfg.tickLabel(d)}</div>`;
  }

  let side = `<div class="tl-side-head">Tareas</div>`;
  let body = '';
  let y = 0; // after header; spacers + rows
  const cols = typeof kanbanColumnas === 'function' ? kanbanColumnas() : [];
  cols.forEach(col => {
    const items = ordenarTareasPorVencimiento((lista||[]).filter(t =>
      (col.id && t.estado_id === col.id) || t.estado === col.estado
    ));
    const collapsed = !!tlCollapsed[col.estado];
    side += `<div class="tl-group-head" onclick="toggleTlGroup('${jsStr(col.estado)}')">${collapsed?'▸':'▾'} ${esc(col.titulo)} <span class="kb-col-count">${items.length}</span></div>`;
    body += `<div class="tl-group-spacer" style="width:${width}px"></div>`;
    y += 32;
    if(collapsed) return;
    items.forEach(t => {
      const estColor = col.color || (typeof colorEstadoPorTarea === 'function' ? colorEstadoPorTarea(t) : '#8896ab');
      const depsCount = (dependenciasTareas||[]).filter(d => d.tarea_id === t.id).length;
      side += `<div class="tl-row-label" title="${esc(t.titulo)}"><span class="kb-label" style="background:${esc(estColor)}"></span><span>${esc(t.titulo)}</span>${depsCount?` <span style="color:var(--text3);font-size:10px">↳${depsCount}</span>`:''}</div>`;
      const ini = fechaInicioTarea(t);
      const fin = fechaFinTarea(t);
      let barHtml = '';
      if(ini || fin){
        const a = ini || fin;
        const b = fin || ini;
        const left = ((a - cfg.start) / 86400000) * cfg.pxPerDay;
        const spanDays = Math.max(0, (b - a) / 86400000);
        const isPoint = spanDays < 0.5;
        const w = isPoint ? 14 : Math.max(18, (spanDays + 1) * cfg.pxPerDay);
        const pct = Math.round(avanceTarea(t)*100);
        const done = typeof esEstadoFinalTarea === 'function' && esEstadoFinalTarea(t);
        const linkCls = tlLinkFromId === t.id ? ' link-source' : '';
        const cls = `tl-bar${done?' done':''}${isPoint?' tl-bar-point':''}${linkCls}`;
        const leftR = Math.round(left);
        const wR = Math.round(w);
        barMeta[t.id] = { left: leftR, width: wR, top: y + 8, height: 20 };
        barHtml = `<div class="${cls}" style="left:${leftR}px;width:${wR}px;background:${esc(estColor)}" data-id="${t.id}"
          onmouseenter="onTlBarEnter(event,'${t.id}')" onmousemove="showTlTooltip(event, todasTareas.find(x=>x.id==='${t.id}')||{})" onmouseleave="onTlBarLeave(event,'${t.id}')"
          onmousedown="startTlMove(event,'${t.id}')" onclick="onTlBarClick(event,'${t.id}')">
          ${!isPoint?`<div class="tl-bar-fill" style="width:${pct}%"></div><span class="tl-bar-label">${esc(t.titulo)}</span>
          <span class="tl-handle left" onmousedown="startTlResize(event,'${t.id}','start')"></span>
          <span class="tl-handle right" onmousedown="startTlResize(event,'${t.id}','end')"></span>`:`<span class="tl-bar-label" style="display:none">${esc(t.titulo)}</span>`}
          <button type="button" class="tl-link-handle" title="Enlazar: esta tarea va antes de otra" onclick="iniciarEnlaceTimeline(event,'${t.id}')"></button>
        </div>`;
      }
      body += `<div class="tl-grid-row" style="width:${width}px" data-tarea-id="${t.id}">${barHtml}</div>`;
      y += 36;
    });
  });

  const svgH = Math.max(y, 40);
  const depsSvg = buildDepsSvg(barMeta, svgH, width);

  wrap.innerHTML = `
    <div class="tl-side">${side}</div>
    <div class="tl-main" id="tl-main">
      <div class="tl-header-row" style="width:${width}px">${ticks}</div>
      <div class="tl-body" style="width:${width}px;position:relative;min-height:${svgH}px">
        ${hoyOffset>=0 && hoyOffset<=width ? `<div class="tl-today-line" style="left:${Math.round(hoyOffset)}px"></div>` : ''}
        ${depsSvg}
        ${body}
      </div>
    </div>`;
  actualizarBannerEnlace();
}

function buildDepsSvg(barMeta, height, width){
  const lines = (dependenciasTareas||[]).map(d => {
    const from = barMeta[d.predecesora_id];
    const to = barMeta[d.tarea_id];
    if(!from || !to) return '';
    const x1 = from.left + from.width;
    const y1 = from.top + from.height / 2;
    const x2 = to.left;
    const y2 = to.top + to.height / 2;
    const mid = Math.max(x1 + 12, (x1 + x2) / 2);
    return `<path d="M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}" />`;
  }).join('');
  return `<svg class="tl-deps-svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs><marker id="tl-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#4a5568"/></marker></defs>
    ${lines}
  </svg>`;
}

function onTlBarEnter(e, id){
  showTlTooltip(e, todasTareas.find(x => x.id === id) || {});
  if(tlLinkFromId && tlLinkFromId !== id) e.currentTarget.classList.add('link-target-hover');
}
function onTlBarLeave(e, id){
  hideTlTooltip();
  e.currentTarget.classList.remove('link-target-hover');
}
function onTlBarClick(e, id){
  if(e.target.closest('.tl-handle') || e.target.closest('.tl-link-handle')) return;
  if(tlDragMoved){ tlDragMoved = false; return; }
  if(tlLinkFromId){
    e.stopPropagation();
    completarEnlaceTimeline(id);
    return;
  }
  abrirEditarTarea(id);
}

function startTlMove(e, id){
  if(e.button !== 0) return;
  if(e.target.closest('.tl-handle') || e.target.closest('.tl-link-handle')) return;
  e.preventDefault();
  e.stopPropagation();
  const t = todasTareas.find(x => x.id === id);
  if(!t) return;
  const bar = e.currentTarget;
  const cfg = tlRangeConfig();
  const ini = fechaInicioTarea(t);
  const fin = fechaFinTarea(t);
  if(!ini && !fin) return;
  tlDragMoved = false;
  tlDrag = {
    mode: 'move',
    id,
    startX: e.clientX,
    origLeft: parseFloat(bar.style.left) || 0,
    ini: ini || fin,
    fin: fin || ini,
    pxPerDay: cfg.pxPerDay,
    el: bar
  };
  bar.classList.add('dragging-move');
  hideTlTooltip();
  document.addEventListener('mousemove', onTlDragMove);
  document.addEventListener('mouseup', onTlDragEnd);
}

function startTlResize(e, id, edge){
  e.preventDefault(); e.stopPropagation();
  const t = todasTareas.find(x => x.id === id);
  if(!t) return;
  const cfg = tlRangeConfig();
  tlDragMoved = false;
  tlDrag = {
    mode: 'resize',
    id, edge,
    startX: e.clientX,
    ini: fechaInicioTarea(t),
    fin: fechaFinTarea(t),
    pxPerDay: cfg.pxPerDay,
    el: e.currentTarget.closest('.tl-bar')
  };
  hideTlTooltip();
  document.addEventListener('mousemove', onTlDragMove);
  document.addEventListener('mouseup', onTlDragEnd);
}

function onTlDragMove(e){
  if(!tlDrag) return;
  const dx = e.clientX - tlDrag.startX;
  if(Math.abs(dx) > 3) tlDragMoved = true;
  if(tlDrag.mode === 'move' && tlDrag.el){
    tlDrag.el.style.left = Math.round(tlDrag.origLeft + dx) + 'px';
  }
}
async function onTlDragEnd(e){
  if(!tlDrag) return;
  const drag = tlDrag;
  tlDrag = null;
  document.removeEventListener('mousemove', onTlDragMove);
  document.removeEventListener('mouseup', onTlDragEnd);
  drag.el?.classList.remove('dragging-move');
  const deltaDays = Math.round((e.clientX - drag.startX) / drag.pxPerDay);
  if(!deltaDays){ tlDragMoved = false; return; }
  const t = todasTareas.find(x => x.id === drag.id);
  if(!t) return;

  if(drag.mode === 'move'){
    const nuevaIni = addDays(drag.ini, deltaDays);
    const nuevaFin = addDays(drag.fin, deltaDays);
    await setFechasTarea(drag.id, {
      fecha_inicio: isoDate(nuevaIni),
      fecha_vencimiento: isoDate(nuevaFin)
    });
    return;
  }
  if(drag.edge === 'start'){
    let nuevaIni = addDays(drag.ini || drag.fin, deltaDays);
    const fin = drag.fin || drag.ini;
    if(fin && nuevaIni > fin) nuevaIni = fin;
    await setFechasTarea(drag.id, { fecha_inicio: isoDate(nuevaIni) });
  } else {
    let nuevaFin = addDays(drag.fin || drag.ini, deltaDays);
    const ini = drag.ini || drag.fin;
    if(ini && nuevaFin < ini) nuevaFin = ini;
    await setFechasTarea(drag.id, { fecha_vencimiento: isoDate(nuevaFin) });
  }
}

function iniciarEnlaceTimeline(e, id){
  e.preventDefault(); e.stopPropagation();
  tlLinkFromId = id;
  actualizarBannerEnlace();
  renderTimelineTareas(todasTareas);
  toast('Ahora clic en la tarea que va DESPUÉS');
}
function cancelarEnlaceTimeline(){
  tlLinkFromId = null;
  actualizarBannerEnlace();
  renderTimelineTareas(todasTareas);
}
function actualizarBannerEnlace(){
  const banner = document.getElementById('tl-link-banner');
  const txt = document.getElementById('tl-link-banner-text');
  if(!banner) return;
  banner.classList.toggle('show', !!tlLinkFromId);
  if(tlLinkFromId && txt){
    const t = todasTareas.find(x => x.id === tlLinkFromId);
    txt.textContent = `Enlace desde «${t?.titulo || '…'}»: clic en la tarea que va después`;
  }
}
function creariaCicloDep(tareaId, predecesoraId){
  // ¿predecesoraId ya depende (transitivamente) de tareaId?
  const adj = {};
  (dependenciasTareas||[]).forEach(d => {
    (adj[d.tarea_id] = adj[d.tarea_id] || []).push(d.predecesora_id);
  });
  const stack = [predecesoraId];
  const seen = new Set();
  while(stack.length){
    const cur = stack.pop();
    if(cur === tareaId) return true;
    if(seen.has(cur)) continue;
    seen.add(cur);
    (adj[cur] || []).forEach(p => stack.push(p));
  }
  return false;
}
async function completarEnlaceTimeline(tareaDespuesId){
  if(!tlLinkFromId || !requiereSupabase()) return;
  const pred = tlLinkFromId;
  tlLinkFromId = null;
  actualizarBannerEnlace();
  if(pred === tareaDespuesId){ toast('No se puede enlazar una tarea consigo misma'); renderTimelineTareas(todasTareas); return; }
  if(creariaCicloDep(tareaDespuesId, pred)){ toast('Ese enlace crearía un ciclo'); renderTimelineTareas(todasTareas); return; }
  const exists = (dependenciasTareas||[]).some(d => d.tarea_id === tareaDespuesId && d.predecesora_id === pred);
  if(exists){ toast('Ese enlace ya existe'); renderTimelineTareas(todasTareas); return; }
  const { error } = await sb.from('tarea_dependencias').insert({
    tarea_id: tareaDespuesId,
    predecesora_id: pred
  });
  if(error){ toast(supabaseErrMsg(error).replace('movimientos','dependencias') + ' — ejecutá supabase/dependencias.sql'); renderTimelineTareas(todasTareas); return; }
  toast('Tareas enlazadas');
  await cargarDependencias();
  renderVistaTareas(todasTareas);
}
async function cargarDependencias(){
  if(!sb || !proyectoActual){ dependenciasTareas = []; return; }
  const ids = (todasTareas||[]).map(t => t.id);
  if(!ids.length){ dependenciasTareas = []; return; }
  const { data, error } = await sb.from('tarea_dependencias').select('*').in('tarea_id', ids);
  if(error){ dependenciasTareas = []; return; }
  dependenciasTareas = data || [];
}
async function setPredecesoraTarea(tareaId, predecesoraId){
  if(!requiereSupabase()) return;
  await sb.from('tarea_dependencias').delete().eq('tarea_id', tareaId);
  if(!predecesoraId){ await cargarDependencias(); return; }
  if(creariaCicloDep(tareaId, predecesoraId)){ toast('Ese enlace crearía un ciclo'); return; }
  const { error } = await sb.from('tarea_dependencias').insert({ tarea_id: tareaId, predecesora_id: predecesoraId });
  if(error){ toast(supabaseErrMsg(error)); return; }
}
function poblarSelectPredecesora(tareaId){
  const sel = document.getElementById('et-predecesora');
  if(!sel) return;
  const actual = (dependenciasTareas||[]).find(d => d.tarea_id === tareaId);
  sel.innerHTML = `<option value="">— Sin enlace —</option>` +
    (todasTareas||[]).filter(t => t.id !== tareaId).map(t =>
      `<option value="${t.id}" ${actual?.predecesora_id===t.id?'selected':''}>${esc(t.titulo)}</option>`
    ).join('');
}

async function setFechasTarea(id, patch){
  if(!requiereSupabase()) return;
  const { error } = await sb.from('tareas').update(patch).eq('id', id);
  if(error){ toast(supabaseErrMsg(error)); return; }
  await cargarTareas();
}
async function setFechaVencimientoTarea(id, fecha){
  await setFechasTarea(id, { fecha_vencimiento: fecha });
}

function escHtmlReporte(s){
  return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
}
function descargarReporteProyecto(){
  if(!proyectoActual){ toast('Abrí un proyecto primero'); return; }
  const cols = typeof kanbanColumnas === 'function' ? kanbanColumnas() : [];
  const fecha = new Date().toLocaleString('es-AR');
  let secciones = cols.map(col => {
    const items = (todasTareas||[]).filter(t => (col.id && t.estado_id === col.id) || t.estado === col.estado);
    const rows = items.map(t => {
      const deps = (dependenciasTareas||[]).filter(d => d.tarea_id === t.id)
        .map(d => (todasTareas.find(x => x.id === d.predecesora_id)||{}).titulo || '—').join(', ');
      return `<tr>
        <td>${escHtmlReporte(t.titulo)}</td>
        <td>${escHtmlReporte(t.asignado_a)}</td>
        <td>${escHtmlReporte(t.prioridad)}</td>
        <td>${escHtmlReporte(t.fecha_inicio||'—')}</td>
        <td>${escHtmlReporte(t.fecha_vencimiento||'—')}</td>
        <td>${escHtmlReporte(deps||'—')}</td>
      </tr>`;
    }).join('') || `<tr><td colspan="6" style="color:#8896ab">Sin tareas</td></tr>`;
    return `<h2 style="color:${escHtmlReporte(col.color)};border-bottom:2px solid #e2e8f0;padding-bottom:6px">${escHtmlReporte(col.titulo)} <small style="color:#8896ab;font-weight:600">(${items.length})</small></h2>
      <table><thead><tr><th>Tarea</th><th>Asignado</th><th>Prioridad</th><th>Inicio</th><th>Vence</th><th>Depende de</th></tr></thead>
      <tbody>${rows}</tbody></table>`;
  }).join('');
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Reporte ${escHtmlReporte(proyectoActual.nombre)}</title>
<style>body{font-family:Segoe UI,Arial,sans-serif;color:#0d1b2e;padding:36px;max-width:960px;margin:0 auto;font-size:13px;line-height:1.45}
h1{color:#0a9d8f;margin:0 0 4px} .meta{color:#8896ab;margin-bottom:24px;font-size:12px}
table{width:100%;border-collapse:collapse;margin:8px 0 24px}th,td{border:1px solid #e2e8f0;padding:8px;text-align:left;vertical-align:top}
th{background:#f8fafc;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#8896ab}
.badge{display:inline-block;width:10px;height:10px;border-radius:50%;background:${escHtmlReporte(proyectoActual.color||'#0a9d8f')};margin-right:6px}
@media print{body{padding:12px}}</style></head><body>
<h1><span class="badge"></span>Proyecto: ${escHtmlReporte(proyectoActual.nombre)}</h1>
<p class="meta">CMR Software Solutions · Generado ${escHtmlReporte(fecha)} · ${todasTareas.length} tareas</p>
${proyectoActual.descripcion?`<p>${escHtmlReporte(proyectoActual.descripcion)}</p>`:''}
${secciones}
</body></html>`;
  const nombre = `Proyecto_${(proyectoActual.nombre||'CMR').replace(/\s+/g,'_')}.html`;
  if(typeof wrapPaginaDescargable === 'function'){
    const page = wrapPaginaDescargable(`Reporte — ${proyectoActual.nombre}`, html, nombre);
    const w = window.open('', '_blank');
    if(w){ w.document.write(page); w.document.close(); return; }
  }
  if(typeof descargarArchivo === 'function'){
    descargarArchivo(nombre, html, 'text/html;charset=utf-8');
  } else {
    const blob = new Blob([html], {type:'text/html;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=nombre; a.click();
    URL.revokeObjectURL(url);
  }
  toast('Reporte descargado');
}

async function agregarTarea(){
  if(!requiereSupabase()) return;
  if(!proyectoActual){ toast('Abrí un proyecto primero'); return; }
  const titulo = document.getElementById('ta-titulo').value.trim();
  const descripcion = document.getElementById('ta-desc').value.trim() || null;
  const asignado_a = document.getElementById('ta-asignado').value;
  const prioridad = document.getElementById('ta-prio').value;
  const fecha_inicio = document.getElementById('ta-inicio')?.value || null;
  const fecha_vencimiento = document.getElementById('ta-vence').value || null;
  const colaborador_1 = colaboradorDesdeSelect('ta-colab1');
  const colaborador_2 = colaboradorDesdeSelect('ta-colab2');
  const estadoNombre = document.getElementById('ta-estado-nuevo')?.value || primerEstadoProyecto()?.nombre || 'Pendiente';
  const est = estadosProyecto.find(e => e.nombre === estadoNombre) || primerEstadoProyecto();
  if(!titulo){ toast('Ingresá el título'); return; }
  if(fecha_inicio && fecha_vencimiento && fecha_inicio > fecha_vencimiento){
    toast('El inicio no puede ser posterior al vencimiento'); return;
  }
  const btn = document.getElementById('btn-ta-add');
  btn.disabled=true; btn.textContent='Guardando…';
  const payload = {
    titulo, descripcion, asignado_a, prioridad,
    estado: est?.nombre || estadoNombre,
    estado_id: est?.id || null,
    estado_final: !!est?.es_final,
    proyecto_id: proyectoActual.id,
    fecha_inicio, fecha_vencimiento, colaborador_1, colaborador_2
  };
  const { data: tareaNueva, error } = await sb.from('tareas').insert(payload).select().single();
  if(error){ toast(supabaseErrMsg(error)); }
  else{
    document.getElementById('ta-titulo').value='';
    document.getElementById('ta-desc').value='';
    if(document.getElementById('ta-inicio')) document.getElementById('ta-inicio').value='';
    document.getElementById('ta-vence').value='';
    document.getElementById('ta-colab1').value='';
    document.getElementById('ta-colab2').value='';
    toggleFormTarea(false);
    toast('Tarea agregada');
    await cargarTareas();
    if(tareaNueva){
      if(!tareaNueva.created_at) tareaNueva.created_at = new Date().toISOString();
      if(typeof notificarTareaCreada === 'function') await notificarTareaCreada(tareaNueva);
    }
  }
  btn.disabled=false; btn.textContent='+ Agregar tarea';
}

async function guardarQuickAdd(estado){
  if(!requiereSupabase()) return;
  if(!proyectoActual){ toast('Abrí un proyecto primero'); return; }
  const box = document.getElementById('qa-' + slugEstado(estado));
  if(!box) return;
  const titulo = (box.querySelector('input')?.value || '').trim();
  const descripcion = (box.querySelector('textarea')?.value || '').trim() || null;
  if(!titulo){ toast('Ingresá el título'); return; }
  const asignado_a = USUARIOS[sesion]?.nombre || 'Tomi';
  const est = estadosProyecto.find(e => e.nombre === estado) || primerEstadoProyecto();
  const { data: tareaNueva, error } = await sb.from('tareas').insert({
    titulo, descripcion, asignado_a, prioridad:'Media',
    estado: est?.nombre || estado,
    estado_id: est?.id || null,
    estado_final: !!est?.es_final,
    proyecto_id: proyectoActual.id,
    fecha_vencimiento:null, colaborador_1:null, colaborador_2:null
  }).select().single();
  if(error){ toast(supabaseErrMsg(error)); return; }
  cerrarQuickAdds();
  toast('Tarea agregada');
  await cargarTareas();
  if(tareaNueva){
    if(!tareaNueva.created_at) tareaNueva.created_at = new Date().toISOString();
    if(typeof notificarTareaCreada === 'function') await notificarTareaCreada(tareaNueva);
  }
}

async function ciclarEstadoTarea(id){
  if(!requiereSupabase()) return;
  const t = todasTareas.find(x=>x.id===id);
  if(!t){ const { data } = await sb.from('tareas').select('*').eq('id',id).single(); if(data) await actualizarEstadoTarea(data); return; }
  await actualizarEstadoTarea(t);
}

async function actualizarEstadoTarea(t){
  const cols = typeof kanbanColumnas === 'function' ? kanbanColumnas() : [];
  const idx = cols.findIndex(c => (c.id && t.estado_id === c.id) || c.estado === t.estado);
  const next = cols[Math.min(cols.length - 1, Math.max(0, idx) + 1)] || cols[cols.length - 1];
  if(!next) return;
  await setEstadoTarea(t.id, next.estado, next.id);
}

async function setEstadoTarea(id, estado, estadoId){
  if(!requiereSupabase()) return;
  const est = (estadoId && estadosProyecto.find(e => e.id === estadoId))
    || estadosProyecto.find(e => e.nombre === estado)
    || null;
  const patch = {
    estado: est?.nombre || estado,
    estado_id: est?.id || estadoId || null,
    estado_final: !!est?.es_final
  };
  const { error } = await sb.from('tareas').update(patch).eq('id', id);
  if(error){ toast(supabaseErrMsg(error)); return; }
  await cargarTareas();
}

async function abrirEditarTarea(id){
  const { data: t, error } = await sb.from('tareas').select('*').eq('id', id).single();
  if(error||!t){ toast('No se pudo cargar la tarea'); return; }
  editandoTareaId = id;
  poblarSelectEstadosTarea();
  document.getElementById('et-titulo').value = t.titulo;
  document.getElementById('et-desc').value = t.descripcion || '';
  document.getElementById('et-asignado').value = t.asignado_a;
  document.getElementById('et-prio').value = t.prioridad;
  document.getElementById('et-estado').value = t.estado;
  document.getElementById('et-inicio').value = t.fecha_inicio || '';
  document.getElementById('et-vence').value = t.fecha_vencimiento || '';
  document.getElementById('et-colab1').value = t.colaborador_1 || '';
  document.getElementById('et-colab2').value = t.colaborador_2 || '';
  poblarSelectPredecesora(id);
  document.getElementById('modal-tarea').classList.add('open');
}

function cerrarModalTarea(){ document.getElementById('modal-tarea').classList.remove('open'); editandoTareaId=null; }

async function guardarTareaEditada(){
  if(!editandoTareaId || !requiereSupabase()) return;
  const titulo = document.getElementById('et-titulo').value.trim();
  const descripcion = document.getElementById('et-desc').value.trim() || null;
  const asignado_a = document.getElementById('et-asignado').value;
  const prioridad = document.getElementById('et-prio').value;
  const estado = document.getElementById('et-estado').value;
  const fecha_inicio = document.getElementById('et-inicio')?.value || null;
  const fecha_vencimiento = document.getElementById('et-vence').value || null;
  const colaborador_1 = colaboradorDesdeSelect('et-colab1');
  const colaborador_2 = colaboradorDesdeSelect('et-colab2');
  if(!titulo){ toast('Ingresá el título'); return; }
  if(fecha_inicio && fecha_vencimiento && fecha_inicio > fecha_vencimiento){
    toast('El inicio no puede ser posterior al vencimiento'); return;
  }
  const est = estadosProyecto.find(e => e.nombre === estado) || null;
  const patch = {
    titulo, descripcion, asignado_a, prioridad, estado, fecha_inicio, fecha_vencimiento, colaborador_1, colaborador_2,
    estado_id: est?.id || null,
    estado_final: !!est?.es_final
  };
  if(proyectoActual) patch.proyecto_id = proyectoActual.id;
  const { error } = await sb.from('tareas').update(patch).eq('id', editandoTareaId);
  if(error){ toast(supabaseErrMsg(error)); return; }
  const pred = document.getElementById('et-predecesora')?.value || '';
  await setPredecesoraTarea(editandoTareaId, pred || null);
  toast('Tarea actualizada');
  cerrarModalTarea();
  await cargarTareas();
}

async function eliminarTarea(id){
  if(!requiereSupabase()) return;
  if(!confirm('¿Eliminar esta tarea?')) return;
  const { error } = await sb.from('tareas').delete().eq('id', id);
  if(error){ toast(supabaseErrMsg(error)); return; }
  toast('Tarea eliminada');
  await cargarTareas();
}

function buscarTareasDebounce(){ clearTimeout(buscarTareasTimer); buscarTareasTimer=setTimeout(cargarTareas,350); }

document.getElementById('modal-mov').addEventListener('click', e => {
  if(e.target.id === 'modal-mov') cerrarModalMov();
});
document.getElementById('modal-tarea').addEventListener('click', e => {
  if(e.target.id === 'modal-tarea') cerrarModalTarea();
});
document.getElementById('modal-estados')?.addEventListener('click', e => {
  if(e.target.id === 'modal-estados') cerrarModalEstados();
});
document.addEventListener('click', e => {
  const pop = document.getElementById('cal-popover');
  if(pop?.classList.contains('open') && !pop.contains(e.target) && !e.target.closest('.cal-more')) cerrarCalPopover();
});
document.getElementById('modal-cliente').addEventListener('click', e => {
  if(e.target.id === 'modal-cliente') cerrarModalCliente();
});
