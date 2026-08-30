// Edge Function: resumen-diario
// Genera (o devuelve cacheado) el resumen diario del negocio con Gemini (free tier).
// Deploy: supabase functions deploy resumen-diario
// Secret:  supabase secrets set GEMINI_API_KEY=tu-key-de-aistudio.google.com

import { createClient } from "npm:@supabase/supabase-js@2";
import { GoogleGenAI } from "npm:@google/genai";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function hoyArgentina(): string {
  // formato en-CA => YYYY-MM-DD, calculado en huso horario de Argentina
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { forzar } = await req.json().catch(() => ({ forzar: false }));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );

    const hoy = hoyArgentina();

    if (!forzar) {
      const { data: cache } = await supabase
        .from("resumenes_diarios")
        .select("contenido")
        .eq("fecha", hoy)
        .maybeSingle();
      if (cache) return json({ resumen: cache.contenido, cacheado: true });
    }

    const { data: config } = await supabase
      .from("configuracion")
      .select("dias_aviso_cliente")
      .eq("id", 1)
      .maybeSingle();
    const diasAviso = config?.dias_aviso_cliente ?? 5;
    const inicioMes = hoy.slice(0, 7) + "-01";

    const [tareasVencidas, tareasPendientes, clientesPorVencer, movimientosMes, clientesDesarrollo] =
      await Promise.all([
        supabase.from("tareas")
          .select("titulo,asignado_a,prioridad,fecha_vencimiento")
          .eq("estado", "Pendiente")
          .lt("fecha_vencimiento", hoy)
          .order("fecha_vencimiento"),
        supabase.from("tareas")
          .select("asignado_a")
          .eq("estado", "Pendiente"),
        supabase.from("clientes")
          .select("nombre,fecha_vencimiento,monto_plan")
          .eq("mantenimiento_activo", true)
          .lte("fecha_vencimiento", new Date(Date.parse(hoy) + diasAviso * 86400000).toISOString().slice(0, 10)),
        supabase.from("movimientos")
          .select("tipo,monto")
          .gte("fecha", inicioMes),
        supabase.from("clientes")
          .select("nombre,monto_plan")
          .eq("activo", true)
          .eq("mantenimiento_activo", false),
      ]);

    const cargaPorSocio: Record<string, number> = {};
    for (const t of tareasPendientes.data ?? []) {
      cargaPorSocio[t.asignado_a] = (cargaPorSocio[t.asignado_a] ?? 0) + 1;
    }

    let ingresosMes = 0, gastosMes = 0;
    for (const m of movimientosMes.data ?? []) {
      if (m.tipo === "ingreso") ingresosMes += Number(m.monto);
      else gastosMes += Number(m.monto);
    }

    const datos = {
      tareas_vencidas: tareasVencidas.data ?? [],
      carga_por_socio: cargaPorSocio,
      clientes_por_vencer_pronto: clientesPorVencer.data ?? [],
      balance_mes_actual: { ingresos: ingresosMes, gastos: gastosMes },
      clientes_en_desarrollo_sin_mantenimiento: clientesDesarrollo.data ?? [],
    };

    const ai = new GoogleGenAI({ apiKey: Deno.env.get("GEMINI_API_KEY") });
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: `Generá el resumen diario con estos datos:\n\n${JSON.stringify(datos, null, 2)}`,
      config: {
        systemInstruction: `Sos el asistente interno de CMR Software Solutions, una empresa de desarrollo de software en San Nicolás de los Arroyos, Argentina.
Generá un resumen diario breve y directo en español argentino, tono natural (nada de "estimado equipo" ni formalidad excesiva).
Priorizá lo urgente primero (tareas vencidas, cobros pendientes). Si algo está bien, no hace falta mencionarlo con bombos y platillos, basta una línea.
No inventes datos que no estén en el JSON de entrada.`,
        maxOutputTokens: 1024,
        thinkingConfig: { thinkingLevel: "MINIMAL" },
      },
    });

    const texto = response.text ?? "";

    await supabase
      .from("resumenes_diarios")
      .upsert({ fecha: hoy, contenido: texto }, { onConflict: "fecha" });

    return json({ resumen: texto, cacheado: false });
  } catch (e) {
    console.error("[resumen-diario]", e);
    return json({ error: String(e) }, 500);
  }
});
