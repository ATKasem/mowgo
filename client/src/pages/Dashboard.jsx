import useLocalizedText from '../i18n/useLocalizedText';
import { useState, useEffect, useContext } from 'react';
import { loadJobs, loadInvoices, loadProfile } from '../lib/data';
import { AuthContext } from '../App';
import { FileText, CheckCircle, Users, DollarSign, Loader2, AlertCircle } from 'lucide-react';

/** Get local date string (YYYY-MM-DD) accounting for timezone */
function localDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

export default function Dashboard() {
  const { tr } = useLocalizedText('dashboard');
  const { user } = useContext(AuthContext);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [role, setRole] = useState(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    async function fetchStats() {
      try {
        const [jobs, invoices, profile] = await Promise.all([
          loadJobs(), loadInvoices(), loadProfile(),
        ]);
        if (!mounted) return;

        // Set role for crew filtering — conservative default: no profile = no revenue
        const userRole = profile?.role;
        setRole(userRole);
        if (!userRole) setRole('unknown'); // safety: unknown role sees limited view

        const today = localDate();
        const weekAgo = localDate(-6); // Mon-Sun = 7 days inclusive

        // Today
        const todayJobs = jobs.filter(j => j.scheduled_date === today);
        const todayDone = todayJobs.filter(j => j.status === 'done');
        const todayRevenue = todayDone.reduce((sum, j) => sum + (j.clients?.rate || 0), 0);

        // Outstanding
        const unpaidTotal = invoices
          .filter(inv => inv.status !== 'paid')
          .reduce((sum, inv) => sum + (inv.amount || 0), 0);

        // This week — count all jobs, not just done
        const weeklyJobs = jobs.filter(j => j.scheduled_date >= weekAgo && j.scheduled_date <= today);
        const weeklyDone = weeklyJobs.filter(j => j.status === 'done');
        const weeklyRevenue = weeklyDone.reduce((sum, j) => sum + (j.clients?.rate || 0), 0);

        // Recurring — count unique CLIENT IDs with recurring jobs, not total jobs
        const recurringClientIds = new Set(
          jobs.filter(j => j.client_id && j.recurrence && j.recurrence !== 'none').map(j => j.client_id)
        );

        // Active clients — only those with jobs in the last 30 days (not future)
        const thirtyDaysAgo = localDate(-30);
        const activeClientIds = new Set(
          jobs.filter(j => j.client_id && j.scheduled_date >= thirtyDaysAgo && j.scheduled_date <= today).map(j => j.client_id)
        );

        setStats({
          todayRevenue,
          todayJobsTotal: todayJobs.length,
          todayJobsDone: todayDone.length,
          outstanding: unpaidTotal,
          weeklyRevenue,
          weeklyJobs: weeklyJobs.length,
          weeklyJobsDone: weeklyDone.length,
          activeClients: activeClientIds.size,
          recurringClients: recurringClientIds.size,
        });
      } catch (err) {
        console.error('Dashboard fetchStats:', err);
        if (mounted) setError(err.message || 'Failed to load dashboard');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchStats();
    return () => { mounted = false; };
  }, [user, retryKey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <AlertCircle className="w-8 h-8 text-amber-500" />
        <p className="text-sm text-gray-500 dark:text-gray-400">{error}</p>
        <button onClick={() => { setError(''); setLoading(true); setRetryKey(k => k + 1); }} className="btn-secondary text-sm">{tr('Retry')}</button>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center py-20">
        <AlertCircle className="w-8 h-8 text-amber-500" />
      </div>
    );
  }

  // Only confirmed owners see revenue — crew, unknown, and null roles get limited view
  if (role !== 'owner') {
    return (
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-5">{tr('Dashboard')}</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="card p-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-2.5">
              <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.weeklyJobs}</p>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mt-0.5">{tr('Jobs This Week')}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{stats.weeklyJobsDone} {tr('done')}</p>
          </div>
          <div className="card p-4">
            <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center mb-2.5">
              <Users className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.activeClients}</p>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mt-0.5">{tr('Active Clients')}</p>
          </div>
        </div>
      </div>
    );
  }

  const cards = [
    {
      icon: DollarSign,
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      value: `$${stats.todayRevenue.toLocaleString()}`,
      label: tr('Revenue Today'),
      sub: stats.todayJobsTotal ? `${stats.todayJobsDone}/${stats.todayJobsTotal} ${tr('jobs done')}` : tr('No jobs today'),
    },
    {
      icon: FileText,
      iconBg: 'bg-amber-100 dark:bg-amber-900/30',
      iconColor: 'text-amber-600 dark:text-amber-400',
      value: `$${stats.outstanding.toLocaleString()}`,
      label: tr('Outstanding'),
      sub: tr('Unpaid invoices'),
    },
    {
      icon: CheckCircle,
      iconBg: 'bg-violet-100 dark:bg-violet-900/30',
      iconColor: 'text-violet-600 dark:text-violet-400',
      value: stats.weeklyJobs,
      label: tr('Jobs This Week'),
      sub: `$${stats.weeklyRevenue.toLocaleString()} ${tr('revenue')}`,
    },
    {
      icon: Users,
      iconBg: 'bg-sky-100 dark:bg-sky-900/30',
      iconColor: 'text-sky-600 dark:text-sky-400',
      value: stats.activeClients,
      label: tr('Active Clients'),
      sub: `${stats.recurringClients} ${tr('recurring')}`,
    },
  ];

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-5">{tr('Dashboard')}</h2>
      <div className="grid grid-cols-2 gap-3">
        {cards.map((card, i) => (
          <div key={i} className="card p-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2.5 ${card.iconBg}`}>
              <card.icon className={`w-5 h-5 ${card.iconColor}`} />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{card.value}</p>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mt-0.5">{card.label}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
