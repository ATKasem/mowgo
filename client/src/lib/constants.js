/** Shared status configuration used across Schedule, Route, and Invoices. */
export const STATUS_CONFIG = {
  scheduled: {
    bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
    badge: 'badge-warning',
    label: 'Scheduled',
    dot: 'bg-amber-500',
  },
  in_progress: {
    bg: 'bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800',
    badge: 'badge-info',
    label: 'In Progress',
    dot: 'bg-sky-500',
  },
  done: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800',
    badge: 'badge-success',
    label: 'Done',
    dot: 'bg-emerald-500',
  },
};

export const INVOICE_STATUS = {
  paid: {
    icon: 'CheckCircle',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    text: 'text-emerald-700 dark:text-emerald-400',
    badge: 'badge-success',
    label: 'Paid',
  },
  unpaid: {
    icon: 'AlertCircle',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    text: 'text-amber-700 dark:text-amber-400',
    badge: 'badge-warning',
    label: 'Unpaid',
  },
  overdue: {
    icon: 'AlertCircle',
    bg: 'bg-red-50 dark:bg-red-950/30',
    text: 'text-red-700 dark:text-red-400',
    badge: 'badge-danger',
    label: 'Overdue',
  },
};

/** Default form values for new jobs and clients. */
export const INITIAL_JOB_FORM = { client_id: '', title: 'Cleaning', scheduled_time: '09:00', duration_minutes: 120 };
export const INITIAL_CLIENT_FORM = { name: '', address: '', phone: '', email: '', rate: 0, cleaning_notes: '', key_code: '', alarm_code: '', pet_instructions: '' };
