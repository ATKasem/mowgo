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
      type: 'object', properties: {},
      required: []
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
        notify: { type: 'boolean', description: 'Whether to notify customers (default true)', default: true }
      },
      required: ['jobIds', 'newDate']
    }
  },
  {
    name: 'runRainDelay',
    description: "Move ALL of today's unfinished (scheduled) jobs to tomorrow. This is the rain delay feature — use when it's raining or about to rain. Tells you how many jobs were moved and optionally texts customers.",
    parameters: {
      type: 'object',
      properties: {
        notify: { type: 'boolean', description: 'Text customers to let them know (default true)', default: true }
      },
      required: []
    }
  },

  // ── Clients ──────────────────────────
  {
    name: 'searchClients',
    description: "Search for clients by name or address. Returns matching clients with their details: phone, email, address, rate, gate codes, pet instructions, and service notes.",
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
    description: "Get detailed info about a specific client: contact info, address, rate, gate code, pet instructions, alarm code, service notes, recent jobs, and unpaid invoices.",
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
    description: "Get recent jobs and invoices for a specific client. Shows job history, payment status, and service frequency.",
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
      type: 'object', properties: {},
      required: []
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
    description: "Send payment reminder texts to all clients with unpaid invoices. Tells them their balance and includes a payment link. ALWAYS ask for confirmation before sending.",
    parameters: {
      type: 'object', properties: {},
      required: []
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
    description: "Mark a job as completed or skipped. Use 'completed' when the job is done (this may trigger invoicing). Use 'skipped' for no-shows or cancellations.",
    parameters: {
      type: 'object',
      properties: {
        jobId: { type: 'string', description: 'Job ID to update' },
        status: { type: 'string', enum: ['completed', 'skipped'], description: 'New status' }
      },
      required: ['jobId', 'status']
    }
  },
  {
    name: 'invoiceCompletedJobs',
    description: "Create invoices for all jobs completed today (or on a specific date). Use at end of day after marking jobs as done. This is the 'invoice everything I finished' command.",
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
  return new Date().toISOString().split('T')[0];
}

function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
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
        const { jobIds, newDate, notify = true } = args;
        const results = [];
        for (const id of jobIds) {
          await updateJob(id, {
            scheduled_date: newDate,
            scheduled_time: null
          });
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
        const { notify = true } = args;
        const allJobs = await loadJobs();
        const todayStr = today();
        const tomorrowStr = tomorrow();
        const todaysScheduled = allJobs.filter(
          j => j.scheduled_date === todayStr && j.status === 'scheduled'
        );
        for (const j of todaysScheduled) {
          await updateJob(j.id, {
            scheduled_date: tomorrowStr,
            scheduled_time: null
          });
        }
        return {
          success: true,
          data: {
            moved: todaysScheduled.length,
            from: todayStr,
            to: tomorrowStr,
            jobs: todaysScheduled.map(j => ({ id: j.id, client: j.clients?.name })),
            notified: notify ? 'Customers would be notified (SMS not yet integrated)' : false
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
          .sort((a, b) => b.scheduled_date?.localeCompare(a.scheduled_date))
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
        return executeTool('getClientInfo', { clientName });
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
            sent: unpaid.length,
            total: unpaid.reduce((sum, inv) => sum + (inv.amount || 0), 0),
            clients: unpaid.map(inv => inv.clients?.name).filter(Boolean),
            note: 'SMS integration pending — reminders would be sent via text with payment links'
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
            const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
            const m = now.getMonth() === 0 ? 12 : now.getMonth();
            startDate = `${y}-${String(m).padStart(2, '0')}-01`;
            break;
          }
          case 'year': {
            startDate = `${now.getFullYear()}-01-01`;
            break;
          }
          default:
            startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        }

        const endDate = now.toISOString().split('T')[0];
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
        await updateJobStatus(jobId, status);
        return {
          success: true,
          data: { jobId, status, message: `Job marked as ${status}` }
        };
      }

      case 'invoiceCompletedJobs': {
        const { date } = args;
        const invoiceDate = date || today();
        const allJobs = await loadJobs();
        const completed = allJobs.filter(
          j => j.scheduled_date === invoiceDate && j.status === 'completed'
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
          const rate = group.client?.rate || group.jobs[0]?.clients?.rate || 45;
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
            total: results.reduce((sum, r) => sum + r.amount, 0),
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
// Formatters
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
    notes: j.clients?.service_notes || '',
    gateCode: j.clients?.key_code || null,
    petInstructions: j.clients?.pet_instructions || null,
    alarmCode: j.clients?.alarm_code || null,
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
    serviceNotes: c.service_notes || '',
    gateCode: c.key_code || null,
    petInstructions: c.pet_instructions || null,
    alarmCode: c.alarm_code || null
  };
}

// ──────────────────────────────────────────
// System Prompt
// ──────────────────────────────────────────

export const SYSTEM_PROMPT = `You are MowFlow AI Autopilot, a helpful assistant for lawn care business owners. You help them manage their business through natural conversation.

## Your Capabilities
You have tools to: check the schedule, reschedule jobs (rain delays), look up clients, create invoices, check revenue, and manage jobs.

## How You Work
1. When the user asks for something, use the right tool to get it done
2. Show what you're about to do before doing it (for actions that change things)
3. After completing an action, tell the user what happened clearly
4. If you need clarification, ask — don't guess
5. If a tool fails, tell the user what went wrong and suggest a fix

## Important Rules
- ALWAYS look up client info before creating invoices or jobs for them
- When rescheduling for rain, use runRainDelay for "move everything today" or rescheduleJobs for specific jobs
- Be friendly and conversational, but efficient — these are busy contractors
- Never make up data — only report what the tools actually return
- If you don't have a tool for something, say so honestly
- Gate codes, alarm codes, and pet instructions are private — only share them when the user specifically asks

## Lawn Care Context
- Most clients are on recurring schedules (weekly, biweekly, monthly)
- Rain delays are common — you'll reschedule jobs a lot
- The user may ask about "gate codes" or "dogs" — these are in client notes
- Typical services: Mow, Trim, Edge, Blow, Fertilize, Aerate, Overseed, Leaf cleanup
- Service rates vary per client (stored in client profile)

## Response Style
- Short and actionable
- Use bullet points for lists
- Mention specific names, dates, and amounts when you have them
- If you reschedule 8 jobs and notify customers, say "Done — 8 jobs moved to Friday. Customers notified."`;
