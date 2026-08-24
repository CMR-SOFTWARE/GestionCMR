// ─── Movimientos: sync, CRUD, tabla, totales ───

const LABEL_TIPO_PAGO = {
  'seña': 'Seña',
  pago_parcial: 'Parcial',
  pago_total: 'Total',
  mensual: 'Mensual',
  otro: 'Otro'
};

let presupuestosParaMov = [];

function badgeTipoPago(tp){
  const v = tp || 'pago_total';
  const lbl = LABEL_TIPO_PAGO[v] || v;
  const cls = v === 'mensual' ? 'pill-vigente'
    : (v === 'seña' || v === 'pago_parcial') ? 'pill-alerta'
    : v === 'otro' ? 'pill-inactivo'
    : 'pill-ing';
  return `<span class="pill ${cls} pill-tipo-pago">${lbl}</span>`;
}

function idTipoPago(prefix){
  return prefix ? prefix + 'tipo-pago' : 'tipo-pago';
}

function toggleDocPresupuestoMov(prefix){
  const sel = document.getElementById(idTipoPago(prefix));
  const v = sel?.value || 'pago_total';
  const show = v === 'seña' || v === 'pago_parcial';
  const wrap = document.getElementById(prefix ? prefix + 'doc-wrap' : 'doc-presupuesto-wrap');
  if(wrap) wrap.style.display = show ? 'block' : 'none';
}

async function cargarPresupuestosParaMov(){
  if(!sb || !supabaseConectado) return;
  let q = sb.from('documentos').select('id, numero, cliente, cliente_id').eq('tipo', 'presupuesto').order('created_at', { ascending: false }).limit(100);
  let { data, error } = await q;
  if(error && esColumnaFaltante(error, 'cliente_id')){
    ({ data, error } = await sb.from('documentos').select('id, numero, cliente').eq('tipo', 'presupuesto').order('created_at', { ascending: false }).limit(100));
  }
  if(error){
    console.warn('[Presupuestos mov]', error);
    return;
  }
  presupuestosParaMov = data || [];
  ['doc-presupuesto', 'em-doc-presupuesto'].forEach(id => {
    const el = document.getElementById(id);
    if(!el) return;
    const cur = el.value;
    el.innerHTML = '<option value="">— Sin vínculo —</option>' +
      presupuestosParaMov.map(p =>
        `<option value="${p.id}">${esc(p.numero)} — ${esc(p.cliente)}</option>`
      ).join('');
    if(cur) el.value = cur;
  });
  poblarSelectClientes('mov-cliente');
  poblarSelectClientes('em-cliente');
}

function leerDocumentoIdMov(prefix){
  const id = prefix ? prefix + 'doc-presupuesto' : 'doc-presupuesto';
  const el = document.getElementById(id);
  const v = el?.value || '';
  return v || null;
}

function leerClienteIdMov(prefix){
  const el = document.getElementById(prefix ? prefix + 'cliente' : 'mov-cliente');
  const v = el?.value || '';
  return v ? Number(v) : null;
}

function onDocPresupuestoChange(prefix){
  const docId = leerDocumentoIdMov(prefix);
  const sel = document.getElementById(prefix ? prefix + 'cliente' : 'mov-cliente');
  if(!docId || !sel) return;
  const p = presupuestosParaMov.find(x => String(x.id) === String(docId));
  if(!p) return;
  if(p.cliente_id){
    sel.value = String(p.cliente_id);
    return;
  }
  if(p.cliente && typeof resolverClienteIdPorNombre === 'function'){
    resolverClienteIdPorNombre(p.cliente).then(id => { if(id) sel.value = String(id); });
  }
}

async function clienteIdParaMovimiento(descripcion, documentoId, explicitId){
  if(explicitId) return Number(explicitId);
  if(documentoId){
    const { data } = await sb.from('documentos').select('cliente_id,cliente').eq('id', documentoId).maybeSingle();
    if(data?.cliente_id) return data.cliente_id;
    if(data?.cliente && typeof resolverClienteIdPorNombre === 'function')
      return await resolverClienteIdPorNombre(data.cliente);
  }
  if(typeof resolverClienteIdPorNombre === 'function')
    return await resolverClienteIdPorNombre(descripcion);
  return null;
}

function nombreClienteDeMov(clienteId){
  if(!clienteId) return '';
  const lista = (typeof clientesCompletos !== 'undefined' && clientesCompletos.length) ? clientesCompletos : [];
  return lista.find(c => Number(c.id) === Number(clienteId))?.nombre || '';
}

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
  const tipoPago = document.getElementById('tipo-pago')?.value || 'pago_total';
  const monto = parseFloat(document.getElementById('monto').value);
  const cotizacionUsd = parseFloat(document.getElementById('cotizacion-usd')?.value);
  const documento_id = leerDocumentoIdMov('');
  if(!desc)         { toast('Completá la descripción'); return; }
  if(!monto||monto<=0){ toast('Ingresá un monto válido'); return; }

  const btn = document.getElementById('btn-agregar');
  btn.disabled = true; btn.textContent = 'Guardando…';

  const hoy = new Date().toISOString().slice(0,10);
  const row = { fecha:hoy, tipo, descripcion:desc, categoria:cat, tipo_pago: tipoPago, monto, socio:sesion };
  if(documento_id) row.documento_id = documento_id;
  if(cotizacionUsd > 0) row.cotizacion_usd = cotizacionUsd;
  const clienteId = await clienteIdParaMovimiento(desc, documento_id, leerClienteIdMov(''));
  if(clienteId) row.cliente_id = clienteId;

  let { error } = await sb.from('movimientos').insert(row);
  if(error && esColumnaFaltante(error, 'cliente_id')){
    delete row.cliente_id;
    ({ error } = await sb.from('movimientos').insert(row));
  }
  if(error && esColumnaFaltante(error, 'cotizacion_usd')){
    delete row.cotizacion_usd;
    ({ error } = await sb.from('movimientos').insert(row));
  }
  if(error){ toast(supabaseErrMsg(error)); console.error('[Supabase]', error); }
  else{
    document.getElementById('desc').value = '';
    document.getElementById('monto').value = '';
    document.getElementById('cotizacion-usd').value = '';
    document.getElementById('tipo-pago').value = 'pago_total';
    document.getElementById('doc-presupuesto').value = '';
    const mc = document.getElementById('mov-cliente');
    if(mc) mc.value = '';
    toggleDocPresupuestoMov('');
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
      <td>${esc(r.descripcion)}${nombreClienteDeMov(r.cliente_id) ? `<div class="cliente-contacto">${esc(nombreClienteDeMov(r.cliente_id))}</div>` : ''}</td>
      <td class="hide-mob" style="font-size:12px;color:#888">${esc(r.categoria)}</td>
      <td class="hide-mob">${badgeTipoPago(r.tipo_pago)}</td>
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

async function editarMovimiento(id){
  const mov = todosLosDatos.find(r => r.id === id);
  if(!mov){ toast('No se encontró el movimiento'); return; }
  await cargarPresupuestosParaMov();
  poblarSelectClientes('em-cliente');
  editandoMovId = id;
  document.getElementById('em-tipo').value = mov.tipo;
  document.getElementById('em-monto').value = mov.monto;
  document.getElementById('em-desc').value = mov.descripcion;
  document.getElementById('em-cat').value = mov.categoria;
  document.getElementById('em-tipo-pago').value = mov.tipo_pago || 'pago_total';
  document.getElementById('em-fecha').value = mov.fecha;
  document.getElementById('em-socio').value = mov.socio;
  document.getElementById('em-doc-presupuesto').value = mov.documento_id || '';
  document.getElementById('em-cotizacion-usd').value = mov.cotizacion_usd || '';
  const emCli = document.getElementById('em-cliente');
  if(emCli) emCli.value = mov.cliente_id ? String(mov.cliente_id) : '';
  toggleDocPresupuestoMov('em-');
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
  const tipo_pago = document.getElementById('em-tipo-pago')?.value || 'pago_total';
  const fecha = document.getElementById('em-fecha').value;
  const socio = document.getElementById('em-socio').value;
  const documento_id = leerDocumentoIdMov('em-') || null;
  const cotizacionUsd = parseFloat(document.getElementById('em-cotizacion-usd')?.value);
  if(!desc){ toast('Completá la descripción'); return; }
  if(!monto||monto<=0){ toast('Ingresá un monto válido'); return; }
  if(!fecha){ toast('Elegí la fecha'); return; }

  const btn = document.getElementById('btn-guardar-mov');
  btn.disabled = true; btn.textContent = 'Guardando…';
  const patch = { tipo, monto, descripcion: desc, categoria: cat, tipo_pago, fecha, socio, documento_id, cotizacion_usd: cotizacionUsd > 0 ? cotizacionUsd : null };
  const clienteId = await clienteIdParaMovimiento(desc, documento_id, leerClienteIdMov('em-'));
  if(clienteId) patch.cliente_id = clienteId;
  else patch.cliente_id = null;
  let { error } = await sb.from('movimientos').update(patch).eq('id', editandoMovId);
  if(error && esColumnaFaltante(error, 'cliente_id')){
    delete patch.cliente_id;
    ({ error } = await sb.from('movimientos').update(patch).eq('id', editandoMovId));
  }
  if(error && esColumnaFaltante(error, 'cotizacion_usd')){
    delete patch.cotizacion_usd;
    ({ error } = await sb.from('movimientos').update(patch).eq('id', editandoMovId));
  }
  if(error){ toast(supabaseErrMsg(error)); console.error(error); }
  else{
    toast('Movimiento actualizado');
    cerrarModalMov();
    await Promise.all([cargarDatos(), poblarMeses()]);
  }
  btn.disabled = false; btn.textContent = 'Guardar cambios';
}

function buscarDebounce(){ clearTimeout(buscarTimer); buscarTimer = setTimeout(cargarDatos, 350); }

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('modal-mov')?.addEventListener('click', e => {
    if(e.target.id === 'modal-mov') cerrarModalMov();
  });
});
