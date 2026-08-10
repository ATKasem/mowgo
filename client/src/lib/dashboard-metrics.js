/** Local calendar date (YYYY-MM-DD), avoiding UTC day-boundary drift. */
export function localDate(offsetDays = 0, now = new Date()) {
  const date = new Date(now);
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Build Dashboard values exclusively from the existing jobs/invoices loaders. */
export function summarizeDashboard(jobs = [], invoices = [], now = new Date()) {
  const today = localDate(0, now);
  const weekAgo = localDate(-6, now);
  const thirtyDaysAgo = localDate(-29, now);
  const todayJobs = jobs.filter(job => job.scheduled_date === today);
  const todayDone = todayJobs.filter(job => job.status === 'done');
  const weeklyJobs = jobs.filter(job => job.scheduled_date >= weekAgo && job.scheduled_date <= today);
  const weeklyDone = weeklyJobs.filter(job => job.status === 'done');

  return {
    todayRevenue: todayDone.reduce((sum, job) => sum + (Number(job.clients?.rate) || 0), 0),
    todayJobsTotal: todayJobs.length,
    todayJobsDone: todayDone.length,
    todayJobsInProgress: todayJobs.filter(job => job.status === 'in_progress').length,
    outstanding: invoices.filter(invoice => invoice.status !== 'paid')
      .reduce((sum, invoice) => sum + (Number(invoice.amount) || 0), 0),
    weeklyRevenue: weeklyDone.reduce((sum, job) => sum + (Number(job.clients?.rate) || 0), 0),
    weeklyJobs: weeklyJobs.length,
    weeklyJobsDone: weeklyDone.length,
    activeClients: new Set(jobs.filter(job => job.client_id && job.scheduled_date >= thirtyDaysAgo && job.scheduled_date <= today).map(job => job.client_id)).size,
    recurringClients: new Set(jobs.filter(job => job.client_id && job.recurrence && job.recurrence !== 'none' && job.scheduled_date >= today).map(job => job.client_id)).size,
  };
}
