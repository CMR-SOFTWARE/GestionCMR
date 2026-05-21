// ─── Información CMR: config, WhatsApp clientes y equipo ───

const NOMBRE_A_USUARIO = { Tomi: 'tomi', Chipi: 'chipi', Gena: 'gena' };

let configCMR = null;
let logsRecordatoriosHoy = new Set();

const DEFAULT_CONFIG = {
  id: 1,
  empresa_nombre: 'CMR Software Solutions',
  telefono_empresa: '3364 57-8599',
  mensaje_wsp_cliente: 'Hola {{nombre}}, somos {{empresa}}. Te recordamos que tu plan *{{plan}}* vence el *{{fecha}}* (monto: ${{monto}}). ¿Podés confirmar la renovación? WhatsApp CMR: {{telefono_cmr}}. Gracias.',
  dias_aviso_cliente: 5,
  email_tomi: '',
  email_chipi: '',
  email_gena: '',
  wsp_tomi: '',
  wsp_chipi: '',
  wsp_gena: '',
  mensaje_wsp_tarea_creada: 'Hola {{destinatario}}, {{empresa}}: *nueva tarea* «{{titulo}}». Asignado: {{asignado}}. Prioridad: {{prioridad}}. Vence: {{vencimiento}}.',
  mensaje_wsp_tarea_vence: 'Hola {{destinatario}}, {{empresa}}: recordatorio — la tarea «{{titulo}}» ({{asignado}}) {{vence_texto}}. Estado: {{estado}}.',
  dias_aviso_tarea: 2,
  notif_tarea_al_crear: true,
  notif_tarea_por_vencer: true,
  notif_tarea_wsp_crear: true,
  notif_tarea_wsp_vencer: true
};

function aplicarEmailsDesdeConfig(cfg){
  if(!cfg || typeof USUARIOS === 'undefined') return;
  if(cfg.email_tomi) USUARIOS.tomi.email = cfg.email_tomi.trim();
  if(cfg.email_chipi) USUARIOS.chipi.email = cfg.email_chipi.trim();
  if(cfg.email_gena) USUARIOS.gena.email = cfg.email_gena.trim();
}

function emailDeNombre(nombre){
  const k = NOMBRE_A_USUARIO[nombre];
  if(!k || typeof USUARIOS === 'undefined') return '';
  return (USUARIOS[k]?.email || '').trim();
}

function wspDeNombre(nombre){
  const c = configCMR || DEFAULT_CONFIG;
  const k = NOMBRE_A_USUARIO[nombre];
  if(!k) return null;
  const raw = c['wsp_' + k];
  return telefonoWhatsApp(raw);
}

function equipoDeTarea(t){
  return [...new Set([t.asignado_a, t.colaborador_1, t.colaborador_2].filter(Boolean))];
}

function emailsEquipoTarea(t){
  return [...new Set(equipoDeTarea(t).map(emailDeNombre).filter(Boolean))];
}

function reemplazarPlantilla(texto, vars){
  let s = texto || '';
  Object.keys(vars).forEach(k => {
    s = s.split('{{' + k + '}}').join(vars[k] ?? '');
  });
  return s;
}

function telefonoWhatsApp(contacto){
  if(!contacto) return null;
  let d = String(contacto).replace(/\D/g, '');
  if(d.length < 8) return null;
  if(d.startsWith('54')) return d;
  if(d.length === 10) return '549' + d;
  if(d.length === 11 && d.startsWith('15')) return '54' + d;
  return d;
}

function diasHasta(fechaStr){
  if(!fechaStr) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const v = new Date(fechaStr + 'T00:00:00');
  return Math.round((v - hoy) / 86400000);
}

function textoVencimientoTarea(tarea){
  const dias = diasHasta(tarea.fecha_vencimiento);
  if(!tarea.fecha_vencimiento) return 'sin fecha de vencimiento';
  if(dias === 0) return 'vence hoy';
  if(dias === 1) return 'vence mañana';
  if(dias > 0) return `vence el ${tarea.fecha_vencimiento} (en ${dias} días)`;
  return `venció el ${tarea.fecha_vencimiento}`;
}

function logKey(tipo, refId){
  return tipo + ':' + refId;
}

function logRefTareaPersona(tareaId, nombre){
  return String(tareaId) + '|' + nombre;
}

async function cargarLogsRecordatoriosHoy(){
  logsRecordatoriosHoy = new Set();
  if(!sb || !supabaseConectado) return;
  const hoy = new Date().toISOString().slice(0, 10);
  const { data } = await sb.from('recordatorios_log').select('tipo, referencia_id').eq('fecha', hoy);
  (data || []).forEach(r => logsRecordatoriosHoy.add(logKey(r.tipo, r.referencia_id)));
}

async function marcarRecordatorioEnviado(tipo, referenciaId){
  if(!sb || !requiereSupabase()) return;
  const hoy = new Date().toISOString().slice(0, 10);
  const { error } = await sb.from('recordatorios_log').insert({ tipo, referencia_id: String(referenciaId), fecha: hoy });
  if(!error || error.code === '23505') logsRecordatoriosHoy.add(logKey(tipo, referenciaId));
}

async function cargarConfiguracion(){
  if(!sb || !requiereSupabase()) return DEFAULT_CONFIG;
  const { data, error } = await sb.from('configuracion').select('*').eq('id', 1).maybeSingle();
  if(error){
    if(error.code === 'PGRST205' || (error.message || '').includes('does not exist')){
      toast('Ejecutá supabase/informacion.sql en Supabase');
    } else {
      toast(supabaseErrMsg(error));
    }
    configCMR = { ...DEFAULT_CONFIG };
    return configCMR;
  }
  if(!data){
    await sb.from('configuracion').insert({ id: 1, telefono_empresa: DEFAULT_CONFIG.telefono_empresa });
    configCMR = { ...DEFAULT_CONFIG };
  } else {
    configCMR = { ...DEFAULT_CONFIG, ...data };
    if(!configCMR.telefono_empresa) configCMR.telefono_empresa = DEFAULT_CONFIG.telefono_empresa;
  }
  aplicarEmailsDesdeConfig(configCMR);
  return configCMR;
}

function poblarFormularioInformacion(){
  const c = configCMR || DEFAULT_CONFIG;
  const set = (id, val) => { const el = document.getElementById(id); if(el) el.value = val ?? ''; };
  const setChk = (id, val) => { const el = document.getElementById(id); if(el) el.checked = !!val; };
  set('info-empresa', c.empresa_nombre);
  set('info-tel-empresa', c.telefono_empresa || '3364 57-8599');
  set('info-msg-wsp', c.mensaje_wsp_cliente);
  set('info-dias-cliente', c.dias_aviso_cliente ?? 5);
  set('info-email-tomi', c.email_tomi || USUARIOS?.tomi?.email || '');
  set('info-email-chipi', c.email_chipi || USUARIOS?.chipi?.email || '');
  set('info-email-gena', c.email_gena || USUARIOS?.gena?.email || '');
  set('info-wsp-tomi', c.wsp_tomi || '');
  set('info-wsp-chipi', c.wsp_chipi || '');
  set('info-wsp-gena', c.wsp_gena || '');
  set('info-msg-wsp-tarea-nueva', c.mensaje_wsp_tarea_creada || DEFAULT_CONFIG.mensaje_wsp_tarea_creada);
  set('info-msg-wsp-tarea-vence', c.mensaje_wsp_tarea_vence || DEFAULT_CONFIG.mensaje_wsp_tarea_vence);
  set('info-dias-tarea', c.dias_aviso_tarea ?? 2);
  setChk('info-notif-crear', c.notif_tarea_al_crear !== false);
  setChk('info-notif-wsp-crear', c.notif_tarea_wsp_crear !== false);
  setChk('info-notif-vencer', c.notif_tarea_por_vencer !== false);
  setChk('info-notif-wsp-vencer', c.notif_tarea_wsp_vencer !== false);
}

async function guardarInformacion(){
  if(!requiereSupabase()) return;
  const payload = {
    id: 1,
    empresa_nombre: document.getElementById('info-empresa').value.trim() || 'CMR Software Solutions',
    telefono_empresa: document.getElementById('info-tel-empresa').value.trim() || '3364 57-8599',
    mensaje_wsp_cliente: document.getElementById('info-msg-wsp').value.trim() || DEFAULT_CONFIG.mensaje_wsp_cliente,
    dias_aviso_cliente: parseInt(document.getElementById('info-dias-cliente').value, 10) || 5,
    email_tomi: document.getElementById('info-email-tomi').value.trim() || null,
    email_chipi: document.getElementById('info-email-chipi').value.trim() || null,
    email_gena: document.getElementById('info-email-gena').value.trim() || null,
    wsp_tomi: document.getElementById('info-wsp-tomi').value.trim() || null,
    wsp_chipi: document.getElementById('info-wsp-chipi').value.trim() || null,
    wsp_gena: document.getElementById('info-wsp-gena').value.trim() || null,
    mensaje_wsp_tarea_creada: document.getElementById('info-msg-wsp-tarea-nueva').value.trim() || DEFAULT_CONFIG.mensaje_wsp_tarea_creada,
    mensaje_wsp_tarea_vence: document.getElementById('info-msg-wsp-tarea-vence').value.trim() || DEFAULT_CONFIG.mensaje_wsp_tarea_vence,
    dias_aviso_tarea: parseInt(document.getElementById('info-dias-tarea').value, 10) || 2,
    notif_tarea_al_crear: document.getElementById('info-notif-crear').checked,
    notif_tarea_wsp_crear: document.getElementById('info-notif-wsp-crear').checked,
    notif_tarea_por_vencer: document.getElementById('info-notif-vencer').checked,
    notif_tarea_wsp_vencer: document.getElementById('info-notif-wsp-vencer').checked,
    updated_at: new Date().toISOString()
  };
  const btn = document.getElementById('btn-guardar-info');
  if(btn){ btn.disabled = true; btn.textContent = 'Guardando…'; }
  const { error } = await sb.from('configuracion').upsert(payload);
  if(btn){ btn.disabled = false; btn.textContent = 'Guardar configuración'; }
  if(error){ toast(supabaseErrMsg(error)); return; }
  configCMR = payload;
  aplicarEmailsDesdeConfig(configCMR);
  toast('Configuración guardada');
  await renderPanelRecordatorios();
}

function mensajeWspCliente(cliente){
  const c = configCMR || DEFAULT_CONFIG;
  const fmtMonto = typeof fmt === 'function' ? fmt(Number(cliente.monto_plan)) : '$' + cliente.monto_plan;
  return reemplazarPlantilla(c.mensaje_wsp_cliente, {
    nombre: cliente.nombre,
    plan: cliente.plan,
    fecha: cliente.fecha_vencimiento,
    monto: fmtMonto.replace(/^\$/, ''),
    empresa: c.empresa_nombre || 'CMR',
    dias: String(diasHasta(cliente.fecha_vencimiento) ?? ''),
    telefono_cmr: c.telefono_empresa || '3364 57-8599'
  });
}

function mensajeWspTarea(tipo, tarea, destinatario){
  const c = configCMR || DEFAULT_CONFIG;
  const plantilla = tipo === 'creada'
    ? (c.mensaje_wsp_tarea_creada || DEFAULT_CONFIG.mensaje_wsp_tarea_creada)
    : (c.mensaje_wsp_tarea_vence || DEFAULT_CONFIG.mensaje_wsp_tarea_vence);
  return reemplazarPlantilla(plantilla, {
    destinatario,
    titulo: tarea.titulo,
    asignado: tarea.asignado_a,
    prioridad: tarea.prioridad,
    vencimiento: tarea.fecha_vencimiento || 'sin fecha',
    vence_texto: textoVencimientoTarea(tarea),
    estado: tarea.estado,
    empresa: c.empresa_nombre || 'CMR'
  });
}

function abrirWhatsAppNumero(tel, mensaje){
  window.open('https://wa.me/' + tel + '?text=' + encodeURIComponent(mensaje), '_blank');
}

function abrirWhatsAppCliente(cliente){
  const tel = telefonoWhatsApp(cliente.contacto);
  if(!tel){ toast('El cliente no tiene teléfono válido en Contacto'); return; }
  abrirWhatsAppNumero(tel, mensajeWspCliente(cliente));
  marcarRecordatorioEnviado('wsp_cliente', cliente.id);
}

function abrirWhatsAppTareaParaPersona(tarea, tipo, nombre){
  const tel = wspDeNombre(nombre);
  if(!tel){
    toast('Configurá el WhatsApp personal de ' + nombre + ' en Información');
    return false;
  }
  const logTipo = tipo === 'creada' ? 'wsp_tarea_creada' : 'wsp_tarea_vence';
  const ref = logRefTareaPersona(tarea.id, nombre);
  if(logsRecordatoriosHoy.has(logKey(logTipo, ref))) return true;
  abrirWhatsAppNumero(tel, mensajeWspTarea(tipo, tarea, nombre));
  marcarRecordatorioEnviado(logTipo, ref);
  return true;
}

function abrirWhatsAppEquipoTarea(tarea, tipo, soloPendientes){
  const c = configCMR || DEFAULT_CONFIG;
  const flagCrear = c.notif_tarea_wsp_crear !== false;
  const flagVencer = c.notif_tarea_wsp_vencer !== false;
  if(tipo === 'creada' && !flagCrear) return 0;
  if(tipo === 'vence' && !flagVencer) return 0;

  const equipo = equipoDeTarea(tarea);
  const logTipo = tipo === 'creada' ? 'wsp_tarea_creada' : 'wsp_tarea_vence';
  let abiertos = 0;
  let delay = 0;

  equipo.forEach(nombre => {
    const ref = logRefTareaPersona(tarea.id, nombre);
    if(soloPendientes && logsRecordatoriosHoy.has(logKey(logTipo, ref))) return;
    if(!wspDeNombre(nombre)) return;
    setTimeout(() => {
      abrirWhatsAppTareaParaPersona(tarea, tipo, nombre);
    }, delay);
    delay += 700;
    abiertos++;
  });

  if(!abiertos) toast('Ningún integrante tiene WhatsApp configurado');
  else if(abiertos > 1) toast(`Abriendo ${abiertos} WhatsApp (${equipo.join(', ')})`);
  return abiertos;
}

function asuntoEmailTarea(tipo, tarea){
  const c = configCMR || DEFAULT_CONFIG;
  const empresa = c.empresa_nombre || 'CMR';
  if(tipo === 'creada') return `[${empresa}] Nueva tarea: ${tarea.titulo}`;
  return `[${empresa}] Tarea por vencer: ${tarea.titulo}`;
}

function cuerpoEmailTarea(tipo, tarea){
  if(tipo === 'creada'){
    return `Se creó una nueva tarea en ${configCMR?.empresa_nombre || 'CMR'}:\n\n` +
      `Título: ${tarea.titulo}\n` +
      `Asignado: ${tarea.asignado_a}\n` +
      `Prioridad: ${tarea.prioridad}\n` +
      `Vencimiento: ${tarea.fecha_vencimiento || '—'}\n` +
      (tarea.descripcion ? `Descripción: ${tarea.descripcion}\n` : '') +
      `\n— Sistema de gestión CMR`;
  }
  return `Recordatorio de tarea en ${configCMR?.empresa_nombre || 'CMR'}:\n\n` +
    `Título: ${tarea.titulo}\n` +
    `Asignado: ${tarea.asignado_a}\n` +
    `Estado: ${tarea.estado}\n` +
    `La tarea ${textoVencimientoTarea(tarea)}.\n` +
    (tarea.descripcion ? `Descripción: ${tarea.descripcion}\n` : '') +
    `\n— Sistema de gestión CMR`;
}

function abrirEmailTarea(tarea, tipo){
  const emails = emailsEquipoTarea(tarea);
  if(!emails.length){
    toast('Configurá los emails del equipo en Información');
    return;
  }
  const subject = encodeURIComponent(asuntoEmailTarea(tipo, tarea));
  const body = encodeURIComponent(cuerpoEmailTarea(tipo, tarea));
  window.location.href = `mailto:${emails.join(',')}?subject=${subject}&body=${body}`;
  marcarRecordatorioEnviado(tipo === 'creada' ? 'email_tarea_creada' : 'email_tarea_vence', tarea.id);
}

function tareaTienePendienteVencer(t){
  const c = configCMR || DEFAULT_CONFIG;
  let pendiente = false;
  if(c.notif_tarea_por_vencer && !logsRecordatoriosHoy.has(logKey('email_tarea_vence', t.id))) pendiente = true;
  if(c.notif_tarea_wsp_vencer !== false){
    equipoDeTarea(t).forEach(nombre => {
      if(!logsRecordatoriosHoy.has(logKey('wsp_tarea_vence', logRefTareaPersona(t.id, nombre)))) pendiente = true;
    });
  }
  return pendiente;
}

async function obtenerClientesParaRecordatorio(){
  const c = configCMR || DEFAULT_CONFIG;
  const dias = c.dias_aviso_cliente ?? 5;
  let lista = (typeof clientesCompletos !== 'undefined' && clientesCompletos.length)
    ? clientesCompletos
    : (typeof todosClientes !== 'undefined' && todosClientes.length ? todosClientes : []);
  if(!lista.length && sb){
    const { data } = await sb.from('clientes').select('*').eq('activo', true);
    lista = data || [];
  }
  return lista.filter(cl => {
    if(!cl.activo || !cl.fecha_vencimiento) return false;
    const d = diasHasta(cl.fecha_vencimiento);
    if(d === null || d < 0 || d > dias) return false;
    return !logsRecordatoriosHoy.has(logKey('wsp_cliente', cl.id));
  });
}

async function obtenerTareasParaRecordatorio(){
  const c = configCMR || DEFAULT_CONFIG;
  if(!c.notif_tarea_por_vencer && c.notif_tarea_wsp_vencer === false) return [];
  const dias = c.dias_aviso_tarea ?? 2;
  let lista = [];
  if(sb){
    const { data } = await sb.from('tareas').select('*').neq('estado', 'Completada');
    lista = data || [];
  }
  return lista.filter(t => {
    if(t.estado === 'Completada' || !t.fecha_vencimiento) return false;
    const d = diasHasta(t.fecha_vencimiento);
    if(d === null || d < 0 || d > dias) return false;
    return tareaTienePendienteVencer(t);
  });
}

async function renderPanelRecordatorios(){
  const wrapC = document.getElementById('info-lista-clientes');
  const wrapT = document.getElementById('info-lista-tareas');
  if(!wrapC || !wrapT) return;
  await cargarLogsRecordatoriosHoy();
  const clientes = await obtenerClientesParaRecordatorio();
  const tareas = await obtenerTareasParaRecordatorio();
  const escFn = typeof esc === 'function' ? esc : s => s;

  if(!clientes.length){
    wrapC.innerHTML = '<p class="info-empty">No hay clientes con vencimiento próximo pendientes de aviso.</p>';
  } else {
    wrapC.innerHTML = '<table class="info-table"><thead><tr><th>Cliente</th><th>Vence</th><th>Contacto</th><th></th></tr></thead><tbody>' +
      clientes.map(cl => {
        const d = diasHasta(cl.fecha_vencimiento);
        const telOk = !!telefonoWhatsApp(cl.contacto);
        return `<tr>
          <td><strong>${escFn(cl.nombre)}</strong><div class="info-sub">${escFn(cl.plan)}</div></td>
          <td>${cl.fecha_vencimiento}<div class="info-sub">${d === 0 ? 'Hoy' : 'En ' + d + ' días'}</div></td>
          <td style="font-size:12px">${escFn(cl.contacto || '—')}</td>
          <td><button type="button" class="btn-wsp" ${telOk ? '' : 'disabled title="Sin teléfono en Contacto"'} onclick="abrirWhatsAppClientePorId('${cl.id}')">WhatsApp</button></td>
        </tr>`;
      }).join('') + '</tbody></table>';
  }

  if(!tareas.length){
    wrapT.innerHTML = '<p class="info-empty">No hay tareas por vencer pendientes de aviso.</p>';
  } else {
    wrapT.innerHTML = '<table class="info-table"><thead><tr><th>Tarea</th><th>Vence</th><th>Equipo</th><th>Acciones</th></tr></thead><tbody>' +
      tareas.map(t => {
        const d = diasHasta(t.fecha_vencimiento);
        const eq = equipoDeTarea(t).join(', ');
        return `<tr>
          <td><strong>${escFn(t.titulo)}</strong></td>
          <td>${t.fecha_vencimiento}<div class="info-sub">${d === 0 ? 'Hoy' : 'En ' + d + ' días'}</div></td>
          <td style="font-size:12px">${escFn(eq)}</td>
          <td><div class="info-acciones">
            <button type="button" class="btn-email-info" onclick="abrirEmailTareaPorId('${t.id}','vence')">Email</button>
            <button type="button" class="btn-wsp" onclick="abrirWhatsAppTareaPorId('${t.id}','vence')">WhatsApp</button>
          </div></td>
        </tr>`;
      }).join('') + '</tbody></table>';
  }

  const badge = document.getElementById('info-badge-pendientes');
  const total = clientes.length + tareas.length;
  if(badge){
    badge.textContent = total;
    badge.classList.toggle('show', total > 0);
  }
  const banner = document.getElementById('banner-recordatorios');
  if(banner){
    if(total){
      banner.classList.add('show');
      const txt = document.getElementById('banner-recordatorios-text');
      if(txt) txt.textContent = `${total} recordatorio${total > 1 ? 's' : ''} pendiente${total > 1 ? 's' : ''} (clientes / tareas)`;
    } else {
      banner.classList.remove('show');
    }
  }
}

window.abrirWhatsAppClientePorId = async function(id){
  const pool = (typeof clientesCompletos !== 'undefined' && clientesCompletos.length) ? clientesCompletos : (typeof todosClientes !== 'undefined' ? todosClientes : []);
  let cl = pool.find(c => String(c.id) === String(id));
  if(!cl && sb){
    const { data } = await sb.from('clientes').select('*').eq('id', id).single();
    cl = data;
  }
  if(cl) abrirWhatsAppCliente(cl);
};

window.abrirEmailTareaPorId = async function(id, tipo){
  let t = (typeof todasTareas !== 'undefined' ? todasTareas : []).find(x => String(x.id) === String(id));
  if(!t && sb){
    const { data } = await sb.from('tareas').select('*').eq('id', id).single();
    t = data;
  }
  if(t) abrirEmailTarea(t, tipo || 'vence');
};

window.abrirWhatsAppTareaPorId = async function(id, tipo){
  let t = (typeof todasTareas !== 'undefined' ? todasTareas : []).find(x => String(x.id) === String(id));
  if(!t && sb){
    const { data } = await sb.from('tareas').select('*').eq('id', id).single();
    t = data;
  }
  if(t) abrirWhatsAppEquipoTarea(t, tipo || 'vence', true);
};

async function cargarInformacion(){
  if(!requiereSupabase()) return;
  await cargarConfiguracion();
  poblarFormularioInformacion();
  await renderPanelRecordatorios();
}

async function notificarTareaCreada(tarea){
  const c = configCMR || await cargarConfiguracion();
  await cargarLogsRecordatoriosHoy();
  let avisos = 0;

  if(c.notif_tarea_al_crear && emailsEquipoTarea(tarea).length && !logsRecordatoriosHoy.has(logKey('email_tarea_creada', tarea.id))){
    abrirEmailTarea(tarea, 'creada');
    avisos++;
  }
  if(c.notif_tarea_wsp_crear !== false){
    const n = abrirWhatsAppEquipoTarea(tarea, 'creada', true);
    if(n) avisos += n;
  }
  if(avisos) toast('Recordatorios de tarea nueva (email y/o WhatsApp personal)');
}

async function verificarRecordatoriosPendientes(){
  if(!supabaseConectado || !sb) return;
  await cargarConfiguracion();
  await cargarLogsRecordatoriosHoy();
  await renderPanelRecordatorios();
}

async function initInformacionApp(){
  if(!supabaseConectado) return;
  await cargarConfiguracion();
  await verificarRecordatoriosPendientes();
}
