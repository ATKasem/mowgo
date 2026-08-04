export function toCsv(rows, fallbackHeaders = []) {
  const headers = rows.length ? Object.keys(rows[0]) : fallbackHeaders;
  const escapeCell = value => {
    let normalized = value == null ? '' : String(value).replace(/[\r\n]+/g, ' ');
    if (/^[\s\u0000-\u001F]*[=+\-@]/.test(normalized)) normalized = `'${normalized}`;
    return `"${normalized.replace(/"/g, '""')}"`;
  };

  const lines = [
    headers.map(escapeCell).join(','),
    ...rows.map(row => headers.map(header => escapeCell(row[header])).join(',')),
  ];

  return `\uFEFF${lines.join('\r\n')}`;
}

export function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
