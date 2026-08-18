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

  const { error: eMov } = await sb.from('movimientos').insert({
    fecha: hoy, tipo: 'ingreso', descripcion: desc, categoria: catMov, tipo_pago: tipoPagoMov, monto, socio: sesion
  });
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
    return `<tr>
      <td><div class="cliente-nombre">${esc(c.nombre)}</div>${contacto}</td>
      <td>${esc(c.plan)}</td>
      <td class="hide-mob" style="text-align:right;font-weight:600">${fmt(c.monto_plan)}</td>
      <td style="font-size:12px">${c.fecha_vencimiento}</td>
      <td><span class="pill ${e.cls}">${e.label}</span></td>
      <td>
        <button class="btn-ghost-edit" onclick="abrirEditarCliente(${c.id})" title="Editar">✎</button>
        <button class="btn-ghost-danger" onclick="eliminarCliente(${c.id})" title="Eliminar">×</button>
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
  const { error } = await sb.from('clientes').update({
    nombre, plan, monto_plan, fecha_vencimiento, contacto, notas, activo, periodicidad, mantenimiento_activo,
    updated_at: new Date().toISOString()
  }).eq('id', editandoClienteId);

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
