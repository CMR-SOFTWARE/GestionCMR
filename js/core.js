// ─── Core: auth, sesión, navegación, toast, tema ───
// ══════════════════════════════════════════
// CONFIG
// ══════════════════════════════════════════
const USUARIOS = {
  tomi:  { nombre: 'Tomi',  color: '#7f77dd', email: 'tomi@empresa.dev' },
  chipi: { nombre: 'Chipi', color: '#1d9e75', email: 'chipi@empresa.dev' },
  gena:  { nombre: 'Gena',  color: '#d85a30', email: 'gena@empresa.dev'  }
};

// contraseñas hasheadas (sha-256) — no están en texto plano
// tomi2025 | chipi2025 | gena2025
const HASHES = {
  tomi:  'd056a43f4d76891634dc9bad4786cf97ab322c6b7f5cd919682883a7489b1f73',
  chipi: '4d5636d0596b2d8ea91b61f9d9372321cf1ba52d11ce548c9ddfefe653acf234',
  gena:  '28277a20e14541d3356ceee0417f28671196c7043a0c5564827471c5af65bb92'
};

// ══════════════════════════════════════════
let sb = null;
let supabaseConectado = false;
let sesion = null;
let todosLosDatos = [];
let buscarTimer = null;

function initSupabase(){
  const cfg = window.SUPABASE_CONFIG;
  if(!cfg?.url || !cfg?.anonKey) return false;
  if(cfg.url.includes('TU_PROYECTO') || cfg.anonKey.includes('TU_ANON')) return false;
  sb = supabase.createClient(cfg.url, cfg.anonKey);
  return true;
}

function supabaseErrMsg(error){
  if(!error) return 'Error desconocido';
  const m = (error.message || '').toLowerCase();
  if(m.includes('failed to fetch') || m.includes('network')) return 'No se pudo conectar al servidor';
  if(error.code === 'PGRST205' || error.code === 'PGRST116' || m.includes('does not exist')) return 'Falta una tabla — ejecutá supabase/schema.sql o clientes.sql';
  if(error.code === '42501' || m.includes('permission') || m.includes('rls')) return 'Permisos RLS — revisá supabase/schema.sql';
  return error.message || error.hint || 'Error de base de datos';
}

async function verificarSupabase(){
  if(!sb){
    supabaseConectado = false;
    setSyncStatus(false, 'Sin configurar');
    return false;
  }
  setSyncStatus(true, 'Conectando…');
  const { error } = await sb.from('movimientos').select('id').limit(1);
  if(error){
    supabaseConectado = false;
    setSyncStatus(false, 'Error de conexión');
    console.error('[Supabase]', error);
    return false;
  }
  supabaseConectado = true;
  setSyncStatus(true, 'Sincronizado');
  return true;
}

function requiereSupabase(){
  if(supabaseConectado && sb) return true;
  toast('Sin conexión a Supabase. Revisá js/supabase-config.js y SUPABASE.md');
  return false;
}

function setSyncStatus(ok, msg){
  const ind = document.getElementById('sync-indicator');
  const dot = document.getElementById('sync-dot');
  const label = document.getElementById('sync-label');
  if(dot) dot.className = 'sync-dot' + (ok ? '' : ' off');
  if(label) label.textContent = msg;
  if(ind) ind.classList.toggle('error', !ok);
}

initSupabase();

// ─── hash simple ─────────────────────────
async function hashStr(str){
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

// ─── login ───────────────────────────────
async function doLogin(){
  const u = document.getElementById('login-user').value.trim().toLowerCase();
  const p = document.getElementById('login-pass').value;
  const err = document.getElementById('login-err');
  const btn = document.getElementById('btn-login');

  if(!u || !p){ err.textContent='Completá usuario y contraseña'; err.style.display='block'; return; }
  if(!USUARIOS[u]){ err.style.display='block'; return; }

  btn.disabled = true; btn.textContent = 'Verificando…';
  const h = await hashStr(p);
  if(h !== HASHES[u]){
    err.style.display='block';
    btn.disabled = false; btn.textContent = 'Ingresar al sistema';
    return;
  }
  err.style.display='none';
  sesion = u;
  sessionStorage.setItem('sesion', u);
  btn.disabled = false; btn.textContent = 'Ingresar al sistema';
  mostrarApp();
}

function mostrarApp(){
  const u = USUARIOS[sesion];
  document.getElementById('login-screen').style.display='none';
  document.getElementById('app').style.display='block';
  const av = document.getElementById('user-avatar');
  av.textContent = u.nombre.charAt(0).toUpperCase();
  av.style.background = u.color;
  document.getElementById('user-name').textContent = u.nombre;
  verificarSupabase().then(ok => { if(ok){ poblarMeses(); cargarDatos(); cargarClientes(); cargarPresupuestosParaMov(); initTareaForm(); initInformacionApp(); cargarResumenDiario(); } });
  setDefaultFechaVence();
}

function initTareaForm(){
  const sel = document.getElementById('ta-asignado');
  if(sel && sesion && USUARIOS[sesion]) sel.value = USUARIOS[sesion].nombre;
}

function logout(){
  sesion = null;
  sessionStorage.removeItem('sesion');
  document.getElementById('login-pass').value='';
  document.getElementById('login-user').value='';
  document.getElementById('app').style.display='none';
  document.getElementById('login-screen').style.display='flex';
}

// restaurar sesión al recargar
(function(){
  if(!initSupabase()){
    setSyncStatus(false, 'Configurá Supabase');
    return;
  }
  verificarSupabase();
  const s = sessionStorage.getItem('sesion');
  if(s && USUARIOS[s]){ sesion = s; mostrarApp(); }
})();


// ─── navegación ──────────────────────────
function showPage(id, tab){
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('page-'+id).classList.add('active');
  if(tab) tab.classList.add('active');
  if(id === 'clientes' && supabaseConectado) cargarClientes();
  if(id === 'movimientos' && supabaseConectado) cargarPresupuestosParaMov();
  if(id === 'estadisticas' && supabaseConectado) cargarEstadisticas();
  if(id === 'tareas' && supabaseConectado){
    if(proyectoActual) cargarTareas();
    else cargarProyectos();
  }
  if(id === 'documentos' && supabaseConectado) { poblarFiltroEstadoDoc(); cargarDocumentos(); }
  if(id === 'informacion' && supabaseConectado) cargarInformacion();
  if(id === 'avisos' && supabaseConectado) cargarAvisos();
}


// ─── toast ───────────────────────────────
function toast(msg){ const el=document.getElementById('toast'); el.textContent=msg; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),2800); }

function esColumnaFaltante(error, col){
  const m = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`;
  return new RegExp(col, 'i').test(m) || /schema cache|could not find/i.test(m);
}

async function resolverClienteIdPorNombre(texto){
  if(!texto || !sb) return null;
  const t = String(texto).toLowerCase();
  let lista = (typeof clientesCompletos !== 'undefined' && clientesCompletos.length) ? clientesCompletos : null;
  if(!lista){
    const { data } = await sb.from('clientes').select('id,nombre');
    lista = data || [];
  }
  const exact = lista.find(c => c.nombre.toLowerCase() === t);
  if(exact) return exact.id;
  const hit = lista.find(c => {
    const n = c.nombre.toLowerCase();
    if(t.includes(n) || n.includes(t)) return true;
    const tokens = n.match(/[a-záéíóúñ0-9]{4,}/gi) || [];
    return tokens.some(tok => t.includes(tok.toLowerCase()));
  });
  return hit ? hit.id : null;
}

function getTema(){
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}
function setTema(tema){
  const t = tema === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', t);
  try{ localStorage.setItem('cmr-theme', t); }catch(e){}
  syncTemaUI();
  toast(t === 'dark' ? 'Modo oscuro activado' : 'Modo claro activado');
}
function syncTemaUI(){
  const t = getTema();
  document.getElementById('theme-opt-light')?.classList.toggle('active', t === 'light');
  document.getElementById('theme-opt-dark')?.classList.toggle('active', t === 'dark');
}
syncTemaUI();

// ─── atajos ──────────────────────────────
document.getElementById('desc').addEventListener('keydown',e=>{ if(e.key==='Enter') document.getElementById('monto').focus(); });
document.getElementById('monto').addEventListener('keydown',e=>{ if(e.key==='Enter') agregar(); });
