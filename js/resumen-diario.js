// ─── Resumen diario (Claude) ─────────────
async function cargarResumenDiario(forzar){
  const txtEl = document.getElementById('resumen-diario-text');
  const btn = document.getElementById('btn-actualizar-resumen');
  if(!txtEl || !window.SUPABASE_CONFIG) return;

  txtEl.className = 'ia-loading';
  txtEl.textContent = 'Generando resumen…';
  if(btn) btn.disabled = true;

  try{
    const cfg = window.SUPABASE_CONFIG;
    const res = await fetch(`${cfg.url}/functions/v1/resumen-diario`,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${cfg.anonKey}`,'apikey':cfg.anonKey},
      body:JSON.stringify({forzar: !!forzar})
    });
    const data = await res.json();
    if(!res.ok || data.error) throw new Error(data.error || 'error desconocido');
    txtEl.className = '';
    txtEl.textContent = data.resumen || 'No hay novedades para resumir hoy.';
  }catch(e){
    console.error('[resumen-diario]', e);
    txtEl.className = '';
    txtEl.textContent = 'No se pudo generar el resumen.';
  }finally{
    if(btn) btn.disabled = false;
  }
}
