// ─── Estadísticas y gráficos ───
// ─── estadísticas ────────────────────────
let chartMeses = null;
let chartClientesMes = null;

function mesKey(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); }
function labelMes(ym){ const m=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']; const [y,mo]=ym.split('-'); return m[+mo-1]+' '+y.slice(2); }
function ultimosNMeses(n){ const r=[]; const h=new Date(); for(let i=n-1;i>=0;i--){ const x=new Date(h.getFullYear(),h.getMonth()-i,1); r.push(mesKey(x)); } return r; }
function ultimos6Meses(){ return ultimosNMeses(6); }

function esClienteEnDesarrollo(c){
  return c.activo !== false && !mantenimientoActivo(c);
}

function nombreCoincideMovimiento(nombreCliente, descripcion){
  if(!nombreCliente || !descripcion) return false;
  const n = nombreCliente.toLowerCase();
  const d = descripcion.toLowerCase();
  if(d.includes(n)) return true;
  const partes = n.match(/\([^)]+\)|[a-záéíóúñ0-9]{4,}/gi) || [];
  return partes.some(p => {
    const clean = p.replace(/[()]/g, '').trim();
    return clean.length >= 4 && d.includes(clean);
  });
}

function docIdsPorCliente(documentos, nombreCliente){
  return new Set(
    (documentos || [])
      .filter(d => d.cliente === nombreCliente)
      .map(d => d.id)
  );
}

function cobradoProyectoCliente(cliente, movimientos, documentos){
  const docIds = docIdsPorCliente(documentos, cliente.nombre);
  let total = 0;
  (movimientos || []).forEach(m => {
    if(m.tipo !== 'ingreso') return;
    const porDoc = m.documento_id && docIds.has(m.documento_id);
    const porDesc = (m.categoria === 'Proyecto' || m.tipo_pago === 'seña' || m.tipo_pago === 'pago_parcial')
      && nombreCoincideMovimiento(cliente.nombre, m.descripcion);
    if(porDoc || porDesc) total += Number(m.monto) || 0;
  });
  return total;
}

function listarClientesEnDesarrollo(clientes, movimientos, documentos){
  return (clientes || [])
    .filter(esClienteEnDesarrollo)
    .map(c => ({
      id: c.id,
      nombre: c.nombre,
      label: nombreCortoCliente(c.nombre),
      cobrado: cobradoProyectoCliente(c, movimientos, documentos)
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

function nombreCortoCliente(nombre){
  const m = String(nombre || '').match(/\(([^)]+)\)/);
  if(m) return `${nombre.replace(/\s*\([^)]+\)/, '').trim()} — ${m[1]}`;
  return nombre;
}

function renderClientesEnDesarrollo(lista){
  const resumen = document.getElementById('st-desarrollo-count');
  const detalle = document.getElementById('lista-clientes-desarrollo');
  if(!resumen || !detalle) return;

  const n = lista.length;
  resumen.textContent = n === 1 ? '1 cliente' : `${n} clientes`;
  resumen.className = 'stat-val ' + (n ? 'val-amber' : 'val-neutral');

  if(!n){
    detalle.innerHTML = '<p class="dev-cli-empty">No hay clientes en desarrollo. Desmarcá «Mantenimiento recurrente» al dar de alta un proyecto.</p>';
    return;
  }

  const totalCobrado = lista.reduce((s, c) => s + c.cobrado, 0);
  detalle.innerHTML = lista.map(c => `
    <div class="dev-cli-row">
      <div>
        <div class="dev-cli-name">${esc(c.label)}</div>
        <div class="dev-cli-meta">Cobrado a cuenta</div>
      </div>
      <div class="dev-cli-monto">${fmt(c.cobrado)}</div>
    </div>
  `).join('') + (n > 1 ? `<div class="dev-cli-total"><span>Total cobrado</span><strong>${fmt(totalCobrado)}</strong></div>` : '');
}

function esIngresoMantenimiento(r){
  return r.tipo === 'ingreso' && (r.categoria || '') === 'Mantenimiento';
}

function contarCobrosMantenimientoPorMes(movimientos, meses){
  const porMes = {};
  meses.forEach(m => { porMes[m] = 0; });
  (movimientos||[]).forEach(r => {
    if(!esIngresoMantenimiento(r)) return;
    const m = String(r.fecha || '').slice(0, 7);
    if(porMes[m] !== undefined) porMes[m]++;
  });
  return porMes;
}

function clientesTotalesPorMes(clientes, meses){
  const lista = clientes || [];
  return meses.map(ym => {
    const [y, mo] = ym.split('-').map(Number);
    const finMes = new Date(y, mo, 0, 23, 59, 59);
    return lista.filter(c => {
      if(c.activo === false) return false;
      if(!mantenimientoActivo(c)) return false;
      if(pagoConfirmado(c)){
        const f = c.fecha_confirmacion_pago;
        return f && new Date(f) <= finMes;
      }
      if(esPendienteProyeccion(c) && c.fecha_vencimiento){
        return new Date(c.fecha_vencimiento + 'T23:59:59') <= finMes;
      }
      return false;
    }).length;
  });
}

function esPendienteProyeccion(c){
  if(c.activo === false) return false;
  if(!mantenimientoActivo(c)) return false;
  if(esPeriodicoUnico(c)) return false;
  if(pagoConfirmado(c)) return false;
  return true;
}

function contarClientesPendientesProyeccion(clientes, meses){
  const porMes = {};
  meses.forEach(m => { porMes[m] = 0; });
  (clientes||[]).forEach(c => {
    if(!esPendienteProyeccion(c) || !c.fecha_vencimiento) return;
    const m = String(c.fecha_vencimiento).slice(0, 7);
    if(porMes[m] !== undefined) porMes[m]++;
  });
  return porMes;
}

/** Últimos 12 meses + meses futuros donde hay pendientes (por fecha de vencimiento) */
function mesesParaGraficoClientes(clientes){
  const meses = ultimosNMeses(12);
  const ultimoHist = meses[meses.length - 1];
  const futuros = new Set();
  const hoy = new Date();
  const topeFuturo = mesKey(new Date(hoy.getFullYear(), hoy.getMonth() + 18, 1));

  (clientes||[]).forEach(c => {
    if(!esPendienteProyeccion(c) || !c.fecha_vencimiento) return;
    const m = String(c.fecha_vencimiento).slice(0, 7);
    if(m > ultimoHist && m <= topeFuturo) futuros.add(m);
  });

  return meses.concat([...futuros].sort());
}

async function cargarEstadisticas(){
  if(!sb || !requiereSupabase()) return;
  const meses = ultimos6Meses();
  const mesesHistCli = ultimosNMeses(12);
  const desde = mesesHistCli[0]+'-01';
  const [{ data: movs, error: e1 }, { data: clis, error: e2 }, { data: movsProy, error: e3 }] = await Promise.all([
    sb.from('movimientos').select('*').gte('fecha', desde),
    sb.from('clientes').select('*'),
    sb.from('movimientos').select('*').eq('tipo', 'ingreso').or('categoria.eq.Proyecto,tipo_pago.eq.seña,tipo_pago.eq.pago_parcial')
  ]);
  if(e1){ toast(supabaseErrMsg(e1)); return; }
  if(e3) console.warn('Movimientos de proyecto:', e3);
  const mov = movs || [];
  const movProyecto = movsProy || mov.filter(r => r.tipo === 'ingreso' && (r.categoria === 'Proyecto' || r.tipo_pago === 'seña' || r.tipo_pago === 'pago_parcial'));
  const clisLista = clis || [];
  const devNombres = clisLista.filter(esClienteEnDesarrollo).map(c => c.nombre);
  let documentos = [];
  if(devNombres.length){
    const { data: docs } = await sb.from('documentos').select('id,cliente').in('cliente', devNombres);
    documentos = docs || [];
  }
  const mk = mesKey(new Date());
  let ingMes=0, gasMes=0;
  const porMes = {}; meses.forEach(m => { porMes[m]={ing:0,gas:0}; });
  mov.forEach(r => {
    const m = (r.fecha||'').slice(0,7);
    const v = Number(r.monto)||0;
    if(r.tipo==='ingreso'){ if(m===mk) ingMes+=v; if(porMes[m]) porMes[m].ing+=v; }
    else { if(m===mk) gasMes+=v; if(porMes[m]) porMes[m].gas+=v; }
  });
  const bal = ingMes - gasMes;
  document.getElementById('st-ing-mes').textContent = fmt(ingMes);
  document.getElementById('st-gas-mes').textContent = fmt(gasMes);
  const elBal = document.getElementById('st-bal-mes');
  elBal.textContent = fmt(bal);
  elBal.className = 'stat-val '+(bal>0?'val-green':bal<0?'val-red':'val-neutral');
  let vig=0;
  clisLista.forEach(c => { if(estadoCliente(c).key==='vigente') vig++; });
  document.getElementById('st-cli-vig').textContent = vig;
  renderClientesEnDesarrollo(listarClientesEnDesarrollo(clisLista, movProyecto, documentos));
  renderChartMeses(meses, porMes);
  const mesesCli = mesesParaGraficoClientes(clisLista);
  const porMesCli = contarCobrosMantenimientoPorMes(mov, mesesCli);
  const totalesCli = clientesTotalesPorMes(clisLista, mesesCli);
  renderChartClientesMes(mesesCli, porMesCli, totalesCli);
  renderTablaCatGas(mov);
  renderTablaSocioIng(mov);
}

function renderChartClientesMes(meses, porMes, totales){
  const ctx = document.getElementById('chart-clientes-mes');
  if(!ctx || typeof Chart === 'undefined') return;
  if(chartClientesMes) chartClientesMes.destroy();
  const datosConf = meses.map(m => porMes[m] || 0);
  const datosTot = totales || [];
  const maxVal = Math.max(1, ...datosConf, ...datosTot);
  const topeEje = Math.max(maxVal + 1, 3);

  chartClientesMes = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: meses.map(labelMes),
      datasets: [
        {
          label: 'Cobros de mantenimiento (ese mes)',
          data: datosConf,
          backgroundColor: 'rgba(26,111,196,0.82)',
          borderRadius: 6
        },
        {
          label: 'Total al cierre del mes',
          data: datosTot,
          backgroundColor: 'rgba(196,122,10,0.55)',
          borderColor: 'rgba(196,122,10,0.9)',
          borderWidth: 1,
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'top' } },
      scales: {
        y: {
          beginAtZero: true,
          suggestedMax: topeEje,
          title: { display: true, text: 'Cantidad de clientes' },
          ticks: { stepSize: 1, precision: 0 }
        }
      }
    }
  });
}

function renderChartMeses(meses, porMes){
  const ctx = document.getElementById('chart-meses');
  if(!ctx || typeof Chart==='undefined') return;
  if(chartMeses) chartMeses.destroy();
  chartMeses = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: meses.map(labelMes),
      datasets: [
        { label: 'Ingresos', data: meses.map(m=>porMes[m].ing), backgroundColor: 'rgba(10,157,110,0.75)', borderRadius: 6 },
        { label: 'Gastos', data: meses.map(m=>porMes[m].gas), backgroundColor: 'rgba(229,62,62,0.75)', borderRadius: 6 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'top' } },
      scales: {
        y: { beginAtZero: true, ticks: { callback: v => '$ '+Number(v).toLocaleString('es-AR') } }
      }
    }
  });
}

function renderTablaRank(tbodyId, rows, total){
  const tb = document.getElementById(tbodyId);
  if(!rows.length){ tb.innerHTML='<tr><td colspan="3" style="text-align:center;color:var(--text3);padding:1.5rem">Sin datos</td></tr>'; return; }
  tb.innerHTML = rows.map(([nombre,val])=>{
    const pct = total ? Math.round(val/total*100) : 0;
    return `<tr><td>${esc(nombre)}</td><td style="text-align:right;font-weight:600">${fmt(val)}</td><td style="text-align:right"><div>${pct}%</div><div class="pct-bar"><div class="pct-fill" style="width:${pct}%"></div></div></td></tr>`;
  }).join('');
}

function renderTablaCatGas(mov){
  const cats = {};
  mov.filter(r=>r.tipo==='gasto').forEach(r=>{ cats[r.categoria]=(cats[r.categoria]||0)+Number(r.monto); });
  const rows = Object.entries(cats).sort((a,b)=>b[1]-a[1]);
  const total = rows.reduce((s,[,v])=>s+v,0);
  renderTablaRank('tabla-cat-gas', rows, total);
}

function renderTablaSocioIng(mov){
  const socios = {};
  mov.filter(r=>r.tipo==='ingreso').forEach(r=>{
    const n = USUARIOS[r.socio]?.nombre || r.socio;
    socios[n]=(socios[n]||0)+Number(r.monto);
  });
  const rows = Object.entries(socios).sort((a,b)=>b[1]-a[1]);
  const total = rows.reduce((s,[,v])=>s+v,0);
  renderTablaRank('tabla-socio-ing', rows, total);
}
