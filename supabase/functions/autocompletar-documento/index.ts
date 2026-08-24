// Edge Function: autocompletar-documento
// Lee un PDF (presupuesto o contrato ya firmado/recibido) con Gemini y devuelve
// los campos estructurados para autocompletar el formulario de Documentos.
// Deploy: supabase functions deploy autocompletar-documento
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

const ESQUEMA_PRESUPUESTO = `{
  "fecha": "YYYY-MM-DD o null si no figura",
  "cliente": "nombre del cliente o empresa",
  "proyecto": "nombre corto del proyecto",
  "contenido": {
    "proyecto": "igual al de arriba",
    "descripcionFilas": [{ "etiqueta": "Producto / Proyecto", "valor": "..." }],
    "items": [{ "nombre": "módulo o ítem", "descripcion": "detalle / funcionalidades", "precio": 0, "dependencia": "" }],
    "precioTotal": 0,
    "cuotas": 1,
    "pagos": [{ "nombre": "1° Pago — Anticipo", "cuando": "Al firmar", "monto": 0 }],
    "mantenimiento": { "activo": false, "precioMensual": 0, "descripcion": "", "excluye": "" },
    "validezDias": 15,
    "notas": ""
  }
}`;

const ESQUEMA_CONTRATO = `{
  "fecha": "YYYY-MM-DD o null si no figura",
  "cliente": "nombre del cliente o empresa",
  "proyecto": "nombre corto del proyecto",
  "contenido": {
    "ciudad": "ciudad de firma",
    "clienteCuit": "", "clienteDni": "", "clienteDomicilio": "", "clienteEmail": "", "representante": "",
    "descripcionFilas": [{ "etiqueta": "Objeto", "valor": "..." }],
    "items": [{ "nombre": "módulo o ítem", "descripcion": "detalle", "precio": 0, "dependencia": "" }],
    "precioTotal": 0,
    "pagos": [{ "nombre": "1° Pago — Anticipo", "cuando": "Al firmar", "monto": 0 }],
    "plazoEntrega": "",
    "mantenimiento": { "activo": false, "precioMensual": 0, "descripcion": "", "excluye": "" },
    "firmas": { "clienteNombre": "", "clienteDoc": "" }
  }
}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { tipo, pdfBase64, mimeType } = await req.json();
    if (!pdfBase64 || typeof pdfBase64 !== "string") {
      return json({ error: "Falta el archivo PDF" }, 400);
    }
    if (tipo !== "presupuesto" && tipo !== "contrato") {
      return json({ error: "Tipo inválido" }, 400);
    }

    const esquema = tipo === "presupuesto" ? ESQUEMA_PRESUPUESTO : ESQUEMA_CONTRATO;
    const prompt = `Sos un asistente que extrae datos de documentos comerciales (presupuestos y contratos de desarrollo de software) para una empresa argentina.
Leé el PDF adjunto y devolvé ÚNICAMENTE un JSON válido (sin texto adicional, sin markdown) con esta forma exacta:

${esquema}

Reglas:
- Los precios/montos son números (sin símbolo de moneda, sin puntos de miles).
- Si un dato no aparece en el documento, dejalo vacío ("" o 0 o [] según corresponda), nunca inventes.
- "items" son los módulos, funcionalidades o ítems cotizados, con su precio individual si figura.
- "pagos" son los hitos de pago (anticipo, entrega, cuotas, etc.) con su monto si figura.`;

    const ai = new GoogleGenAI({ apiKey: Deno.env.get("GEMINI_API_KEY") });
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: [
        { inlineData: { mimeType: mimeType || "application/pdf", data: pdfBase64 } },
        { text: prompt },
      ],
      config: {
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
      },
    });

    const texto = (response.text || "").trim();
    if (!texto) return json({ error: "Gemini no devolvió contenido" }, 500);

    let data: unknown;
    try {
      const limpio = texto.replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
      data = JSON.parse(limpio);
    } catch {
      console.error("[autocompletar-documento] JSON inválido:", texto);
      return json({ error: "No se pudo interpretar la respuesta de la IA" }, 500);
    }

    return json(data);
  } catch (e) {
    console.error("[autocompletar-documento]", e);
    return json({ error: String(e) }, 500);
  }
});
