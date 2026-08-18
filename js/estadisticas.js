// ─── Estadísticas y gráficos ───
// ─── estadísticas ────────────────────────
let chartMeses = null;
let chartClientesMes = null;

function mesKey(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); }
function labelMes(ym){ const m=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']; const [y,mo]=ym.split('-'); return m[+mo-1]+' '+y.slice(2); }
function ultimosNMeses(n){ const r=[]; const h=new Date(); for(let i=n-1;i>=0;i--){ const x=new Date(h.getFullYear(),h.getMonth()-i,1); r.push(mesKey(x)); } return r; }
function ultimos6Meses(){ return ultimosNMeses(6); }

function mesConfirmacionCliente(c){
  if(!pagoConfirmado(c)) return null;
  const f = c.fecha_confirmacion_pago;
  if(f) return String(f).slice(0, 7);
  return null;
}

function contarClientesNuevosPorMes(clientes, meses){
  const porMes = {};
  meses.forEach(m => { porMes[m] = 0; });
  (clientes||[]).forEach(c => {
    if(!mantenimientoActivo(c)) return;
    const m = mesConfirmacionCliente(c);
    if(m && porMes[m] !== undefined) porMes[m]++;
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
  const desde = meses[0]+'-01';
  const [{ data: movs, error: e1 }, { data: clis, error: e2 }] = await Promise.all([
    sb.from('movimientos').select('*').gte('fecha', desde),
    sb.from('clientes').select('*')
  ]);
  if(e1){ toast(supabaseErrMsg(e1)); return; }
  const mov = movs || [];
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
  (clis||[]).forEach(c => { if(estadoCliente(c).key==='vigente') vig++; });
  document.getElementById('st-cli-vig').textContent = vig;
  renderChartMeses(meses, porMes);
  const mesesCli = mesesParaGraficoClientes(clis);
  const porMesCli = contarClientesNuevosPorMes(clis, mesesCli);
  const totalesCli = clientesTotalesPorMes(clis, mesesCli);
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
          label: 'Pago confirmado (ese mes)',
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
