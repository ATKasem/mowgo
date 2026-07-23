import { useState, useEffect } from 'react';

/** Fetch current rain probability from Open-Meteo for a given location */
export function useWeather(lat = 35.47, lon = -97.52) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchWeather(latitude, longitude) {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=precipitation_probability_max,weather_code&temperature_unit=fahrenheit&timezone=auto&forecast_days=3`
        );
        const data = await res.json();
        if (!cancelled) setWeather(data);
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
  function rainLikely() {
    if (!weather?.daily) return false;
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    for (let i = 0; i < weather.daily.time.length; i++) {
      if ((weather.daily.time[i] === today || weather.daily.time[i] === tomorrow) &&
          weather.daily.precipitation_probability_max[i] > 30) {
        return true;
      }
    }
    return false;
  }

  function todayRainChance() {
    if (!weather?.daily) return 0;
    const today = new Date().toISOString().split('T')[0];
    const idx = weather.daily.time.indexOf(today);
    return idx >= 0 ? weather.daily.precipitation_probability_max[idx] : 0;
  }

  return { weather, loading, rainLikely, todayRainChance };
}
