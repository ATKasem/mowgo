// Scheduled weather-to-push pipeline. Suggestion only: this function never updates jobs.
// Required secrets: SB_SERVICE_ROLE_KEY, WEATHER_PUSH_CRON_SECRET, NWS_USER_AGENT.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseNwsPayload, parseOpenMeteoTomorrow, runWeatherPush } from "./core.js";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://vqgiynfrpsqddjrayczc.supabase.co";
const serviceRoleKey = Deno.env.get("SB_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const admin = createClient(supabaseUrl, serviceRoleKey);

function validCoordinates(latitude: unknown, longitude: unknown): boolean {
  return typeof latitude === "number" && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 &&
    typeof longitude === "number" && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
}

async function listOwnersWithTomorrowJobs(candidateDates: string[]) {
  const { data, error } = await admin
    .from("profiles")
    .select("id, latitude, longitude, jobs!jobs_user_id_fkey!inner(id, scheduled_date)")
    .eq("role", "owner")
    .eq("rain_alerts_enabled", true)
    .in("jobs.scheduled_date", candidateDates)
    .in("jobs.status", ["scheduled", "in_progress"]);
  if (error) throw new Error("Could not load eligible owners");
  return (data ?? []).flatMap((profile: Record<string, unknown>) => {
    const jobs = Array.isArray(profile.jobs) ? profile.jobs : [];
    if (!validCoordinates(profile.latitude, profile.longitude) || jobs.length === 0) return [];
    return [{
      id: profile.id,
      latitude: profile.latitude,
      longitude: profile.longitude,
      jobDates: jobs.flatMap((job: Record<string, unknown>) =>
        typeof job.scheduled_date === "string" ? [job.scheduled_date] : []
      ),
    }];
  });
}

async function fetchJson(url: URL, headers: Record<string, string> = {}) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error("Weather provider unavailable");
  return await response.json();
}

async function fetchWeather(owner: { latitude: number; longitude: number }) {
  const userAgent = Deno.env.get("NWS_USER_AGENT")?.trim();
  if (!userAgent || userAgent.length > 256 || /[\r\n]/.test(userAgent)) throw new Error("NWS identity not configured");

  const meteoUrl = new URL("https://api.open-meteo.com/v1/forecast");
  meteoUrl.searchParams.set("latitude", String(owner.latitude));
  meteoUrl.searchParams.set("longitude", String(owner.longitude));
  meteoUrl.searchParams.set("daily", "precipitation_probability_max");
  meteoUrl.searchParams.set("timezone", "auto");
  meteoUrl.searchParams.set("forecast_days", "3");
  const nwsUrl = new URL("https://api.weather.gov/alerts/active");
  nwsUrl.searchParams.set("point", `${owner.latitude},${owner.longitude}`);

  const [meteoPayload, nwsPayload] = await Promise.all([
    fetchJson(meteoUrl),
    fetchJson(nwsUrl, { Accept: "application/geo+json", "User-Agent": userAgent }),
  ]);
  const forecast = parseOpenMeteoTomorrow(meteoPayload);
  const nwsAlerts = parseNwsPayload(nwsPayload);
  if (!forecast || !nwsAlerts) throw new Error("Invalid weather response");
  return { date: forecast.date, rainProbability: forecast.rainProbability, nwsAlerts };
}

async function reserveEvent(event: { eventKey: string; userId: string; forecastDate: string; reasons: string[]; nwsAlertIds: string[] }) {
  const { data, error } = await admin.rpc("reserve_weather_push_event", {
    p_event_key: event.eventKey,
    p_user_id: event.userId,
    p_forecast_date: event.forecastDate,
    p_notification_kind: "alert",
    p_reasons: event.reasons,
    p_nws_alert_ids: event.nwsAlertIds,
  });
  if (error) throw new Error("Could not reserve weather notification");
  return typeof data === "string" ? data : null;
}

async function sendPush(message: { userId: string; title: string; body: string }) {
  const response = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
    method: "POST",
    headers: { Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(message),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return false;
  const result = await response.json().catch(() => null) as { sent?: boolean } | null;
  return result?.sent === true;
}

serve((request) => {
  const cronSecret = Deno.env.get("WEATHER_PUSH_CRON_SECRET")?.trim() ?? "";
  if (!supabaseUrl || !serviceRoleKey || !cronSecret) {
    console.error("weather-push: required server configuration is missing");
    return new Response(JSON.stringify({ error: "Weather notifications are unavailable." }), {
      status: 503,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
  return runWeatherPush(request, {
    cronSecret,
    now: () => new Date(),
    listOwnersWithTomorrowJobs,
    fetchWeather,
    reserveEvent,
    releaseEvent: async (eventKey: string, reservationToken: string) => {
      const { error } = await admin.rpc("release_weather_push_event", {
        p_event_key: eventKey,
        p_reservation_token: reservationToken,
      });
      if (error) throw new Error("Could not release weather notification");
    },
    markSent: async (eventKey: string, reservationToken: string) => {
      const { data, error } = await admin.rpc("mark_weather_push_event_sent", {
        p_event_key: eventKey,
        p_reservation_token: reservationToken,
      });
      if (error) throw new Error("Could not finalize weather notification");
      if (data !== true) throw new Error("Weather notification reservation expired");
    },
    sendPush,
  });
});
