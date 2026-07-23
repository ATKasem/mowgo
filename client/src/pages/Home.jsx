import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../App';
import {
  Sprout, Sun, CloudRain, Cloud, CloudSun,
  Calendar, DollarSign, AlertCircle, CheckCircle,
  ArrowRight, Plus, ChevronRight, Clock,
} from 'lucide-react';
import { RECURRENCE_OPTIONS } from '../lib/constants';

// Simple weather mock — would be replaced with real API
const weatherMock = { temp: 92, condition: 'Clear', icon: Sun, emoji: '☀️' };

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function StatCard({ icon: Icon, value, label, color, sub }) {
  return (
    <div className={`card p-4 flex flex-col items-center text-center gap-1 hover:border-${color}-200 dark:hover:border-${color}-800 transition-all`}>
      <div className={`w-9 h-9 rounded-xl bg-${color}-100 dark:bg-${color}-950/30 flex items-center justify-center mb-1`}>
        <Icon className={`w-4.5 h-4.5 text-${color}-600 dark:text-${color}-400`} />
      </div>
      <span className="text-xl font-extrabold text-gray-900 dark:text-white">{value}</span>
      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      {sub && <span className="text-[10px] text-gray-400 dark:text-gray-500">{sub}</span>}
    </div>
  );
}

export default function Home({ jobs = [], invoices = [] }) {
  const { user } = useAuth();
  const today = new Date().toISOString().split('T')[0];
  const greeting = getGreeting();
  const userName = user?.email?.split('@')[0] || 'there';

  const todayJobs = useMemo(() => jobs.filter(j => j.scheduled_date === today), [jobs, today]);
  const doneToday = todayJobs.filter(j => j.status === 'done').length;
  const totalToday = todayJobs.length;
  const todayRevenue = todayJobs.filter(j => j.status === 'done').reduce((s, j) => s + (j.clients?.rate || 0), 0);
  const unpaidInvoices = invoices.filter(i => i.status !== 'paid');
  const unpaidTotal = unpaidInvoices.reduce((s, i) => s + (i.amount || 0), 0);

  // This week's jobs
  const weekDays = useMemo(() => {
    const days = [];
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7)); // Last Monday

    for (let i = 0; i < 5; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const dayJobs = jobs.filter(j => j.scheduled_date === dateStr);
      days.push({
        label: d.toLocaleDateString('en-US', { weekday: 'short' }),
        date: dateStr,
        isToday: dateStr === today,
        total: dayJobs.length,
        done: dayJobs.filter(j => j.status === 'done').length,
      });
    }
    return days;
  }, [jobs, today]);

  // Upcoming (non-done) jobs
  const upcoming = todayJobs.filter(j => j.status !== 'done').slice(0, 4);

  return (
    <div>
      {/* Greeting */}
      <div className="mb-5">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          {greeting}, {userName} <span className="ml-1">{weatherMock.emoji}</span>
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          {' · '}{weatherMock.temp}°F, {weatherMock.condition}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <StatCard
          icon={CheckCircle}
          value={totalToday ? `${doneToday}/${totalToday}` : '—'}
          label="Done today"
          color="emerald"
          sub={totalToday ? `${Math.round((doneToday / totalToday) * 100)}%` : ''}
        />
        <StatCard
          icon={DollarSign}
          value={`$${todayRevenue}`}
          label="Today's revenue"
          color="sky"
        />
        <StatCard
          icon={AlertCircle}
          value={`$${unpaidTotal}`}
          label="Outstanding"
          color={unpaidTotal > 0 ? 'amber' : 'emerald'}
          sub={unpaidInvoices.length ? `${unpaidInvoices.length} unpaid` : 'All clear'}
        />
      </div>

      {/* This Week */}
      <div className="card p-4 mb-5">
        <h3 className="font-semibold text-sm text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-emerald-500" />
          This Week
        </h3>
        <div className="space-y-2">
          {weekDays.map(day => (
            <div key={day.date} className="flex items-center gap-3">
              <span className={`text-xs font-medium w-9 text-right ${day.isToday ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-gray-500 dark:text-gray-400'}`}>
                {day.label}
              </span>
              <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${day.total ? Math.max((day.done / Math.max(day.total, 1)) * 100, 8) : 0}%` }}
                />
              </div>
              <span className={`text-xs min-w-[4rem] text-right ${day.isToday ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'}`}>
                {day.total ? `${day.done}/${day.total} jobs` : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Up Next + Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        {/* Upcoming */}
        <div className="card p-4">
          <h3 className="font-semibold text-sm text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-violet-500" />
            Up Next
          </h3>
          {upcoming.length === 0 ? (
            <div className="text-center py-4">
              <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">All done for today!</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Great work</p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcoming.map((job, i) => (
                <Link
                  key={job.id}
                  to="/app/today"
                  className="flex items-center gap-2.5 p-2 -mx-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
                >
                  <span className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-xs font-bold text-emerald-700 dark:text-emerald-400 flex-shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{job.clients?.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{job.scheduled_time?.slice(0, 5)} · {job.title}</p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 group-hover:text-emerald-500 transition-colors" />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="card p-4">
          <h3 className="font-semibold text-sm text-gray-900 dark:text-white mb-3">Quick Actions</h3>
          <div className="space-y-2">
            <Link to="/app/today" className="btn-primary w-full justify-start gap-2 text-sm py-2.5">
              <Calendar className="w-4 h-4" />View Today's Schedule
            </Link>
            <Link to="/app/clients" className="btn-secondary w-full justify-start gap-2 text-sm py-2.5">
              <Plus className="w-4 h-4" />Add New Client
            </Link>
            <Link to="/app/invoices" className="btn-secondary w-full justify-start gap-2 text-sm py-2.5">
              <AlertCircle className="w-4 h-4" />
              {unpaidTotal > 0 ? `$${unpaidTotal} in unpaid invoices` : 'All invoices paid'}
            </Link>
            <Link to="/app/settings" className="btn-ghost w-full justify-start gap-2 text-sm py-2.5">
              Manage Settings <ArrowRight className="w-3.5 h-3.5 ml-auto" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
