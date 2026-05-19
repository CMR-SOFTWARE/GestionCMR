// ─── Documentos (Presupuestos y Contratos) ─────────────────────────

const ESTADOS_PRESUPUESTO = ['Borrador', 'Enviado', 'Aprobado', 'Rechazado'];
const ESTADOS_CONTRATO = ['Borrador', 'Enviado', 'Firmado', 'Vencido'];

let docSubTab = 'presupuesto';
let todosDocumentos = [];
let editandoDocumentoId = null;
let buscarDocTimer = null;

const MANT_DEFAULT = 'Corrección de bugs · Actualizaciones menores · Backups · Soporte técnico';
const MANT_EXCLUYE_DEFAULT = 'No incluye nuevas funcionalidades, rediseños mayores ni integraciones no acordadas.';

function nombreSocioDoc(){
  return (typeof USUARIOS !== 'undefined' && sesion && USUARIOS[sesion]) ? USUARIOS[sesion].nombre : 'Tomi';
}

function contenidoPresupuestoVacio(){
  return {
    producto: '', descripcion: '', tecnologia: '', diseno: '', entrega: '',
    modulos: [{ num: '01', nombre: '', descripcion: '', precio: 0 }],
    precioTotal: 0,
    pagos: [{ nombre: '1° Pago — Anticipo', cuando: 'Al firmar el contrato', monto: 0 }],
    clausulaBlue: true,
    mediosPago: { transferencia: true, mercadopago: false, efectivo: false, wise: false },
    mantenimiento: { activo: false, precioMensual: 0, descripcion: MANT_DEFAULT, excluye: MANT_EXCLUYE_DEFAULT },
    validezDias: 15,
    notas: ''
  };
}

function contenidoContratoVacio(){
  return {
    clienteCuit: '', clienteDomicilio: '', representante: '',
    objeto: '', alcance: '',
    precioTotal: 0,
    pagos: [{ nombre: '1° Pago — Anticipo', cuando: 'Al firmar', monto: 0 }],
    plazoEntrega: '',
    mantenimiento: { activo: false, precioMensual: 0, descripcion: MANT_DEFAULT, excluye: MANT_EXCLUYE_DEFAULT },
    fechaInicio: '', fechaFin: '',
    jurisdiccion: 'San Nicolás de los Arroyos, Buenos Aires, Argentina',
    confidencialidad: 'Las partes se comprometen a mantener confidencial la información intercambiada.',
    propiedadIntelectual: 'El código y entregables desarrollados serán propiedad del cliente una vez abonado el total acordado.',
    terminacion: 'Cualquiera de las partes podrá rescindir con aviso de 15 días, sin perjuicio de los pagos devengados.',
    notas: ''
  };
}

function pillEstadoDoc(estado){
  if(estado === 'Borrador') return 'pill-inactivo';
  if(estado === 'Enviado') return 'pill-est-progreso';
  if(estado === 'Aprobado' || estado === 'Firmado') return 'pill-vigente';
  return 'pill-vencido';
}

function setDocSubTab(tipo, btn){
  docSubTab = tipo;
  document.querySelectorAll('.doc-subtab').forEach(b => b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  const lbl = document.getElementById('btn-nuevo-doc');
  if(lbl) lbl.textContent = tipo === 'presupuesto' ? '+ Nuevo Presupuesto' : '+ Nuevo Contrato';
  const lt = document.getElementById('doc-list-title');
  if(lt) lt.textContent = tipo === 'presupuesto' ? 'Presupuestos' : 'Contratos';
  poblarFiltroEstadoDoc();
  if(typeof supabaseConectado !== 'undefined' && supabaseConectado) cargarDocumentos();
  else renderTablaDocumentos([]);
}

function poblarFiltroEstadoDoc(){
  const sel = document.getElementById('f-doc-estado');
  if(!sel) return;
  const est = docSubTab === 'presupuesto' ? ESTADOS_PRESUPUESTO : ESTADOS_CONTRATO;
  sel.innerHTML = '<option value="">Todos los estados</option>' + est.map(e => `<option>${e}</option>`).join('');
}

async function proximoNumeroDoc(tipo){
  const pref = tipo === 'presupuesto' ? 'P' : 'C';
  const { data } = await sb.from('documentos').select('numero').eq('tipo', tipo).order('created_at', { ascending: false }).limit(50);
  let max = 0;
  (data || []).forEach(d => {
    const m = String(d.numero || '').match(/\d+/);
    if(m) max = Math.max(max, parseInt(m[0], 10));
  });
  return String(max + 1).padStart(4, '0');
}

function actualizarStatsDocumentos(lista){
  const pres = lista.filter(d => d.tipo === 'presupuesto');
  const cont = lista.filter(d => d.tipo === 'contrato');
  const ok = lista.filter(d => d.estado === 'Aprobado' || d.estado === 'Firmado');
  const el = id => document.getElementById(id);
  if(el('d-total')) el('d-total').textContent = lista.length;
  if(el('d-pres')) el('d-pres').textContent = pres.length;
  if(el('d-cont')) el('d-cont').textContent = cont.length;
  if(el('d-ok')) el('d-ok').textContent = ok.length;
}

async function cargarDocumentos(){
  if(!sb || !requiereSupabase()) return;
  const fEst = document.getElementById('f-doc-estado')?.value || '';
  const fBus = (document.getElementById('f-doc-buscar')?.value || '').trim().toLowerCase();

  const { data, error } = await sb.from('documentos').select('*').eq('tipo', docSubTab).order('created_at', { ascending: false });
  if(error){
    toast(supabaseErrMsg(error).replace('movimientos', 'documentos'));
    console.error('[Supabase documentos]', error);
    renderTablaDocumentos([]);
    return;
  }

  const { data: todos } = await sb.from('documentos').select('id, tipo, estado');
  todosDocumentos = data || [];
  actualizarStatsDocumentos(todos || []);

  let lista = todosDocumentos;
  if(fEst) lista = lista.filter(d => d.estado === fEst);
  if(fBus) lista = lista.filter(d =>
    d.cliente.toLowerCase().includes(fBus) ||
    String(d.numero).toLowerCase().includes(fBus)
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
  tbody.innerHTML = lista.map(d => `
    <tr>
      <td><strong>${escDoc(d.numero)}</strong></td>
      <td>${escDoc(d.cliente)}</td>
      <td style="font-size:12px">${d.fecha || '—'}</td>
      <td><span class="pill ${pillEstadoDoc(d.estado)}">${escDoc(d.estado)}</span></td>
      <td class="hide-mob">${escDoc(d.created_by)}</td>
      <td>
        <div class="acciones-cell">
          <button class="btn-ghost-edit" onclick="abrirEditarDocumento('${d.id}')" title="Ver / Editar">✎</button>
          <button class="btn-ghost-edit" onclick="exportarPDFDocumento('${d.id}')" title="Exportar PDF">↓</button>
          <button class="btn-ghost-danger" onclick="eliminarDocumento('${d.id}')" title="Eliminar">×</button>
        </div>
      </td>
    </tr>`).join('');
}

function escDoc(s){ return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'); }

function buscarDocDebounce(){
  clearTimeout(buscarDocTimer);
  buscarDocTimer = setTimeout(cargarDocumentos, 350);
}

// ─── Modal formulario ───────────────────────────────────────────

function toggleCollapsible(btn){
  const body = btn.nextElementSibling;
  const open = body.classList.toggle('open');
  btn.classList.toggle('open', open);
}

function renderModuloRow(m, i){
  return `<div class="doc-dyn-row" data-modulo="${i}">
    <input type="text" class="dm-num" value="${escDoc(m.num)}" placeholder="01">
    <input type="text" class="dm-nom" value="${escDoc(m.nombre)}" placeholder="Nombre módulo">
    <textarea class="dm-desc ta-desc" rows="1" placeholder="Descripción">${escDoc(m.descripcion)}</textarea>
    <input type="number" class="dm-precio" value="${m.precio || 0}" min="0" step="0.01" placeholder="USD">
    <button type="button" class="btn-ghost-danger" onclick="eliminarFilaModulo(${i})">×</button>
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

function renderFormPresupuesto(c){
  const modulos = (c.modulos && c.modulos.length) ? c.modulos : [{ num:'01', nombre:'', descripcion:'', precio:0 }];
  const pagos = (c.pagos && c.pagos.length) ? c.pagos : [{ nombre:'1° Pago — Anticipo', cuando:'Al firmar el contrato', monto:0 }];
  const mp = c.mediosPago || {};
  const mant = c.mantenimiento || { activo:false, precioMensual:0, descripcion:MANT_DEFAULT, excluye:MANT_EXCLUYE_DEFAULT };

  return `
    <details class="doc-section" open><summary>1. Encabezado</summary>
      <div class="form-grid form-2 doc-sec-body">
        <div class="field"><label>Número</label><input id="dp-numero" type="text"></div>
        <div class="field"><label>Fecha</label><input id="dp-fecha" type="date"></div>
        <div class="field"><label>Cliente / Empresa</label><input id="dp-cliente" type="text"></div>
        <div class="field"><label>Estado</label><select id="dp-estado">${ESTADOS_PRESUPUESTO.map(e=>`<option>${e}</option>`).join('')}</select></div>
      </div>
    </details>
    <details class="doc-section"><summary>2. Descripción del proyecto</summary>
      <div class="doc-sec-body">
        <div class="field" style="margin-bottom:8px"><label>Producto / Proyecto</label><input id="dp-producto" type="text"></div>
        <div class="field" style="margin-bottom:8px"><label>Descripción</label><textarea id="dp-descripcion" class="ta-desc" rows="3"></textarea></div>
        <div class="form-grid form-2">
          <div class="field"><label>Tecnología</label><input id="dp-tecnologia" type="text"></div>
          <div class="field"><label>Diseño (opcional)</label><input id="dp-diseno" type="text"></div>
        </div>
        <div class="field" style="margin-top:8px"><label>Entrega</label><input id="dp-entrega" type="text"></div>
      </div>
    </details>
    <details class="doc-section"><summary>3. Módulos / Ítems</summary>
      <div class="doc-sec-body">
        <div id="dp-modulos-list">${modulos.map((m,i)=>renderModuloRow(m,i)).join('')}</div>
        <button type="button" class="btn-doc-add" onclick="agregarModulo()">+ Agregar módulo</button>
      </div>
    </details>
    <details class="doc-section"><summary>4. Precio y pagos</summary>
      <div class="doc-sec-body">
        <div class="field" style="margin-bottom:10px"><label>Precio total USD</label><input id="dp-precio-total" type="number" min="0" step="0.01" oninput="recalcPorcentajesPagos('dp')"></div>
        <div id="dp-pagos-list">${pagos.map((p,i)=>renderPagoRow(p,i,'dp')).join('')}</div>
        <button type="button" class="btn-doc-add" onclick="agregarPago('dp')">+ Agregar hito de pago</button>
        <label class="doc-check" style="margin-top:12px"><input type="checkbox" id="dp-blue" ${c.clausulaBlue?'checked':''}> Incluir cláusula dólar blue (pesos argentinos)</label>
        <div style="margin-top:10px;font-size:12px;font-weight:600;color:var(--text3)">MEDIOS DE PAGO</div>
        <div class="doc-checks">
          <label class="doc-check"><input type="checkbox" id="dp-mp-tr" ${mp.transferencia?'checked':''}> Transferencia</label>
          <label class="doc-check"><input type="checkbox" id="dp-mp-mp" ${mp.mercadopago?'checked':''}> MercadoPago</label>
          <label class="doc-check"><input type="checkbox" id="dp-mp-ef" ${mp.efectivo?'checked':''}> Efectivo</label>
          <label class="doc-check"><input type="checkbox" id="dp-mp-wise" ${mp.wise?'checked':''}> Wise</label>
        </div>
      </div>
    </details>
    <details class="doc-section"><summary>5. Mantenimiento mensual</summary>
      <div class="doc-sec-body">
        <label class="doc-check"><input type="checkbox" id="dp-mant-on" ${mant.activo?'checked':''} onchange="toggleMantFields('dp')"> Incluir mantenimiento</label>
        <div id="dp-mant-fields" style="${mant.activo?'':'display:none'}">
          <div class="field" style="margin-top:8px"><label>Precio mensual USD</label><input id="dp-mant-precio" type="number" min="0" step="0.01" value="${mant.precioMensual||0}"></div>
          <div class="field" style="margin-top:8px"><label>Descripción</label><textarea id="dp-mant-desc" class="ta-desc" rows="2">${escDoc(mant.descripcion)}</textarea></div>
          <div class="field" style="margin-top:8px"><label>No incluye</label><textarea id="dp-mant-excl" class="ta-desc" rows="2">${escDoc(mant.excluye)}</textarea></div>
        </div>
      </div>
    </details>
    <details class="doc-section"><summary>6. Condiciones generales</summary>
      <div class="doc-sec-body">
        <div class="field"><label>Validez (días)</label><input id="dp-validez" type="number" min="1" value="${c.validezDias||15}"></div>
        <div class="field" style="margin-top:8px"><label>Notas adicionales</label><textarea id="dp-notas" class="ta-desc" rows="2">${escDoc(c.notas)}</textarea></div>
      </div>
    </details>`;
}

function renderFormContrato(c){
  const pagos = (c.pagos && c.pagos.length) ? c.pagos : [{ nombre:'1° Pago — Anticipo', cuando:'Al firmar', monto:0 }];
  const mant = c.mantenimiento || { activo:false, precioMensual:0, descripcion:MANT_DEFAULT, excluye:MANT_EXCLUYE_DEFAULT };

  return `
    <details class="doc-section" open><summary>1. Encabezado</summary>
      <div class="form-grid form-2 doc-sec-body">
        <div class="field"><label>Número</label><input id="dc-numero" type="text"></div>
        <div class="field"><label>Fecha</label><input id="dc-fecha" type="date"></div>
        <div class="field"><label>Cliente / Empresa</label><input id="dc-cliente" type="text"></div>
        <div class="field"><label>Estado</label><select id="dc-estado">${ESTADOS_CONTRATO.map(e=>`<option>${e}</option>`).join('')}</select></div>
      </div>
    </details>
    <details class="doc-section"><summary>2. Partes</summary>
      <div class="doc-sec-body form-grid form-2">
        <div class="field"><label>CUIT / CUIL</label><input id="dc-cuit" type="text"></div>
        <div class="field"><label>Representante</label><input id="dc-representante" type="text"></div>
        <div class="field" style="grid-column:1/-1"><label>Domicilio</label><input id="dc-domicilio" type="text"></div>
      </div>
    </details>
    <details class="doc-section"><summary>3. Objeto y alcance</summary>
      <div class="doc-sec-body">
        <div class="field"><label>Objeto del contrato</label><textarea id="dc-objeto" class="ta-desc" rows="2"></textarea></div>
        <div class="field" style="margin-top:8px"><label>Alcance</label><textarea id="dc-alcance" class="ta-desc" rows="4"></textarea></div>
      </div>
    </details>
    <details class="doc-section"><summary>4. Precio, pagos y plazo</summary>
      <div class="doc-sec-body">
        <div class="field"><label>Precio total USD</label><input id="dc-precio-total" type="number" min="0" step="0.01" oninput="recalcPorcentajesPagos('dc')"></div>
        <div id="dc-pagos-list" style="margin-top:10px">${pagos.map((p,i)=>renderPagoRow(p,i,'dc')).join('')}</div>
        <button type="button" class="btn-doc-add" onclick="agregarPago('dc')">+ Agregar hito de pago</button>
        <div class="field" style="margin-top:10px"><label>Plazo de entrega</label><input id="dc-plazo" type="text" placeholder="Ej: 30 días hábiles"></div>
      </div>
    </details>
    <details class="doc-section"><summary>5. Mantenimiento mensual</summary>
      <div class="doc-sec-body">
        <label class="doc-check"><input type="checkbox" id="dc-mant-on" ${mant.activo?'checked':''} onchange="toggleMantFields('dc')"> Incluir mantenimiento</label>
        <div id="dc-mant-fields" style="${mant.activo?'':'display:none'}">
          <div class="field" style="margin-top:8px"><label>Precio mensual USD</label><input id="dc-mant-precio" type="number" min="0" step="0.01"></div>
          <div class="field" style="margin-top:8px"><label>Descripción</label><textarea id="dc-mant-desc" class="ta-desc" rows="2"></textarea></div>
          <div class="field" style="margin-top:8px"><label>No incluye</label><textarea id="dc-mant-excl" class="ta-desc" rows="2"></textarea></div>
        </div>
      </div>
    </details>
    <details class="doc-section"><summary>6. Vigencia</summary>
      <div class="form-grid form-2 doc-sec-body">
        <div class="field"><label>Inicio</label><input id="dc-inicio" type="date"></div>
        <div class="field"><label>Fin</label><input id="dc-fin" type="date"></div>
        <div class="field" style="grid-column:1/-1"><label>Jurisdicción</label><input id="dc-jurisdiccion" type="text"></div>
      </div>
    </details>
    <details class="doc-section"><summary>7. Cláusulas</summary>
      <div class="doc-sec-body">
        <div class="field"><label>Confidencialidad</label><textarea id="dc-conf" class="ta-desc" rows="2"></textarea></div>
        <div class="field" style="margin-top:8px"><label>Propiedad intelectual</label><textarea id="dc-pi" class="ta-desc" rows="2"></textarea></div>
        <div class="field" style="margin-top:8px"><label>Terminación</label><textarea id="dc-term" class="ta-desc" rows="2"></textarea></div>
        <div class="field" style="margin-top:8px"><label>Notas</label><textarea id="dc-notas" class="ta-desc" rows="2"></textarea></div>
      </div>
    </details>`;
}

// Fix div typos in generated HTML - use a cleanup function
function cleanDocHtml(html){
  return html;
}

async function abrirNuevoDocumento(){
  if(typeof requiereSupabase !== 'function' || !requiereSupabase()) return;
  editandoDocumentoId = null;
  const tipo = docSubTab === 'contrato' ? 'contrato' : 'presupuesto';
  const numero = await proximoNumeroDoc(tipo);
  const hoy = new Date().toISOString().slice(0, 10);
  const titulo = document.getElementById('modal-doc-title');
  const body = document.getElementById('modal-doc-body');
  if(titulo) titulo.textContent = tipo === 'presupuesto' ? 'Nuevo presupuesto' : 'Nuevo contrato';

  if(tipo === 'presupuesto'){
    body.innerHTML = cleanDocHtml(renderFormPresupuesto(contenidoPresupuestoVacio()));
    document.getElementById('dp-numero').value = numero;
    document.getElementById('dp-fecha').value = hoy;
    document.getElementById('dp-estado').value = 'Borrador';
  } else {
    body.innerHTML = cleanDocHtml(renderFormContrato(contenidoContratoVacio()));
    document.getElementById('dc-numero').value = numero;
    document.getElementById('dc-fecha').value = hoy;
    document.getElementById('dc-estado').value = 'Borrador';
    const c0 = contenidoContratoVacio();
    document.getElementById('dc-jurisdiccion').value = c0.jurisdiccion;
    document.getElementById('dc-conf').value = c0.confidencialidad;
    document.getElementById('dc-pi').value = c0.propiedadIntelectual;
    document.getElementById('dc-term').value = c0.terminacion;
    document.getElementById('dc-mant-desc').value = MANT_DEFAULT;
    document.getElementById('dc-mant-excl').value = MANT_EXCLUYE_DEFAULT;
  }
  document.getElementById('modal-documento').classList.add('open');
  recalcPorcentajesPagos(tipo === 'presupuesto' ? 'dp' : 'dc');
}

async function abrirEditarDocumento(id){
  if(!requiereSupabase()) return;
  const { data: d, error } = await sb.from('documentos').select('*').eq('id', id).single();
  if(error || !d){ toast('No se pudo cargar el documento'); return; }
  editandoDocumentoId = id;
  const titulo = document.getElementById('modal-doc-title');
  const body = document.getElementById('modal-doc-body');
  const c = d.contenido || {};
  if(titulo) titulo.textContent = d.tipo === 'presupuesto' ? `Presupuesto #${d.numero}` : `Contrato #${d.numero}`;

  if(d.tipo === 'presupuesto'){
    body.innerHTML = cleanDocHtml(renderFormPresupuesto(c));
    document.getElementById('dp-numero').value = d.numero;
    document.getElementById('dp-fecha').value = d.fecha;
    document.getElementById('dp-cliente').value = d.cliente;
    document.getElementById('dp-estado').value = d.estado;
    document.getElementById('dp-producto').value = c.producto || '';
    document.getElementById('dp-descripcion').value = c.descripcion || '';
    document.getElementById('dp-tecnologia').value = c.tecnologia || '';
    document.getElementById('dp-diseno').value = c.diseno || '';
    document.getElementById('dp-entrega').value = c.entrega || '';
    document.getElementById('dp-precio-total').value = c.precioTotal || 0;
    document.getElementById('dp-validez').value = c.validezDias || 15;
    document.getElementById('dp-notas').value = c.notas || '';
  } else {
    body.innerHTML = cleanDocHtml(renderFormContrato(c));
    document.getElementById('dc-numero').value = d.numero;
    document.getElementById('dc-fecha').value = d.fecha;
    document.getElementById('dc-cliente').value = d.cliente;
    document.getElementById('dc-estado').value = d.estado;
    document.getElementById('dc-cuit').value = c.clienteCuit || '';
    document.getElementById('dc-representante').value = c.representante || '';
    document.getElementById('dc-domicilio').value = c.clienteDomicilio || '';
    document.getElementById('dc-objeto').value = c.objeto || '';
    document.getElementById('dc-alcance').value = c.alcance || '';
    document.getElementById('dc-precio-total').value = c.precioTotal || 0;
    document.getElementById('dc-plazo').value = c.plazoEntrega || '';
    document.getElementById('dc-inicio').value = c.fechaInicio || '';
    document.getElementById('dc-fin').value = c.fechaFin || '';
    document.getElementById('dc-jurisdiccion').value = c.jurisdiccion || '';
    document.getElementById('dc-conf').value = c.confidencialidad || '';
    document.getElementById('dc-pi').value = c.propiedadIntelectual || '';
    document.getElementById('dc-term').value = c.terminacion || '';
    document.getElementById('dc-notas').value = c.notas || '';
    if(c.mantenimiento?.activo){
      document.getElementById('dc-mant-precio').value = c.mantenimiento.precioMensual || 0;
      document.getElementById('dc-mant-desc').value = c.mantenimiento.descripcion || MANT_DEFAULT;
      document.getElementById('dc-mant-excl').value = c.mantenimiento.excluye || MANT_EXCLUYE_DEFAULT;
    }
  }
  document.getElementById('modal-documento').classList.add('open');
  recalcPorcentajesPagos(d.tipo === 'presupuesto' ? 'dp' : 'dc');
}

function cerrarModalDocumento(){
  document.getElementById('modal-documento')?.classList.remove('open');
  editandoDocumentoId = null;
}

function toggleMantFields(prefix){
  const on = document.getElementById(prefix + '-mant-on')?.checked;
  const el = document.getElementById(prefix + '-mant-fields');
  if(el) el.style.display = on ? 'block' : 'none';
}

function agregarModulo(){
  const list = document.getElementById('dp-modulos-list');
  const i = list.querySelectorAll('.doc-dyn-row').length;
  list.insertAdjacentHTML('beforeend', renderModuloRow({ num: String(i+1).padStart(2,'0'), nombre:'', descripcion:'', precio:0 }, i));
}

function eliminarFilaModulo(i){
  const rows = document.querySelectorAll('#dp-modulos-list .doc-dyn-row');
  if(rows.length <= 1){ toast('Debe haber al menos un módulo'); return; }
  rows[i]?.remove();
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

function leerModulos(){
  return Array.from(document.querySelectorAll('#dp-modulos-list .doc-dyn-row')).map(row => ({
    num: row.querySelector('.dm-num')?.value || '',
    nombre: row.querySelector('.dm-nom')?.value || '',
    descripcion: row.querySelector('.dm-desc')?.value || '',
    precio: parseFloat(row.querySelector('.dm-precio')?.value) || 0
  }));
}

function leerPagos(prefix){
  return Array.from(document.querySelectorAll(`#${prefix}-pagos-list .doc-dyn-row`)).map(row => ({
    nombre: row.querySelector('.' + prefix + '-nom')?.value || '',
    cuando: row.querySelector('.' + prefix + '-cuando')?.value || '',
    monto: parseFloat(row.querySelector('.' + prefix + '-monto')?.value) || 0
  }));
}

function leerMantenimiento(prefix){
  const on = document.getElementById(prefix + '-mant-on')?.checked;
  return {
    activo: !!on,
    precioMensual: parseFloat(document.getElementById(prefix + '-mant-precio')?.value) || 0,
    descripcion: document.getElementById(prefix + '-mant-desc')?.value || MANT_DEFAULT,
    excluye: document.getElementById(prefix + '-mant-excl')?.value || MANT_EXCLUYE_DEFAULT
  };
}

function recolectarPresupuesto(){
  return {
    producto: document.getElementById('dp-producto')?.value || '',
    descripcion: document.getElementById('dp-descripcion')?.value || '',
    tecnologia: document.getElementById('dp-tecnologia')?.value || '',
    diseno: document.getElementById('dp-diseno')?.value || '',
    entrega: document.getElementById('dp-entrega')?.value || '',
    modulos: leerModulos(),
    precioTotal: parseFloat(document.getElementById('dp-precio-total')?.value) || 0,
    pagos: leerPagos('dp'),
    clausulaBlue: document.getElementById('dp-blue')?.checked,
    mediosPago: {
      transferencia: document.getElementById('dp-mp-tr')?.checked,
      mercadopago: document.getElementById('dp-mp-mp')?.checked,
      efectivo: document.getElementById('dp-mp-ef')?.checked,
      wise: document.getElementById('dp-mp-wise')?.checked
    },
    mantenimiento: leerMantenimiento('dp'),
    validezDias: parseInt(document.getElementById('dp-validez')?.value, 10) || 15,
    notas: document.getElementById('dp-notas')?.value || ''
  };
}

function recolectarContrato(){
  return {
    clienteCuit: document.getElementById('dc-cuit')?.value || '',
    clienteDomicilio: document.getElementById('dc-domicilio')?.value || '',
    representante: document.getElementById('dc-representante')?.value || '',
    objeto: document.getElementById('dc-objeto')?.value || '',
    alcance: document.getElementById('dc-alcance')?.value || '',
    precioTotal: parseFloat(document.getElementById('dc-precio-total')?.value) || 0,
    pagos: leerPagos('dc'),
    plazoEntrega: document.getElementById('dc-plazo')?.value || '',
    mantenimiento: leerMantenimiento('dc'),
    fechaInicio: document.getElementById('dc-inicio')?.value || '',
    fechaFin: document.getElementById('dc-fin')?.value || '',
    jurisdiccion: document.getElementById('dc-jurisdiccion')?.value || '',
    confidencialidad: document.getElementById('dc-conf')?.value || '',
    propiedadIntelectual: document.getElementById('dc-pi')?.value || '',
    terminacion: document.getElementById('dc-term')?.value || '',
    notas: document.getElementById('dc-notas')?.value || ''
  };
}

async function guardarDocumento(){
  if(!requiereSupabase()) return;
  const esPres = docSubTab === 'presupuesto' || document.getElementById('dp-numero');
  const tipo = esPres ? 'presupuesto' : 'contrato';
  const numero = (document.getElementById(esPres ? 'dp-numero' : 'dc-numero')?.value || '').trim();
  const fecha = document.getElementById(esPres ? 'dp-fecha' : 'dc-fecha')?.value;
  const cliente = (document.getElementById(esPres ? 'dp-cliente' : 'dc-cliente')?.value || '').trim();
  const estado = document.getElementById(esPres ? 'dp-estado' : 'dc-estado')?.value;
  const contenido = esPres ? recolectarPresupuesto() : recolectarContrato();

  if(!numero || !cliente || !fecha){ toast('Completá número, cliente y fecha'); return; }

  const btn = document.getElementById('btn-guardar-doc');
  if(btn){ btn.disabled = true; btn.textContent = 'Guardando…'; }

  const row = { tipo, numero, cliente, fecha, estado, contenido, created_by: nombreSocioDoc() };

  let error;
  if(editandoDocumentoId){
    ({ error } = await sb.from('documentos').update(row).eq('id', editandoDocumentoId));
  } else {
    ({ error } = await sb.from('documentos').insert(row));
  }

  if(btn){ btn.disabled = false; btn.textContent = 'Guardar documento'; }

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

// ─── PDF ─────────────────────────────────────────────────────────

function fmtUsd(n){ return 'USD ' + (Number(n)||0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }

function buildHTMLPresupuesto(d, c){
  const modRows = (c.modulos||[]).map(m => `<tr><td>${escDoc(m.num)}</td><td><strong>${escDoc(m.nombre)}</strong><br><small>${escDoc(m.descripcion)}</small></td><td style="text-align:right">${m.precio?fmtUsd(m.precio):'—'}</td></tr>`).join('');
  const pagoRows = (c.pagos||[]).map(p => {
    const pct = c.precioTotal > 0 ? Math.round((p.monto/c.precioTotal)*100) : 0;
    return `<tr><td>${escDoc(p.nombre)}</td><td>${escDoc(p.cuando)}</td><td style="text-align:right">${fmtUsd(p.monto)}</td><td style="text-align:right">${pct}%</td></tr>`;
  }).join('');
  const medios = [];
  if(c.mediosPago?.transferencia) medios.push('Transferencia bancaria');
  if(c.mediosPago?.mercadopago) medios.push('MercadoPago');
  if(c.mediosPago?.efectivo) medios.push('Efectivo');
  if(c.mediosPago?.wise) medios.push('Wise');
  let mant = '';
  if(c.mantenimiento?.activo){
    mant = `<h3>Mantenimiento mensual</h3><p><strong>${fmtUsd(c.mantenimiento.precioMensual)}/mes</strong></p><p>${escDoc(c.mantenimiento.descripcion)}</p><p><em>No incluye:</em> ${escDoc(c.mantenimiento.excluye)}</p>`;
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Presupuesto ${escDoc(d.numero)}</title>
<style>body{font-family:Segoe UI,Arial,sans-serif;color:#0d1b2e;padding:40px;max-width:800px;margin:0 auto;font-size:13px;line-height:1.5}
h1{color:#0a9d8f;font-size:22px;margin:0}h2{font-size:14px;color:#8896ab;font-weight:600;margin:4px 0 24px}
h3{font-size:13px;color:#0a9d8f;margin:20px 0 8px;border-bottom:2px solid #e2e8f0;padding-bottom:4px}
table{width:100%;border-collapse:collapse;margin:8px 0}th,td{border:1px solid #e2e8f0;padding:8px;text-align:left}th{background:#f8fafc;font-size:11px;text-transform:uppercase}
.total{font-size:18px;font-weight:700;color:#0a9d6e;margin:16px 0}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px}
.logo{font-weight:800;font-size:18px;color:#0a9d8f}.meta{text-align:right;font-size:12px;color:#8896ab}</style></head><body>
<div class="header"><div class="logo">CMR Software Solutions</div><div class="meta">N° ${escDoc(d.numero)}<br>${d.fecha}<br>${escDoc(d.cliente)}</div></div>
<h1>PRESUPUESTO</h1><h2>${escDoc(c.producto)}</h2>
<h3>Descripción del proyecto</h3><p>${escDoc(c.descripcion)}</p>
<p><strong>Tecnología:</strong> ${escDoc(c.tecnologia)} ${c.diseno?'<br><strong>Diseño:</strong> '+escDoc(c.diseno):''}<br><strong>Entrega:</strong> ${escDoc(c.entrega)}</p>
<h3>Módulos</h3><table><thead><tr><th>#</th><th>Módulo</th><th style="text-align:right">Precio</th></tr></thead><tbody>${modRows}</tbody></table>
<p class="total">Precio total: ${fmtUsd(c.precioTotal)}</p>
<h3>Estructura de pagos</h3><table><thead><tr><th>Hito</th><th>Cuándo</th><th style="text-align:right">Monto</th><th style="text-align:right">%</th></tr></thead><tbody>${pagoRows}</tbody></table>
${c.clausulaBlue?'<p><em>Los montos en pesos argentinos se calcularán al tipo de cambio dólar blue del día de pago.</em></p>':''}
<p><strong>Medios de pago:</strong> ${medios.join(' · ') || '—'}</p>
${mant}
<p style="margin-top:24px;font-size:12px;color:#8896ab">Validez: ${c.validezDias||15} días desde la fecha del presupuesto.${c.notas?'<br>Notas: '+escDoc(c.notas):''}</p>
</body></html>`;
}

function buildHTMLContrato(d, c){
  const pagoRows = (c.pagos||[]).map(p => `<li><strong>${escDoc(p.nombre)}</strong> — ${escDoc(p.cuando)}: ${fmtUsd(p.monto)}</li>`).join('');
  let mant = '';
  if(c.mantenimiento?.activo){
    mant = `<h3>5. Mantenimiento</h3><p>El CLIENTE abonará ${fmtUsd(c.mantenimiento.precioMensual)} mensuales por: ${escDoc(c.mantenimiento.descripcion)}. No incluye: ${escDoc(c.mantenimiento.excluye)}.</p>`;
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Contrato ${escDoc(d.numero)}</title>
<style>body{font-family:Segoe UI,Arial,sans-serif;color:#0d1b2e;padding:40px;max-width:800px;margin:0 auto;font-size:13px;line-height:1.6}
h1{color:#0a9d8f;font-size:20px}h3{font-size:13px;color:#0a9d8f;margin:18px 0 6px}.header{margin-bottom:24px}</style></head><body>
<div class="header"><strong style="color:#0a9d8f;font-size:18px">CMR Software Solutions</strong><br>Contrato N° ${escDoc(d.numero)} — ${d.fecha}</div>
<h1>CONTRATO DE PRESTACIÓN DE SERVICIOS</h1>
<p>Entre <strong>CMR Software Solutions</strong> y <strong>${escDoc(d.cliente)}</strong>${c.representante?' representado por '+escDoc(c.representante):''}${c.clienteCuit?' (CUIT: '+escDoc(c.clienteCuit)+')':''}${c.clienteDomicilio?', domiciliado en '+escDoc(c.clienteDomicilio):''}.</p>
<h3>1. Objeto</h3><p>${escDoc(c.objeto)}</p>
<h3>2. Alcance</h3><p>${escDoc(c.alcance).replace(/\n/g,'<br>')}</p>
<h3>3. Precio y forma de pago</h3><p>Precio total: <strong>${fmtUsd(c.precioTotal)}</strong></p><ul>${pagoRows}</ul>
<h3>4. Plazo</h3><p>${escDoc(c.plazoEntrega)}</p>
${mant}
<h3>6. Vigencia</h3><p>Desde ${c.fechaInicio||'—'} hasta ${c.fechaFin||'—'}. Jurisdicción: ${escDoc(c.jurisdiccion)}.</p>
<h3>7. Cláusulas</h3><p><strong>Confidencialidad:</strong> ${escDoc(c.confidencialidad)}</p>
<p><strong>Propiedad intelectual:</strong> ${escDoc(c.propiedadIntelectual)}</p>
<p><strong>Terminación:</strong> ${escDoc(c.terminacion)}</p>
${c.notas?'<p><strong>Notas:</strong> '+escDoc(c.notas)+'</p>':''}
</body></html>`;
}

function cleanPdfHtml(html){ return html; }

async function exportarPDFDocumento(id){
  const { data: d, error } = await sb.from('documentos').select('*').eq('id', id).single();
  if(error || !d){ toast('No se pudo cargar'); return; }
  const c = d.contenido || {};
  const html = cleanPdfHtml(d.tipo === 'presupuesto' ? buildHTMLPresupuesto(d, c) : buildHTMLContrato(d, c));
  const w = window.open('', '_blank');
  if(!w){ toast('Permití ventanas emergentes para exportar PDF'); return; }
  w.document.write(html);
  w.document.close();
  w.onload = () => { setTimeout(() => w.print(), 300); };
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('modal-documento')?.addEventListener('click', e => {
    if(e.target.id === 'modal-documento') cerrarModalDocumento();
  });
});
