/**
 * Cloudflare Pages Function — AI Autopilot LLM Proxy
 *
 * POST /api/autopilot
 * Headers: Authorization: Bearer <supabase access token>
 * Body: { messages: [{role, content}], tools: [...] }
 * Returns: { message: {role, content, tool_calls?} }
 *
 * Proxies to OpenRouter with the user's configured model.
 *
 * This endpoint spends money on every call, so it requires a valid Supabase
 * session. The Origin allowlist is kept as defence in depth only — the header
 * is trivially forged outside a browser and is not a security control.
 *
 * Env vars (set in Cloudflare dashboard):
 *   OPENROUTER_API_KEY — required for AI
 *   SUPABASE_URL, SUPABASE_ANON_KEY — required to authenticate callers
 *   AUTOPILOT_MODEL — optional model override (default: deepseek/deepseek-chat)
 *   ALLOWED_ORIGINS — optional comma-separated override (add localhost in dev)
 */

import { requireUser, isAllowedOrigin } from './_lib/auth.js';

const DEFAULT_ORIGINS = [
  'https://mowflow.pages.dev',
  'https://cleanflloww.pages.dev',
  'https://mowflow.app',
];
const DEFAULT_MODEL = 'deepseek/deepseek-chat';
const MAX_TOKENS = 1024;
const TIMEOUT_MS = 20000;

// Bound the proxied payload — the request body is attacker-controlled and
// every token costs money.
const MAX_MESSAGES = 40;
const MAX_TOTAL_CHARS = 24000;

function allowedOrigins(env) {
  if (env.ALLOWED_ORIGINS) {
    return env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean);
  }
  return DEFAULT_ORIGINS;
}

export async function onRequestOptions(context) {
  const origin = context.request.headers.get('origin');
  const allowed = allowedOrigins(context.env);
  return new Response(null, {
    status: 204,
    headers: corsHeaders(origin, allowed),
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const allowed = allowedOrigins(env);
  const origin = request.headers.get('origin');

  if (!isAllowedOrigin(origin, allowed)) {
    return json({ error: 'Forbidden' }, 403, null, allowed);
  }

  // Authentication — must come before any billable work.
  const { user, error: authError } = await requireUser(request, env);
  if (!user) {
    const status = authError === 'auth_unavailable' ? 503 : 401;
    return json({ error: authError || 'unauthorized' }, status, origin, allowed);
  }

  if (!env.OPENROUTER_API_KEY) {
    console.warn('OpenRouter API key not configured — returning demo mode hint');
    return json({
      error: 'not_configured',
      message: 'AI Autopilot is not configured yet. Add OPENROUTER_API_KEY to Cloudflare environment variables.'
    }, 503, origin, allowed);
  }

  try {
    const { messages, tools } = await request.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return json({ error: 'messages array is required' }, 400, origin, allowed);
    }
    if (messages.length > MAX_MESSAGES) {
      return json({ error: 'Conversation too long. Start a new chat.' }, 413, origin, allowed);
    }

    const totalChars = messages.reduce((sum, m) => sum + String(m?.content ?? '').length, 0);
    if (totalChars > MAX_TOTAL_CHARS) {
      return json({ error: 'Conversation too long. Start a new chat.' }, 413, origin, allowed);
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
          temperature: 0.3,
          // Attribute spend to the calling account for per-user tracing.
          user: user.id,
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
        }, 502, origin, allowed);
      }

      const data = await response.json();
      const choice = data.choices?.[0];

      if (!choice) {
        console.error('OpenRouter: no choices in response');
        return json({ error: 'ai_error', message: 'No response from AI. Try again.' }, 502, origin, allowed);
      }

      const msg = choice.message;
      return json({
        message: {
          role: msg.role || 'assistant',
          content: msg.content || null,
          tool_calls: msg.tool_calls || null,
          finish_reason: choice.finish_reason || 'stop'
        }
      }, 200, origin, allowed);

    } finally {
      clearTimeout(timeout);
    }

  } catch (err) {
    if (err.name === 'AbortError') {
      return json({ error: 'timeout', message: 'AI took too long. Try a simpler request.' }, 504, origin, allowed);
    }
    console.error('Autopilot function error:', err);
    return json({ error: 'server_error', message: 'Something went wrong.' }, 500, origin, allowed);
  }
}

function json(data, status = 200, origin = null, allowed = DEFAULT_ORIGINS) {
  const headers = { 'Content-Type': 'application/json' };
  if (isAllowedOrigin(origin, allowed)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
  }
  return new Response(JSON.stringify(data), { status, headers });
}

function corsHeaders(origin, allowed) {
  const h = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  };
  if (isAllowedOrigin(origin, allowed)) {
    h['Access-Control-Allow-Origin'] = origin;
  }
  return h;
}
