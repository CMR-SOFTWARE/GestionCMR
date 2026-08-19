// ─── Clientes y renovaciones ───
// ─── clientes ────────────────────────────
let todosClientes = [];
let editandoClienteId = null;
let buscarClientesTimer = null;

function setDefaultFechaVence(){
  const el = document.getElementById('cl-vence');
  if(!el || el.value) return;
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  el.value = d.toISOString().slice(0, 10);
}


const GRACIA_RENOV_DIAS = 5;
let clientesCompletos = [];

function sumarPeriodo(fechaStr, periodicidad){
  if(periodicidad === 'unico') return fechaStr;
  const d = new Date(fechaStr + 'T12:00:00');
  if(periodicidad === 'semestral' || periodicidad === 'trimestral') d.setMonth(d.getMonth() + 6);
  else if(periodicidad === 'anual') d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

function esPeriodicoUnico(c){
  return (c.periodicidad || 'mensual') === 'unico';
}

function labelPeriodicidad(per){
  return { mensual:'Mensual', semestral:'Semestral', anual:'Anual', unico:'Único' }[per] || per;
}

function pagoConfirmado(c){
  return c.pago_confirmado !== false;
}

function mantenimientoActivo(c){
  return c.mantenimiento_activo !== false;
}

function estadoCliente(c){
  if(!c.activo) return { key:'inactivo', label:'Inactivo', cls:'pill-inactivo', diff:0, daysPast:0, needsRenewal:false };
  if(!mantenimientoActivo(c))
    return { key:'proyecto', label:'Proyecto en curso', cls:'pill-est-progreso', diff:0, daysPast:0, needsRenewal:false };
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const v = new Date(c.fecha_vencimiento + 'T00:00:00');
  const diff = Math.ceil((v - hoy) / 86400000);
  const daysPast = diff < 0 ? -diff : 0;
  if(!pagoConfirmado(c))
    return { key:'pendiente_pago', label:'Pago pendiente', cls:'pill-pendiente-pago', diff, daysPast, needsRenewal:true };
  if(esPeriodicoUnico(c))
    return { key:'unico', label:'Pago único', cls:'pill-inactivo', diff, daysPast, needsRenewal:false };
  if(diff < 0 && daysPast > GRACIA_RENOV_DIAS)
    return { key:'vencido', label:'Fuera de gracia', cls:'pill-fuera-gracia', diff, daysPast, needsRenewal:true };
  if(diff <= 0)
    return { key:'en_gracia', label: daysPast === 0 ? 'Vence hoy' : `Gracia ${daysPast}/${GRACIA_RENOV_DIAS}d`, cls:'pill-gracia', diff, daysPast, needsRenewal:true };
  if(diff <= 7)
    return { key:'alerta', label:`Vence en ${diff}d`, cls:'pill-alerta', diff, daysPast, needsRenewal:false };
  return { key:'vigente', label:'Vigente', cls:'pill-vigente', diff, daysPast, needsRenewal:false };
}

function actualizarBannerRenovaciones(lista){
  const banner = document.getElementById('banner-renovaciones');
  const textEl = document.getElementById('banner-renov-text');
  if(!banner || !textEl) return;
  const n = (lista||[]).filter(c => c.activo && mantenimientoActivo(c) && estadoCliente(c).needsRenewal).length;
  if(n > 0){
    banner.classList.add('show');
    textEl.textContent = n === 1
      ? 'Hay 1 cliente con pago pendiente de confirmar.'
      : `Hay ${n} clientes con pago pendiente de confirmar.`;
  } else banner.classList.remove('show');
}

function renderPanelRenovaciones(lista){
  const panel = document.getElementById('panel-renovaciones');
  const inner = document.getElementById('renew-list');
  if(!panel || !inner) return;
  const pend = (lista||[]).filter(c => c.activo && mantenimientoActivo(c) && estadoCliente(c).needsRenewal);
  if(!pend.length){ panel.style.display = 'none'; return; }
  panel.style.display = 'block';
  inner.innerHTML = pend.map(c => {
    const e = estadoCliente(c);
    const per = c.periodicidad || 'mensual';
    const perLbl = labelPeriodicidad(per);
    const rest = GRACIA_RENOV_DIAS - e.daysPast;
    let msg;
    if(e.key === 'pendiente_pago')
      msg = esPeriodicoUnico(c)
        ? `Pago único pendiente. ¿Confirmó el cobro de ${fmt(c.monto_plan)}? No se repetirá automáticamente.`
        : `Alta nueva. ¿Confirmó el primer pago? Se registrará el ingreso y el servicio queda vigente hasta el ${c.fecha_vencimiento}.`;
    else if(e.key === 'vencido')
      msg = `Superó los ${GRACIA_RENOV_DIAS} días de gracia. Confirmá el pago o dá de baja el sistema.`;
    else if(e.daysPast === 0)
      msg = `El plan vence hoy (${c.fecha_vencimiento}). ¿El cliente abonó la renovación ${per}?`;
    else
      msg = `Venció el ${c.fecha_vencimiento} (hace ${e.daysPast} día(s)). Quedan ${rest} día(s) de gracia antes de dar de baja.`;
    const border = e.key === 'vencido' ? '#e53e3e' : e.key === 'pendiente_pago' ? '#1a6fc4' : '#c47a0a';
    return `<div class="renew-card" style="border-left-color:${border}">
      <div>
        <h4>${esc(c.nombre)}</h4>
        <p>${msg}</p>
        <div class="renew-meta">${esc(c.plan)} · ${fmt(c.monto_plan)} · ${e.key === 'pendiente_pago' ? (esPeriodicoUnico(c) ? 'Pago único' : 'Primer pago') : 'Renovación'} ${perLbl}</div>
      </div>
      <div class="renew-actions">
        <button class="btn-renov-ok" onclick="confirmarRenovacionCliente(${c.id})">✓ Confirmó el pago</button>
        <button class="btn-renov-no" onclick="darDeBajaCliente(${c.id})">No renovó / Dar de baja</button>
      </div>
    </div>`;
  }).join('');
}

async function confirmarRenovacionCliente(id){
  if(!requiereSupabase()) return;
  const { data: c, error } = await sb.from('clientes').select('*').eq('id', id).single();
  if(error || !c){ toast('No se pudo cargar el cliente'); return; }
  if(!mantenimientoActivo(c)){
    toast('Este cliente tiene mantenimiento inactivo (proyecto en curso). Activá el mantenimiento antes de registrar cobros recurrentes.');
    return;
  }
  const per = c.periodicidad || 'mensual';
  if(esPeriodicoUnico(c) && pagoConfirmado(c)){
    toast('Este cliente ya tiene el pago único confirmado.');
    return;
  }
  const esPrimera = !pagoConfirmado(c);
  const nuevaFecha = esPrimera || esPeriodicoUnico(c) ? c.fecha_vencimiento : sumarPeriodo(c.fecha_vencimiento, per);
  const hoy = new Date().toISOString().slice(0, 10);
  const desc = esPeriodicoUnico(c)
    ? `Pago único — ${c.nombre} (${c.plan})`
    : (esPrimera ? `Alta — ${c.nombre} (${c.plan})` : `Renovación — ${c.nombre} (${c.plan})`);
  const monto = Number(c.monto_plan) || 0;
  const tipoPagoMov = esPeriodicoUnico(c) ? 'pago_total' : (per === 'mensual' ? 'mensual' : 'pago_total');
  const catMov = esPeriodicoUnico(c) ? 'Proyecto' : 'Mantenimiento';
  const msgConfirm = esPeriodicoUnico(c)
    ? `¿Confirmar pago único de ${fmt(monto)}? No se generarán renovaciones automáticas.`
    : (esPrimera
      ? `¿Confirmar primer pago de ${fmt(monto)}? El vencimiento queda el ${c.fecha_vencimiento}.`
      : `¿Confirmar pago de ${fmt(monto)} y extender vencimiento al ${nuevaFecha}?`);
  if(!confirm(msgConfirm)) return;

  const movRow = {
    fecha: hoy, tipo: 'ingreso', descripcion: desc, categoria: catMov, tipo_pago: tipoPagoMov, monto, socio: sesion, cliente_id: c.id
  };
  let { error: eMov } = await sb.from('movimientos').insert(movRow);
  if(eMov && esColumnaFaltante(eMov, 'cliente_id')){
    delete movRow.cliente_id;
    ({ error: eMov } = await sb.from('movimientos').insert(movRow));
  }
  if(eMov){ toast(supabaseErrMsg(eMov)); return; }

  const upd = {
    fecha_vencimiento: nuevaFecha, pago_confirmado: true, activo: true, updated_at: new Date().toISOString()
  };
  if(esPrimera) upd.fecha_confirmacion_pago = new Date().toISOString();

  const { error: eCl } = await sb.from('clientes').update(upd).eq('id', id);
  if(eCl){ toast(supabaseErrMsg(eCl)); return; }

  toast(esPeriodicoUnico(c) ? 'Pago único confirmado — ingreso registrado' : (esPrimera ? 'Primer pago confirmado — ingreso registrado en Movimientos' : 'Renovación confirmada — ingreso registrado en Movimientos'));
  const promesas = [cargarClientes(), cargarDatos(), poblarMeses()];
  if(document.getElementById('page-estadisticas')?.classList.contains('active')) promesas.push(cargarEstadisticas());
  if(typeof verificarRecordatoriosPendientes === 'function') promesas.push(verificarRecordatoriosPendientes());
  await Promise.all(promesas);
}

async function darDeBajaCliente(id){
  if(!requiereSupabase()) return;
  const { data: c } = await sb.from('clientes').select('nombre').eq('id', id).single();
  const nombre = c?.nombre || 'este cliente';
  if(!confirm(`¿Dar de baja a ${nombre}? El sistema quedará marcado como inactivo.`)) return;
  const { error } = await sb.from('clientes').update({ activo: false, updated_at: new Date().toISOString() }).eq('id', id);
  if(error){ toast(supabaseErrMsg(error)); return; }
  toast('Cliente dado de baja');
  const promesas = [cargarClientes()];
  if(document.getElementById('page-estadisticas')?.classList.contains('active')) promesas.push(cargarEstadisticas());
  await Promise.all(promesas);
}

function actualizarStatsClientes(lista){
  let vig=0, alerta=0, gracia=0;
  lista.forEach(c => {
    const e = estadoCliente(c);
    if(e.key === 'vigente') vig++;
    else if(e.key === 'alerta') alerta++;
    else if(e.key === 'en_gracia' || e.key === 'vencido' || e.key === 'pendiente_pago') gracia++;
  });
  document.getElementById('c-total').textContent = lista.length;
  document.getElementById('c-vigentes').textContent = vig;
  document.getElementById('c-alerta').textContent = alerta;
  const elGr = document.getElementById('c-gracia');
  if(elGr) elGr.textContent = gracia;
}

async function cargarClientes(){
  if(!sb || !requiereSupabase()) return;
  const fEst = document.getElementById('f-cl-estado').value;
  const fBus = document.getElementById('f-cl-buscar').value.trim().toLowerCase();

  let q = sb.from('clientes').select('*').order('fecha_vencimiento', { ascending: true });
  const { data, error } = await q;
  if(error){
    toast(supabaseErrMsg(error).replace('movimientos', 'clientes'));
    console.error('[Supabase clientes]', error);
    return;
  }

  let lista = data || [];
  if(fBus) lista = lista.filter(c =>
    c.nombre.toLowerCase().includes(fBus) ||
    (c.contacto || '').toLowerCase().includes(fBus) ||
    c.plan.toLowerCase().includes(fBus)
  );
  if(fEst) lista = lista.filter(c => estadoCliente(c).key === fEst);

  clientesCompletos = data || [];
  todosClientes = lista;
  actualizarStatsClientes(clientesCompletos);
  renderPanelRenovaciones(clientesCompletos);
  actualizarBannerRenovaciones(clientesCompletos);
  renderTablaClientes(lista);
  poblarSelectClientes('proy-cliente');
  poblarSelectClientes('mov-cliente');
  poblarSelectClientes('em-cliente');
  if(typeof verificarRecordatoriosPendientes === 'function') verificarRecordatoriosPendientes();
}

function renderTablaClientes(lista){
  const tbody = document.getElementById('tabla-clientes');
  const empty = document.getElementById('empty-clientes');
  if(!lista.length){
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  tbody.innerHTML = lista.map(c => {
    const e = estadoCliente(c);
    const contacto = c.contacto ? `<div class="cliente-contacto">${esc(c.contacto)}</div>` : '';
    return `<tr class="cliente-row" onclick="onFilaClienteClick(event,${c.id})">
      <td><div class="cliente-nombre">${esc(c.nombre)}</div>${contacto}</td>
      <td>${esc(c.plan)}</td>
      <td class="hide-mob" style="text-align:right;font-weight:600">${fmt(c.monto_plan)}</td>
      <td style="font-size:12px">${c.fecha_vencimiento}</td>
      <td><span class="pill ${e.cls}">${e.label}</span></td>
      <td>
        <button type="button" class="btn-ghost-edit" onclick="event.stopPropagation();abrirEditarCliente(${c.id})" title="Editar">✎</button>
        <button type="button" class="btn-ghost-danger" onclick="event.stopPropagation();eliminarCliente(${c.id})" title="Eliminar">×</button>
      </td>
    </tr>`;
  }).join('');
}

function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'); }

async function agregarCliente(){
  if(!requiereSupabase()) return;
  const nombre = document.getElementById('cl-nombre').value.trim();
  const plan = document.getElementById('cl-plan').value;
  const monto = parseFloat(document.getElementById('cl-monto').value) || 0;
  const fecha_vencimiento = document.getElementById('cl-vence').value;
  const contacto = document.getElementById('cl-contacto').value.trim() || null;
  if(!nombre){ toast('Ingresá el nombre del cliente'); return; }
  if(!fecha_vencimiento){ toast('Elegí la fecha de vencimiento'); return; }

  const btn = document.getElementById('btn-cl-agregar');
  btn.disabled = true; btn.textContent = 'Guardando…';
  const periodicidad = document.getElementById('cl-periodicidad').value;
  const mantenimiento_activo = document.getElementById('cl-mant-activo')?.checked !== false;
  const { error } = await sb.from('clientes').insert({
    nombre, plan, monto_plan: monto, fecha_vencimiento, contacto, periodicidad,
    pago_confirmado: false, activo: true, mantenimiento_activo
  });
  if(error){ toast(supabaseErrMsg(error)); console.error(error); }
  else{
    document.getElementById('cl-nombre').value = '';
    document.getElementById('cl-monto').value = '';
    document.getElementById('cl-contacto').value = '';
    setDefaultFechaVence();
    toast('Cliente agregado — confirmá el primer pago en el panel de arriba');
    const promesas = [cargarClientes()];
    if(document.getElementById('page-estadisticas')?.classList.contains('active')) promesas.push(cargarEstadisticas());
    await Promise.all(promesas);
  }
  btn.disabled = false; btn.textContent = '+ Agregar cliente';
}

async function abrirEditarCliente(id){
  const { data: c, error } = await sb.from('clientes').select('*').eq('id', id).single();
  if(error || !c){ toast('No se pudo cargar el cliente'); return; }
  editandoClienteId = id;
  document.getElementById('ec-nombre').value = c.nombre;
  document.getElementById('ec-plan').value = c.plan;
  document.getElementById('ec-monto').value = c.monto_plan;
  document.getElementById('ec-vence').value = c.fecha_vencimiento;
  document.getElementById('ec-contacto').value = c.contacto || '';
  document.getElementById('ec-notas').value = c.notas || '';
  document.getElementById('ec-activo').value = c.activo ? 'true' : 'false';
  const ecMant = document.getElementById('ec-mant-activo');
  if(ecMant) ecMant.value = mantenimientoActivo(c) ? 'true' : 'false';
  const ecPer = document.getElementById('ec-periodicidad');
  if(ecPer) ecPer.value = c.periodicidad || 'mensual';
  document.getElementById('modal-cliente').classList.add('open');
}

function cerrarModalCliente(){
  document.getElementById('modal-cliente').classList.remove('open');
  editandoClienteId = null;
}

async function guardarClienteEditado(){
  if(!editandoClienteId || !requiereSupabase()) return;
  const nombre = document.getElementById('ec-nombre').value.trim();
  const plan = document.getElementById('ec-plan').value;
  const monto_plan = parseFloat(document.getElementById('ec-monto').value) || 0;
  const fecha_vencimiento = document.getElementById('ec-vence').value;
  const contacto = document.getElementById('ec-contacto').value.trim() || null;
  const notas = document.getElementById('ec-notas').value.trim() || null;
  const activo = document.getElementById('ec-activo').value === 'true';
  if(!nombre || !fecha_vencimiento){ toast('Completá nombre y vencimiento'); return; }

  const periodicidad = document.getElementById('ec-periodicidad')?.value || 'mensual';
  const mantenimiento_activo = document.getElementById('ec-mant-activo')?.value !== 'false';
  const payload = {
    nombre, plan, monto_plan, fecha_vencimiento, contacto, notas, activo, periodicidad, mantenimiento_activo,
    updated_at: new Date().toISOString()
  };
  let { error } = await sb.from('clientes').update(payload).eq('id', editandoClienteId);
  if(error && /mantenimiento_activo|periodicidad|check/i.test(error.message || '')){
    delete payload.mantenimiento_activo;
    if(periodicidad === 'unico') delete payload.periodicidad;
    ({ error } = await sb.from('clientes').update(payload).eq('id', editandoClienteId));
  }

  if(error){ toast(supabaseErrMsg(error)); return; }
  toast('Cliente actualizado');
  cerrarModalCliente();
  await cargarClientes();
}

async function eliminarCliente(id){
  if(!requiereSupabase()) return;
  if(!confirm('¿Eliminar este cliente?')) return;
  const { error } = await sb.from('clientes').delete().eq('id', id);
  if(error){ toast(supabaseErrMsg(error)); return; }
  toast('Cliente eliminado');
  const promesas = [cargarClientes()];
  if(document.getElementById('page-estadisticas')?.classList.contains('active')) promesas.push(cargarEstadisticas());
  await Promise.all(promesas);
}

function buscarClientesDebounce(){
  clearTimeout(buscarClientesTimer);
  buscarClientesTimer = setTimeout(cargarClientes, 350);
}

let fichaClienteId = null;
let fichaClienteActual = null;
let fichaPagosById = {};

function onFilaClienteClick(ev, id){
  if(ev.target.closest('button')) return;
  abrirFichaCliente(id);
}

function labelEstadoFicha(c){
  if(c.activo === false) return { label:'Inactivo', cls:'pill-inactivo' };
  if(!mantenimientoActivo(c)) return { label:'En desarrollo', cls:'pill-est-progreso' };
  return { label:'Mantenimiento activo', cls:'pill-vigente' };
}

function fmtUsdFicha(n){
  return 'USD ' + Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function totalPresupuestadoUsd(docs){
  let usd = 0;
  (docs || []).filter(d => d.tipo === 'presupuesto').forEach(d => {
    const c = d.contenido || {};
    if(c.total_usd != null && c.total_usd !== '') usd += Number(c.total_usd) || 0;
    else if(Array.isArray(c.modulos) && c.modulos.length)
      usd += c.modulos.reduce((s, m) => s + (Number(m.precio_usd || m.precio) || 0), 0);
    else if(Array.isArray(c.items) && c.items.length)
      usd += c.items.reduce((s, m) => s + (Number(m.precio) || 0), 0);
    else usd += Number(c.precioTotal) || 0;
  });
  return usd;
}

function htmlModulosPresupuesto(docs){
  const items = [];
  (docs || []).filter(d => d.tipo === 'presupuesto').forEach(d => {
    const c = d.contenido || {};
    const mods = Array.isArray(c.modulos) && c.modulos.length ? c.modulos : (c.items || []);
    mods.forEach(m => {
      const nom = m.nombre || 'Módulo';
      const est = m.estado ? ` · ${m.estado.replace(/_/g, ' ')}` : '';
      const prec = m.precio_usd != null ? m.precio_usd : m.precio;
      items.push(`${esc(nom)} (${fmtUsdFicha(prec)}${esc(est)})`);
    });
  });
  if(!items.length) return '';
  return `<ul class="ficha-modulos">${items.map(t => `<li>${t}</li>`).join('')}</ul>`;
}

async function queryPorCliente(tabla, cliente, extra){
  const cols = extra?.select || '*';
  let r = await sb.from(tabla).select(cols).eq('cliente_id', cliente.id);
  if(r.error && esColumnaFaltante(r.error, 'cliente_id')){
    if(tabla === 'documentos')
      r = await sb.from(tabla).select(cols).ilike('cliente', `%${cliente.nombre}%`);
    else
      r = { data: [], error: null };
  } else if(!r.error && !(r.data || []).length && extra?.fallback){
    const fb = await extra.fallback();
    r = { data: fb || [], error: null };
  }
  return r.data || [];
}

async function abrirFichaCliente(id){
  if(!requiereSupabase()) return;
  fichaClienteId = id;
  fichaClienteActual = null;
  fichaPagosById = {};
  const modal = document.getElementById('modal-ficha-cliente');
  const body = document.getElementById('ficha-body');
  modal.classList.add('open');
  body.innerHTML = '<p class="info-hint">Cargando ficha…</p>';

  const { data: c, error } = await sb.from('clientes').select('*').eq('id', id).single();
  if(error || !c){ body.innerHTML = '<p class="ficha-empty">No se pudo cargar el cliente.</p>'; return; }
  fichaClienteActual = c;

  const est = labelEstadoFicha(c);
  document.getElementById('ficha-nombre').textContent = c.nombre;
  document.getElementById('ficha-meta').textContent = `${c.plan} · ${labelPeriodicidad(c.periodicidad)} · vence ${c.fecha_vencimiento || '—'}${c.contacto ? ' · ' + c.contacto : ''}`;
  const pill = document.getElementById('ficha-estado-pill');
  pill.className = 'pill ' + est.cls;
  pill.textContent = est.label;

  const token = (c.nombre.match(/\(([^)]+)\)/) || c.nombre.match(/[a-záéíóúñ0-9]{4,}/gi) || [c.nombre]).slice(-1)[0];

  const [docsFk, movFk, proyFk] = await Promise.all([
    queryPorCliente('documentos', c, {
      fallback: async () => {
        const { data } = await sb.from('documentos').select('*').ilike('cliente', `%${token}%`);
        return data || [];
      }
    }),
    queryPorCliente('movimientos', c, {
      fallback: async () => {
        const { data } = await sb.from('movimientos').select('*').ilike('descripcion', `%${token}%`).order('fecha', { ascending: false });
        return data || [];
      }
    }),
    queryPorCliente('proyectos', c, {
      fallback: async () => {
        const q = /tenis|casella/i.test(c.nombre) ? '%Tenis%' : `%${token}%`;
        const { data } = await sb.from('proyectos').select('*').ilike('nombre', q);
        return (data || []).filter(p => p.nombre !== 'General');
      }
    })
  ]);

  let docs = docsFk;
  if(!docs.length){
    const { data } = await sb.from('documentos').select('*').ilike('cliente', `%${token}%`);
    docs = data || [];
  }

  let movs = movFk;
  if(!movs.length){
    const { data } = await sb.from('movimientos').select('*').ilike('descripcion', `%${token}%`).order('fecha', { ascending: false });
    movs = data || [];
  } else {
    movs = [...movs].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  }

  const ingresos = movs.filter(m => m.tipo === 'ingreso');
  const cobrado = ingresos.reduce((s, m) => s + (Number(m.monto) || 0), 0);
  const porTipo = {};
  ingresos.forEach(m => {
    const k = m.tipo_pago || 'pago_total';
    porTipo[k] = (porTipo[k] || 0) + (Number(m.monto) || 0);
  });
  const presupuestado = totalPresupuestadoUsd(docs);
  const labelsPago = (typeof LABEL_TIPO_PAGO !== 'undefined') ? LABEL_TIPO_PAGO : {};

  const htmlDocs = docs.length
    ? docs.map(d => `<div class="ficha-row">
        <div><strong>${esc(d.numero)}</strong> · ${esc(d.tipo)} · ${esc(d.estado || '')}</div>
        <button type="button" class="ficha-link" onclick="verDocumento('${d.id}')">Abrir</button>
      </div>`).join('') + htmlModulosPresupuesto(docs)
    : '<p class="ficha-empty">Sin documentos vinculados.</p>';

  const htmlPagos = ingresos.length
    ? `<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Descripción</th><th>Pago</th><th style="text-align:right">Monto</th><th></th></tr></thead><tbody>${
      ingresos.map(m => {
        fichaPagosById[m.id] = m;
        const telOk = typeof telefonoWhatsApp === 'function' && telefonoWhatsApp(c.contacto);
        const mailOk = !!emailDeContactoCliente(c.contacto);
        return `<tr>
        <td style="font-size:12px">${esc(m.fecha)}</td>
        <td>${esc(m.descripcion)}</td>
        <td>${typeof badgeTipoPago === 'function' ? badgeTipoPago(m.tipo_pago) : esc(m.tipo_pago || '')}</td>
        <td style="text-align:right;font-weight:600">${fmt(m.monto)}</td>
        <td>
          <div class="ficha-recibo-actions">
            <button type="button" class="ficha-link" onclick="verReciboPago(${m.id})" title="Ver e imprimir recibo">Recibo</button>
            <button type="button" class="btn-wsp btn-recibo" ${telOk ? '' : 'disabled title="Sin teléfono en Contacto"'} onclick="enviarReciboWhatsApp(${m.id})">WhatsApp</button>
            ${mailOk ? `<button type="button" class="btn-email-info btn-recibo" onclick="enviarReciboEmail(${m.id})">Email</button>` : ''}
          </div>
        </td>
      </tr>`;
      }).join('')
    }</tbody></table></div>`
    : '<p class="ficha-empty">Sin pagos registrados a este cliente.</p>';

  const tiposHtml = Object.keys(porTipo).length
    ? `<div class="ficha-tipos">${Object.entries(porTipo).map(([k, v]) =>
        `<span class="pill pill-inactivo">${esc(labelsPago[k] || k)} ${fmt(v)}</span>`
      ).join('')}</div>`
    : '';

  let htmlProy = '<p class="ficha-empty">Sin proyecto de tareas vinculado.</p>';
  if(proyFk.length){
    const bloques = [];
    for(const p of proyFk){
      const [{ data: tareas }, { data: estados }] = await Promise.all([
        sb.from('tareas').select('id,titulo,estado,estado_id,estado_final').eq('proyecto_id', p.id),
        sb.from('proyecto_estados').select('*').eq('proyecto_id', p.id).order('orden')
      ]);
      const estMap = {};
      (estados || []).forEach(e => { estMap[e.id] = e; });
      const grupos = {};
      (tareas || []).forEach(t => {
        const nom = estMap[t.estado_id]?.nombre || t.estado || 'Sin estado';
        (grupos[nom] = grupos[nom] || []).push(t);
      });
      const gruposHtml = Object.keys(grupos).length
        ? Object.entries(grupos).map(([nom, list]) =>
            `<div class="ficha-row"><span>${esc(nom)}</span><strong>${list.length}</strong></div>`
            + list.map(t => `<div class="ficha-row" style="padding-left:12px;color:var(--text2)"><span>${esc(t.titulo)}</span></div>`).join('')
          ).join('')
        : '<p class="ficha-empty">Sin tareas.</p>';
      bloques.push(`<div class="ficha-row">
        <strong>${esc(p.nombre)}</strong>
        <button type="button" class="ficha-link" onclick="abrirProyectoDesdeFicha('${p.id}')">Abrir tablero</button>
      </div>${gruposHtml}`);
    }
    htmlProy = bloques.join('');
  }

  body.innerHTML = `
    <section class="ficha-sec">
      <h3>Cuenta corriente</h3>
      <div class="ficha-cc">
        <div class="ficha-cc-card"><div class="ficha-cc-label">Total presupuestado</div><div class="ficha-cc-val">${presupuestado ? fmtUsdFicha(presupuestado) : '—'}</div></div>
        <div class="ficha-cc-card"><div class="ficha-cc-label">Total cobrado</div><div class="ficha-cc-val val-green">${fmt(cobrado)}</div></div>
      </div>
      <p class="info-hint" style="margin:0">Presupuesto en USD y cobros en ARS se muestran aparte (aún no hay tipo de cambio automático).</p>
      ${tiposHtml}
    </section>
    <section class="ficha-sec">
      <h3>Documentos</h3>
      ${htmlDocs}
    </section>
    <section class="ficha-sec">
      <h3>Historial de pagos</h3>
      ${htmlPagos}
    </section>
    <section class="ficha-sec">
      <h3>Proyecto y tareas</h3>
      ${htmlProy}
    </section>
  `;
}

function cerrarFichaCliente(){
  document.getElementById('modal-ficha-cliente')?.classList.remove('open');
  fichaClienteId = null;
  fichaClienteActual = null;
  fichaPagosById = {};
}

function fichaAbrirEditar(){
  const id = fichaClienteId;
  cerrarFichaCliente();
  if(id) abrirEditarCliente(id);
}

function emailDeContactoCliente(contacto){
  const m = String(contacto || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m ? m[0] : null;
}

function fmtFechaRecibo(f){
  const s = String(f || '').slice(0, 10);
  const [y, mo, d] = s.split('-');
  if(!y || !mo || !d) return s || '—';
  return `${d}/${mo}/${y}`;
}

function nroReciboPago(mov){
  return 'R' + String(mov.id).padStart(5, '0');
}

function labelTipoPagoRecibo(tp){
  if(typeof LABEL_TIPO_PAGO !== 'undefined' && LABEL_TIPO_PAGO[tp]) return LABEL_TIPO_PAGO[tp];
  return { seña:'Seña', pago_parcial:'Pago parcial', pago_total:'Pago total', mensual:'Mensual', otro:'Otro' }[tp] || (tp || 'Pago');
}

function datosRecibo(movId){
  const cliente = fichaClienteActual;
  const mov = fichaPagosById[movId];
  if(!cliente || !mov){ toast('No se encontró el pago'); return null; }
  return { cliente, mov };
}

function textoReciboPago(cliente, mov){
  const m = typeof marcaCMR === 'function' ? marcaCMR() : { empresa:'CMR Software Solutions', telefono:'3364 57-8599' };
  return `Hola ${cliente.nombre}, te enviamos el recibo de cobro de ${m.empresa}.

N° ${nroReciboPago(mov)}
Fecha: ${fmtFechaRecibo(mov.fecha)}
Concepto: ${mov.descripcion}
Tipo: ${labelTipoPagoRecibo(mov.tipo_pago)}
Monto: ${fmt(mov.monto)}

¡Gracias! WhatsApp CMR: ${m.telefono}`;
}

function buildHTMLRecibo(cliente, mov){
  const m = typeof marcaCMR === 'function' ? marcaCMR() : {
    empresa:'CMR Software Solutions', telefono:'3364 57-8599',
    email:'contacto@cmrsoftwaresolutions.com',
    ubicacion:'San Nicolás de los Arroyos, Buenos Aires, Argentina',
    color:'#0a9d8f', colorOscuro:'#0d1b2e', logoText:'CM', logoUrl:''
  };
  const nro = nroReciboPago(mov);
  const socio = (typeof USUARIOS !== 'undefined' && USUARIOS[mov.socio]?.nombre) || mov.socio || '';
  const logo = m.logoUrl
    ? `<img src="${esc(m.logoUrl)}" alt="${esc(m.empresa)}" style="height:42px">`
    : `<div class="logo">${esc(m.logoText || 'CM')}</div>`;
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Recibo ${nro}</title>
<style>
  *{box-sizing:border-box} body{margin:0;font-family:'Segoe UI',system-ui,sans-serif;color:${m.colorOscuro};background:#f0f4f8}
  .page{max-width:720px;margin:24px auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden}
  .banner{background:${m.colorOscuro};color:#fff;padding:22px 28px;display:flex;justify-content:space-between;align-items:center;gap:16px}
  .logo{width:42px;height:42px;border-radius:10px;background:${m.color};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px}
  .banner h1{margin:0;font-size:20px}
  .banner p{margin:4px 0 0;font-size:12px;opacity:.8}
  .pad{padding:28px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:22px}
  .box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px}
  .box h3{margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#64748b}
  .box p{margin:0;font-size:14px}
  table{width:100%;border-collapse:collapse;margin:8px 0 18px}
  th,td{padding:10px 8px;border-bottom:1px solid #e2e8f0;text-align:left;font-size:14px}
  th{font-size:11px;text-transform:uppercase;color:#64748b}
  .total{display:flex;justify-content:space-between;align-items:center;background:${m.color}14;border:1px solid ${m.color}44;border-radius:10px;padding:14px 16px;font-size:18px;font-weight:700;color:${m.color}}
  .nota{margin-top:22px;font-size:11px;color:#64748b}
  @media print{body{background:#fff}.page{margin:0;border:none}}
</style></head><body>
<div class="page">
  <div class="banner">
    <div style="display:flex;gap:12px;align-items:center">${logo}<div><strong>${esc(m.empresa)}</strong><p>${esc(m.telefono)} · ${esc(m.email)}</p></div></div>
    <div style="text-align:right"><h1>Recibo ${esc(nro)}</h1><p>${esc(fmtFechaRecibo(mov.fecha))}</p></div>
  </div>
  <div class="pad">
    <div class="grid">
      <div class="box"><h3>Recibido de</h3><p><strong>${esc(cliente.nombre)}</strong></p>${cliente.contacto?`<p>${esc(cliente.contacto)}</p>`:''}${cliente.plan?`<p>${esc(cliente.plan)}</p>`:''}</div>
      <div class="box"><h3>Emitido por</h3><p><strong>${esc(m.empresa)}</strong></p><p>${esc(m.ubicacion)}</p>${socio?`<p>Registró: ${esc(socio)}</p>`:''}</div>
    </div>
    <table>
      <thead><tr><th>Concepto</th><th>Tipo</th><th style="text-align:right">Monto</th></tr></thead>
      <tbody><tr><td>${esc(mov.descripcion)}</td><td>${esc(labelTipoPagoRecibo(mov.tipo_pago))}</td><td style="text-align:right;font-weight:700">${fmt(mov.monto)}</td></tr></tbody>
    </table>
    <div class="total"><span>Total cobrado</span><span>${fmt(mov.monto)}</span></div>
    <p class="nota">Comprobante interno de cobro de ${esc(m.empresa)}. No válido como factura fiscal.</p>
  </div>
</div>
</body></html>`;
}

function verReciboPago(movId){
  const d = datosRecibo(movId);
  if(!d) return;
  const html = buildHTMLRecibo(d.cliente, d.mov);
  const nombre = `Recibo_${nroReciboPago(d.mov)}_${(d.cliente.nombre || 'cliente').replace(/\s+/g,'_')}.html`;
  if(typeof abrirHtmlVista === 'function') abrirHtmlVista(`Recibo ${nroReciboPago(d.mov)} — CMR`, html, nombre);
  else {
    const w = window.open('', '_blank');
    if(w){ w.document.write(html); w.document.close(); }
    else toast('Permití popups para ver el recibo');
  }
}

function enviarReciboWhatsApp(movId){
  const d = datosRecibo(movId);
  if(!d) return;
  const tel = typeof telefonoWhatsApp === 'function' ? telefonoWhatsApp(d.cliente.contacto) : null;
  if(!tel){ toast('El cliente no tiene teléfono válido en Contacto'); return; }
  if(typeof abrirWhatsAppNumero === 'function') abrirWhatsAppNumero(tel, textoReciboPago(d.cliente, d.mov));
  else window.open('https://wa.me/' + tel + '?text=' + encodeURIComponent(textoReciboPago(d.cliente, d.mov)), '_blank');
}

function enviarReciboEmail(movId){
  const d = datosRecibo(movId);
  if(!d) return;
  const email = emailDeContactoCliente(d.cliente.contacto);
  if(!email){ toast('El cliente no tiene email en Contacto'); return; }
  const nro = nroReciboPago(d.mov);
  const subject = encodeURIComponent(`Recibo ${nro} — CMR Software`);
  const body = encodeURIComponent(textoReciboPago(d.cliente, d.mov));
  window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
}

function abrirProyectoDesdeFicha(id){
  cerrarFichaCliente();
  const tab = document.querySelector('.nav-tab[onclick*="tareas"]');
  if(typeof showPage === 'function') showPage('tareas', tab);
  if(typeof abrirProyecto === 'function') abrirProyecto(id);
}

function poblarSelectClientes(selectId){
  const el = document.getElementById(selectId);
  if(!el) return;
  const cur = el.value;
  const lista = clientesCompletos || [];
  el.innerHTML = '<option value="">— Sin cliente —</option>' +
    lista.map(c => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('');
  if(cur) el.value = cur;
}

document.getElementById('modal-ficha-cliente')?.addEventListener('click', e => {
  if(e.target.id === 'modal-ficha-cliente') cerrarFichaCliente();
});
