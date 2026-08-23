/** Local calendar date (YYYY-MM-DD), avoiding UTC day-boundary drift. */
export function localDate(offsetDays = 0, now = new Date()) {
  const date = new Date(now);
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const asArray = value => Array.isArray(value) ? value : [];
const isRecord = value => value !== null && typeof value === 'object';
const safeNumber = value => {
  try {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  } catch {
    return null;
  }
};
const routeOrder = value => safeNumber(value) ?? Infinity;
const isDateString = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const validJobs = value => asArray(value).filter(job => (
  isRecord(job) && isDateString(job.scheduled_date) && typeof job.status === 'string' && job.status.length > 0
));
const validInvoices = value => asArray(value).filter(invoice => (
  isRecord(invoice)
  && typeof invoice.status === 'string' && invoice.status.length > 0
  && invoice.amount !== null && invoice.amount !== ''
  && safeNumber(invoice.amount) !== null
  && safeNumber(invoice.amount) >= 0
));

/**
 * Find clients whose price implies a low estimated hourly rate from scheduled
 * duration. Each client needs at least two completed jobs with usable duration.
 */
export function estimatedRateReview(clients = [], jobs = []) {
  const completedDurations = new Map();
  for (const job of asArray(jobs)) {
    if (!isRecord(job) || job.status !== 'done' || job.client_id == null) continue;
    const duration = safeNumber(job.duration_minutes);
    if (duration === null || duration <= 0) continue;
    const durations = completedDurations.get(job.client_id) || [];
    durations.push(duration);
    completedDurations.set(job.client_id, durations);
  }

  const eligible = [];
  for (const client of asArray(clients)) {
    if (!isRecord(client) || client.id == null) continue;
    const rate = safeNumber(client.rate);
    const durations = completedDurations.get(client.id) || [];
    if (rate === null || rate <= 0 || durations.length < 2) continue;
    const scheduledMinutes = durations.reduce((sum, duration) => sum + duration, 0) / durations.length;
    eligible.push({
      client,
      clientId: client.id,
      completedJobCount: durations.length,
      scheduledMinutes,
      estimatedHourlyRate: rate / (scheduledMinutes / 60),
    });
  }

  if (eligible.length === 0) return { eligibleAverage: null, flagged: [] };
  const eligibleAverage = eligible.reduce((sum, item) => sum + item.estimatedHourlyRate, 0) / eligible.length;
  const flagged = eligible
    .filter(item => item.estimatedHourlyRate < eligibleAverage * 0.75 && item.estimatedHourlyRate < 50)
    .map(item => ({
      ...item,
      comparisonPercent: (item.estimatedHourlyRate / eligibleAverage) * 100,
    }));

  return { eligibleAverage, flagged };
}

/** Build Dashboard values exclusively from the existing jobs/invoices loaders. */
export function summarizeDashboard(jobs = [], invoices = [], now = new Date()) {
  jobs = validJobs(jobs);
  invoices = validInvoices(invoices);
  const today = localDate(0, now);
  const weekAgo = localDate(-6, now);
  const thirtyDaysAgo = localDate(-29, now);
  const todayJobs = jobs.filter(job => job.scheduled_date === today);
  const todayDone = todayJobs.filter(job => job.status === 'done');
  const weeklyJobs = jobs.filter(job => job.scheduled_date >= weekAgo && job.scheduled_date <= today);
  const weeklyDone = weeklyJobs.filter(job => job.status === 'done');

  return {
    todayRevenue: todayDone.reduce((sum, job) => sum + (safeNumber(job.clients?.rate) || 0), 0),
    todayJobsTotal: todayJobs.length,
    todayJobsDone: todayDone.length,
    todayJobsInProgress: todayJobs.filter(job => job.status === 'in_progress').length,
    outstanding: invoices.filter(invoice => invoice.status !== 'paid')
      .reduce((sum, invoice) => sum + (safeNumber(invoice.amount) || 0), 0),
    weeklyRevenue: weeklyDone.reduce((sum, job) => sum + (safeNumber(job.clients?.rate) || 0), 0),
    weeklyJobs: weeklyJobs.length,
    weeklyJobsDone: weeklyDone.length,
    activeClients: new Set(jobs.filter(job => job.client_id && job.scheduled_date >= thirtyDaysAgo && job.scheduled_date <= today).map(job => job.client_id)).size,
    recurringClients: new Set(jobs.filter(job => job.client_id && job.recurrence && job.recurrence !== 'none' && job.scheduled_date >= today).map(job => job.client_id)).size,
  };
}

/** Today's job counts, completed revenue, and the next not-done job in route order. */
export function todayCommand(jobs = [], now = new Date()) {
  jobs = validJobs(jobs);
  const today = localDate(0, now);
  const todayJobs = jobs
    .filter(job => job.scheduled_date === today)
    .slice()
    .sort((a, b) => routeOrder(a.route_order) - routeOrder(b.route_order));
  const done = todayJobs.filter(job => job.status === 'done');
  const inProgress = todayJobs.filter(job => job.status === 'in_progress');
  const next = todayJobs.find(job => job.status !== 'done') || null;

  return {
    total: todayJobs.length,
    done: done.length,
    inProgress: inProgress.length,
    revenue: done.reduce((sum, job) => sum + (safeNumber(job.clients?.rate) || 0), 0),
    nextJob: next ? {
      id: next.id,
      clientName: next.clients?.name || null,
      address: next.clients?.address || null,
      time: next.scheduled_time || null,
      status: next.status,
    } : null,
  };
}

/** Next few scheduled (not-done, after-today) jobs, ordered by date then route order. */
export function upcomingJobs(jobs = [], now = new Date(), limit = 5) {
  jobs = validJobs(jobs);
  limit = Number.isInteger(limit) && limit >= 0 ? limit : 5;
  const today = localDate(0, now);
  return jobs
    .filter(job => job.scheduled_date > today && job.status !== 'done')
    .slice()
    .sort((a, b) => {
      if (a.scheduled_date !== b.scheduled_date) return a.scheduled_date < b.scheduled_date ? -1 : 1;
      return routeOrder(a.route_order) - routeOrder(b.route_order);
    })
    .slice(0, limit)
    .map(job => ({
      id: job.id,
      date: job.scheduled_date,
      time: job.scheduled_time || null,
      clientName: job.clients?.name || null,
      status: job.status,
    }));
}

/** Money actually owed, from real invoice fields only (no invented due-date aging). */
export function moneyToCollect(invoices = []) {
  invoices = validInvoices(invoices);
  const owed = invoices.filter(invoice => invoice.status !== 'paid' && invoice.status !== 'voided');
  const overdue = owed.filter(invoice => invoice.status === 'overdue');
  return {
    unpaidTotal: owed.reduce((sum, invoice) => sum + (safeNumber(invoice.amount) || 0), 0),
    unpaidCount: owed.length,
    overdueTotal: overdue.reduce((sum, invoice) => sum + (safeNumber(invoice.amount) || 0), 0),
    overdueCount: overdue.length,
  };
}

/** Past-due jobs (scheduled before today, still not done) — real "unfinished work" signal. */
export function unfinishedJobCount(jobs = [], now = new Date()) {
  jobs = validJobs(jobs);
  const today = localDate(0, now);
  return jobs.filter(job => job.scheduled_date < today && job.status !== 'done').length;
}

/** The nearer of today/tomorrow crossing the rain-risk threshold (>=60%), or null. Mirrors Today's rain banner. */
export function rainRiskDay(weatherDays = [], now = new Date()) {
  weatherDays = asArray(weatherDays).filter(day => (
    isRecord(day) && isDateString(day.date) && Number.isFinite(day.rain)
  ));
  const today = localDate(0, now);
  const tomorrow = localDate(1, now);
  return weatherDays.find(day => day.date === today && day.rain >= 60)
    || weatherDays.find(day => day.date === tomorrow && day.rain >= 60)
    || null;
}

/** Not-done jobs scheduled for a given date — sizes the rain-delay action for that date. */
export function rainAffectedJobs(jobs = [], date) {
  jobs = validJobs(jobs);
  if (!isDateString(date)) return [];
  return jobs.filter(job => job.scheduled_date === date && job.status !== 'done');
}

/** Presentation state for the permanent weather banner: loading / no_location / unavailable / loaded. */
export function weatherBannerView(hasLocation, loading, hasData) {
  if (loading || hasLocation === null) return 'loading';
  if (!hasLocation) return 'no_location';
  return hasData ? 'loaded' : 'unavailable';
}

/** Estimated profit for a single job using client rate and cost fields. */
export function jobProfit(job) {
  const revenue = safeNumber(job.clients?.rate) || 0;
  const materials_cost = safeNumber(job.materials_cost) || 0;
  const travel_cost = (safeNumber(job.travel_miles) || 0) * 0.70;
  const labor_cost = (safeNumber(job.duration_minutes) || 60) / 60 * 25;
  const estimated_profit = revenue - materials_cost - travel_cost - labor_cost;
  const profit_margin_percent = revenue > 0 ? (estimated_profit / revenue * 100) : 0;
  return { revenue, materials_cost, travel_cost, labor_cost, estimated_profit, profit_margin_percent };
}

/** Aggregate profitability for an array of done jobs. */
export function summarizeProfitability(jobs = []) {
  jobs = validJobs(jobs).filter(job => job.status === 'done');
  let totalRevenue = 0;
  let totalCosts = 0;
  let totalProfit = 0;
  for (const job of jobs) {
    const p = jobProfit(job);
    totalRevenue += p.revenue;
    totalCosts += p.materials_cost + p.travel_cost + p.labor_cost;
    totalProfit += p.estimated_profit;
  }
  const overall_margin_percent = totalRevenue > 0 ? (totalProfit / totalRevenue * 100) : 0;
  return { totalRevenue, totalCosts, totalProfit, overall_margin_percent };
}

/**
 * Needs Attention queue, in priority order: rain decision, overdue invoices,
 * new leads, estimated-rate review, unfinished work. Only actionable (non-zero)
 * items are included.
 */
export function attentionItems(options = {}) {
  const {
    rainRisk = null,
    rainAffectedCount = 0,
    overdueInvoiceCount = 0,
    overdueInvoiceTotal = 0,
    newLeadCount = 0,
    estimatedRateReviewCount = 0,
    unfinishedJobCount = 0,
  } = isRecord(options) ? options : {};
  const items = [];
  if (rainRisk && rainAffectedCount > 0) {
    items.push({ type: 'rain', count: rainAffectedCount, rainPercent: rainRisk.rain, date: rainRisk.date });
  }
  if (overdueInvoiceCount > 0) {
    items.push({ type: 'overdue_invoices', count: overdueInvoiceCount, amount: overdueInvoiceTotal });
  }
  if (newLeadCount > 0) {
    items.push({ type: 'new_leads', count: newLeadCount });
  }
  if (estimatedRateReviewCount > 0) {
    items.push({ type: 'estimated_rate_review', count: estimatedRateReviewCount });
  }
  if (unfinishedJobCount > 0) {
    items.push({ type: 'unfinished_jobs', count: unfinishedJobCount });
  }
  return items;
}
