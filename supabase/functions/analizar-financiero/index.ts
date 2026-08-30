// Edge Function: analizar-financiero
// Reemplaza la llamada directa (insegura) que hacía js/exportar.js a una API de IA
// desde el navegador. La API key ahora vive acá, nunca en el frontend.
// Deploy: supabase functions deploy analizar-financiero
// Secret:  supabase secrets set GEMINI_API_KEY=tu-key-de-aistudio.google.com

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { resumen } = await req.json();
    if (!resumen || typeof resumen !== "string") {
      return json({ error: "Falta el resumen de movimientos" }, 400);
    }

    const ai = new GoogleGenAI({ apiKey: Deno.env.get("GEMINI_API_KEY") });
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: `Sos el asesor financiero de una empresa tech en Argentina. Analizá estos datos y dá un resumen claro en 4-5 puntos concretos: situación actual, categorías que más pesan, algo positivo y una recomendación accionable. Sin saludos ni títulos, directo al análisis.\n\n${resumen}`,
      config: {
        maxOutputTokens: 1500,
        thinkingConfig: { thinkingLevel: "MINIMAL" },
      },
    });

    return json({ texto: response.text || "Sin respuesta." });
  } catch (e) {
    console.error("[analizar-financiero]", e);
    return json({ error: String(e) }, 500);
  }
});
