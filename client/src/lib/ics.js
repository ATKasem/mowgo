/** Generate .ics calendar file from jobs array and trigger download */
export function downloadICS(jobs, filename = 'mowflow-schedule.ics') {
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

  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function addMinutes(timeStr, minutes) {
  const h = parseInt(timeStr.slice(0, 2));
  const m = parseInt(timeStr.slice(2, 4));
  const total = h * 60 + m + minutes;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return String(nh).padStart(2, '0') + String(nm).padStart(2, '0') + '00';
}
