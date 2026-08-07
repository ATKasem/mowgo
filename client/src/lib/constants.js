/** Shared status configuration used across Schedule, Route, and Invoices. */
export const STATUS_CONFIG = {
  scheduled: {
    bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
    badge: 'badge-warning',
    label: 'Scheduled',
    dot: 'bg-amber-500',
  },
  in_progress: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800',
    badge: 'badge-info',
    label: 'In Progress',
    dot: 'bg-emerald-500',
  },
  done: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800',
    badge: 'badge-success',
    label: 'Done',
    dot: 'bg-emerald-500',
  },
  skipped: {
    bg: 'bg-gray-50 dark:bg-gray-950/30 border-gray-200 dark:border-gray-800',
    badge: 'badge-ghost',
    label: 'Skipped',
    dot: 'bg-gray-400',
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
  voided: {
    icon: 'AlertCircle',
    bg: 'bg-gray-100 dark:bg-gray-800',
    text: 'text-gray-500 dark:text-gray-400',
    badge: 'badge-ghost',
    label: 'Voided',
  },
};

export const ESTIMATE_STATUS = {
  draft: { badge: 'badge-ghost', label: 'Draft' },
  sent: { badge: 'badge-info', label: 'Sent' },
  approved: { badge: 'badge-success', label: 'Approved' },
  declined: { badge: 'badge-danger', label: 'Declined' },
};

/** Recurrence options for jobs */
export const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'One-time' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
];

/** Default form values for new jobs and clients. */
export const INITIAL_JOB_FORM = { client_id: '', title: 'Mow + Edge', scheduled_time: '09:00', duration_minutes: 120, recurrence: 'none', assigned_to: null };
export const INITIAL_CLIENT_FORM = { name: '', address: '', phone: '', email: '', rate: 0, service_notes: '', key_code: '', alarm_code: '', pet_instructions: '', tags: [] };

/** Pre-built client tags — common labels lawn crews use to flag clients */
export const CLIENT_TAGS = [
  { value: 'do-not-service', label: 'Do Not Service', color: 'bg-red-100 border-red-300 text-red-700 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400' },
  { value: 'late-payer', label: 'Late Payer', color: 'bg-amber-100 border-amber-300 text-amber-700 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400' },
  { value: 'vip', label: 'VIP', color: 'bg-purple-100 border-purple-300 text-purple-700 dark:bg-purple-950/30 dark:border-purple-800 dark:text-purple-400' },
  { value: 'needs-quote', label: 'Needs Quote', color: 'bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-400' },
];

// ===== Crew / Team =====

/** Available roles for team members */
export const CREW_ROLES = [
  { value: 'owner', label: 'Owner' },
  { value: 'crew', label: 'Crew Member' },
];

/** Avatar background + text color pairs (Tailwind classes) for team member avatars. */
export const TEAM_MEMBER_COLORS = [
  { bg: 'bg-blue-100 dark:bg-blue-900/40',    text: 'text-blue-700 dark:text-blue-300' },
  { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-300' },
  { bg: 'bg-amber-100 dark:bg-amber-900/40',  text: 'text-amber-700 dark:text-amber-300' },
  { bg: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-700 dark:text-purple-300' },
  { bg: 'bg-rose-100 dark:bg-rose-900/40',    text: 'text-rose-700 dark:text-rose-300' },
  { bg: 'bg-cyan-100 dark:bg-cyan-900/40',    text: 'text-cyan-700 dark:text-cyan-300' },
  { bg: 'bg-orange-100 dark:bg-orange-900/40', text: 'text-orange-700 dark:text-orange-300' },
  { bg: 'bg-teal-100 dark:bg-teal-900/40',    text: 'text-teal-700 dark:text-teal-300' },
];
