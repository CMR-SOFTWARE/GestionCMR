/* Proyectos + estados configurables (CMR) */
const PROYECTO_COLORES = ['#0a9d8f','#1a6fc4','#c47a0a','#e53e3e','#7f77dd','#d85a30','#0a9d6e','#4a5568'];
const ESTADOS_DEFAULT = [
  { nombre: 'Pendiente', color: '#8896ab', orden: 0, es_final: false },
  { nombre: 'En progreso', color: '#1a6fc4', orden: 1, es_final: false },
  { nombre: 'Completada', color: '#0a9d6e', orden: 2, es_final: true }
];

let todosProyectos = [];
let proyectoActual = null;
let estadosProyecto = [];
let dragEstadoId = null;

function colorEstadoPorTarea(t){
  if(t?.estado_id){
    const e = estadosProyecto.find(x => x.id === t.estado_id);
    if(e) return e.color;
  }
  const byName = estadosProyecto.find(x => x.nombre === t?.estado);
  return byName?.color || '#8896ab';
}
function estadoMeta(t){
  if(t?.estado_id){
    const e = estadosProyecto.find(x => x.id === t.estado_id);
    if(e) return e;
  }
  return estadosProyecto.find(x => x.nombre === t?.estado) || null;
}
function esEstadoFinalTarea(t){
  if(typeof t?.estado_final === 'boolean') return t.estado_final;
  const m = estadoMeta(t);
  if(m) return !!m.es_final;
  return t?.estado === 'Completada';
}
function primerEstadoProyecto(){
  return estadosProyecto[0] || null;
}
function kanbanColumnas(){
  return estadosProyecto.map(e => ({
    id: e.id,
    estado: e.nombre,
    titulo: e.nombre,
    color: e.color,
    es_final: e.es_final,
    orden: e.orden
  }));
}

function mostrarCapaProyectos(lista){
  const home = document.getElementById('proyectos-home');
  const board = document.getElementById('proyecto-board');
  if(home) home.style.display = lista ? 'flex' : 'none';
  if(board) board.style.display = lista ? 'none' : 'flex';
}

async function cargarProyectos(){
  if(!sb || !requiereSupabase()) return;
  mostrarCapaProyectos(true);
  proyectoActual = null;
  estadosProyecto = [];
  const grid = document.getElementById('proyectos-grid');
  if(grid) grid.innerHTML = '<div class="proy-empty">Cargando proyectos…</div>';

  const { data, error } = await sb.from('proyectos').select('*').order('created_at', { ascending: true });
  if(error){
    toast(supabaseErrMsg(error).replace('movimientos','proyectos') + ' — ejecutá supabase/proyectos.sql');
    if(grid) grid.innerHTML = '<div class="proy-empty">No se pudieron cargar los proyectos. Ejecutá <code>supabase/proyectos.sql</code> en Supabase.</div>';
    return;
  }
  todosProyectos = data || [];
  if(!todosProyectos.length){
    await asegurarProyectoGeneral();
    return cargarProyectos();
  }

  const ids = todosProyectos.map(p => p.id);
  const { data: tareas } = await sb.from('tareas').select('id,proyecto_id,asignado_a,colaborador_1,colaborador_2,estado_final,estado_id').in('proyecto_id', ids);
  const { data: estados } = await sb.from('proyecto_estados').select('*').in('proyecto_id', ids).order('orden');

  const byProj = {};
  (tareas||[]).forEach(t => {
    (byProj[t.proyecto_id] = byProj[t.proyecto_id] || []).push(t);
  });
  const estByProj = {};
  (estados||[]).forEach(e => {
    (estByProj[e.proyecto_id] = estByProj[e.proyecto_id] || []).push(e);
  });

  renderProyectosGrid(byProj, estByProj);
}

async function asegurarProyectoGeneral(){
  const { data: proy, error } = await sb.from('proyectos').insert({
    nombre: 'General', color: '#0a9d8f', icono: 'folder', descripcion: 'Proyecto por defecto'
  }).select().single();
  if(error || !proy) return;
  const rows = ESTADOS_DEFAULT.map(e => ({ ...e, proyecto_id: proy.id }));
  await sb.from('proyecto_estados').insert(rows);
}

function avanceProyecto(tareas, estados){
  const list = tareas || [];
  if(!list.length) return 0;
  const finales = new Set((estados||[]).filter(e => e.es_final).map(e => e.id));
  const done = list.filter(t => t.estado_final || finales.has(t.estado_id)).length;
  return Math.round((done / list.length) * 100);
}

function miembrosProyecto(tareas){
  const set = new Set();
  (tareas||[]).forEach(t => {
    [t.asignado_a, t.colaborador_1, t.colaborador_2].filter(Boolean).forEach(n => set.add(n));
  });
  return [...set];
}

function renderProyectosGrid(byProj, estByProj){
  const grid = document.getElementById('proyectos-grid');
  if(!grid) return;
  if(!todosProyectos.length){
    grid.innerHTML = '<div class="proy-empty">Todavía no hay proyectos. Creá el primero.</div>';
    return;
  }
  grid.innerHTML = todosProyectos.map(p => {
    const ts = byProj[p.id] || [];
    const es = estByProj[p.id] || [];
    const pct = avanceProyecto(ts, es);
    const members = miembrosProyecto(ts);
    const avatars = members.slice(0, 4).map(n => {
      const u = Object.values(USUARIOS).find(x => x.nombre === n);
      const color = u?.color || '#8896ab';
      return `<span class="kb-avatar" title="${esc(n)}" style="background:${color}">${esc((n||'?').charAt(0))}</span>`;
    }).join('');
    const more = members.length > 4 ? `<span class="proy-more">+${members.length-4}</span>` : '';
    return `<article class="proy-card" onclick="abrirProyecto('${p.id}')" style="--proy-color:${esc(p.color)}">
      <div class="proy-card-top">
        <span class="proy-icon" style="background:${esc(p.color)}">${iconoProyecto(p.icono)}</span>
        <button type="button" class="proy-card-menu" title="Eliminar" onclick="event.stopPropagation();eliminarProyecto('${p.id}')">×</button>
      </div>
      <h3 class="proy-card-title">${esc(p.nombre)}</h3>
      ${p.descripcion ? `<p class="proy-card-desc">${esc(p.descripcion)}</p>` : ''}
      <div class="proy-card-meta">
        <span>${ts.length} tarea${ts.length===1?'':'s'}</span>
        <span>${pct}%</span>
      </div>
      <div class="proy-progress"><div class="proy-progress-fill" style="width:${pct}%;background:${esc(p.color)}"></div></div>
      <div class="proy-card-foot">
        <div class="kb-avatars">${avatars}${more}</div>
      </div>
    </article>`;
  }).join('');
}

function iconoProyecto(kind){
  if(kind === 'star') return '★';
  if(kind === 'bolt') return '⚡';
  if(kind === 'target') return '◎';
  return '▣';
}

function toggleFormProyecto(abrir){
  const panel = document.getElementById('proy-form-panel');
  if(!panel) return;
  const open = abrir === true || (abrir !== false && !panel.classList.contains('open'));
  panel.classList.toggle('open', open);
  if(open){
    document.getElementById('proy-nombre').value = '';
    document.getElementById('proy-desc').value = '';
    document.getElementById('proy-color').value = PROYECTO_COLORES[0];
    document.getElementById('proy-icono').value = 'folder';
    renderProyColorPicker();
    document.getElementById('proy-nombre')?.focus();
  }
}

function renderProyColorPicker(){
  const wrap = document.getElementById('proy-color-picker');
  const cur = document.getElementById('proy-color')?.value || PROYECTO_COLORES[0];
  if(!wrap) return;
  wrap.innerHTML = PROYECTO_COLORES.map(c =>
    `<button type="button" class="proy-swatch${c===cur?' active':''}" style="background:${c}" onclick="document.getElementById('proy-color').value='${c}';renderProyColorPicker()"></button>`
  ).join('');
}

async function crearProyecto(){
  if(!requiereSupabase()) return;
  const nombre = document.getElementById('proy-nombre').value.trim();
  const descripcion = document.getElementById('proy-desc').value.trim() || null;
  const color = document.getElementById('proy-color').value || PROYECTO_COLORES[0];
  const icono = document.getElementById('proy-icono').value || 'folder';
  if(!nombre){ toast('Ingresá el nombre del proyecto'); return; }
  const btn = document.getElementById('btn-proy-add');
  if(btn){ btn.disabled = true; btn.textContent = 'Creando…'; }
  const { data: proy, error } = await sb.from('proyectos').insert({ nombre, descripcion, color, icono }).select().single();
  if(error){
    toast(supabaseErrMsg(error));
  } else {
    const rows = ESTADOS_DEFAULT.map(e => ({ ...e, proyecto_id: proy.id }));
    const { error: e2 } = await sb.from('proyecto_estados').insert(rows);
    if(e2) toast(supabaseErrMsg(e2));
    else toast('Proyecto creado');
    toggleFormProyecto(false);
    await cargarProyectos();
  }
  if(btn){ btn.disabled = false; btn.textContent = '+ Crear proyecto'; }
}

async function eliminarProyecto(id){
  if(!requiereSupabase()) return;
  const p = todosProyectos.find(x => x.id === id);
  if(!confirm(`¿Eliminar el proyecto «${p?.nombre || ''}» y todas sus tareas?`)) return;
  const { error } = await sb.from('proyectos').delete().eq('id', id);
  if(error){ toast(supabaseErrMsg(error)); return; }
  toast('Proyecto eliminado');
  if(proyectoActual?.id === id) proyectoActual = null;
  await cargarProyectos();
}

async function abrirProyecto(id){
  if(!requiereSupabase()) return;
  let p = todosProyectos.find(x => x.id === id);
  if(!p){
    const { data } = await sb.from('proyectos').select('*').eq('id', id).single();
    p = data;
  }
  if(!p){ toast('Proyecto no encontrado'); return; }
  proyectoActual = p;
  await cargarEstadosProyecto(id);
  mostrarCapaProyectos(false);
  const title = document.getElementById('kanban-board-title');
  if(title) title.textContent = p.nombre;
  const tag = document.getElementById('kanban-org-tag');
  if(tag) tag.textContent = 'CMR Software';
  const backColor = document.getElementById('proy-back-dot');
  if(backColor) backColor.style.background = p.color;
  poblarSelectEstadosTarea();
  await cargarTareas();
}

async function cargarEstadosProyecto(proyectoId){
  const { data, error } = await sb.from('proyecto_estados').select('*').eq('proyecto_id', proyectoId).order('orden', { ascending: true });
  if(error){ toast(supabaseErrMsg(error)); estadosProyecto = []; return; }
  estadosProyecto = data || [];
  if(!estadosProyecto.length){
    const rows = ESTADOS_DEFAULT.map(e => ({ ...e, proyecto_id: proyectoId }));
    const { data: created } = await sb.from('proyecto_estados').insert(rows).select();
    estadosProyecto = created || [];
  }
}

function volverAProyectos(){
  proyectoActual = null;
  estadosProyecto = [];
  cargarProyectos();
}

function poblarSelectEstadosTarea(){
  const et = document.getElementById('et-estado');
  if(!et) return;
  const cur = et.value;
  et.innerHTML = estadosProyecto.map(e => `<option value="${esc(e.nombre)}">${esc(e.nombre)}</option>`).join('');
  if(cur && [...et.options].some(o => o.value === cur)) et.value = cur;
}

function abrirModalEstados(){
  if(!proyectoActual){ toast('Abrí un proyecto primero'); return; }
  renderEditorEstados();
  document.getElementById('modal-estados')?.classList.add('open');
}
function cerrarModalEstados(){
  document.getElementById('modal-estados')?.classList.remove('open');
}

function renderEditorEstados(){
  const list = document.getElementById('estados-editor-list');
  if(!list) return;
  list.innerHTML = estadosProyecto.map(e => `
    <div class="est-row" draggable="true" data-id="${e.id}"
      ondragstart="onEstDragStart(event)" ondragover="onEstDragOver(event)" ondrop="onEstDrop(event)" ondragend="onEstDragEnd(event)">
      <span class="est-drag" title="Arrastrar">⠿</span>
      <input type="color" value="${esc(e.color)}" onchange="actualizarEstadoCampo('${e.id}','color',this.value)" title="Color">
      <input type="text" class="est-nombre" value="${esc(e.nombre)}" onchange="actualizarEstadoCampo('${e.id}','nombre',this.value)" placeholder="Nombre">
      <label class="est-final"><input type="checkbox" ${e.es_final?'checked':''} onchange="actualizarEstadoCampo('${e.id}','es_final',this.checked)"> Final</label>
      <button type="button" class="btn-ghost-danger" title="Eliminar" onclick="eliminarEstadoProyecto('${e.id}')">×</button>
    </div>
  `).join('') || '<p class="info-empty">Sin estados. Agregá uno.</p>';
}

function onEstDragStart(e){
  const row = e.target.closest('.est-row');
  if(!row) return;
  dragEstadoId = row.dataset.id;
  row.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}
function onEstDragOver(e){ e.preventDefault(); e.currentTarget.classList.add('drag-over'); }
function onEstDragEnd(e){
  e.target.closest('.est-row')?.classList.remove('dragging');
  document.querySelectorAll('.est-row.drag-over').forEach(r => r.classList.remove('drag-over'));
  dragEstadoId = null;
}
async function onEstDrop(e){
  e.preventDefault();
  const target = e.currentTarget;
  target.classList.remove('drag-over');
  const toId = target.dataset.id;
  if(!dragEstadoId || dragEstadoId === toId) return;
  const from = estadosProyecto.findIndex(x => x.id === dragEstadoId);
  const to = estadosProyecto.findIndex(x => x.id === toId);
  if(from < 0 || to < 0) return;
  const [item] = estadosProyecto.splice(from, 1);
  estadosProyecto.splice(to, 0, item);
  await persistirOrdenEstados();
  renderEditorEstados();
  if(typeof renderVistaTareas === 'function') renderVistaTareas(todasTareas);
}

async function persistirOrdenEstados(){
  for(let i=0;i<estadosProyecto.length;i++){
    estadosProyecto[i].orden = i;
    await sb.from('proyecto_estados').update({ orden: i }).eq('id', estadosProyecto[i].id);
  }
}

async function actualizarEstadoCampo(id, campo, valor){
  if(!requiereSupabase()) return;
  const e = estadosProyecto.find(x => x.id === id);
  if(!e) return;
  const prevNombre = e.nombre;
  if(campo === 'nombre'){
    valor = String(valor||'').trim();
    if(!valor){ toast('Nombre requerido'); renderEditorEstados(); return; }
  }
  const patch = { [campo]: valor };
  const { error } = await sb.from('proyecto_estados').update(patch).eq('id', id);
  if(error){ toast(supabaseErrMsg(error)); renderEditorEstados(); return; }
  e[campo] = valor;
  if(campo === 'nombre' && prevNombre !== valor){
    await sb.from('tareas').update({ estado: valor }).eq('estado_id', id);
    todasTareas.forEach(t => { if(t.estado_id === id) t.estado = valor; });
  }
  if(campo === 'es_final'){
    await sb.from('tareas').update({ estado_final: !!valor }).eq('estado_id', id);
    todasTareas.forEach(t => { if(t.estado_id === id) t.estado_final = !!valor; });
  }
  poblarSelectEstadosTarea();
  if(typeof renderVistaTareas === 'function') renderVistaTareas(todasTareas);
}

async function agregarEstadoProyecto(){
  if(!proyectoActual || !requiereSupabase()) return;
  const nombre = `Estado ${estadosProyecto.length + 1}`;
  const color = PROYECTO_COLORES[estadosProyecto.length % PROYECTO_COLORES.length];
  const orden = estadosProyecto.length;
  const { data, error } = await sb.from('proyecto_estados').insert({
    proyecto_id: proyectoActual.id, nombre, color, orden, es_final: false
  }).select().single();
  if(error){ toast(supabaseErrMsg(error)); return; }
  estadosProyecto.push(data);
  renderEditorEstados();
  poblarSelectEstadosTarea();
  if(typeof renderVistaTareas === 'function') renderVistaTareas(todasTareas);
}

async function eliminarEstadoProyecto(id){
  if(!requiereSupabase()) return;
  if(estadosProyecto.length <= 1){ toast('Debe quedar al menos un estado'); return; }
  const e = estadosProyecto.find(x => x.id === id);
  const count = todasTareas.filter(t => t.estado_id === id || t.estado === e?.nombre).length;
  if(count > 0){
    const opciones = estadosProyecto.filter(x => x.id !== id);
    const nombres = opciones.map((x,i) => `${i+1}. ${x.nombre}`).join('\n');
    const pick = prompt(`Hay ${count} tarea(s) en «${e.nombre}».\nElegí a qué estado moverlas (número):\n${nombres}`, '1');
    if(pick === null) return;
    const idx = Math.max(0, (parseInt(pick,10)||1) - 1);
    const destino = opciones[idx] || opciones[0];
    if(!destino) return;
    const { error } = await sb.from('tareas').update({
      estado_id: destino.id, estado: destino.nombre, estado_final: !!destino.es_final
    }).eq('estado_id', id);
    if(error){
      await sb.from('tareas').update({
        estado_id: destino.id, estado: destino.nombre, estado_final: !!destino.es_final
      }).eq('proyecto_id', proyectoActual.id).eq('estado', e.nombre);
    }
  }
  const { error: delErr } = await sb.from('proyecto_estados').delete().eq('id', id);
  if(delErr){ toast(supabaseErrMsg(delErr)); return; }
  estadosProyecto = estadosProyecto.filter(x => x.id !== id);
  await persistirOrdenEstados();
  toast('Estado eliminado');
  renderEditorEstados();
  poblarSelectEstadosTarea();
  await cargarTareas();
}
