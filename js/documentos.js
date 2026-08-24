// ─── Documentos: repositorio + editores Presupuesto / Contrato ───
// Permisos A: todo el equipo ve y edita.

const ESTADOS_DOC = ['Borrador', 'Enviado', 'Aceptado', 'Firmado'];
const CHIP_COLORS = ['#0a9d8f', '#1a6fc4', '#7c5cbf', '#d97706', '#dc2626', '#059669', '#2563eb', '#db2777'];

let todosDocumentos = [];
let editandoDocumentoId = null;
let editandoTipoDoc = 'presupuesto';
let buscarDocTimer = null;
let pendienteSubida = null;

const MANT_DEFAULT = 'Corrección de bugs · Actualizaciones menores · Backups · Soporte técnico';
const MANT_EXCLUYE_DEFAULT = 'No incluye nuevas funcionalidades, rediseños mayores ni integraciones no acordadas.';

const TEXTO_FIJO = {
  validez: 'Esta oferta tiene una validez de {{dias}} días corridos desde la fecha del presupuesto.',
  plazoEntrega: 'El plazo de entrega se acordará al firmar y comenzará a contar desde la recepción del anticipo, salvo pacto en contrario.',
  oblPrestador: 'El PRESTADOR se obliga a desarrollar e implementar el sistema conforme al alcance descripto, informando avances y entregando documentación razonable.',
  oblCliente: 'El CLIENTE se obliga a proveer información, accesos y feedback en tiempo y forma, y a abonar los montos en las fechas pactadas.',
  cambiosAlcance: 'Todo cambio de alcance que implique trabajo adicional se cotizará por separado y requerirá aceptación escrita de ambas partes.',
  propiedadIntelectual: 'El código y entregables desarrollados serán propiedad del CLIENTE una vez abonado el total acordado. Las herramientas, librerías y know-how previos del PRESTADOR permanecen de su titularidad.',
  rescision: 'Cualquiera de las partes podrá rescindir con aviso fehaciente de 15 días, sin perjuicio de los pagos ya devengados y trabajos realizados.',
  confidencialidad: 'Las partes se comprometen a mantener confidencial la información intercambiada con motivo del presente, salvo obligación legal o autorización escrita.',
  jurisdiccion: 'Para cualquier controversia, las partes se someten a los tribunales ordinarios de San Nicolás de los Arroyos, Provincia de Buenos Aires, República Argentina, renunciando a cualquier otro fuero.',
  notaLegal: 'Se recomienda la revisión de este documento por un profesional del derecho antes de su firma.'
};

function nombreSocioDoc(){
  return (typeof USUARIOS !== 'undefined' && sesion && USUARIOS[sesion]) ? USUARIOS[sesion].nombre : 'Tomi';
}

function marcaDoc(){
  return typeof marcaCMR === 'function' ? marcaCMR() : {
    empresa: 'CMR Software Solutions', telefono: '3364 57-8599',
    email: 'contacto@cmrsoftwaresolutions.com',
    ubicacion: 'San Nicolás de los Arroyos, Buenos Aires, Argentina',
    logoUrl: '', logoText: 'CM', color: '#0a9d8f', colorOscuro: '#0d1b2e'
  };
}

function escDoc(s){ return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'); }
function fmtUsd(n){ return 'USD ' + (Number(n)||0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
function chipColor(i){ return CHIP_COLORS[i % CHIP_COLORS.length]; }

function contenidoPresupuestoVacio(){
  return {
    formatoItems: 'modulo', // checklist | modulo
    empresaCliente: '',
    proyecto: '',
    descripcionFilas: [
      { etiqueta: 'Producto / Proyecto', valor: '' },
      { etiqueta: 'Tecnología', valor: '' },
      { etiqueta: 'Diseño', valor: '' },
      { etiqueta: 'Entrega', valor: '' }
    ],
    items: [{ num: '01', nombre: '', descripcion: '', precio: 0, dependencia: '' }],
    precioTotal: 0,
    cuotas: 1,
    pagos: [
      { nombre: '1° Pago — Anticipo', cuando: 'Al firmar el contrato', monto: 0 },
      { nombre: '2° Pago — Entrega', cuando: 'Al entregar el sistema', monto: 0 }
    ],
    clausulaBlue: true,
    mediosPago: { transferencia: true, mercadopago: false, efectivo: false, wise: false },
    mantenimiento: { activo: false, precioMensual: 0, descripcion: MANT_DEFAULT, excluye: MANT_EXCLUYE_DEFAULT },
    bloques: {
      noIncluye: { activo: false, texto: '' },
      resumenModulos: { activo: true },
      participacionIngresos: { activo: false, texto: '' },
      costosExternos: { activo: false, texto: '' },
      condicionesGenerales: { activo: false, texto: '' },
      responsabilidadCaptacion: { activo: false, texto: 'CMR no asume responsabilidad por la captación de clientes del producto, salvo acuerdo escrito.' }
    },
    validezDias: 15,
    notas: ''
  };
}

function contenidoContratoVacio(){
  const m = marcaDoc();
  return {
    ciudad: 'San Nicolás de los Arroyos',
    clienteCuit: '', clienteDni: '', clienteDomicilio: '', clienteEmail: '', representante: '',
    formatoItems: 'modulo',
    esquemaPago: 'cuotas', // cuotas | por_modulo
    descripcionFilas: [
      { etiqueta: 'Producto / Proyecto', valor: '' },
      { etiqueta: 'Alcance', valor: '' },
      { etiqueta: 'Plazo estimado', valor: '' }
    ],
    items: [{ num: '01', nombre: '', descripcion: '', precio: 0, dependencia: '' }],
    precioTotal: 0,
    cuotas: 2,
    pagos: [
      { nombre: '1° Pago — Anticipo', cuando: 'Al firmar', monto: 0 },
      { nombre: '2° Pago — Entrega', cuando: 'Al entregar', monto: 0 }
    ],
    plazoEntrega: TEXTO_FIJO.plazoEntrega,
    oblPrestador: TEXTO_FIJO.oblPrestador,
    oblCliente: TEXTO_FIJO.oblCliente,
    cambiosAlcance: TEXTO_FIJO.cambiosAlcance,
    propiedadIntelectual: TEXTO_FIJO.propiedadIntelectual,
    rescision: TEXTO_FIJO.rescision,
    confidencialidad: TEXTO_FIJO.confidencialidad,
    jurisdiccion: TEXTO_FIJO.jurisdiccion,
    mantenimiento: { activo: false, precioMensual: 0, descripcion: MANT_DEFAULT, excluye: MANT_EXCLUYE_DEFAULT },
    participacionIngresos: { activo: false, texto: '' },
    firmas: {
      prestadorNombre: m.empresa,
      prestadorRol: 'Prestador',
      prestadorDoc: '',
      clienteNombre: '',
      clienteRol: 'Cliente',
      clienteDoc: ''
    },
    notas: ''
  };
}

function migrarContenidoPresupuesto(c){
  const base = contenidoPresupuestoVacio();
  if(!c || typeof c !== 'object') return base;
  const out = { ...base, ...c };
  if(!out.descripcionFilas && (c.producto || c.descripcion)){
    out.descripcionFilas = [
      { etiqueta: 'Producto / Proyecto', valor: c.producto || '' },
      { etiqueta: 'Descripción', valor: c.descripcion || '' },
      { etiqueta: 'Tecnología', valor: c.tecnologia || '' },
      { etiqueta: 'Diseño', valor: c.diseno || '' },
      { etiqueta: 'Entrega', valor: c.entrega || '' }
    ];
  }
  if(!out.items && c.modulos) out.items = c.modulos;
  if(!out.bloques) out.bloques = base.bloques;
  if(!out.formatoItems) out.formatoItems = 'modulo';
  return out;
}

function migrarContenidoContrato(c){
  const base = contenidoContratoVacio();
  if(!c || typeof c !== 'object') return base;
  const out = { ...base, ...c };
  if(!out.items && c.modulos) out.items = c.modulos;
  if(!out.descripcionFilas){
    out.descripcionFilas = [
      { etiqueta: 'Objeto', valor: c.objeto || '' },
      { etiqueta: 'Alcance', valor: c.alcance || '' },
      { etiqueta: 'Plazo', valor: c.plazoEntrega || '' }
    ];
  }
  if(!out.firmas) out.firmas = base.firmas;
  if(c.terminacion && !c.rescision) out.rescision = c.terminacion;
  return out;
}

function pillEstadoDoc(estado){
  if(estado === 'Borrador') return 'pill-inactivo';
  if(estado === 'Enviado') return 'pill-alerta';
  if(estado === 'Aceptado' || estado === 'Aprobado' || estado === 'Firmado') return 'pill-vigente';
  return 'pill-vencido';
}

function labelTipoDoc(tipo){
  if(tipo === 'presupuesto') return 'Presupuesto';
  if(tipo === 'contrato') return 'Contrato';
  return 'Archivo';
}

function poblarFiltroEstadoDoc(){
  const sel = document.getElementById('f-doc-estado');
  if(!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">Todos los estados</option>' + ESTADOS_DOC.map(e => `<option>${e}</option>`).join('');
  if(cur) sel.value = cur;
}

async function proximoNumeroDoc(tipo){
  const pref = tipo === 'contrato' ? 'C' : tipo === 'archivo' ? 'A' : 'N';
  const { data } = await sb.from('documentos').select('numero').order('created_at', { ascending: false }).limit(200);
  let max = 0;
  (data || []).forEach(d => {
    const m = String(d.numero || '').match(/\d+/);
    if(m) max = Math.max(max, parseInt(m[0], 10));
  });
  return pref + String(max + 1).padStart(4, '0');
}

function actualizarStatsDocumentos(lista){
  const pres = lista.filter(d => d.tipo === 'presupuesto');
  const cont = lista.filter(d => d.tipo === 'contrato');
  const ok = lista.filter(d => ['Aceptado', 'Aprobado', 'Firmado'].includes(d.estado));
  const el = id => document.getElementById(id);
  if(el('d-total')) el('d-total').textContent = lista.length;
  if(el('d-pres')) el('d-pres').textContent = pres.length;
  if(el('d-cont')) el('d-cont').textContent = cont.length;
  if(el('d-ok')) el('d-ok').textContent = ok.length;
}

async function cargarDocumentos(){
  if(!sb || !requiereSupabase()) return;
  poblarFiltroEstadoDoc();
  const fTipo = document.getElementById('f-doc-tipo')?.value || '';
  const fEst = document.getElementById('f-doc-estado')?.value || '';
  const fDesde = document.getElementById('f-doc-desde')?.value || '';
  const fHasta = document.getElementById('f-doc-hasta')?.value || '';
  const fBus = (document.getElementById('f-doc-buscar')?.value || '').trim().toLowerCase();

  const { data, error } = await sb.from('documentos').select('*').order('fecha', { ascending: false }).order('created_at', { ascending: false });
  if(error){
    toast(supabaseErrMsg(error).replace('movimientos', 'documentos'));
    console.error('[Supabase documentos]', error);
    renderTablaDocumentos([]);
    return;
  }

  todosDocumentos = data || [];
  actualizarStatsDocumentos(todosDocumentos);

  let lista = todosDocumentos;
  if(fTipo) lista = lista.filter(d => d.tipo === fTipo);
  if(fEst) lista = lista.filter(d => d.estado === fEst);
  if(fDesde) lista = lista.filter(d => (d.fecha || '') >= fDesde);
  if(fHasta) lista = lista.filter(d => (d.fecha || '') <= fHasta);
  if(fBus) lista = lista.filter(d =>
    (d.cliente || '').toLowerCase().includes(fBus) ||
    String(d.numero || '').toLowerCase().includes(fBus) ||
    String(d.proyecto || '').toLowerCase().includes(fBus)
  );
  renderTablaDocumentos(lista);
}

function renderTablaDocumentos(lista){
  const tbody = document.getElementById('tabla-documentos');
  const empty = document.getElementById('empty-documentos');
  if(!tbody) return;
  if(!lista.length){
    tbody.innerHTML = '';
    if(empty) empty.style.display = 'block';
    return;
  }
  if(empty) empty.style.display = 'none';
  tbody.innerHTML = lista.map(d => {
    const proyecto = d.proyecto || (d.contenido && (d.contenido.proyecto || d.contenido.producto)) || '';
    const clienteProyecto = proyecto && proyecto !== d.cliente
      ? `${escDoc(d.cliente)}<div class="info-sub">${escDoc(proyecto)}</div>`
      : escDoc(d.cliente || '—');
    const esArchivo = d.origen === 'subido' || d.tipo === 'archivo';
    return `<tr>
      <td><strong>${escDoc(d.numero)}</strong></td>
      <td><span class="pill ${d.tipo === 'contrato' ? 'pill-alerta' : d.tipo === 'archivo' ? 'pill-inactivo' : 'pill-vigente'}">${labelTipoDoc(d.tipo)}</span></td>
      <td>${clienteProyecto}</td>
      <td style="font-size:12px">${d.fecha || '—'}</td>
      <td><span class="pill ${pillEstadoDoc(d.estado)}">${escDoc(d.estado)}</span></td>
      <td class="hide-mob">${escDoc(d.created_by)}</td>
      <td>
        <div class="acciones-cell">
          <button class="btn-ghost-edit" onclick="verDocumento('${d.id}')" title="Ver">👁</button>
          <button class="btn-ghost-edit" onclick="exportarPDFDocumento('${d.id}')" title="Descargar / Imprimir PDF">↓</button>
          ${esArchivo ? '' : `<button class="btn-ghost-edit" onclick="duplicarDocumento('${d.id}')" title="Duplicar">⧉</button>
          <button class="btn-ghost-edit" onclick="abrirEditarDocumento('${d.id}')" title="Editar">✎</button>`}
          ${esArchivo ? `<button class="btn-ghost-edit" onclick="abrirEditarDocumento('${d.id}')" title="Editar metadatos">✎</button>` : ''}
          <button class="btn-ghost-danger" onclick="eliminarDocumento('${d.id}')" title="Eliminar">×</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function buscarDocDebounce(){
  clearTimeout(buscarDocTimer);
  buscarDocTimer = setTimeout(cargarDocumentos, 350);
}

// ─── Filas dinámicas ─────────────────────────────────────────────

function renderDescRow(f, i, prefix){
  return `<div class="doc-dyn-row doc-desc-row" data-desc="${i}">
    <input type="text" class="${prefix}-desc-et" value="${escDoc(f.etiqueta)}" placeholder="Etiqueta">
    <input type="text" class="${prefix}-desc-val" value="${escDoc(f.valor)}" placeholder="Valor">
    <button type="button" class="btn-ghost-danger" onclick="this.closest('.doc-dyn-row').remove()">×</button>
  </div>`;
}

function renderItemRow(it, i, formato){
  const esCheck = formato === 'checklist';
  if(esCheck){
    return `<div class="doc-dyn-row doc-item-row" data-item="${i}">
      <span class="doc-chip" style="background:${chipColor(i)}">${escDoc(it.num || String(i+1).padStart(2,'0'))}</span>
      <input type="text" class="di-desc" value="${escDoc(it.descripcion || it.nombre)}" placeholder="Ítem del checklist" style="grid-column:span 3">
      <button type="button" class="btn-ghost-danger" onclick="eliminarFilaItem(${i})">×</button>
    </div>`;
  }
  return `<div class="doc-dyn-row doc-item-row" data-item="${i}" style="grid-template-columns:48px 1fr 1.2fr 90px 1fr 32px">
    <span class="doc-chip" style="background:${chipColor(i)}">${escDoc(it.num || String(i+1).padStart(2,'0'))}</span>
    <input type="text" class="di-nom" value="${escDoc(it.nombre)}" placeholder="Módulo">
    <textarea class="di-desc ta-desc" rows="1" placeholder="Funcionalidades">${escDoc(it.descripcion)}</textarea>
    <input type="number" class="di-precio" value="${it.precio || 0}" min="0" step="0.01" placeholder="USD" oninput="recalcTotalDesdeItems()">
    <input type="text" class="di-dep" value="${escDoc(it.dependencia || '')}" placeholder="Depende de…">
    <button type="button" class="btn-ghost-danger" onclick="eliminarFilaItem(${i})">×</button>
  </div>`;
}

function renderPagoRow(p, i, prefix){
  return `<div class="doc-dyn-row" data-pago="${i}">
    <input type="text" class="${prefix}-nom" value="${escDoc(p.nombre)}" placeholder="Hito">
    <input type="text" class="${prefix}-cuando" value="${escDoc(p.cuando)}" placeholder="Cuándo">
    <input type="number" class="${prefix}-monto" value="${p.monto || 0}" min="0" step="0.01" oninput="recalcPorcentajesPagos('${prefix}')">
    <span class="doc-pct ${prefix}-pct">0%</span>
    <button type="button" class="btn-ghost-danger" onclick="eliminarFilaPago('${prefix}',${i})">×</button>
  </div>`;
}

function formatoItemsActual(){
  return document.querySelector('input[name="doc-formato"]:checked')?.value || 'modulo';
}

function agregarDescFila(prefix){
  const list = document.getElementById(prefix + '-desc-list');
  const i = list.querySelectorAll('.doc-dyn-row').length;
  list.insertAdjacentHTML('beforeend', renderDescRow({ etiqueta:'', valor:'' }, i, prefix));
}

function agregarItem(){
  const list = document.getElementById('doc-items-list');
  const i = list.querySelectorAll('.doc-item-row').length;
  const formato = formatoItemsActual();
  list.insertAdjacentHTML('beforeend', renderItemRow({ num: String(i+1).padStart(2,'0'), nombre:'', descripcion:'', precio:0, dependencia:'' }, i, formato));
  renumerarChips();
}

function eliminarFilaItem(i){
  const rows = document.querySelectorAll('#doc-items-list .doc-item-row');
  if(rows.length <= 1){ toast('Debe haber al menos un ítem'); return; }
  rows[i]?.remove();
  renumerarChips();
  recalcTotalDesdeItems();
}

function renumerarChips(){
  document.querySelectorAll('#doc-items-list .doc-item-row').forEach((row, i) => {
    const chip = row.querySelector('.doc-chip');
    if(chip){
      chip.textContent = String(i + 1).padStart(2, '0');
      chip.style.background = chipColor(i);
    }
  });
}

function cambiarFormatoItems(){
  const items = leerItems();
  const list = document.getElementById('doc-items-list');
  const formato = formatoItemsActual();
  list.innerHTML = (items.length ? items : [{ num:'01', nombre:'', descripcion:'', precio:0 }])
    .map((it, i) => renderItemRow(it, i, formato)).join('');
  const depHint = document.getElementById('doc-dep-hint');
  if(depHint) depHint.style.display = formato === 'modulo' ? 'block' : 'none';
  recalcTotalDesdeItems();
}

function agregarPago(prefix){
  const list = document.getElementById(prefix + '-pagos-list');
  const i = list.querySelectorAll('.doc-dyn-row').length;
  list.insertAdjacentHTML('beforeend', renderPagoRow({ nombre:'', cuando:'', monto:0 }, i, prefix));
  recalcPorcentajesPagos(prefix);
}

function eliminarFilaPago(prefix, i){
  const list = document.getElementById(prefix + '-pagos-list');
  const rows = list.querySelectorAll('.doc-dyn-row');
  if(rows.length <= 1){ toast('Debe haber al menos un hito'); return; }
  rows[i]?.remove();
  recalcPorcentajesPagos(prefix);
}

function recalcPorcentajesPagos(prefix){
  const total = parseFloat(document.getElementById(prefix + '-precio-total')?.value) || 0;
  document.querySelectorAll(`#${prefix}-pagos-list .doc-dyn-row`).forEach(row => {
    const m = parseFloat(row.querySelector('.' + prefix + '-monto')?.value) || 0;
    const pct = total > 0 ? Math.round((m / total) * 100) : 0;
    const el = row.querySelector('.' + prefix + '-pct');
    if(el) el.textContent = pct + '%';
  });
}

function recalcTotalDesdeItems(){
  if(formatoItemsActual() !== 'modulo') return;
  const sum = leerItems().reduce((a, it) => a + (Number(it.precio) || 0), 0);
  const el = document.getElementById('dp-precio-total') || document.getElementById('dc-precio-total');
  if(el && (!el.dataset.manual || el.value === '' || el.value === '0')){
    el.value = sum;
  }
  const prefix = document.getElementById('dp-precio-total') ? 'dp' : 'dc';
  recalcPorcentajesPagos(prefix);
}

function toggleMantFields(prefix){
  const on = document.getElementById(prefix + '-mant-on')?.checked;
  const el = document.getElementById(prefix + '-mant-fields');
  if(el) el.style.display = on ? 'block' : 'none';
}

function toggleBloque(id){
  const on = document.getElementById(id + '-on')?.checked;
  const el = document.getElementById(id + '-fields');
  if(el) el.style.display = on ? 'block' : 'none';
}

function leerDescFilas(prefix){
  return Array.from(document.querySelectorAll(`#${prefix}-desc-list .doc-dyn-row`)).map(row => ({
    etiqueta: row.querySelector('.' + prefix + '-desc-et')?.value || '',
    valor: row.querySelector('.' + prefix + '-desc-val')?.value || ''
  }));
}

function leerItems(){
  const formato = formatoItemsActual();
  return Array.from(document.querySelectorAll('#doc-items-list .doc-item-row')).map((row, i) => {
    if(formato === 'checklist'){
      return {
        num: String(i + 1).padStart(2, '0'),
        nombre: '',
        descripcion: row.querySelector('.di-desc')?.value || '',
        precio: 0,
        dependencia: ''
      };
    }
    return {
      num: String(i + 1).padStart(2, '0'),
      nombre: row.querySelector('.di-nom')?.value || '',
      descripcion: row.querySelector('.di-desc')?.value || '',
      precio: parseFloat(row.querySelector('.di-precio')?.value) || 0,
      dependencia: row.querySelector('.di-dep')?.value || ''
    };
  });
}

function leerPagos(prefix){
  return Array.from(document.querySelectorAll(`#${prefix}-pagos-list .doc-dyn-row`)).map(row => ({
    nombre: row.querySelector('.' + prefix + '-nom')?.value || '',
    cuando: row.querySelector('.' + prefix + '-cuando')?.value || '',
    monto: parseFloat(row.querySelector('.' + prefix + '-monto')?.value) || 0
  }));
}

function leerMantenimiento(prefix){
  return {
    activo: !!document.getElementById(prefix + '-mant-on')?.checked,
    precioMensual: parseFloat(document.getElementById(prefix + '-mant-precio')?.value) || 0,
    descripcion: document.getElementById(prefix + '-mant-desc')?.value || MANT_DEFAULT,
    excluye: document.getElementById(prefix + '-mant-excl')?.value || MANT_EXCLUYE_DEFAULT
  };
}

// ─── Formularios ─────────────────────────────────────────────────

function renderFormPresupuesto(c){
  const m = marcaDoc();
  const items = (c.items && c.items.length) ? c.items : [{ num:'01', nombre:'', descripcion:'', precio:0 }];
  const pagos = (c.pagos && c.pagos.length) ? c.pagos : contenidoPresupuestoVacio().pagos;
  const desc = (c.descripcionFilas && c.descripcionFilas.length) ? c.descripcionFilas : contenidoPresupuestoVacio().descripcionFilas;
  const mp = c.mediosPago || {};
  const mant = c.mantenimiento || { activo:false, precioMensual:0, descripcion:MANT_DEFAULT, excluye:MANT_EXCLUYE_DEFAULT };
  const b = c.bloques || contenidoPresupuestoVacio().bloques;
  const formato = c.formatoItems || 'modulo';

  return `
    <details class="doc-section" open><summary>1. Encabezado</summary>
      <div class="form-grid form-2 doc-sec-body">
        <div class="field"><label>Número</label><input id="dp-numero" type="text"></div>
        <div class="field"><label>Fecha</label><input id="dp-fecha" type="date"></div>
        <div class="field"><label>Cliente</label><input id="dp-cliente" type="text"></div>
        <div class="field"><label>Proyecto</label><input id="dp-proyecto" type="text" value="${escDoc(c.proyecto || '')}"></div>
        <div class="field"><label>Estado</label><select id="dp-estado">${ESTADOS_DOC.map(e=>`<option>${e}</option>`).join('')}</select></div>
        <div class="field"><label>Empresa (marca)</label><input type="text" value="${escDoc(m.empresa)}" disabled></div>
      </div>
    </details>
    <details class="doc-section" open><summary>2. Descripción del proyecto</summary>
      <div class="doc-sec-body">
        <div id="dp-desc-list">${desc.map((f,i)=>renderDescRow(f,i,'dp')).join('')}</div>
        <button type="button" class="btn-doc-add" onclick="agregarDescFila('dp')">+ Fila</button>
      </div>
    </details>
    <details class="doc-section" open><summary>3. Ítems</summary>
      <div class="doc-sec-body">
        <div class="doc-checks" style="margin-bottom:10px">
          <label class="doc-check"><input type="radio" name="doc-formato" value="checklist" ${formato==='checklist'?'checked':''} onchange="cambiarFormatoItems()"> Checklist (sin precio por ítem)</label>
          <label class="doc-check"><input type="radio" name="doc-formato" value="modulo" ${formato!=='checklist'?'checked':''} onchange="cambiarFormatoItems()"> Por módulo (con precio)</label>
        </div>
        <p id="doc-dep-hint" class="info-hint" style="display:${formato==='modulo'?'block':'none'}">En formato módulo podés indicar dependencia entre módulos.</p>
        <div id="doc-items-list">${items.map((it,i)=>renderItemRow(it,i,formato)).join('')}</div>
        <button type="button" class="btn-doc-add" onclick="agregarItem()">+ Agregar ítem</button>
      </div>
    </details>
    <details class="doc-section"><summary>4. Precio y forma de pago</summary>
      <div class="doc-sec-body">
        <div class="form-grid form-2">
          <div class="field"><label>Precio total USD</label><input id="dp-precio-total" type="number" min="0" step="0.01" value="${c.precioTotal||0}" oninput="this.dataset.manual='1';recalcPorcentajesPagos('dp')"></div>
          <div class="field"><label>Cuotas</label>
            <select id="dp-cuotas" onchange="aplicarCuotasPresupuesto()">
              <option value="1" ${Number(c.cuotas)===1?'selected':''}>1 cuota</option>
              <option value="2" ${Number(c.cuotas)!==1?'selected':''}>2 cuotas</option>
            </select>
          </div>
        </div>
        <div id="dp-pagos-list" style="margin-top:10px">${pagos.map((p,i)=>renderPagoRow(p,i,'dp')).join('')}</div>
        <button type="button" class="btn-doc-add" onclick="agregarPago('dp')">+ Hito</button>
        <label class="doc-check" style="margin-top:12px"><input type="checkbox" id="dp-blue" ${c.clausulaBlue!==false?'checked':''}> Cláusula dólar blue (ARS)</label>
        <div style="margin-top:10px;font-size:12px;font-weight:600;color:var(--text3)">MEDIOS DE PAGO</div>
        <div class="doc-checks">
          <label class="doc-check"><input type="checkbox" id="dp-mp-tr" ${mp.transferencia!==false?'checked':''}> Transferencia</label>
          <label class="doc-check"><input type="checkbox" id="dp-mp-mp" ${mp.mercadopago?'checked':''}> MercadoPago</label>
          <label class="doc-check"><input type="checkbox" id="dp-mp-ef" ${mp.efectivo?'checked':''}> Efectivo</label>
          <label class="doc-check"><input type="checkbox" id="dp-mp-wise" ${mp.wise?'checked':''}> Wise</label>
        </div>
      </div>
    </details>
    <details class="doc-section"><summary>5. Bloques opcionales</summary>
      <div class="doc-sec-body">
        <label class="doc-check"><input type="checkbox" id="blk-noIncluye-on" ${b.noIncluye?.activo?'checked':''} onchange="toggleBloque('blk-noIncluye')"> Qué no incluye</label>
        <div id="blk-noIncluye-fields" style="${b.noIncluye?.activo?'':'display:none'}"><textarea id="blk-noIncluye-txt" class="ta-desc" rows="2">${escDoc(b.noIncluye?.texto||'')}</textarea></div>
        <label class="doc-check"><input type="checkbox" id="blk-resumen-on" ${b.resumenModulos?.activo!==false?'checked':''}> Resumen de módulos con total</label>
        <label class="doc-check"><input type="checkbox" id="blk-part-on" ${b.participacionIngresos?.activo?'checked':''} onchange="toggleBloque('blk-part')"> Participación en ingresos</label>
        <div id="blk-part-fields" style="${b.participacionIngresos?.activo?'':'display:none'}"><textarea id="blk-part-txt" class="ta-desc" rows="2">${escDoc(b.participacionIngresos?.texto||'')}</textarea></div>
        <label class="doc-check"><input type="checkbox" id="blk-costos-on" ${b.costosExternos?.activo?'checked':''} onchange="toggleBloque('blk-costos')"> Costos externos</label>
        <div id="blk-costos-fields" style="${b.costosExternos?.activo?'':'display:none'}"><textarea id="blk-costos-txt" class="ta-desc" rows="2">${escDoc(b.costosExternos?.texto||'')}</textarea></div>
        <label class="doc-check"><input type="checkbox" id="blk-cond-on" ${b.condicionesGenerales?.activo?'checked':''} onchange="toggleBloque('blk-cond')"> Condiciones generales</label>
        <div id="blk-cond-fields" style="${b.condicionesGenerales?.activo?'':'display:none'}"><textarea id="blk-cond-txt" class="ta-desc" rows="2">${escDoc(b.condicionesGenerales?.texto||'')}</textarea></div>
        <label class="doc-check"><input type="checkbox" id="blk-capt-on" ${b.responsabilidadCaptacion?.activo?'checked':''} onchange="toggleBloque('blk-capt')"> Responsabilidad captación de clientes</label>
        <div id="blk-capt-fields" style="${b.responsabilidadCaptacion?.activo?'':'display:none'}"><textarea id="blk-capt-txt" class="ta-desc" rows="2">${escDoc(b.responsabilidadCaptacion?.texto||contenidoPresupuestoVacio().bloques.responsabilidadCaptacion.texto)}</textarea></div>
      </div>
    </details>
    <details class="doc-section"><summary>6. Mantenimiento mensual</summary>
      <div class="doc-sec-body">
        <label class="doc-check"><input type="checkbox" id="dp-mant-on" ${mant.activo?'checked':''} onchange="toggleMantFields('dp')"> Incluir mantenimiento</label>
        <div id="dp-mant-fields" style="${mant.activo?'':'display:none'}">
          <div class="field" style="margin-top:8px"><label>Precio mensual USD</label><input id="dp-mant-precio" type="number" min="0" step="0.01" value="${mant.precioMensual||0}"></div>
          <div class="field" style="margin-top:8px"><label>Incluye</label><textarea id="dp-mant-desc" class="ta-desc" rows="2">${escDoc(mant.descripcion||MANT_DEFAULT)}</textarea></div>
          <div class="field" style="margin-top:8px"><label>No incluye</label><textarea id="dp-mant-excl" class="ta-desc" rows="2">${escDoc(mant.excluye||MANT_EXCLUYE_DEFAULT)}</textarea></div>
        </div>
      </div>
    </details>
    <details class="doc-section"><summary>7. Validez</summary>
      <div class="doc-sec-body">
        <div class="field"><label>Validez (días)</label><input id="dp-validez" type="number" min="1" value="${c.validezDias||15}"></div>
        <div class="field" style="margin-top:8px"><label>Notas</label><textarea id="dp-notas" class="ta-desc" rows="2">${escDoc(c.notas||'')}</textarea></div>
      </div>
    </details>`;
}

function renderFormContrato(c){
  const m = marcaDoc();
  const items = (c.items && c.items.length) ? c.items : [{ num:'01', nombre:'', descripcion:'', precio:0 }];
  const pagos = (c.pagos && c.pagos.length) ? c.pagos : contenidoContratoVacio().pagos;
  const desc = (c.descripcionFilas && c.descripcionFilas.length) ? c.descripcionFilas : contenidoContratoVacio().descripcionFilas;
  const mant = c.mantenimiento || { activo:false, precioMensual:0, descripcion:MANT_DEFAULT, excluye:MANT_EXCLUYE_DEFAULT };
  const firmas = c.firmas || contenidoContratoVacio().firmas;
  const formato = c.formatoItems || 'modulo';

  return `
    <details class="doc-section" open><summary>1. Encabezado y partes</summary>
      <div class="form-grid form-2 doc-sec-body">
        <div class="field"><label>Número</label><input id="dc-numero" type="text"></div>
        <div class="field"><label>Fecha</label><input id="dc-fecha" type="date"></div>
        <div class="field"><label>Ciudad</label><input id="dc-ciudad" type="text" value="${escDoc(c.ciudad||'San Nicolás de los Arroyos')}"></div>
        <div class="field"><label>Estado</label><select id="dc-estado">${ESTADOS_DOC.map(e=>`<option>${e}</option>`).join('')}</select></div>
        <div class="field" style="grid-column:1/-1"><label>Prestador (fijo)</label><input type="text" value="${escDoc(m.empresa)}" disabled></div>
        <div class="field"><label>Cliente / Razón social</label><input id="dc-cliente" type="text"></div>
        <div class="field"><label>Proyecto</label><input id="dc-proyecto" type="text" value="${escDoc(c.proyecto||'')}"></div>
        <div class="field"><label>CUIT</label><input id="dc-cuit" type="text" value="${escDoc(c.clienteCuit||'')}"></div>
        <div class="field"><label>DNI</label><input id="dc-dni" type="text" value="${escDoc(c.clienteDni||'')}"></div>
        <div class="field"><label>Email cliente</label><input id="dc-email" type="email" value="${escDoc(c.clienteEmail||'')}"></div>
        <div class="field"><label>Representante</label><input id="dc-representante" type="text" value="${escDoc(c.representante||'')}"></div>
        <div class="field" style="grid-column:1/-1"><label>Domicilio</label><input id="dc-domicilio" type="text" value="${escDoc(c.clienteDomicilio||'')}"></div>
      </div>
    </details>
    <details class="doc-section" open><summary>2. Objeto (mini-tabla)</summary>
      <div class="doc-sec-body">
        <div id="dc-desc-list">${desc.map((f,i)=>renderDescRow(f,i,'dc')).join('')}</div>
        <button type="button" class="btn-doc-add" onclick="agregarDescFila('dc')">+ Fila</button>
      </div>
    </details>
    <details class="doc-section" open><summary>3. Módulos y precio</summary>
      <div class="doc-sec-body">
        <div class="doc-checks" style="margin-bottom:10px">
          <label class="doc-check"><input type="radio" name="doc-formato" value="checklist" ${formato==='checklist'?'checked':''} onchange="cambiarFormatoItems()"> Checklist</label>
          <label class="doc-check"><input type="radio" name="doc-formato" value="modulo" ${formato!=='checklist'?'checked':''} onchange="cambiarFormatoItems()"> Por módulo</label>
        </div>
        <div class="field" style="margin-bottom:8px"><label>Esquema de pago</label>
          <select id="dc-esquema">
            <option value="cuotas" ${c.esquemaPago!=='por_modulo'?'selected':''}>Cuotas iguales sobre el total</option>
            <option value="por_modulo" ${c.esquemaPago==='por_modulo'?'selected':''}>100% de cada módulo al confirmarlo</option>
          </select>
        </div>
        <div id="doc-items-list">${items.map((it,i)=>renderItemRow(it,i,formato)).join('')}</div>
        <button type="button" class="btn-doc-add" onclick="agregarItem()">+ Módulo / ítem</button>
        <div class="field" style="margin-top:10px"><label>Precio total USD</label><input id="dc-precio-total" type="number" min="0" step="0.01" value="${c.precioTotal||0}" oninput="this.dataset.manual='1';recalcPorcentajesPagos('dc')"></div>
        <div id="dc-pagos-list" style="margin-top:10px">${pagos.map((p,i)=>renderPagoRow(p,i,'dc')).join('')}</div>
        <button type="button" class="btn-doc-add" onclick="agregarPago('dc')">+ Hito</button>
      </div>
    </details>
    <details class="doc-section"><summary>4. Artículos estándar</summary>
      <div class="doc-sec-body">
        <div class="field"><label>Plazo de entrega</label><textarea id="dc-plazo" class="ta-desc" rows="2">${escDoc(c.plazoEntrega||TEXTO_FIJO.plazoEntrega)}</textarea></div>
        <div class="field" style="margin-top:8px"><label>Obligaciones del prestador</label><textarea id="dc-obl-p" class="ta-desc" rows="2">${escDoc(c.oblPrestador||TEXTO_FIJO.oblPrestador)}</textarea></div>
        <div class="field" style="margin-top:8px"><label>Obligaciones del cliente</label><textarea id="dc-obl-c" class="ta-desc" rows="2">${escDoc(c.oblCliente||TEXTO_FIJO.oblCliente)}</textarea></div>
        <div class="field" style="margin-top:8px"><label>Cambios de alcance</label><textarea id="dc-cambios" class="ta-desc" rows="2">${escDoc(c.cambiosAlcance||TEXTO_FIJO.cambiosAlcance)}</textarea></div>
        <div class="field" style="margin-top:8px"><label>Propiedad intelectual</label><textarea id="dc-pi" class="ta-desc" rows="2">${escDoc(c.propiedadIntelectual||TEXTO_FIJO.propiedadIntelectual)}</textarea></div>
        <div class="field" style="margin-top:8px"><label>Rescisión</label><textarea id="dc-rescision" class="ta-desc" rows="2">${escDoc(c.rescision||TEXTO_FIJO.rescision)}</textarea></div>
        <div class="field" style="margin-top:8px"><label>Confidencialidad</label><textarea id="dc-conf" class="ta-desc" rows="2">${escDoc(c.confidencialidad||TEXTO_FIJO.confidencialidad)}</textarea></div>
        <div class="field" style="margin-top:8px"><label>Jurisdicción y ley aplicable</label><textarea id="dc-jurisdiccion" class="ta-desc" rows="2">${escDoc(c.jurisdiccion||TEXTO_FIJO.jurisdiccion)}</textarea></div>
      </div>
    </details>
    <details class="doc-section"><summary>5. Bloques opcionales</summary>
      <div class="doc-sec-body">
        <label class="doc-check"><input type="checkbox" id="dc-mant-on" ${mant.activo?'checked':''} onchange="toggleMantFields('dc')"> Mantenimiento mensual</label>
        <div id="dc-mant-fields" style="${mant.activo?'':'display:none'}">
          <div class="field" style="margin-top:8px"><label>Precio mensual USD</label><input id="dc-mant-precio" type="number" min="0" step="0.01" value="${mant.precioMensual||0}"></div>
          <div class="field" style="margin-top:8px"><label>Incluye</label><textarea id="dc-mant-desc" class="ta-desc" rows="2">${escDoc(mant.descripcion||MANT_DEFAULT)}</textarea></div>
          <div class="field" style="margin-top:8px"><label>No incluye</label><textarea id="dc-mant-excl" class="ta-desc" rows="2">${escDoc(mant.excluye||MANT_EXCLUYE_DEFAULT)}</textarea></div>
        </div>
        <label class="doc-check" style="margin-top:8px"><input type="checkbox" id="dc-part-on" ${c.participacionIngresos?.activo?'checked':''} onchange="toggleBloque('dc-part')"> Participación en ingresos</label>
        <div id="dc-part-fields" style="${c.participacionIngresos?.activo?'':'display:none'}"><textarea id="dc-part-txt" class="ta-desc" rows="2">${escDoc(c.participacionIngresos?.texto||'')}</textarea></div>
      </div>
    </details>
    <details class="doc-section"><summary>6. Firmas</summary>
      <div class="form-grid form-2 doc-sec-body">
        <div class="field"><label>Prestador — Nombre</label><input id="dc-fp-nom" type="text" value="${escDoc(firmas.prestadorNombre||m.empresa)}"></div>
        <div class="field"><label>Cliente — Nombre</label><input id="dc-fc-nom" type="text" value="${escDoc(firmas.clienteNombre||'')}"></div>
        <div class="field"><label>Prestador — Rol</label><input id="dc-fp-rol" type="text" value="${escDoc(firmas.prestadorRol||'Prestador')}"></div>
        <div class="field"><label>Cliente — Rol</label><input id="dc-fc-rol" type="text" value="${escDoc(firmas.clienteRol||'Cliente')}"></div>
        <div class="field"><label>Prestador — CUIT/DNI</label><input id="dc-fp-doc" type="text" value="${escDoc(firmas.prestadorDoc||'')}"></div>
        <div class="field"><label>Cliente — CUIT/DNI</label><input id="dc-fc-doc" type="text" value="${escDoc(firmas.clienteDoc||'')}"></div>
      </div>
    </details>`;
}

function aplicarCuotasPresupuesto(){
  const n = parseInt(document.getElementById('dp-cuotas')?.value, 10) || 1;
  const total = parseFloat(document.getElementById('dp-precio-total')?.value) || 0;
  const list = document.getElementById('dp-pagos-list');
  if(!list) return;
  if(n === 1){
    list.innerHTML = renderPagoRow({ nombre:'Pago único', cuando:'Al firmar / entregar', monto: total }, 0, 'dp');
  } else {
    const mitad = Math.round((total / 2) * 100) / 100;
    list.innerHTML =
      renderPagoRow({ nombre:'1° Pago — Anticipo', cuando:'Al firmar el contrato', monto: mitad }, 0, 'dp') +
      renderPagoRow({ nombre:'2° Pago — Entrega', cuando:'Al entregar el sistema', monto: Math.round((total - mitad) * 100) / 100 }, 1, 'dp');
  }
  recalcPorcentajesPagos('dp');
}

function recolectarPresupuesto(){
  return {
    formatoItems: formatoItemsActual(),
    proyecto: document.getElementById('dp-proyecto')?.value || '',
    descripcionFilas: leerDescFilas('dp'),
    items: leerItems(),
    precioTotal: parseFloat(document.getElementById('dp-precio-total')?.value) || 0,
    cuotas: parseInt(document.getElementById('dp-cuotas')?.value, 10) || 1,
    pagos: leerPagos('dp'),
    clausulaBlue: document.getElementById('dp-blue')?.checked,
    mediosPago: {
      transferencia: document.getElementById('dp-mp-tr')?.checked,
      mercadopago: document.getElementById('dp-mp-mp')?.checked,
      efectivo: document.getElementById('dp-mp-ef')?.checked,
      wise: document.getElementById('dp-mp-wise')?.checked
    },
    mantenimiento: leerMantenimiento('dp'),
    bloques: {
      noIncluye: { activo: !!document.getElementById('blk-noIncluye-on')?.checked, texto: document.getElementById('blk-noIncluye-txt')?.value || '' },
      resumenModulos: { activo: !!document.getElementById('blk-resumen-on')?.checked },
      participacionIngresos: { activo: !!document.getElementById('blk-part-on')?.checked, texto: document.getElementById('blk-part-txt')?.value || '' },
      costosExternos: { activo: !!document.getElementById('blk-costos-on')?.checked, texto: document.getElementById('blk-costos-txt')?.value || '' },
      condicionesGenerales: { activo: !!document.getElementById('blk-cond-on')?.checked, texto: document.getElementById('blk-cond-txt')?.value || '' },
      responsabilidadCaptacion: { activo: !!document.getElementById('blk-capt-on')?.checked, texto: document.getElementById('blk-capt-txt')?.value || '' }
    },
    validezDias: parseInt(document.getElementById('dp-validez')?.value, 10) || 15,
    notas: document.getElementById('dp-notas')?.value || ''
  };
}

function recolectarContrato(){
  return {
    ciudad: document.getElementById('dc-ciudad')?.value || '',
    proyecto: document.getElementById('dc-proyecto')?.value || '',
    clienteCuit: document.getElementById('dc-cuit')?.value || '',
    clienteDni: document.getElementById('dc-dni')?.value || '',
    clienteDomicilio: document.getElementById('dc-domicilio')?.value || '',
    clienteEmail: document.getElementById('dc-email')?.value || '',
    representante: document.getElementById('dc-representante')?.value || '',
    formatoItems: formatoItemsActual(),
    esquemaPago: document.getElementById('dc-esquema')?.value || 'cuotas',
    descripcionFilas: leerDescFilas('dc'),
    items: leerItems(),
    precioTotal: parseFloat(document.getElementById('dc-precio-total')?.value) || 0,
    pagos: leerPagos('dc'),
    plazoEntrega: document.getElementById('dc-plazo')?.value || '',
    oblPrestador: document.getElementById('dc-obl-p')?.value || '',
    oblCliente: document.getElementById('dc-obl-c')?.value || '',
    cambiosAlcance: document.getElementById('dc-cambios')?.value || '',
    propiedadIntelectual: document.getElementById('dc-pi')?.value || '',
    rescision: document.getElementById('dc-rescision')?.value || '',
    confidencialidad: document.getElementById('dc-conf')?.value || '',
    jurisdiccion: document.getElementById('dc-jurisdiccion')?.value || '',
    mantenimiento: leerMantenimiento('dc'),
    participacionIngresos: {
      activo: !!document.getElementById('dc-part-on')?.checked,
      texto: document.getElementById('dc-part-txt')?.value || ''
    },
    firmas: {
      prestadorNombre: document.getElementById('dc-fp-nom')?.value || '',
      prestadorRol: document.getElementById('dc-fp-rol')?.value || '',
      prestadorDoc: document.getElementById('dc-fp-doc')?.value || '',
      clienteNombre: document.getElementById('dc-fc-nom')?.value || '',
      clienteRol: document.getElementById('dc-fc-rol')?.value || '',
      clienteDoc: document.getElementById('dc-fc-doc')?.value || ''
    },
    notas: ''
  };
}

async function abrirNuevoDocumento(tipo){
  if(typeof requiereSupabase !== 'function' || !requiereSupabase()) return;
  if(typeof cargarConfiguracion === 'function' && !configCMR) await cargarConfiguracion();
  editandoDocumentoId = null;
  editandoTipoDoc = tipo === 'contrato' ? 'contrato' : 'presupuesto';
  const numero = await proximoNumeroDoc(editandoTipoDoc);
  const hoy = new Date().toISOString().slice(0, 10);
  const titulo = document.getElementById('modal-doc-title');
  const body = document.getElementById('modal-doc-body');
  if(titulo) titulo.textContent = editandoTipoDoc === 'presupuesto' ? 'Nuevo presupuesto' : 'Nuevo contrato';

  if(editandoTipoDoc === 'presupuesto'){
    const c = contenidoPresupuestoVacio();
    body.innerHTML = renderFormPresupuesto(c);
    document.getElementById('dp-numero').value = numero;
    document.getElementById('dp-fecha').value = hoy;
    document.getElementById('dp-estado').value = 'Borrador';
    recalcPorcentajesPagos('dp');
  } else {
    const c = contenidoContratoVacio();
    body.innerHTML = renderFormContrato(c);
    document.getElementById('dc-numero').value = numero;
    document.getElementById('dc-fecha').value = hoy;
    document.getElementById('dc-estado').value = 'Borrador';
    recalcPorcentajesPagos('dc');
  }
  document.getElementById('modal-documento').classList.add('open');
  const btnDl = document.getElementById('btn-descargar-doc');
  const btnVista = document.getElementById('btn-vista-doc');
  if(btnDl) btnDl.style.display = 'none';
  if(btnVista) btnVista.style.display = '';
  toggleDocIaToolbar();
}

async function abrirEditarDocumento(id){
  if(!requiereSupabase()) return;
  if(typeof cargarConfiguracion === 'function' && !configCMR) await cargarConfiguracion();
  const { data: d, error } = await sb.from('documentos').select('*').eq('id', id).single();
  if(error || !d){ toast('No se pudo cargar el documento'); return; }
  editandoDocumentoId = id;
  editandoTipoDoc = d.tipo;

  if(d.origen === 'subido' || d.tipo === 'archivo' || d.contenido?.archivoData){
    const tipoActual = ['presupuesto', 'contrato', 'archivo'].includes(d.tipo) ? d.tipo : 'archivo';
    document.getElementById('modal-doc-title').textContent = `Archivo ${d.numero}`;
    document.getElementById('modal-doc-body').innerHTML = `
      <div class="form-grid form-2">
        <div class="field"><label>Número</label><input id="da-numero" type="text" value="${escDoc(d.numero)}"></div>
        <div class="field"><label>Fecha</label><input id="da-fecha" type="date" value="${d.fecha||''}"></div>
        <div class="field" style="grid-column:1/-1"><label>Cliente / Proyecto</label><input id="da-cliente" type="text" value="${escDoc(d.cliente||'')}"></div>
        <div class="field"><label>Tipo</label>
          <select id="da-tipo">
            <option value="archivo" ${tipoActual==='archivo'?'selected':''}>Archivo</option>
            <option value="presupuesto" ${tipoActual==='presupuesto'?'selected':''}>Presupuesto</option>
            <option value="contrato" ${tipoActual==='contrato'?'selected':''}>Contrato</option>
          </select>
        </div>
        <div class="field"><label>Estado</label><select id="da-estado">${ESTADOS_DOC.map(e=>`<option ${e===d.estado?'selected':''}>${e}</option>`).join('')}</select></div>
        <div class="field" style="grid-column:1/-1"><label>Archivo</label><input type="text" value="${escDoc(d.archivo_nombre||'adjunto')}" disabled></div>
      </div>`;
    editandoTipoDoc = 'subido';
  } else if(d.tipo === 'presupuesto'){
    const c = migrarContenidoPresupuesto(d.contenido);
    document.getElementById('modal-doc-title').textContent = `Presupuesto ${d.numero}`;
    document.getElementById('modal-doc-body').innerHTML = renderFormPresupuesto(c);
    document.getElementById('dp-numero').value = d.numero;
    document.getElementById('dp-fecha').value = d.fecha;
    document.getElementById('dp-cliente').value = d.cliente;
    document.getElementById('dp-proyecto').value = d.proyecto || c.proyecto || '';
    document.getElementById('dp-estado').value = ESTADOS_DOC.includes(d.estado) ? d.estado : (d.estado === 'Aprobado' ? 'Aceptado' : 'Borrador');
    recalcPorcentajesPagos('dp');
  } else {
    const c = migrarContenidoContrato(d.contenido);
    document.getElementById('modal-doc-title').textContent = `Contrato ${d.numero}`;
    document.getElementById('modal-doc-body').innerHTML = renderFormContrato(c);
    document.getElementById('dc-numero').value = d.numero;
    document.getElementById('dc-fecha').value = d.fecha;
    document.getElementById('dc-cliente').value = d.cliente;
    document.getElementById('dc-proyecto').value = d.proyecto || c.proyecto || '';
    document.getElementById('dc-estado').value = ESTADOS_DOC.includes(d.estado) ? d.estado : 'Borrador';
    recalcPorcentajesPagos('dc');
  }

  document.getElementById('modal-documento').classList.add('open');
  const btnDl = document.getElementById('btn-descargar-doc');
  const btnVista = document.getElementById('btn-vista-doc');
  if(btnDl) btnDl.style.display = '';
  if(btnVista) btnVista.style.display = (editandoTipoDoc === 'archivo' || editandoTipoDoc === 'subido') ? 'none' : '';
  toggleDocIaToolbar();
}

function cerrarModalDocumento(){
  document.getElementById('modal-documento')?.classList.remove('open');
  editandoDocumentoId = null;
}

function toggleDocIaToolbar(){
  const el = document.getElementById('doc-ia-toolbar');
  if(el) el.style.display = (editandoTipoDoc === 'presupuesto' || editandoTipoDoc === 'contrato') ? 'block' : 'none';
}

let autocompletandoDoc = false;

async function autocompletarDesdeArchivo(file){
  if(!file) return;
  if(!requiereSupabase()) return;
  if(editandoTipoDoc !== 'presupuesto' && editandoTipoDoc !== 'contrato'){
    toast('Solo disponible para presupuestos y contratos');
    return;
  }
  if(file.type !== 'application/pdf'){ toast('Elegí un archivo PDF'); return; }
  if(file.size > 8 * 1024 * 1024){ toast('Máximo 8 MB'); return; }
  if(autocompletandoDoc) return;
  autocompletandoDoc = true;

  const btn = document.getElementById('btn-doc-ia');
  const textoOriginal = btn?.textContent;
  if(btn){ btn.disabled = true; btn.textContent = 'Leyendo PDF…'; }

  try {
    const dataUrl = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    const base64 = String(dataUrl).split(',')[1] || '';

    const cfg = window.SUPABASE_CONFIG;
    const res = await fetch(`${cfg.url}/functions/v1/autocompletar-documento`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.anonKey}`, 'apikey': cfg.anonKey },
      body: JSON.stringify({ tipo: editandoTipoDoc, pdfBase64: base64, mimeType: file.type })
    });
    const data = await res.json();
    if(!res.ok || data.error){
      toast('No se pudo leer el PDF: ' + (data?.error || 'error desconocido'));
      return;
    }
    aplicarDatosExtraidosDoc(data);
    toast('Datos completados desde el PDF — revisalos antes de guardar');
  } catch(e){
    console.error('[autocompletar PDF]', e);
    toast('Error al leer el PDF');
  } finally {
    autocompletandoDoc = false;
    if(btn){ btn.disabled = false; btn.textContent = textoOriginal || '📄 Autocompletar desde PDF'; }
    const inputFile = document.getElementById('doc-ia-file');
    if(inputFile) inputFile.value = '';
  }
}

function aplicarDatosExtraidosDoc(d){
  const esPres = editandoTipoDoc === 'presupuesto';
  const numId = esPres ? 'dp-numero' : 'dc-numero';
  const fechaId = esPres ? 'dp-fecha' : 'dc-fecha';
  const clienteId = esPres ? 'dp-cliente' : 'dc-cliente';
  const estadoId = esPres ? 'dp-estado' : 'dc-estado';
  const numeroActual = document.getElementById(numId)?.value || '';
  const fechaActual = document.getElementById(fechaId)?.value || '';
  const estadoActual = document.getElementById(estadoId)?.value || '';

  const contenido = esPres ? migrarContenidoPresupuesto(d.contenido || {}) : migrarContenidoContrato(d.contenido || {});
  document.getElementById('modal-doc-body').innerHTML = esPres ? renderFormPresupuesto(contenido) : renderFormContrato(contenido);

  const numEl = document.getElementById(numId);
  if(numEl) numEl.value = numeroActual;
  const fechaEl = document.getElementById(fechaId);
  if(fechaEl) fechaEl.value = d.fecha || fechaActual;
  const clienteEl = document.getElementById(clienteId);
  if(clienteEl) clienteEl.value = d.cliente || '';
  const estadoEl = document.getElementById(estadoId);
  if(estadoEl) estadoEl.value = estadoActual || 'Borrador';

  recalcPorcentajesPagos(esPres ? 'dp' : 'dc');
}

async function guardarDocumento(){
  if(!requiereSupabase()) return;
  let tipo = editandoTipoDoc;
  let numero, fecha, cliente, estado, proyecto, contenido, origen, archivo_nombre, archivo_mime;

  const esSubido = editandoTipoDoc === 'subido' || editandoTipoDoc === 'archivo' || document.getElementById('da-tipo');
  if(esSubido){
    numero = (document.getElementById('da-numero')?.value || '').trim();
    fecha = document.getElementById('da-fecha')?.value;
    cliente = (document.getElementById('da-cliente')?.value || '').trim();
    estado = document.getElementById('da-estado')?.value;
    tipo = document.getElementById('da-tipo')?.value || tipo || 'archivo';
    proyecto = null;
    origen = 'subido';
    contenido = null;
  } else {
    const esPres = tipo === 'presupuesto';
    numero = (document.getElementById(esPres ? 'dp-numero' : 'dc-numero')?.value || '').trim();
    fecha = document.getElementById(esPres ? 'dp-fecha' : 'dc-fecha')?.value;
    cliente = (document.getElementById(esPres ? 'dp-cliente' : 'dc-cliente')?.value || '').trim();
    estado = document.getElementById(esPres ? 'dp-estado' : 'dc-estado')?.value;
    proyecto = (document.getElementById(esPres ? 'dp-proyecto' : 'dc-proyecto')?.value || '').trim() || null;
    contenido = esPres ? recolectarPresupuesto() : recolectarContrato();
    origen = 'generado';
    archivo_nombre = null;
    archivo_mime = null;
  }

  if(!numero || !cliente || !fecha){ toast('Completá número, cliente y fecha'); return; }

  const btn = document.getElementById('btn-guardar-doc');
  if(btn){ btn.disabled = true; btn.textContent = 'Guardando…'; }

  const row = {
    tipo: tipo === 'archivo' ? 'archivo' : tipo,
    numero, cliente, proyecto, fecha, estado, origen,
    updated_at: new Date().toISOString()
  };
  if(contenido != null) row.contenido = contenido;
  if(!editandoDocumentoId) row.created_by = nombreSocioDoc();
  if(archivo_nombre != null){ row.archivo_nombre = archivo_nombre; row.archivo_mime = archivo_mime; }
  if(typeof resolverClienteIdPorNombre === 'function'){
    const cid = await resolverClienteIdPorNombre(cliente);
    if(cid) row.cliente_id = cid;
  }

  let error;
  if(editandoDocumentoId){
    ({ error } = await sb.from('documentos').update(row).eq('id', editandoDocumentoId));
  } else {
    ({ error } = await sb.from('documentos').insert(row));
  }
  if(error && esColumnaFaltante(error, 'cliente_id')){
    delete row.cliente_id;
    if(editandoDocumentoId) ({ error } = await sb.from('documentos').update(row).eq('id', editandoDocumentoId));
    else ({ error } = await sb.from('documentos').insert(row));
  }

  if(btn){ btn.disabled = false; btn.textContent = 'Guardar'; }
  if(error){ toast(supabaseErrMsg(error)); return; }
  toast(editandoDocumentoId ? 'Documento actualizado' : 'Documento guardado');
  cerrarModalDocumento();
  await cargarDocumentos();
}

async function eliminarDocumento(id){
  if(!requiereSupabase()) return;
  if(!confirm('¿Eliminar este documento?')) return;
  const { error } = await sb.from('documentos').delete().eq('id', id);
  if(error){ toast(supabaseErrMsg(error)); return; }
  toast('Documento eliminado');
  await cargarDocumentos();
}

async function duplicarDocumento(id){
  if(!requiereSupabase()) return;
  const { data: d, error } = await sb.from('documentos').select('*').eq('id', id).single();
  if(error || !d){ toast('No se pudo duplicar'); return; }
  if(d.tipo === 'archivo' || d.origen === 'subido'){ toast('Los archivos subidos no se duplican como plantilla'); return; }
  const numero = await proximoNumeroDoc(d.tipo);
  const row = {
    tipo: d.tipo,
    numero,
    cliente: d.cliente,
    proyecto: d.proyecto,
    fecha: new Date().toISOString().slice(0, 10),
    estado: 'Borrador',
    origen: 'generado',
    contenido: d.contenido || {},
    created_by: nombreSocioDoc()
  };
  if(d.cliente_id) row.cliente_id = d.cliente_id;
  const { error: e2 } = await sb.from('documentos').insert(row);
  if(e2){ toast(supabaseErrMsg(e2)); return; }
  toast('Duplicado como ' + numero);
  await cargarDocumentos();
}

// ─── Subida manual ───────────────────────────────────────────────

async function abrirSubirDocumento(){
  if(!requiereSupabase()) return;
  pendienteSubida = null;
  document.getElementById('up-numero').value = await proximoNumeroDoc(document.getElementById('up-tipo')?.value || 'archivo');
  document.getElementById('up-fecha').value = new Date().toISOString().slice(0, 10);
  document.getElementById('up-cliente').value = '';
  document.getElementById('up-tipo').value = 'archivo';
  document.getElementById('up-estado').value = 'Borrador';
  document.getElementById('up-file').value = '';
  document.getElementById('modal-subir-doc').classList.add('open');
}

function cerrarSubirDocumento(){
  document.getElementById('modal-subir-doc')?.classList.remove('open');
  pendienteSubida = null;
}

async function onTipoSubidaChange(){
  const el = document.getElementById('up-numero');
  if(!el) return;
  const cur = el.value || '';
  if(!cur || /^[ANC]\d+$/i.test(cur)){
    el.value = await proximoNumeroDoc(document.getElementById('up-tipo')?.value || 'archivo');
  }
}

let subiendoDocumento = false;

async function guardarSubidaDocumento(){
  if(!requiereSupabase()) return;
  if(subiendoDocumento) return;
  const file = document.getElementById('up-file')?.files?.[0];
  const numero = (document.getElementById('up-numero')?.value || '').trim();
  const cliente = (document.getElementById('up-cliente')?.value || '').trim();
  const fecha = document.getElementById('up-fecha')?.value;
  const tipo = document.getElementById('up-tipo')?.value || 'archivo';
  const estado = document.getElementById('up-estado')?.value || 'Borrador';
  if(!file || !numero || !cliente || !fecha){ toast('Completá datos y elegí un archivo'); return; }
  if(file.size > 4 * 1024 * 1024){ toast('Máximo 4 MB'); return; }

  subiendoDocumento = true;
  const btn = document.querySelector('#modal-subir-doc .btn-success');
  if(btn){ btn.disabled = true; btn.textContent = 'Subiendo…'; }

  try {
    const dataUrl = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });

    const row = {
      tipo,
      numero,
      cliente,
      fecha,
      estado,
      origen: 'subido',
      archivo_nombre: file.name,
      archivo_mime: file.type || 'application/octet-stream',
      contenido: { archivoData: dataUrl },
      created_by: nombreSocioDoc()
    };
    if(typeof resolverClienteIdPorNombre === 'function'){
      const cid = await resolverClienteIdPorNombre(cliente);
      if(cid) row.cliente_id = cid;
    }
    let { error } = await sb.from('documentos').insert(row);
    if(error && esColumnaFaltante(error, 'cliente_id')){
      delete row.cliente_id;
      ({ error } = await sb.from('documentos').insert(row));
    }
    if(error){ toast(supabaseErrMsg(error)); return; }
    toast('Archivo subido');
    cerrarSubirDocumento();
    await cargarDocumentos();
  } finally {
    subiendoDocumento = false;
    if(btn){ btn.disabled = false; btn.textContent = 'Subir'; }
  }
}

// ─── HTML de marca CM ────────────────────────────────────────────

function cssDocPrint(m){
  return `
    *{box-sizing:border-box} body{margin:0;font-family:'Segoe UI',Arial,sans-serif;color:#0d1b2e;font-size:13px;line-height:1.5;background:#fff}
    .page{max-width:820px;margin:0 auto;padding:0 0 40px}
    .banner{background:${m.colorOscuro};color:#fff;padding:22px 28px;display:flex;justify-content:space-between;align-items:center;gap:16px}
    .logo-cm{width:52px;height:52px;border-radius:12px;background:linear-gradient(135deg,${m.color},#1a6fc4);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px}
    .brand h1{margin:0;font-size:18px;font-weight:800}
    .brand p{margin:4px 0 0;font-size:11px;opacity:.75}
    .banner-meta{text-align:right;font-size:12px;opacity:.9}
    .banner-meta strong{display:block;font-size:16px;margin-bottom:4px}
    .pad{padding:24px 28px}
    .cols{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:18px}
    .box{border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;background:#f8fafc}
    .box h3{margin:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:${m.color}}
    .box p{margin:2px 0;font-size:12px}
    table{width:100%;border-collapse:collapse;margin:10px 0 16px}
    th,td{border:1px solid #e2e8f0;padding:8px 10px;text-align:left;vertical-align:top}
    th{background:#f1f5f9;font-size:11px;text-transform:uppercase;color:#64748b}
    .chip{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:8px;color:#fff;font-size:11px;font-weight:800}
    .total-box{border:2px solid ${m.color};border-radius:12px;padding:14px 16px;margin:16px 0;display:flex;justify-content:space-between;align-items:center}
    .total-box strong{font-size:20px;color:${m.color}}
    h2.sec{font-size:14px;color:${m.color};margin:22px 0 8px;border-bottom:2px solid #e2e8f0;padding-bottom:4px}
    .muted{color:#64748b;font-size:12px}
    .foot{margin-top:28px;padding-top:14px;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
    .firmas{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:48px}
    .firma-linea{border-top:1px solid #0d1b2e;margin-top:56px;padding-top:8px;font-size:12px}
    .art{margin:14px 0} .art h3{font-size:13px;margin:0 0 6px;color:${m.color}}
    .check{color:${m.color};font-weight:800;margin-right:6px}
    @media print{.banner{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  `;
}

function htmlBannerPresupuesto(d, m){
  const logo = m.logoUrl
    ? `<img src="${escDoc(m.logoUrl)}" alt="CM" style="width:52px;height:52px;border-radius:12px;object-fit:cover">`
    : `<div class="logo-cm">${escDoc(m.logoText)}</div>`;
  return `<div class="banner">
    <div style="display:flex;gap:14px;align-items:center">
      ${logo}
      <div class="brand"><h1>${escDoc(m.empresa)}</h1><p>${escDoc(m.ubicacion)}</p></div>
    </div>
    <div class="banner-meta"><strong>PRESUPUESTO</strong>N° ${escDoc(d.numero)}<br>${escDoc(d.fecha)}</div>
  </div>`;
}

function htmlTablaDesc(filas){
  const rows = (filas || []).filter(f => f.etiqueta || f.valor)
    .map(f => `<tr><th style="width:34%">${escDoc(f.etiqueta)}</th><td>${escDoc(f.valor)}</td></tr>`).join('');
  return rows ? `<h2 class="sec">Descripción del proyecto</h2><table>${rows}</table>` : '';
}

function htmlItems(c){
  const items = c.items || c.modulos || [];
  const formato = c.formatoItems || 'modulo';
  if(formato === 'checklist'){
    const rows = items.map((it, i) => `<tr>
      <td style="width:44px"><span class="chip" style="background:${chipColor(i)}">${escDoc(it.num || String(i+1).padStart(2,'0'))}</span></td>
      <td><span class="check">✓</span>${escDoc(it.descripcion || it.nombre)}</td>
    </tr>`).join('');
    return `<h2 class="sec">Alcance / Checklist</h2><table><tbody>${rows}</tbody></table>`;
  }
  const showDep = items.some(it => it.dependencia);
  const rows = items.map((it, i) => `<tr>
    <td style="width:44px"><span class="chip" style="background:${chipColor(i)}">${escDoc(it.num || String(i+1).padStart(2,'0'))}</span></td>
    <td><strong>${escDoc(it.nombre)}</strong><br><span class="muted">${escDoc(it.descripcion)}</span></td>
    ${showDep ? `<td class="muted">${escDoc(it.dependencia || '—')}</td>` : ''}
    <td style="text-align:right;white-space:nowrap">${it.precio ? fmtUsd(it.precio) : '—'}</td>
  </tr>`).join('');
  return `<h2 class="sec">Módulos</h2><table>
    <thead><tr><th>#</th><th>Módulo / Funcionalidades</th>${showDep?'<th>Dependencia</th>':''}<th style="text-align:right">Precio</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
}

function buildHTMLPresupuesto(d, cRaw){
  const c = migrarContenidoPresupuesto(cRaw);
  const m = marcaDoc();
  const b = c.bloques || {};
  const medios = [];
  if(c.mediosPago?.transferencia) medios.push('Transferencia');
  if(c.mediosPago?.mercadopago) medios.push('MercadoPago');
  if(c.mediosPago?.efectivo) medios.push('Efectivo');
  if(c.mediosPago?.wise) medios.push('Wise');

  const pagoRows = (c.pagos || []).map(p => {
    const pct = c.precioTotal > 0 ? Math.round((p.monto / c.precioTotal) * 100) : 0;
    return `<tr><td>${escDoc(p.nombre)}</td><td>${escDoc(p.cuando)}</td><td style="text-align:right">${fmtUsd(p.monto)}</td><td style="text-align:right">${pct}%</td></tr>`;
  }).join('');

  let extras = '';
  if(b.noIncluye?.activo && b.noIncluye.texto) extras += `<h2 class="sec">Qué no incluye</h2><p>${escDoc(b.noIncluye.texto).replace(/\n/g,'<br>')}</p>`;
  if(b.resumenModulos?.activo !== false && (c.formatoItems || 'modulo') === 'modulo'){
    extras += `<h2 class="sec">Resumen</h2><p>Total del proyecto: <strong>${fmtUsd(c.precioTotal)}</strong></p>`;
  }
  if(b.participacionIngresos?.activo && b.participacionIngresos.texto) extras += `<h2 class="sec">Participación en ingresos</h2><p>${escDoc(b.participacionIngresos.texto).replace(/\n/g,'<br>')}</p>`;
  if(b.costosExternos?.activo && b.costosExternos.texto) extras += `<h2 class="sec">Costos externos</h2><p>${escDoc(b.costosExternos.texto).replace(/\n/g,'<br>')}</p>`;
  if(b.condicionesGenerales?.activo && b.condicionesGenerales.texto) extras += `<h2 class="sec">Condiciones generales</h2><p>${escDoc(b.condicionesGenerales.texto).replace(/\n/g,'<br>')}</p>`;
  if(b.responsabilidadCaptacion?.activo) extras += `<h2 class="sec">Captación de clientes</h2><p>${escDoc(b.responsabilidadCaptacion.texto || '').replace(/\n/g,'<br>')}</p>`;

  let mant = '';
  if(c.mantenimiento?.activo){
    mant = `<h2 class="sec">Mantenimiento mensual</h2>
      <p><strong>${fmtUsd(c.mantenimiento.precioMensual)} / mes</strong></p>
      <p>${escDoc(c.mantenimiento.descripcion)}</p>
      <p class="muted"><em>No incluye:</em> ${escDoc(c.mantenimiento.excluye)}</p>`;
  }

  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Presupuesto ${escDoc(d.numero)}</title>
<style>${cssDocPrint(m)}</style></head><body><div class="page">
${htmlBannerPresupuesto(d, m)}
<div class="pad">
  <div class="cols">
    <div class="box"><h3>Cliente</h3><p><strong>${escDoc(d.cliente)}</strong></p>${c.proyecto?`<p>${escDoc(c.proyecto)}</p>`:''}</div>
    <div class="box"><h3>Empresa</h3><p><strong>${escDoc(m.empresa)}</strong></p><p>${escDoc(m.email)}</p><p>${escDoc(m.telefono)}</p></div>
  </div>
  ${htmlTablaDesc(c.descripcionFilas)}
  ${htmlItems(c)}
  ${extras}
  <div class="total-box"><span>Precio total</span><strong>${fmtUsd(c.precioTotal)}</strong></div>
  <h2 class="sec">Forma de pago</h2>
  <table><thead><tr><th>Hito</th><th>Cuándo</th><th style="text-align:right">Monto</th><th style="text-align:right">%</th></tr></thead><tbody>${pagoRows}</tbody></table>
  ${c.clausulaBlue ? '<p class="muted"><em>Los montos en pesos argentinos se calcularán al tipo de cambio dólar blue del día de pago.</em></p>' : ''}
  <p><strong>Medios de pago:</strong> ${medios.join(' · ') || '—'}</p>
  ${mant}
  <p class="muted" style="margin-top:20px">${escDoc(TEXTO_FIJO.validez.replace('{{dias}}', String(c.validezDias || 15)))}${c.notas ? '<br>Notas: ' + escDoc(c.notas) : ''}</p>
  <div class="foot">
    <span>${escDoc(m.empresa)}</span>
    <span>${escDoc(m.email)} · ${escDoc(m.telefono)}</span>
    <span>${escDoc(m.ubicacion)}</span>
  </div>
</div></div></body></html>`;
}

function buildHTMLContrato(d, cRaw){
  const c = migrarContenidoContrato(cRaw);
  const m = marcaDoc();
  const firmas = c.firmas || {};
  const pagoRows = (c.pagos || []).map(p => `<tr><td>${escDoc(p.nombre)}</td><td>${escDoc(p.cuando)}</td><td style="text-align:right">${fmtUsd(p.monto)}</td></tr>`).join('');
  let n = 1;
  const art = (titulo, html) => `<div class="art"><h3>Artículo ${n++} — ${titulo}</h3>${html}</div>`;

  let extras = '';
  if(c.mantenimiento?.activo){
    extras += art('Mantenimiento mensual', `<p>${fmtUsd(c.mantenimiento.precioMensual)} mensuales. Incluye: ${escDoc(c.mantenimiento.descripcion)}. No incluye: ${escDoc(c.mantenimiento.excluye)}.</p>`);
  }
  if(c.participacionIngresos?.activo && c.participacionIngresos.texto){
    extras += art('Participación en ingresos', `<p>${escDoc(c.participacionIngresos.texto).replace(/\n/g,'<br>')}</p>`);
  }

  const esquemaTxt = c.esquemaPago === 'por_modulo'
    ? 'El CLIENTE abonará el 100% de cada módulo al confirmarlo.'
    : 'El precio total se abona en las cuotas indicadas.';

  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Contrato ${escDoc(d.numero)}</title>
<style>${cssDocPrint(m)}</style></head><body><div class="page">
  <div class="pad" style="padding-top:28px">
    <div style="text-align:center;margin-bottom:20px">
      <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#64748b">Contrato de prestación de servicios</div>
      <div style="font-size:20px;font-weight:800;margin-top:6px">N° ${escDoc(d.numero)}</div>
      <div class="muted">${escDoc(c.ciudad || '')}, ${escDoc(d.fecha)}</div>
    </div>
    ${art('Partes contratantes', `
      <p><strong>PRESTADOR:</strong> ${escDoc(m.empresa)} — ${escDoc(m.email)} — ${escDoc(m.telefono)} — ${escDoc(m.ubicacion)}</p>
      <p><strong>CLIENTE:</strong> ${escDoc(d.cliente)}
        ${c.clienteCuit ? ' — CUIT ' + escDoc(c.clienteCuit) : ''}
        ${c.clienteDni ? ' — DNI ' + escDoc(c.clienteDni) : ''}
        ${c.clienteDomicilio ? ' — ' + escDoc(c.clienteDomicilio) : ''}
        ${c.clienteEmail ? ' — ' + escDoc(c.clienteEmail) : ''}
        ${c.representante ? ' — Representante: ' + escDoc(c.representante) : ''}
      </p>`)}
    ${art('Objeto del contrato', htmlTablaDesc(c.descripcionFilas))}
    ${art('Módulos y precio', `
      ${htmlItems(c)}
      <p>Precio total: <strong>${fmtUsd(c.precioTotal)}</strong>. ${esquemaTxt}</p>
      <table><thead><tr><th>Hito</th><th>Cuándo</th><th style="text-align:right">Monto</th></tr></thead><tbody>${pagoRows}</tbody></table>`)}
    ${art('Plazo de entrega', `<p>${escDoc(c.plazoEntrega).replace(/\n/g,'<br>')}</p>`)}
    ${art('Obligaciones del prestador', `<p>${escDoc(c.oblPrestador).replace(/\n/g,'<br>')}</p>`)}
    ${art('Obligaciones del cliente', `<p>${escDoc(c.oblCliente).replace(/\n/g,'<br>')}</p>`)}
    ${art('Cambios de alcance', `<p>${escDoc(c.cambiosAlcance).replace(/\n/g,'<br>')}</p>`)}
    ${art('Propiedad intelectual', `<p>${escDoc(c.propiedadIntelectual).replace(/\n/g,'<br>')}</p>`)}
    ${art('Rescisión', `<p>${escDoc(c.rescision).replace(/\n/g,'<br>')}</p>`)}
    ${art('Confidencialidad', `<p>${escDoc(c.confidencialidad).replace(/\n/g,'<br>')}</p>`)}
    ${art('Jurisdicción y ley aplicable', `<p>${escDoc(c.jurisdiccion).replace(/\n/g,'<br>')}</p>`)}
    ${extras}
    <div class="firmas">
      <div class="firma-linea"><strong>${escDoc(firmas.prestadorNombre || m.empresa)}</strong><br>${escDoc(firmas.prestadorRol || 'Prestador')}<br>${escDoc(firmas.prestadorDoc || '')}</div>
      <div class="firma-linea"><strong>${escDoc(firmas.clienteNombre || d.cliente)}</strong><br>${escDoc(firmas.clienteRol || 'Cliente')}<br>${escDoc(firmas.clienteDoc || c.clienteCuit || c.clienteDni || '')}</div>
    </div>
    <p class="muted" style="margin-top:28px;font-style:italic">${escDoc(TEXTO_FIJO.notaLegal)}</p>
  </div>
</div></body></html>`;
}

function wrapPaginaDescargable(titulo, htmlBody, nombreArchivo){
  const safeName = (nombreArchivo || 'documento-cmr.html').replace(/[^\w.\-áéíóúñÁÉÍÓÚÑ]+/gi, '_');
  const encoded = btoa(unescape(encodeURIComponent(htmlBody)));
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${titulo}</title>
<style>
  :root{--teal:#0a9d8f;--navy:#0d1b2e;--border:#e2e8f0;--bg:#f0f4f8}
  *{box-sizing:border-box}body{margin:0;font-family:'Segoe UI',system-ui,sans-serif;background:var(--bg);color:var(--navy)}
  .bar{position:sticky;top:0;z-index:10;display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;
    padding:12px 16px;background:#0d1b2e;color:#fff;box-shadow:0 2px 12px rgba(0,0,0,.2)}
  .bar h1{margin:0;font-size:14px;font-weight:700}
  .bar-actions{display:flex;gap:8px;flex-wrap:wrap}
  .bar button{height:36px;padding:0 14px;border:none;border-radius:8px;font-weight:700;font-size:12px;cursor:pointer;font-family:inherit}
  .btn-dl{background:#07b5a5;color:#fff}.btn-print{background:#1a6fc4;color:#fff}.btn-close{background:rgba(255,255,255,.12);color:#fff}
  .frame{max-width:900px;margin:20px auto;background:#fff;border:1px solid var(--border);border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(13,27,46,.08)}
  iframe{width:100%;min-height:80vh;border:0;display:block}
  @media print{.bar{display:none!important}.frame{margin:0;border:none;box-shadow:none;border-radius:0}iframe{min-height:auto}}
</style></head><body>
<div class="bar">
  <h1>${titulo}</h1>
  <div class="bar-actions">
    <button class="btn-dl" id="btn-descargar">↓ Descargar HTML</button>
    <button class="btn-print" id="btn-imprimir">🖨 Imprimir / PDF</button>
    <button class="btn-close" onclick="window.close()">Cerrar</button>
  </div>
</div>
<div class="frame"><iframe id="preview" title="Vista previa"></iframe></div>
<script>
(function(){
  var html = decodeURIComponent(escape(atob('${encoded}')));
  var nombre = ${JSON.stringify(safeName)};
  var frame = document.getElementById('preview');
  frame.srcdoc = html;
  document.getElementById('btn-descargar').onclick = function(){
    var blob = new Blob([html], {type:'text/html;charset=utf-8'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = nombre; a.click();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 1200);
  };
  document.getElementById('btn-imprimir').onclick = function(){
    try{ var w = frame.contentWindow; if(w) w.focus(), w.print(); else window.print(); }
    catch(e){ window.print(); }
  };
})();
<\/script>
</body></html>`;
}

function descargarArchivo(nombre, contenido, mime){
  const blob = new Blob([contenido], { type: mime || 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function abrirHtmlVista(titulo, html, nombre){
  const page = wrapPaginaDescargable(titulo, html, nombre);
  const w = window.open('', '_blank');
  if(!w){
    descargarArchivo(nombre, html, 'text/html;charset=utf-8');
    toast('Descarga lista (permití popups para vista previa)');
    return;
  }
  w.document.write(page);
  w.document.close();
}

async function verDocumento(id){
  await exportarPDFDocumento(id);
}

async function exportarPDFDocumento(id){
  const { data: d, error } = await sb.from('documentos').select('*').eq('id', id).single();
  if(error || !d){ toast('No se pudo cargar'); return; }

  if(d.origen === 'subido' || d.contenido?.archivoData){
    const dataUrl = d.contenido.archivoData;
    const nombre = d.archivo_nombre || (d.numero + '.bin');
    if(dataUrl){
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = nombre;
      a.target = '_blank';
      a.click();
      toast('Descarga del archivo');
      return;
    }
  }

  const c = d.contenido || {};
  const html = d.tipo === 'contrato' ? buildHTMLContrato(d, c) : buildHTMLPresupuesto(d, c);
  const tipoLabel = labelTipoDoc(d.tipo);
  abrirHtmlVista(`${tipoLabel} ${d.numero || ''} — CMR`, html, `${tipoLabel}_${d.numero || id}.html`);
}

function vistaPreviaDocumentoModal(){
  const tipo = editandoTipoDoc;
  if(tipo === 'archivo') return;
  const esPres = tipo === 'presupuesto';
  const d = {
    numero: document.getElementById(esPres ? 'dp-numero' : 'dc-numero')?.value || 'BORRADOR',
    cliente: document.getElementById(esPres ? 'dp-cliente' : 'dc-cliente')?.value || '',
    fecha: document.getElementById(esPres ? 'dp-fecha' : 'dc-fecha')?.value || '',
    tipo
  };
  const c = esPres ? recolectarPresupuesto() : recolectarContrato();
  const html = esPres ? buildHTMLPresupuesto(d, c) : buildHTMLContrato(d, c);
  abrirHtmlVista(`Vista previa — ${labelTipoDoc(tipo)}`, html, `Vista_${tipo}.html`);
}

async function descargarDocumentoDirecto(id){
  await exportarPDFDocumento(id);
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('modal-documento')?.addEventListener('click', e => {
    if(e.target.id === 'modal-documento') cerrarModalDocumento();
  });
  document.getElementById('modal-subir-doc')?.addEventListener('click', e => {
    if(e.target.id === 'modal-subir-doc') cerrarSubirDocumento();
  });
});

// Compat: llamadas viejas a setDocSubTab
function setDocSubTab(){ cargarDocumentos(); }
