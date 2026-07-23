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
    details: jobs.map(j => `${j.title} - ${j.clients?.name || ''} at ${j.scheduled_time?.slice(0, 5)}`).join('\\n'),
    location: first.clients?.address || '',
  });
  return `${base}&${params.toString()}`;
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
      `SUMMARY:${job.title} - ${job.clients.name}`,
      `LOCATION:${job.clients.address || ''}`,
      `DESCRIPTION:${job.clients.service_notes || ''}\\nRate: $${job.clients.rate || 0}`,
      `UID:${uid}`,
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
