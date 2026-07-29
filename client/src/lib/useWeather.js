import { useState, useEffect, useCallback, useMemo } from 'react';

const WEATHER_CACHE_KEY = 'mf_weather_cache';
const WEATHER_TTL = 30 * 60 * 1000; // 30 minutes

/** Fetch current rain probability from Open-Meteo for a given location (with caching) */
export function useWeather(lat = 35.47, lon = -97.52) {
  const [weather, setWeather] = useState(() => {
    try {
      const cached = localStorage.getItem(WEATHER_CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < WEATHER_TTL) return data;
      }
    } catch {}
    return null;
  });
  const [loading, setLoading] = useState(!weather);

  useEffect(() => {
    let cancelled = false;
    async function fetchWeather(latitude, longitude) {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=precipitation_probability_max,weather_code&temperature_unit=fahrenheit&timezone=auto&forecast_days=3`
        );
        if (!res.ok) throw new Error(`Weather API ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setWeather(data);
          try {
            localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
          } catch {}
        }
      } catch { /* offline */ }
      if (!cancelled) setLoading(false);
    }

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        pos => { if (!cancelled) fetchWeather(pos.coords.latitude, pos.coords.longitude); },
        () => fetchWeather(lat, lon),
        { timeout: 5000 }
      );
    } else {
      fetchWeather(lat, lon);
    }

    return () => { cancelled = true; };
  }, []);

  /** Check if rain is likely today or tomorrow (precip > 30%) */
  const rainLikely = useCallback(() => {
    if (!weather?.daily) return false;
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const td = new Date(); td.setDate(td.getDate() + 1);
    const tomorrow = `${td.getFullYear()}-${String(td.getMonth() + 1).padStart(2, '0')}-${String(td.getDate()).padStart(2, '0')}`;
    for (let i = 0; i < weather.daily.time.length; i++) {
      if ((weather.daily.time[i] === today || weather.daily.time[i] === tomorrow) &&
          weather.daily.precipitation_probability_max[i] > 30) {
        return true;
      }
    }
    return false;
  }, [weather]);

  const todayRainChance = useCallback(() => {
    if (!weather?.daily) return 0;
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const idx = weather.daily.time.indexOf(today);
    return idx >= 0 ? weather.daily.precipitation_probability_max[idx] : 0;
  }, [weather]);

  return useMemo(() => ({ weather, loading, rainLikely, todayRainChance }), [weather, loading, rainLikely, todayRainChance]);
}
