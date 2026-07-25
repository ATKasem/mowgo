/** Generate .ics calendar file from jobs array and trigger download */
export function downloadICS(jobs, filename = 'mowflow-schedule.ics') {
  const blob = new Blob([generateICS(jobs)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Generate Google Calendar URL from jobs array */
export function generateGoogleCalUrl(jobs) {
  const base = 'https://calendar.google.com/calendar/render?action=TEMPLATE';
  if (jobs.length === 0) return base;
  const first = jobs[0];
  const date = first.scheduled_date.replace(/-/g, '');
  const time = (first.scheduled_time || '09:00').replace(':', '') + '00';
  const endTime = addMinutes(time, first.duration_minutes || 60);
  const params = new URLSearchParams({
    text: `${first.title} - ${first.clients?.name || 'MowFlow Job'}`,
    dates: `${date}T${time}/${date}T${endTime}`,
    details: jobs.map(j => `${j.title} - ${j.clients?.name || ''} at ${j.scheduled_time?.slice(0, 5)}`).join('\n'),
    location: first.clients?.address || '',
  });
  return `${base}&${params.toString()}`;
}

/** Generate and download CSV (opens in Excel, Numbers, Google Sheets) */
export function downloadCSV(jobs, filename = 'mowflow-schedule.csv') {
  const headers = ['Date', 'Time', 'Client', 'Service', 'Address', 'Duration', 'Rate', 'Status'];
  const rows = jobs.map(j => [
    j.scheduled_date,
    j.scheduled_time?.slice(0, 5) || '',
    j.clients?.name || 'Unknown',
    j.title,
    j.clients?.address || '',
    `${j.duration_minutes || 60} min`,
    `$${j.clients?.rate || 0}`,
    j.status,
  ]);
  const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/** Escape HTML special characters */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Open print-friendly schedule view for PDF export */
export function printSchedule(jobs) {
  const rows = jobs.map(j => `
    <tr>
      <td>${escapeHtml(j.scheduled_date)}</td>
      <td>${escapeHtml(j.scheduled_time?.slice(0, 5) || '')}</td>
      <td>${escapeHtml(j.clients?.name || 'Unknown')}</td>
      <td>${escapeHtml(j.title)}</td>
      <td>${escapeHtml(j.clients?.address || '')}</td>
      <td>$${escapeHtml(String(j.clients?.rate || 0))}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>MowFlow Schedule</title>
    <style>body{font-family:system-ui,sans-serif;max-width:900px;margin:2rem auto;padding:0 1rem}
    h1{color:#22c55e}table{width:100%;border-collapse:collapse;margin-top:1rem}
    th,td{text-align:left;padding:8px 12px;border-bottom:1px solid #e5e7eb}th{background:#f3f4f6;font-weight:600}
    @media print{body{margin:0;padding:1cm}}</style></head>
    <body><h1>🌱 MowFlow Schedule</h1><p>${new Date().toLocaleDateString()}</p>
    <table><thead><tr><th>Date</th><th>Time</th><th>Client</th><th>Service</th><th>Address</th><th>Rate</th></tr></thead>
    <tbody>${rows}</tbody></table></body></html>`;

  const w = window.open('', '_blank');
  if (!w) {
    alert('Pop-up blocked. Please allow pop-ups for this site and try again.');
    return;
  }
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 500);
}

/** Escape ICS special characters */
function escapeICS(str) {
  if (!str) return '';
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\n/g, '\\n');
}

/** Generate raw ICS string (reusable) */
export function generateICS(jobs) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MowFlow//Lawn Care Scheduling//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  jobs.forEach(job => {
    if (!job.clients) return;
    const date = job.scheduled_date.replace(/-/g, '');
    const time = (job.scheduled_time || '09:00').replace(':', '') + '00';
    const endTime = addMinutes(time, job.duration_minutes || 60);
    const uid = `${job.id}@mowflow`;

    lines.push(
      'BEGIN:VEVENT',
      `DTSTART:${date}T${time}`,
      `DTEND:${date}T${endTime}`,
      `SUMMARY:${escapeICS(`${job.title} - ${job.clients.name}`)}`,
      `LOCATION:${escapeICS(job.clients.address || '')}`,
      `DESCRIPTION:${escapeICS(job.clients.service_notes || '')}\\nRate: $${escapeICS(String(job.clients.rate || 0))}`,
      `UID:${escapeICS(uid)}`,
      'END:VEVENT',
    );
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function addMinutes(timeStr, minutes) {
  const h = parseInt(timeStr.slice(0, 2));
  const m = parseInt(timeStr.slice(2, 4));
  const total = h * 60 + m + minutes;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return String(nh).padStart(2, '0') + String(nm).padStart(2, '0') + '00';
}
