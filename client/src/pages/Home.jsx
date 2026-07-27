import useLocalizedText from '../i18n/useLocalizedText';
import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../App';
import { downloadICS, generateGoogleCalUrl, downloadCSV, printSchedule } from '../lib/ics';
import {
  Sprout, Sun, Cloud, CloudRain, CloudSun, CloudDrizzle, CloudLightning, Snowflake,
  Calendar, DollarSign, AlertCircle, CheckCircle, Clock,
  ArrowRight, Plus, ChevronLeft, ChevronRight, Download, ExternalLink, FileSpreadsheet, Printer,
} from 'lucide-react';

// ===== Weather helpers =====
const weatherIcons = {
  0: Sun, 1: Sun, 2: CloudSun, 3: Cloud,
  45: Cloud, 48: Cloud, 51: CloudDrizzle, 53: CloudDrizzle, 55: CloudDrizzle,
  61: CloudRain, 63: CloudRain, 65: CloudRain,
  71: Snowflake, 73: Snowflake, 75: Snowflake,
  80: CloudRain, 81: CloudRain, 82: CloudRain,
  95: CloudLightning, 96: CloudLightning, 99: CloudLightning,
};
const weatherEmoji = { 0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️', 45: '🌫️', 48: '🌫️', 51: '🌦️', 61: '🌧️', 71: '❄️', 95: '⛈️' };

function wmoToLabel(code) {
  if (code <= 1) return 'Clear';
  if (code === 2) return 'Partly Cloudy';
  if (code === 3) return 'Cloudy';
  if (code >= 45 && code <= 48) return 'Fog';
  if (code >= 51 && code <= 55) return 'Drizzle';
  if (code >= 61 && code <= 65) return 'Rain';
  if (code >= 71 && code <= 75) return 'Snow';
  if (code >= 80 && code <= 82) return 'Showers';
  if (code >= 95) return 'Thunderstorm';
  return 'Clear';
}

// ===== Calendar helpers =====
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function getMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid = [];
  for (let i = 0; i < firstDay; i++) grid.push(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(new Date(year, month, d).toISOString().split('T')[0]);
  return grid;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function StatCard({ icon: Icon, value, label, color, sub }) {
  const colors = {
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-950/60', text: 'text-emerald-600 dark:text-emerald-400', hover: 'hover:border-emerald-200 dark:hover:border-emerald-800' },
    sky:     { bg: 'bg-sky-50 dark:bg-sky-950/60',     text: 'text-sky-600 dark:text-sky-400',     hover: 'hover:border-sky-200 dark:hover:border-sky-800' },
    amber:   { bg: 'bg-amber-50 dark:bg-amber-950/60',   text: 'text-amber-600 dark:text-amber-400',   hover: 'hover:border-amber-200 dark:hover:border-amber-800' },
  };
  const c = colors[color] || colors.emerald;
  return (
    <div className={`card p-4 flex flex-col items-center text-center gap-1 ${c.hover} transition-all`}>
      <div className={`w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center mb-1`}>
        <Icon className={`w-4 h-4 ${c.text}`} />
      </div>
      <span className="text-xl font-extrabold text-gray-900 dark:text-white">{value}</span>
      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      {sub && <span className="text-[10px] text-gray-400 dark:text-gray-500">{sub}</span>}
    </div>
  );
}

export default function Home({ jobs = [], invoices = [] }) {
  const { tr, t, i18n } = useLocalizedText('home');
  const { user } = useAuth();
  const today = new Date().toISOString().split('T')[0];
  const userName = user?.email?.split('@')[0] || 'there';

  // ===== Weather state =====
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    async function fetchWeather(lat, lon) {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,relative_humidity_2m&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max&temperature_unit=fahrenheit&timezone=auto&forecast_days=10`,
          { signal }
        );
        const data = await res.json();
        if (!signal.aborted) setWeather(data);
      } catch { /* offline or API down — silent fallback */ }
      if (!signal.aborted) setWeatherLoading(false);
    }

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        pos => fetchWeather(pos.coords.latitude, pos.coords.longitude),
        () => fetchWeather(35.47, -97.52), // OKC fallback
        { timeout: 5000 }
      );
    } else {
      fetchWeather(35.47, -97.52);
    }

    return () => controller.abort();
  }, []);

  // ===== Calendar state =====
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [showForm, setShowForm] = useState(null); // calendar popover
  const [showExport, setShowExport] = useState(false);
  const calendarGrid = useMemo(() => getMonthGrid(calYear, calMonth), [calYear, calMonth]);
  const jobsByDate = useMemo(() => {
    const map = {};
    jobs.forEach(j => {
      if (!map[j.scheduled_date]) map[j.scheduled_date] = [];
      map[j.scheduled_date].push(j);
    });
    return map;
  }, [jobs]);

  // ===== Stats =====
  const todayJobs = useMemo(() => jobs.filter(j => j.scheduled_date === today), [jobs, today]);
  const doneToday = todayJobs.filter(j => j.status === 'done').length;
  const totalToday = todayJobs.length;
  const todayRevenue = todayJobs.filter(j => j.status === 'done').reduce((s, j) => s + (j.clients?.rate || 0), 0);
  const unpaidInvoices = invoices.filter(i => i.status !== 'paid');
  const unpaidTotal = unpaidInvoices.reduce((s, i) => s + (i.amount || 0), 0);
  const upcoming = todayJobs.filter(j => j.status !== 'done').slice(0, 4);

  // ===== Weather rendering =====
  const WIcon = weather ? (weatherIcons[weather.current.weather_code] || Sun) : Sun;
  const wLabel = weather ? wmoToLabel(weather.current.weather_code) : 'Clear';
  const wTemp = weather ? Math.round(weather.current.temperature_2m) : '—';
  const wEmoji = weather ? (weatherEmoji[weather.current.weather_code] || '☀️') : '☀️';
  const forecast = weather?.daily ? weather.daily.time.slice(0, 10).map((_, i) => ({
    day: new Date(weather.daily.time[i] + 'T12:00:00').toLocaleDateString(i18n.resolvedLanguage === 'es' ? 'es-US' : 'en-US', { weekday: 'short' }),
    hi: Math.round(weather.daily.temperature_2m_max[i]),
    lo: Math.round(weather.daily.temperature_2m_min[i]),
    code: weather.daily.weather_code[i],
    rain: weather.daily.precipitation_probability_max[i],
  })) : [];

  // ===== Calendar navigation =====
  const prevMonth = () => calMonth === 0 ? (setCalYear(calYear - 1), setCalMonth(11)) : setCalMonth(calMonth - 1);
  const nextMonth = () => calMonth === 11 ? (setCalYear(calYear + 1), setCalMonth(0)) : setCalMonth(calMonth + 1);

  return (
    <div>
      {/* Greeting + Weather */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {tr(getGreeting())}, {userName} {wEmoji}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {new Date().toLocaleDateString(i18n.resolvedLanguage === 'es' ? 'es-US' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            {weatherLoading ? ` · ${tr('Loading weather...')}` : ` · ${wTemp}°F, ${tr(wLabel)}`}
          </p>
        </div>
        <div className="flex flex-col items-center">
          <WIcon className="w-8 h-8 text-amber-500 dark:text-amber-400" />
          {!weatherLoading && <span className="text-lg font-bold text-gray-900 dark:text-white">{wTemp}°</span>}
        </div>
      </div>

      {/* 5-day forecast strip */}
      {!weatherLoading && forecast.length > 0 && (
        <div className="flex gap-2 mb-6 overflow-x-auto overflow-y-visible pb-2 -mx-1 px-1
          [&::-webkit-scrollbar]:h-1.5
          [&::-webkit-scrollbar-track]:bg-transparent
          [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-700
          [&::-webkit-scrollbar-thumb]:rounded-full">
          {forecast.map((f, i) => {
            const FI = weatherIcons[f.code] || Sun;
            return (
              <div key={i} className={`card flex-shrink-0 pt-4 pb-3 px-2.5 flex flex-col items-center gap-1.5 w-[76px] box-border ${f.day === new Date().toLocaleDateString('en-US', { weekday: 'short' }) ? 'border-2 border-emerald-400 dark:border-emerald-500' : ''}`}>
                <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">{f.day}</span>
                <FI className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                <span className="text-xs font-bold text-gray-900 dark:text-white">{f.hi}°</span>
                <span className="text-[10px] text-gray-400 dark:text-gray-500">{f.lo}°</span>
                {f.rain > 0 && <span className="text-[10px] text-sky-500 dark:text-sky-400">{f.rain}%</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard icon={CheckCircle} value={totalToday ? `${doneToday}/${totalToday}` : '—'} label={tr("Done today")} color="emerald" sub={totalToday ? `${Math.round((doneToday / totalToday) * 100)}%` : ''} />
        <StatCard icon={DollarSign} value={`$${todayRevenue}`} label={tr("Today's revenue")} color="sky" />
        <StatCard icon={AlertCircle} value={`$${unpaidTotal}`} label={tr("Outstanding")} color={unpaidTotal > 0 ? 'amber' : 'emerald'} sub={unpaidInvoices.length ? tr('{{count}} unpaid', { count: unpaidInvoices.length }) : tr('All clear')} />
      </div>

      {/* Monthly Calendar */}
      <div className="card p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"><ChevronLeft className="w-4 h-4 text-gray-500 dark:text-gray-400" /></button>
            <h3 className="font-semibold text-sm text-gray-900 dark:text-white">{tr(MONTHS[calMonth])} {calYear}</h3>
            <button onClick={nextMonth} className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"><ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-400" /></button>
          </div>
          <div className="relative">
            <button onClick={() => setShowExport(!showExport)} className="btn-ghost text-xs gap-1.5 text-emerald-600 dark:text-emerald-400">
              <Download className="w-3.5 h-3.5" />{tr("Export")}
            </button>
            {showExport && (
              <div className="absolute right-0 top-full mt-1 card p-1 z-10 min-w-[190px] shadow-lg"
                   onMouseLeave={() => setShowExport(false)}
                   onKeyDown={e => { if (e.key === 'Escape') setShowExport(false); }}
                   onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setShowExport(false); }}>
                <button onClick={() => { downloadICS(jobs.filter(j => j.scheduled_date >= today)); setShowExport(false); }}
                  className="w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2 min-h-[44px]">
                  <Download className="w-3.5 h-3.5" />{tr("Download .ics (Apple/Outlook)")}
                </button>
                <button onClick={() => { downloadCSV(jobs.filter(j => j.scheduled_date >= today)); setShowExport(false); }}
                  className="w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2 min-h-[44px]">
                  <FileSpreadsheet className="w-3.5 h-3.5" />{tr("Download CSV (Excel/Numbers)")}
                </button>
                <button onClick={() => { printSchedule(jobs.filter(j => j.scheduled_date >= today)); setShowExport(false); }}
                  className="w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2 min-h-[44px]">
                  <Printer className="w-3.5 h-3.5" />{tr("Print / Save as PDF")}
                </button>
                <button onClick={() => { window.open(generateGoogleCalUrl(jobs.filter(j => j.scheduled_date >= today)), '_blank'); setShowExport(false); }}
                  className="w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2 min-h-[44px]">
                  <ExternalLink className="w-3.5 h-3.5" />{tr("Add to Google Calendar")}
                </button>
              </div>
            )}
          </div>
        </div>
        {/* Day headers */}
        <div className="grid grid-cols-7 mb-0.5">
          {DAYS.map(d => <div key={d} className="text-center text-[10px] font-semibold text-gray-400 dark:text-gray-500 py-0.5">{tr(d)}</div>)}
        </div>
        {/* Calendar grid — compact, interactive */}
        <div className="grid grid-cols-7 gap-px">
          {calendarGrid.map((date, i) => {
            if (!date) return <div key={`empty-${i}`} className="h-11" />;
            const dayNum = parseInt(date.split('-')[2]);
            const dayJobs = jobsByDate[date] || [];
            const isToday = date === today;
            return (
              <button
                key={date}
                onClick={() => setShowForm({ date, jobs: dayJobs })}
                className={`h-11 flex items-center justify-center rounded-md text-[11px] font-medium transition-all relative
                  ${isToday ? 'bg-emerald-500 text-white font-bold shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}
                  ${dayJobs.length > 0 && !isToday ? 'ring-1 ring-inset ring-amber-300 dark:ring-amber-700' : ''}
                `}
                title={dayJobs.length ? tr('{{count}} job', { count: dayJobs.length }) : ''}
              >
                {dayNum}
              </button>
            );
          })}
        </div>
      </div>

      {/* Calendar day popover */}
      {showForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50" onClick={() => setShowForm(null)}>
          <div className="card p-4 m-4 max-w-xs w-full shadow-2xl" onClick={e => e.stopPropagation()} style={{ animation: 'scaleIn 0.15s ease-out' }}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-sm text-gray-900 dark:text-white">
                {new Date(showForm.date + 'T12:00:00').toLocaleDateString(i18n.resolvedLanguage === 'es' ? 'es-US' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </h4>
              <button onClick={() => setShowForm(null)} aria-label={tr("Close calendar popover")} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg leading-none p-2 min-w-[44px] min-h-[44px] flex items-center justify-center">&times;</button>
            </div>
            {showForm.jobs.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">{tr("No jobs scheduled")}</p>
            ) : (
              <div className="space-y-2">
                {showForm.jobs.map((job, ji) => (
                  <div key={job.id} className="flex items-center gap-2.5 p-2 -mx-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${job.status === 'done' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{job.clients?.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{job.scheduled_time?.slice(0, 5)} · {job.title}</p>
                    </div>
                  </div>
                ))}
                <Link
                  to={`/app/today?date=${showForm.date}`}
                  onClick={() => setShowForm(null)}
                  className="btn-primary w-full text-xs py-2 justify-center mt-1"
                >
                  {tr("View in Schedule")}
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Up Next + Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-2">
        <div className="card p-4">
          <h3 className="font-semibold text-sm text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-violet-500" />
            {tr("Up Next")}
          </h3>
          {upcoming.length === 0 ? (
            <div className="text-center py-5">
              <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{tr("All done for today!")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcoming.map((job, i) => (
                <Link key={job.id} to="/app/today" className="flex items-center gap-2.5 p-2 -mx-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
                  <span className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-xs font-bold text-emerald-700 dark:text-emerald-400 flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{job.clients?.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{job.scheduled_time?.slice(0, 5)} · {job.title}</p>
                  </div>
                  <ChevronLeft className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 group-hover:text-emerald-500 transition-colors rotate-180" />
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="card p-4">
          <h3 className="font-semibold text-sm text-gray-900 dark:text-white mb-3">{tr("Quick Actions")}</h3>
          <div className="space-y-2">
            <Link to="/app/today" className="btn-primary w-full justify-start gap-2 text-sm py-2.5">
              <Calendar className="w-4 h-4" />{tr("View Today's Schedule")}
            </Link>
            <Link to="/app/clients" className="btn-secondary w-full justify-start gap-2 text-sm py-2.5">
              <Plus className="w-4 h-4" />{tr("Add New Client")}
            </Link>
            <Link to="/app/invoices" className="btn-secondary w-full justify-start gap-2 text-sm py-2.5">
              <AlertCircle className="w-4 h-4" />
              {unpaidTotal > 0 ? tr('${{amount}} in unpaid invoices', { amount: unpaidTotal }) : tr('All invoices paid')}
            </Link>
            <Link to="/app/settings" className="btn-ghost w-full justify-start gap-2 text-sm py-2.5">
              {tr("Manage Settings")} <ArrowRight className="w-3.5 h-3.5 ml-auto" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
