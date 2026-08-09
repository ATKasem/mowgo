const ALIASES = {
  name: ['name', 'client name', 'client_name', 'customer name', 'customer', 'client'],
  address: ['address', 'street', 'location'],
  phone: ['phone', 'phone number', 'phone_number', 'mobile', 'cell'],
  email: ['email', 'e-mail', 'email address'],
  rate: ['rate', 'price', 'amount', 'cost', 'mow price'],
};

function firstRecord(source) {
  let value = '', quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (char === '"') {
      value += char;
      if (quoted && source[i + 1] === '"') { value += '"'; i += 1; }
      else quoted = !quoted;
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (value.trim()) return value;
      if (char === '\r' && source[i + 1] === '\n') i += 1;
      value = '';
    } else value += char;
  }
  return value.trim() ? value : '';
}

function delimiterFor(line) {
  const counts = { '\t': 0, ';': 0, ',': 0 };
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    if (line[i] === '"') {
      if (quoted && line[i + 1] === '"') i += 1;
      else quoted = !quoted;
    } else if (!quoted && Object.hasOwn(counts, line[i])) counts[line[i]] += 1;
  }
  return counts['\t'] ? '\t' : counts[';'] && !counts[','] ? ';' : ',';
}

function records(source, delimiter) {
  const output = [];
  let cells = [], value = '', quoted = false, row = 1, startRow = 1;
  const push = () => { cells.push(value.trim()); output.push({ cells, row: startRow }); cells = []; value = ''; startRow = row; };
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (char === '"') {
      if (quoted && source[i + 1] === '"') { value += '"'; i += 1; }
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      cells.push(value.trim()); value = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && source[i + 1] === '\n') i += 1;
      push(); row += 1; startRow = row;
    } else {
      value += char;
      if (char === '\n' || char === '\r') row += 1;
    }
  }
  if (value || cells.length) push();
  return output;
}

export function parseConciergeCsv(text) {
  const source = String(text || '').replace(/^\uFEFF/, '');
  const firstText = firstRecord(source);
  if (!firstText) return { rows: [], errors: [] };
  const parsedRecords = records(source, delimiterFor(firstText));
  const firstIndex = parsedRecords.findIndex(record => record.cells.some(cell => cell.trim()));
  const normalized = parsedRecords[firstIndex].cells.map(value => value.toLowerCase().trim());
  const header = normalized.some(value => Object.values(ALIASES).some(aliases => aliases.includes(value)));
  const indexes = {};
  if (header) Object.entries(ALIASES).forEach(([key, aliases]) => { indexes[key] = normalized.findIndex(value => aliases.includes(value)); });
  else ['name', 'address', 'phone', 'email', 'rate'].forEach((key, index) => { indexes[key] = index; });
  const rows = [], errors = [];
  parsedRecords.forEach((record, index) => {
    if (!record.cells.some(cell => cell.trim()) || (header && index === firstIndex) || index < firstIndex) return;
    const row = Object.fromEntries(Object.entries(indexes).map(([key, column]) => [key, column < 0 ? '' : (record.cells[column] || '').trim()]));
    const missing = [!row.name && 'name', !row.address && 'address'].filter(Boolean);
    if (missing.length) errors.push({ row: record.row, message: `Missing ${missing.join(' and ')}` });
    else rows.push(row);
  });
  return { rows, errors };
}
