const PROMPTS = {
  CAME_MAQUILA: `Este documento es una REMISION de Cartones America (CAME) tipo "Entrega Maquila", dirigida a una empresa cliente (por ejemplo Contubos o Tecnipapel).
Tiene un encabezado con el numero de remision (campo "Numero") y la fecha (campo "Fecha Contabilizacion"), y una tabla con varias filas. Cada fila tiene: Pedido/Pos, Cliente, Descripcion (material), Lote, Ancho(cm), Peso(Kg).
Extrae TODAS las filas de la tabla, sin omitir ninguna.
Para cada fila devuelve un objeto JSON con EXACTAMENTE estas claves: "Remisión" (el numero de remision del encabezado, igual para todas las filas), "Fecha" (formato DD/MM/AAAA, igual para todas las filas), "Pedido" (el valor de Pedido/Pos de esa fila), "Cliente" (el nombre de cliente de esa fila), "Descripción" (el material), "Lote", "Ancho" (solo el numero), "Peso" (solo el numero, sin la palabra KG).
Responde UNICAMENTE con un array JSON de objetos. No agregues texto antes ni despues, ni uses bloques de codigo markdown.`,

  CAME_INTERNO: `Este documento es una REMISION de Cartones America (CAME) tipo "Entrega Ventas Nal", dirigida a una empresa cliente.
Tiene un encabezado con el numero de remision (campo "Numero") y la fecha (campo "Fecha Contabilizacion"), y una tabla con varias filas. Cada fila tiene: Material, Descripcion, # Rollo, Ancho(cm), Cantidad KG.
Extrae TODAS las filas de la tabla, sin omitir ninguna.
Para cada fila devuelve un objeto JSON con EXACTAMENTE estas claves: "Remisión" (el numero de remision del encabezado, igual para todas las filas), "Fecha" (formato DD/MM/AAAA, igual para todas las filas), "Descripción" (el material), "Número rollo" (el valor de # Rollo), "Ancho" (solo el numero), "Cantidad KG" (solo el numero).
Responde UNICAMENTE con un array JSON de objetos. No agregues texto antes ni despues, ni uses bloques de codigo markdown.`,

  SMURFIT_MAQUILA: `Este documento es una "PLANILLA DE TRANSPORTE CENTROS EXTERNOS" de Smurfit Kappa.
Tiene un encabezado con el numero de documento y fecha juntos en el campo "Documento/Fecha" (formato NUMERO / DD.MM.AAAA), y una tabla con varias filas. Cada fila tiene: Material, Descripcion, Lote, Ancho, Peso.
Extrae TODAS las filas de la tabla, incluso si el documento tiene varias paginas.
Para cada fila devuelve un objeto JSON con EXACTAMENTE estas claves: "Número documento" (la parte numerica antes de la barra "/" en "Documento/Fecha", igual para todas las filas), "Fecha" (la parte de fecha despues de la barra, formato DD/MM/AAAA, igual para todas las filas), "Descripción" (el material), "Lote", "Ancho" (solo el numero), "Peso" (solo el numero).
Responde UNICAMENTE con un array JSON de objetos. No agregues texto antes ni despues, ni uses bloques de codigo markdown.`,

  SMURFIT_INTERNO: `Este documento es una "Nota de Despacho" de Smurfit Kappa.
Tiene un encabezado con el numero de nota y fecha juntos en el campo "Numero/Fecha" (formato NUMERO / DD.MM.AAAA), y una tabla con varias filas. Cada fila tiene: Denominacion/Caracteristicas (descripcion del material), No. Lote, Kilos (KG). El ancho del material aparece como un dato fijo junto a la descripcion (ejemplo "Ancho 105,500 CM"), y es el mismo para todas las filas de esa pagina.
Extrae TODAS las filas de la tabla, incluso si el documento tiene varias paginas.
Para cada fila devuelve un objeto JSON con EXACTAMENTE estas claves: "Número" (la parte numerica antes de la barra "/" en "Numero/Fecha", igual para todas las filas), "Fecha" (la parte de fecha despues de la barra, formato DD/MM/AAAA, igual para todas las filas), "Descripción" (el material, ejemplo "Chip Tubos 200 g/m2"), "Ancho" (solo el numero, ejemplo 105.5), "Número de lote" (el valor de No. Lote), "Kilos" (solo el numero).
Responde UNICAMENTE con un array JSON de objetos. No agregues texto antes ni despues, ni uses bloques de codigo markdown.`
};

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Método no permitido" });
    return;
  }

  try {
    const { tipo, mimeType, base64 } = req.body || {};

    if (!tipo || !mimeType || !base64) {
      res.status(400).json({ ok: false, error: "Faltan datos (tipo, mimeType o base64)" });
      return;
    }

    const prompt = PROMPTS[tipo];
    if (!prompt) {
      res.status(400).json({ ok: false, error: "Tipo de documento no reconocido: " + tipo });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(500).json({ ok: false, error: "Falta configurar GEMINI_API_KEY en Vercel" });
      return;
    }

    const geminiResp = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { inline_data: { mime_type: mimeType, data: base64 } }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: "application/json"
          }
        })
      }
    );

    const data = await geminiResp.json();

    if (!geminiResp.ok) {
      const msg = (data && data.error && data.error.message) || "Error llamando a Gemini";
      res.status(500).json({ ok: false, error: msg });
      return;
    }

    const text =
      data &&
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0] &&
      data.candidates[0].content.parts[0].text;

    if (!text) {
      res.status(500).json({ ok: false, error: "La IA no devolvió datos. Intenta con una foto más clara." });
      return;
    }

    let filas;
    try {
      filas = JSON.parse(text);
    } catch (e) {
      res.status(500).json({ ok: false, error: "No se pudo interpretar la respuesta de la IA" });
      return;
    }

    if (!Array.isArray(filas)) filas = [filas];

    res.status(200).json({ ok: true, filas });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || "Error interno" });
  }
};
