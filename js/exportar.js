// ─── Exportar CSV / análisis IA ───
// ─── exportar ────────────────────────────
function exportarCSV(){
  if(!todosLosDatos.length){ toast('No hay datos para exportar'); return; }
  const cab = 'Fecha,Tipo,Descripcion,Categoria,TipoPago,Monto,Socio\n';
  const filas = todosLosDatos.map(r=>
    `${r.fecha},${r.tipo},"${r.descripcion.replace(/"/g,'""')}",${r.categoria},${r.tipo_pago||'pago_total'},${r.monto},${USUARIOS[r.socio]?.nombre||r.socio}`
  ).join('\n');
  const blob = new Blob(['\uFEFF'+cab+filas],{type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='movimientos_empresa.csv'; a.click();
  URL.revokeObjectURL(url);
}

// ─── análisis IA ─────────────────────────
let iaVisible = false;
function toggleIA(){
  const box = document.getElementById('ia-box');
  iaVisible = !iaVisible;
  if(!iaVisible){ box.style.display='none'; return; }
  box.style.display='block';
  analizarIA();
}

async function analizarIA(){
  const txtEl = document.getElementById('ia-text');
  txtEl.className='ia-loading'; txtEl.textContent='Analizando movimientos…';
  if(ANTHROPIC_KEY==='TU_API_KEY_ACÁ'){
    txtEl.className=''; txtEl.textContent='Para usar el análisis con IA, reemplazá TU_API_KEY_ACÁ con tu clave de api.anthropic.com'; return;
  }
  if(!todosLosDatos.length){ txtEl.className=''; txtEl.textContent='No hay movimientos para analizar.'; return; }
  let ing=0,gas=0; const cats={},porSocio={};
  todosLosDatos.forEach(r=>{
    const m=Number(r.monto);
    if(r.tipo==='ingreso') ing+=m; else gas+=m;
    if(!cats[r.categoria]) cats[r.categoria]={ing:0,gas:0};
    if(r.tipo==='ingreso') cats[r.categoria].ing+=m; else cats[r.categoria].gas+=m;
    const sn=USUARIOS[r.socio]?.nombre||r.socio;
    if(!porSocio[sn]) porSocio[sn]={ing:0,gas:0};
    if(r.tipo==='ingreso') porSocio[sn].ing+=m; else porSocio[sn].gas+=m;
  });
  const resumen=`Empresa de desarrollo de apps y webs, 3 socios (Tomi-IA, Chipi-Dev, Gena-Marketing), San Nicolás de los Arroyos, Argentina.
Movimientos: ${todosLosDatos.length}. Ingresos: $${ing.toFixed(2)}. Gastos: $${gas.toFixed(2)}. Balance: $${(ing-gas).toFixed(2)}.
Por categoría: ${JSON.stringify(cats)}. Por socio: ${JSON.stringify(porSocio)}.
Últimos 5: ${JSON.stringify(todosLosDatos.slice(0,5).map(r=>({fecha:r.fecha,tipo:r.tipo,desc:r.descripcion,monto:r.monto})))}`;
  try{
    const res = await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':ANTHROPIC_KEY,'anthropic-version':'2023-06-01'},
      body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:600,
        messages:[{role:'user',content:`Sos el asesor financiero de una empresa tech en Argentina. Analizá estos datos y dá un resumen claro en 4-5 puntos concretos: situación actual, categorías que más pesan, algo positivo y una recomendación accionable. Sin saludos ni títulos, directo al análisis.\n\n${resumen}`}]})
    });
    const data = await res.json();
    txtEl.className=''; txtEl.textContent=data.content?.[0]?.text||'Sin respuesta.';
  }catch(e){ txtEl.className=''; txtEl.textContent='Error al conectar con la IA.'; }
}
