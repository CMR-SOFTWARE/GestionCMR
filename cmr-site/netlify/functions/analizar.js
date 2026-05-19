exports.handler = async function(event) {
  if(event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;
  if(!ANTHROPIC_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'API key no configurada' }) };
  }

  let body;
  try { body = JSON.parse(event.body); } 
  catch(e) { return { statusCode: 400, body: JSON.stringify({ error: 'Body inválido' }) }; }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 600,
        messages: [{ role: 'user', content: body.prompt }]
      })
    });

    const data = await response.json();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ text: data.content?.[0]?.text || 'Sin respuesta.' })
    };
  } catch(e) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Error al llamar a la API: ' + e.message }) };
  }
};
