/**
 * Cloudflare Pages Function — AI Autopilot LLM Proxy
 *
 * POST /api/autopilot
 * Body: { messages: [{role, content}], tools: [...] }
 * Returns: { message: {role, content, tool_calls?} }
 *
 * Proxies to OpenRouter with the user's configured model.
 * Falls back to demo mode if no API key is configured.
 *
 * Env vars (set in Cloudflare dashboard):
 *   OPENROUTER_API_KEY — required for AI
 *   AUTOPILOT_MODEL — optional model override (default: deepseek/deepseek-chat)
 */

const ALLOWED_ORIGINS = [
  'https://mowflow.pages.dev',
  'https://cleanflloww.pages.dev',
  'https://mowflow.app',
  'http://localhost:5173',
  'http://localhost:4173'
];
const OPTS_METHOD = 'OPTIONS';
const DEFAULT_MODEL = 'deepseek/deepseek-chat';
const MAX_TOKENS = 1024;
const TIMEOUT_MS = 20000;

export async function onRequestOptions(context) {
  const origin = context.request.headers.get('origin');
  return new Response(null, {
    status: 204,
    headers: corsHeaders(origin || '*')
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // Origin validation
  const origin = request.headers.get('origin');
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
    return json({ error: 'Forbidden' }, 403, origin);
  }

  // Guard: API key
  if (!env.OPENROUTER_API_KEY) {
    console.warn('OpenRouter API key not configured — returning demo mode hint');
    return json({
      error: 'not_configured',
      message: 'AI Autopilot is not configured yet. Add OPENROUTER_API_KEY to Cloudflare environment variables.'
    }, 503, origin);
  }

  try {
    const { messages, tools } = await request.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return json({ error: 'messages array is required' }, 400, origin);
    }

    const model = env.AUTOPILOT_MODEL || DEFAULT_MODEL;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': origin,
          'X-Title': 'MowFlow AI Autopilot'
        },
        body: JSON.stringify({
          model,
          messages,
          tools: tools || undefined,
          tool_choice: tools?.length ? 'auto' : undefined,
          max_tokens: MAX_TOKENS,
          temperature: 0.3
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errText = await response.text().catch(() => 'Unknown error');
        console.error(`OpenRouter ${response.status}:`, errText.slice(0, 200));
        return json({
          error: 'ai_error',
          message: response.status === 429
            ? 'Too many requests. Please wait a moment and try again.'
            : 'AI is having trouble right now. Try again in a minute.'
        }, 502, origin);
      }

      const data = await response.json();
      const choice = data.choices?.[0];

      if (!choice) {
        console.error('OpenRouter: no choices in response');
        return json({ error: 'ai_error', message: 'No response from AI. Try again.' }, 502, origin);
      }

      const msg = choice.message;
      return json({
        message: {
          role: msg.role || 'assistant',
          content: msg.content || null,
          tool_calls: msg.tool_calls || null,
          finish_reason: choice.finish_reason || 'stop'
        }
      }, 200, origin);

    } finally {
      clearTimeout(timeout);
    }

  } catch (err) {
    if (err.name === 'AbortError') {
      return json({ error: 'timeout', message: 'AI took too long. Try a simpler request.' }, 504, origin);
    }
    console.error('Autopilot function error:', err);
    return json({ error: 'server_error', message: 'Something went wrong.' }, 500, origin);
  }
}

function json(data, status = 200, origin = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
  }
  return new Response(JSON.stringify(data), { status, headers });
}

function corsHeaders(origin) {
  const h = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
  if (origin && (origin === '*' || ALLOWED_ORIGINS.includes(origin))) {
    h['Access-Control-Allow-Origin'] = origin;
  }
  return h;
}
