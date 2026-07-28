// Supabase Edge Function: ai-chat
// Proxies conversation history to OpenRouter for AI responses.
//
// Deploy: supabase functions deploy ai-chat
//
// Required env vars (set in Supabase Dashboard → Edge Functions → Secrets):
//   OPENROUTER_API_KEY — your OpenRouter API key
//   OPENROUTER_MODEL   — optional, defaults to "openai/gpt-4o-mini"

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// In-memory rate limiter (per-user, per-minute, resets on cold start)
const RL_WINDOW_MS = 60_000;
const RL_MAX = 30;
const rlMap = new Map<string, { count: number; window: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rlMap.get(userId);
  if (!entry || now - entry.window > RL_WINDOW_MS) {
    rlMap.set(userId, { count: 1, window: now });
    return true;
  }
  if (entry.count >= RL_MAX) return false;
  entry.count++;
  return true;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify the caller is authenticated
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit: 30 requests per minute per user
    if (!checkRateLimit(user.id)) {
      return new Response(
        JSON.stringify({ error: "Too many requests. Please wait." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "messages array required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Call OpenRouter
    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "OPENROUTER_API_KEY not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const model = Deno.env.get("OPENROUTER_MODEL") ?? "openai/gpt-4o-mini";

    const openRouterResp = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://mowgo.app",
          "X-Title": "MowGo AI",
        },
        body: JSON.stringify({
          model,
          messages: messages.slice(-20), // Last 20 messages for context
          max_tokens: 800,
          temperature: 0.7,
        }),
      }
    );

    if (!openRouterResp.ok) {
      const errText = await openRouterResp.text();
      console.error("OpenRouter error:", errText);
      return new Response(
        JSON.stringify({ error: "AI service unavailable" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const completion = await openRouterResp.json();
    const reply =
      completion.choices?.[0]?.message?.content ??
      "Sorry, I couldn't generate a response.";

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("ai-chat error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
