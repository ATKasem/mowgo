/**
 * AI Autopilot — Tool Definitions + Executors
 *
 * Each tool has:
 *  - definition: OpenAI-compatible function definition (what the LLM sees)
 *  - execute:   client-side executor using Supabase + data.js helpers
 *
 * Tools are grouped: schedule, clients, invoices, jobs, revenue.
 *
 * ⚠️ IMPORTANT: Keep descriptions simple and action-oriented.
 * The LLM uses these to decide which tool to call — vague descriptions
 * make it pick the wrong tool.
 */

import {
  loadJobs, loadClients, loadInvoices,
  createJob, updateJob, updateJobStatus, deleteJob,
  createInvoice, loadProfile
} from './data';
import { supabase, isDemoMode } from './supabase';

// ──────────────────────────────────────────
// Tool Definitions (OpenAI function-calling format)
// ──────────────────────────────────────────

export const TOOLS = [
  // ── Schedule ──────────────────────────
  {
    name: 'getTodaySchedule',
    description: "Get all jobs scheduled for today. Shows client names, addresses, times, status, and special notes like gate codes or pet instructions.",
    parameters: {
      type: 'object', properties: {}, required: []
    }
  },
  {
    name: 'getSchedule',
    description: "Get all jobs between two dates. Use for 'what's this week' or 'show me next week'.",
    parameters: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Start date YYYY-MM-DD' },
        endDate: { type: 'string', description: 'End date YYYY-MM-DD (inclusive)' }
      },
      required: ['startDate', 'endDate']
    }
  },
  {
    name: 'rescheduleJobs',
    description: "Move one or more jobs to a new date. Use for rain delays, customer reschedules, or when you want to shift the whole day. Can optionally text customers to notify them.",
    parameters: {
      type: 'object',
      properties: {
        jobIds: { type: 'array', items: { type: 'string' }, description: 'List of job IDs to reschedule' },
        newDate: { type: 'string', description: 'New date YYYY-MM-DD' },
        newTime: { type: 'string', description: 'Optional — new time HH:MM. If not provided, original time is kept.' },
        notify: { type: 'boolean', description: 'Notify customers (SMS not yet available — will note this in response)' }
      },
      required: ['jobIds', 'newDate']
    }
  },
  {
    name: 'runRainDelay',
    description: "Move ALL of today's unfinished (scheduled) jobs to tomorrow. This is the rain delay feature — use when it's raining or about to rain. Tells you how many jobs were moved. SMS notifications not yet available.",
    parameters: {
      type: 'object',
      properties: {}, required: []
    }
  },

  // ── Clients ──────────────────────────
  {
    name: 'searchClients',
    description: "Search for clients by name or address. Returns matching clients with their details: phone, email, address, rate, and service notes.",
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Name or address to search for (e.g. "Smith" or "Oak Street")' }
      },
      required: ['query']
    }
  },
  {
    name: 'getClientInfo',
    description: "Get detailed info about a specific client: contact info, address, rate, service notes, recent jobs, and unpaid invoices.",
    parameters: {
      type: 'object',
      properties: {
        clientName: { type: 'string', description: 'Client name (partial match OK, but be specific)' }
      },
      required: ['clientName']
    }
  },
  {
    name: 'getClientHistory',
    description: "Get recent jobs, invoices, service frequency, and payment history for a specific client. Use this for questions about a client's service history.",
    parameters: {
      type: 'object',
      properties: {
        clientName: { type: 'string', description: 'Client name to look up history for' }
      },
      required: ['clientName']
    }
  },

  // ── Invoices ─────────────────────────
  {
    name: 'getUnpaidInvoices',
    description: "List all unpaid invoices. Shows client name, amount owed, and how long it's been outstanding.",
    parameters: {
      type: 'object', properties: {}, required: []
    }
  },
  {
    name: 'createInvoice',
    description: "Create and send an invoice for a client. Use after completing a job or at end of day. You need the client name and amount.",
    parameters: {
      type: 'object',
      properties: {
        clientName: { type: 'string', description: 'Client name (must match a client in the system)' },
        amount: { type: 'number', description: 'Invoice amount in dollars' },
        description: { type: 'string', description: 'What this invoice is for (e.g. "Biweekly mow - July 24")' }
      },
      required: ['clientName', 'amount']
    }
  },
  {
    name: 'sendPaymentReminders',
    description: "List clients with unpaid invoices so you can follow up with them. SMS integration not yet available — shows who to contact manually.",
    parameters: {
      type: 'object', properties: {}, required: []
    }
  },

  // ── Revenue ──────────────────────────
  {
    name: 'getRevenue',
    description: "Get revenue summary. Use for questions like 'how much did I make this week?' or 'what's my monthly revenue?' or 'compare this month to last month'.",
    parameters: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['week', 'month', 'year', 'this_month', 'last_month'], description: 'Time period' }
      },
      required: ['period']
    }
  },

  // ── Jobs ─────────────────────────────
  {
    name: 'createJob',
    description: "Schedule a new job for a client. Use when someone calls to book service.",
    parameters: {
      type: 'object',
      properties: {
        clientName: { type: 'string', description: 'Client name (must exist in system)' },
        date: { type: 'string', description: 'Date YYYY-MM-DD' },
        service: { type: 'string', description: 'What service (e.g. "Mow", "Trim", "Fertilize")' },
        time: { type: 'string', description: 'Optional time HH:MM (e.g. "09:00")' },
        notes: { type: 'string', description: 'Optional notes about the job' }
      },
      required: ['clientName', 'date', 'service']
    }
  },
  {
    name: 'updateJobStatus',
    description: "Mark a job as done or reschedule it. Use 'done' when the job is complete (this may trigger invoicing). Use 'scheduled' to reschedule/cancel.",
    parameters: {
      type: 'object',
      properties: {
        jobId: { type: 'string', description: 'Job ID to update' },
        status: { type: 'string', enum: ['done', 'scheduled'], description: 'New status: done or scheduled' }
      },
      required: ['jobId', 'status']
    }
  },
  {
    name: 'invoiceCompletedJobs',
    description: "Create invoices for all jobs completed today (or on a specific date). IMPORTANT: Before calling this tool, list the jobs and amounts and ALWAYS ask for user confirmation. Only call this tool after the user explicitly approves.",
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Date to invoice for (defaults to today)' }
      },
      required: []
    }
  }
];

// ──────────────────────────────────────────
// Tool Executors (called client-side by useAutopilot)
// Each returns: { success, data, error }
// ──────────────────────────────────────────

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function executeTool(name, args) {
  try {
    switch (name) {
      // ── Schedule ──────────────────────
      case 'getTodaySchedule': {
        const allJobs = await loadJobs();
        const todayStr = today();
        const todaysJobs = allJobs.filter(j => j.scheduled_date === todayStr);
        return {
          success: true,
          data: {
            date: todayStr,
            count: todaysJobs.length,
            jobs: todaysJobs.map(formatJob)
          }
        };
      }

      case 'getSchedule': {
        const allJobs = await loadJobs();
        const { startDate, endDate } = args;
        const range = allJobs.filter(j =>
          j.scheduled_date >= startDate && j.scheduled_date <= endDate
        );
        return {
          success: true,
          data: {
            startDate, endDate,
            count: range.length,
            jobs: range.map(formatJob)
          }
        };
      }

      case 'rescheduleJobs': {
        const { jobIds, newDate, newTime, notify = false } = args;
        const results = [];
        for (const id of jobIds) {
          const update = { scheduled_date: newDate };
          if (newTime) update.scheduled_time = newTime;
          // Don't null out time if not specified — preserve original
          await updateJob(id, update);
          results.push({ id, movedTo: newDate });
        }
        return {
          success: true,
          data: {
            moved: results.length,
            newDate,
            jobs: results,
            notified: notify ? 'Customers would be notified (SMS not yet integrated)' : false
          }
        };
      }

      case 'runRainDelay': {
        const allJobs = await loadJobs();
        const todayStr = today();
        const tomorrowStr = tomorrow();
        const todaysScheduled = allJobs.filter(
          j => j.scheduled_date === todayStr && j.status === 'scheduled'
        );
        for (const j of todaysScheduled) {
          // Preserve original time
          await updateJob(j.id, { scheduled_date: tomorrowStr });
        }
        return {
          success: true,
          data: {
            moved: todaysScheduled.length,
            from: todayStr,
            to: tomorrowStr,
            jobs: todaysScheduled.map(j => ({ id: j.id, client: j.clients?.name })),
            note: 'SMS notifications not yet available — tell customers manually'
          }
        };
      }

      // ── Clients ───────────────────────
      case 'searchClients': {
        const { query } = args;
        const clients = await loadClients();
        const q = query.toLowerCase();
        const results = clients.filter(c =>
          c.name?.toLowerCase().includes(q) ||
          c.address?.toLowerCase().includes(q)
        );
        return {
          success: true,
          data: {
            query,
            count: results.length,
            clients: results.map(formatClient)
          }
        };
      }

      case 'getClientInfo': {
        const { clientName } = args;
        const clients = await loadClients();
        const q = clientName.toLowerCase();
        const client = clients.find(c =>
          c.name?.toLowerCase().includes(q)
        );
        if (!client) return { success: false, error: `No client found matching "${clientName}"` };

        // Get their recent jobs
        const allJobs = await loadJobs();
        const clientJobs = allJobs
          .filter(j => j.client_id === client.id || j.clients?.id === client.id)
          .sort((a, b) => (b.scheduled_date || '').localeCompare(a.scheduled_date || ''))
          .slice(0, 10);

        // Get unpaid invoices
        const allInvoices = await loadInvoices();
        const clientInvoices = allInvoices.filter(
          inv => inv.clients?.id === client.id && inv.status === 'unpaid'
        );

        return {
          success: true,
          data: {
            client: formatClient(client),
            recentJobs: clientJobs.map(formatJob),
            unpaidInvoices: clientInvoices.map(inv => ({
              id: inv.id,
              amount: inv.amount,
              created: inv.created_at?.split('T')[0]
            })),
            totalUnpaid: clientInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0)
          }
        };
      }

      case 'getClientHistory': {
        const { clientName } = args;
        const clients = await loadClients();
        const q = clientName.toLowerCase();
        const client = clients.find(c =>
          c.name?.toLowerCase().includes(q)
        );
        if (!client) return { success: false, error: `No client found matching "${clientName}"` };

        const allJobs = await loadJobs();
        const clientJobs = allJobs
          .filter(j => j.client_id === client.id || j.clients?.id === client.id)
          .sort((a, b) => (b.scheduled_date || '').localeCompare(a.scheduled_date || ''));

        const allInvoices = await loadInvoices();
        const clientInvoices = allInvoices.filter(
          inv => inv.clients?.id === client.id
        );

        // Calculate service frequency
        const doneJobs = clientJobs.filter(j => j.status === 'done');
        const serviceDates = doneJobs.map(j => j.scheduled_date).sort();
        let frequency = 'N/A';
        if (serviceDates.length >= 2) {
          const first = new Date(serviceDates[0]);
          const last = new Date(serviceDates[serviceDates.length - 1]);
          const daysBetween = (last - first) / (1000 * 60 * 60 * 24);
          const avgDays = daysBetween / (serviceDates.length - 1);
          if (avgDays <= 10) frequency = 'Weekly';
          else if (avgDays <= 18) frequency = 'Biweekly';
          else if (avgDays <= 35) frequency = 'Monthly';
          else frequency = `${Math.round(avgDays)} days avg`;
        }

        const totalRevenue = clientInvoices
          .filter(inv => inv.status === 'paid')
          .reduce((sum, inv) => sum + (inv.amount || 0), 0);

        return {
          success: true,
          data: {
            client: formatClient(client),
            jobCount: clientJobs.length,
            completedCount: doneJobs.length,
            frequency,
            recentJobs: clientJobs.slice(0, 10).map(formatJob),
            invoices: clientInvoices.map(inv => ({
              id: inv.id,
              amount: inv.amount,
              status: inv.status,
              created: inv.created_at?.split('T')[0]
            })),
            totalRevenue,
            totalUnpaid: clientInvoices.filter(inv => inv.status === 'unpaid')
              .reduce((sum, inv) => sum + (inv.amount || 0), 0)
          }
        };
      }

      // ── Invoices ──────────────────────
      case 'getUnpaidInvoices': {
        const invoices = await loadInvoices();
        const unpaid = invoices.filter(inv => inv.status === 'unpaid');
        return {
          success: true,
          data: {
            count: unpaid.length,
            total: unpaid.reduce((sum, inv) => sum + (inv.amount || 0), 0),
            invoices: unpaid.map(inv => ({
              id: inv.id,
              client: inv.clients?.name || 'Unknown',
              amount: inv.amount,
              since: inv.created_at?.split('T')[0]
            }))
          }
        };
      }

      case 'createInvoice': {
        const { clientName, amount, description } = args;
        const clients = await loadClients();
        const client = clients.find(c =>
          c.name?.toLowerCase().includes(clientName.toLowerCase())
        );
        if (!client) return { success: false, error: `Client "${clientName}" not found. Check spelling or add them first.` };

        const invoice = await createInvoice({
          client_id: client.id,
          amount,
          description
        });

        // Send email via Express server (server needs Authorization header)
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const headers = { 'Content-Type': 'application/json' };
          if (session?.access_token) {
            headers['Authorization'] = `Bearer ${session.access_token}`;
          }
          const res = await fetch('/api/invoices/send-email', {
            method: 'POST',
            headers,
            body: JSON.stringify({ invoice_id: invoice.id, client_id: client.id, amount }),
          });
          if (!res.ok) console.error('Email send failed:', res.status);
        } catch { /* email failure is non-fatal */ }

        return {
          success: true,
          data: {
            invoice: {
              id: invoice.id,
              client: client.name,
              amount,
              description,
              status: 'unpaid'
            }
          }
        };
      }

      case 'sendPaymentReminders': {
        const invoices = await loadInvoices();
        const unpaid = invoices.filter(inv => inv.status === 'unpaid');
        if (unpaid.length === 0) {
          return { success: true, data: { sent: 0, message: 'No unpaid invoices — everyone is caught up!' } };
        }
        return {
          success: true,
          data: {
            sent: 0,
            message: 'SMS integration not available yet. Here are the clients with unpaid invoices — you can contact them manually from the Invoices tab.',
            clients: unpaid.map(inv => ({
              name: inv.clients?.name,
              amount: inv.amount,
              since: inv.created_at?.split('T')[0],
            })),
            totalOwed: unpaid.reduce((sum, inv) => sum + (inv.amount || 0), 0),
          }
        };
      }

      // ── Revenue ───────────────────────
      case 'getRevenue': {
        const { period } = args;
        const invoices = await loadInvoices();
        const paid = invoices.filter(inv => inv.status === 'paid');
        const now = new Date();

        let startDate;
        let endDate = now.toISOString().split('T')[0];

        switch (period) {
          case 'week': {
            const d = new Date(now);
            d.setDate(d.getDate() - 7);
            startDate = d.toISOString().split('T')[0];
            break;
          }
          case 'month':
          case 'this_month': {
            startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
            break;
          }
          case 'last_month': {
            const d = new Date(now);
            d.setMonth(d.getMonth() - 1);
            const ly = d.getFullYear();
            const lm = d.getMonth(); // 0-indexed
            startDate = `${ly}-${String(lm + 1).padStart(2, '0')}-01`;
            // Set endDate to last day of that month
            const lastDay = new Date(ly, lm + 1, 0).getDate();
            endDate = `${ly}-${String(lm + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
            break;
          }
          case 'year': {
            startDate = `${now.getFullYear()}-01-01`;
            break;
          }
          default:
            startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        }

        const periodPaid = paid.filter(inv => {
          const d = inv.paid_at?.split('T')[0] || inv.created_at?.split('T')[0];
          return d >= startDate && d <= endDate;
        });

        const total = periodPaid.reduce((sum, inv) => sum + (inv.amount || 0), 0);

        return {
          success: true,
          data: {
            period,
            startDate,
            endDate,
            total,
            invoiceCount: periodPaid.length,
            averageTicket: periodPaid.length ? Math.round(total / periodPaid.length) : 0
          }
        };
      }

      // ── Jobs ──────────────────────────
      case 'createJob': {
        const { clientName, date, service, time, notes } = args;
        const clients = await loadClients();
        const client = clients.find(c =>
          c.name?.toLowerCase().includes(clientName.toLowerCase())
        );
        if (!client) return { success: false, error: `Client "${clientName}" not found. Add them in the Clients tab first.` };

        const job = await createJob({
          client_id: client.id,
          title: service,
          scheduled_date: date,
          scheduled_time: time || null,
          duration_minutes: 60,
          recurrence: 'none',
          notes
        });

        // Also update route_order
        await updateJob(job.id, { route_order: 99 });

        return {
          success: true,
          data: {
            job: formatJob(job),
            message: `Scheduled ${service} for ${client.name} on ${date}${time ? ` at ${time}` : ''}`
          }
        };
      }

      case 'updateJobStatus': {
        const { jobId, status } = args;
        // Map autopilot statuses to app statuses
        const statusMap = { completed: 'done', skipped: 'scheduled' };
        const appStatus = statusMap[status] || status;
        await updateJobStatus(jobId, appStatus);
        return {
          success: true,
          data: { jobId, status: appStatus, message: `Job marked as ${appStatus}` }
        };
      }

      case 'invoiceCompletedJobs': {
        const { date } = args;
        const invoiceDate = date || today();
        const allJobs = await loadJobs();
        const completed = allJobs.filter(
          j => j.scheduled_date === invoiceDate && (j.status === 'completed' || j.status === 'done')
        );

        if (completed.length === 0) {
          return { success: true, data: { invoiced: 0, message: `No completed jobs found for ${invoiceDate}` } };
        }

        // Group by client
        const byClient = {};
        for (const job of completed) {
          const cid = job.client_id || job.clients?.id;
          if (!cid) continue;
          if (!byClient[cid]) byClient[cid] = { client: job.clients, jobs: [] };
          byClient[cid].jobs.push(job);
        }

        const results = [];
        for (const [cid, group] of Object.entries(byClient)) {
          const rate = group.client?.rate || group.jobs[0]?.clients?.rate;
          if (!rate || rate === 0) {
            results.push({ client: group.client?.name || 'Unknown', warning: 'No rate set — skipped. Set a rate in Clients tab first.' });
            continue;
          }
          const amount = group.jobs.length * rate;
          const invoice = await createInvoice({
            client_id: cid,
            amount,
            description: `${group.jobs.length} service(s) on ${invoiceDate}`
          });
          results.push({ client: group.client?.name, jobs: group.jobs.length, amount });
        }

        return {
          success: true,
          data: {
            date: invoiceDate,
            invoiced: results.length,
            total: results.reduce((sum, r) => sum + (r.amount || 0), 0),
            invoices: results
          }
        };
      }

      default:
        return { success: false, error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    console.error(`Tool ${name} error:`, err);
    return { success: false, error: err.message || 'Tool execution failed' };
  }
}

// ──────────────────────────────────────────
// Formatters — redact sensitive PII before sending to LLM
// ──────────────────────────────────────────

function formatJob(j) {
  return {
    id: j.id,
    client: j.clients?.name || 'Unknown',
    address: j.clients?.address || '',
    service: j.title,
    date: j.scheduled_date,
    time: j.scheduled_time || null,
    status: j.status,
    recurrence: j.recurrence || 'none',
    notes: redactPII(j.clients?.service_notes || ''),
    // Gate codes, alarm codes, pet instructions redacted
    rate: j.clients?.rate || null
  };
}

function formatClient(c) {
  return {
    id: c.id,
    name: c.name,
    address: c.address,
    phone: c.phone,
    email: c.email,
    rate: c.rate,
    serviceNotes: redactPII(c.service_notes || ''),
    // Sensitive fields (key_code, alarm_code) redacted — user can ask for them explicitly
  };
}

/** Redact PII patterns (gate codes, alarm codes, pet info, PINs) from text before sending to LLM */
function redactPII(text) {
  if (!text) return '';
  return text
    .replace(/\b(gate\s*(?:code|#|num(?:ber)?)?\s*(?:is\s+)?[:=]?\s*)(\S+)/gi, '$1[REDACTED]')
    .replace(/\b(alarm\s*(?:code|#|pin)?\s*(?:is\s+)?[:=]?\s*)(\S+)/gi, '$1[REDACTED]')
    .replace(/\b(door\s*code\s*(?:is\s+)?[:=]?\s*)(\S+)/gi, '$1[REDACTED]')
    .replace(/\b(access\s*code\s*(?:is\s+)?[:=]?\s*)(\S+)/gi, '$1[REDACTED]')
    .replace(/\b(password\s*(?:is\s+)?[:=]?\s*)(\S+)/gi, '$1[REDACTED]')
    .replace(/\b(PIN\s*(?:code|number)?\s*(?:is\s+)?[:=]?\s*)(\S+)/gi, '$1[REDACTED]')
    .replace(/\b(combination\s*(?:is\s+)?[:=]?\s*)(\S+)/gi, '$1[REDACTED]')
    .replace(/\b(security\s*code\s*(?:is\s+)?[:=]?\s*)(\S+)/gi, '$1[REDACTED]');
}

// ──────────────────────────────────────────
// System Prompt
// ──────────────────────────────────────────

export const SYSTEM_PROMPT = `You are MowGo AI Autopilot for lawn-care business operations only.
If a tool exists for the request, you MUST call it. Only respond with text when no tool applies.
Never invent business data; report only tool results.
Look up a client before creating their job or invoice.
Before changing data, state the action; confirm completed-job invoices before creating them.
Keep private access details hidden unless the user explicitly requests them.
If a tool fails or is unavailable, say so plainly.
Give short, direct answers; use bullets only when useful.`;
