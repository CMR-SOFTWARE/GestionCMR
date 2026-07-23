// ─── Movimientos: sync, CRUD, tabla, totales ───

async function cargarDatos(){
  if(!sb || !requiereSupabase()) return;
  setSyncStatus(true, 'Sincronizando…');
  const fTipo   = document.getElementById('f-tipo').value;
  const fSocio  = document.getElementById('f-socio').value;
  const fMes    = document.getElementById('mes-sel').value;
  const fBus    = document.getElementById('f-buscar').value.trim();

  let q = sb.from('movimientos').select('*').order('fecha', {ascending:false}).order('id', {ascending:false});
  if(fTipo)  q = q.eq('tipo', fTipo);
  if(fSocio) q = q.eq('socio', fSocio);
  if(fMes){  q = q.gte('fecha', fMes+'-01').lte('fecha', fMes+'-31'); }
  if(fBus)   q = q.ilike('descripcion', `%${fBus}%`);

  const { data, error } = await q;
  if(error){
    supabaseConectado = false;
    setSyncStatus(false, 'Error de conexión');
    console.error('[Supabase]', error);
    toast(supabaseErrMsg(error));
    return;
  }
  todosLosDatos = data || [];
  supabaseConectado = true;
  setSyncStatus(true, 'Sincronizado');
  renderTabla(data);
  actualizarTotales(data);
}

async function agregar(){
  if(!requiereSupabase()) return;
  const tipo  = document.getElementById('tipo').value;
  const desc  = document.getElementById('desc').value.trim();
  const cat   = document.getElementById('cat').value;
  const monto = parseFloat(document.getElementById('monto').value);
  if(!desc)         { toast('Completá la descripción'); return; }
  if(!monto||monto<=0){ toast('Ingresá un monto válido'); return; }

  const btn = document.getElementById('btn-agregar');
  btn.disabled = true; btn.textContent = 'Guardando…';

  const hoy = new Date().toISOString().slice(0,10);
  const { error } = await sb.from('movimientos').insert({ fecha:hoy, tipo, descripcion:desc, categoria:cat, monto, socio:sesion });
  if(error){ toast(supabaseErrMsg(error)); console.error('[Supabase]', error); }
  else{
    document.getElementById('desc').value = '';
    document.getElementById('monto').value = '';
    toast('Movimiento guardado');
    await Promise.all([cargarDatos(), poblarMeses()]);
  }
  btn.disabled = false; btn.textContent = '+ Agregar movimiento';
}

async function eliminar(id, socioOwner){
  if(!requiereSupabase()) return;
  if(socioOwner !== sesion){ toast('Solo podés eliminar tus propios movimientos'); return; }
  if(!confirm('¿Eliminar este movimiento?')) return;
  const { error } = await sb.from('movimientos').delete().eq('id', id);
  if(error){ toast(supabaseErrMsg(error)); return; }
  toast('Eliminado');
  await Promise.all([cargarDatos(), poblarMeses()]);
}

async function limpiarTodo(){
  if(!requiereSupabase()) return;
  if(!confirm('¿Borrar TODOS los movimientos? Esta acción no se puede deshacer.')) return;
  const { error } = await sb.from('movimientos').delete().gt('id', 0);
  if(error){ toast(supabaseErrMsg(error)); return; }
  toast('Todos los movimientos eliminados');
  await Promise.all([cargarDatos(), poblarMeses()]);
}

// ─── meses ───────────────────────────────
async function poblarMeses(){
  if(!sb || !supabaseConectado) return;
  const { data, error } = await sb.from('movimientos').select('fecha').order('fecha', {ascending:false});
  if(error || !data) return;
  const sel = document.getElementById('mes-sel');
  const actual = sel.value;
  while(sel.options.length > 1) sel.remove(1);
  const meses = [...new Set(data.map(r=>r.fecha.slice(0,7)))].sort((a,b)=>b.localeCompare(a));
  meses.forEach(m=>{ const o=document.createElement('option'); o.value=m; o.textContent=m; sel.add(o); });
  if(actual) sel.value = actual;
}

// ─── render ──────────────────────────────
function fmt(n){ return '$ '+Number(n).toLocaleString('es-AR',{minimumFractionDigits:0,maximumFractionDigits:2}); }

function actualizarTotales(datos){
  let ing=0, gas=0;
  datos.forEach(r=>{ if(r.tipo==='ingreso') ing+=Number(r.monto); else gas+=Number(r.monto); });
  document.getElementById('total-ing').textContent = fmt(ing);
  document.getElementById('total-gas').textContent = fmt(gas);
  const bal = ing-gas;
  const el = document.getElementById('balance');
  el.textContent = fmt(bal);
  el.className = 'stat-val '+(bal>0?'val-green':bal<0?'val-red':'val-neutral');
}

function renderTabla(datos){
  const tbody = document.getElementById('tabla');
  const empty = document.getElementById('empty-msg');
  if(!datos.length){ tbody.innerHTML=''; empty.style.display='block'; return; }
  empty.style.display='none';
  tbody.innerHTML = datos.map(r=>{
    const u = USUARIOS[r.socio]||{nombre:r.socio, color:'#aaa'};
    const esMio = r.socio === sesion;
    const socioPill = `<span class="socio-pill" style="font-size:11px;padding:2px 8px;border-radius:12px;font-weight:500;background:${u.color}22;color:${u.color}" onclick="editarMovimiento(${r.id})" title="Clic para editar">${u.nombre}</span>`;
    return `<tr>
      <td style="font-size:12px;color:#888">${r.fecha}</td>
      <td><span class="pill ${r.tipo==='ingreso'?'pill-ing':'pill-gas'}">${r.tipo==='ingreso'?'Ingreso':'Gasto'}</span></td>
      <td>${esc(r.descripcion)}</td>
      <td class="hide-mob" style="font-size:12px;color:#888">${esc(r.categoria)}</td>
      <td class="hide-mob">${socioPill}</td>
      <td style="text-align:right" class="${r.tipo==='ingreso'?'monto-ing':'monto-gas'}">${r.tipo==='gasto'?'− ':'+ '}${fmt(r.monto)}</td>
      <td><div class="acciones-cell">
        <button class="btn-ghost-edit" onclick="editarMovimiento(${r.id})" title="Editar">✎</button>
        ${esMio?`<button class="btn-ghost-danger" onclick="eliminar(${r.id},'${r.socio}')">×</button>`:''}
      </div></td>
    </tr>`;
  }).join('');
}

let editandoMovId = null;

function editarMovimiento(id){
  const mov = todosLosDatos.find(r => r.id === id);
  if(!mov){ toast('No se encontró el movimiento'); return; }
  editandoMovId = id;
  document.getElementById('em-tipo').value = mov.tipo;
  document.getElementById('em-monto').value = mov.monto;
  document.getElementById('em-desc').value = mov.descripcion;
  document.getElementById('em-cat').value = mov.categoria;
  document.getElementById('em-fecha').value = mov.fecha;
  document.getElementById('em-socio').value = mov.socio;
  document.getElementById('modal-mov').classList.add('open');
}

function cerrarModalMov(){
  document.getElementById('modal-mov').classList.remove('open');
  editandoMovId = null;
}

async function guardarMovimiento(){
  if(!editandoMovId || !requiereSupabase()) return;
  const tipo = document.getElementById('em-tipo').value;
  const monto = parseFloat(document.getElementById('em-monto').value);
  const desc = document.getElementById('em-desc').value.trim();
  const cat = document.getElementById('em-cat').value;
  const fecha = document.getElementById('em-fecha').value;
  const socio = document.getElementById('em-socio').value;
  if(!desc){ toast('Completá la descripción'); return; }
  if(!monto||monto<=0){ toast('Ingresá un monto válido'); return; }
  if(!fecha){ toast('Elegí la fecha'); return; }

  const btn = document.getElementById('btn-guardar-mov');
  btn.disabled = true; btn.textContent = 'Guardando…';
  const { error } = await sb.from('movimientos').update({ tipo, monto, descripcion: desc, categoria: cat, fecha, socio }).eq('id', editandoMovId);
  if(error){ toast(supabaseErrMsg(error)); console.error(error); }
  else{
    toast('Movimiento actualizado');
    cerrarModalMov();
    await Promise.all([cargarDatos(), poblarMeses()]);
  }
  btn.disabled = false; btn.textContent = 'Guardar cambios';
}

function buscarDebounce(){ clearTimeout(buscarTimer); buscarTimer = setTimeout(cargarDatos, 350); }
