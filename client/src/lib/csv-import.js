const ALIASES = {
  name: ['name', 'client name', 'client_name', 'customer name', 'customer', 'client'],
  address: ['address', 'street', 'location'],
  phone: ['phone', 'phone number', 'phone_number', 'mobile', 'cell'],
  email: ['email', 'e-mail', 'email address'],
  rate: ['rate', 'price', 'amount', 'cost', 'mow price'],
};

function delimiterFor(line) {
  const counts = { '\t': 0, ';': 0, ',': 0 };
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    if (line[i] === '"') {
      if (quoted && line[i + 1] === '"') i += 1;
      else quoted = !quoted;
    } else if (!quoted && Object.hasOwn(counts, line[i])) counts[line[i]] += 1;
  }
  if (counts['\t']) return '\t';
  if (counts[';'] && !counts[',']) return ';';
  return ',';
}

function firstRecord(source) {
  let value = '';
  let quoted = false;
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

function parseRecords(source, delimiter) {
  const records = [];
  let cells = [];
  let value = '';
  let quoted = false;
  let row = 1;
  let startRow = 1;
  const pushRecord = () => {
    cells.push(value.trim());
    records.push({ cells, row: startRow });
    cells = [];
    value = '';
    startRow = row;
  };
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (char === '"') {
      if (quoted && source[i + 1] === '"') { value += '"'; i += 1; }
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      cells.push(value.trim());
      value = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && source[i + 1] === '\n') i += 1;
      pushRecord();
      row += 1;
      startRow = row;
    } else {
      value += char;
      if (char === '\n' || char === '\r') row += 1;
    }
  }
  if (value || cells.length) pushRecord();
  return records;
}

export function cleanClientRows(rows) {
  const placeholders = /^(n\/?a|n\/?a\/?n|unknown|\?|none|-+|tbd|missing|not sure)$/i;
  const normalizePhone = value => {
    let digits = String(value).replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
    return digits.length === 10
      ? `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
      : digits;
  };
  const seenNamesAndAddresses = new Set();
  const seenNamesAndPhones = new Set();
  const cleanedRows = [];
  let cleaned = 0;
  let duplicates = 0;

  rows.forEach(sourceRow => {
    const row = {};
    let changed = false;
    ['name', 'address', 'phone', 'email', 'rate'].forEach(field => {
      const original = String(sourceRow?.[field] ?? '');
      let value = original.trim().replace(/\s+/g, ' ');
      if (placeholders.test(value)) value = '';
      row[field] = value;
      if (value !== original) changed = true;
    });

    const phone = normalizePhone(row.phone);
    if (phone !== row.phone) changed = true;
    row.phone = phone;

    if (row.rate && !/^\d+$/.test(row.rate)) {
      const match = row.rate.match(/\d+(?:\.\d+)?/);
      const rate = match ? match[0] : '';
      if (rate !== row.rate) changed = true;
      row.rate = rate;
    }

    if (!row.address && row.name.includes(',')) {
      const comma = row.name.indexOf(',');
      row.address = row.name.slice(comma + 1).trim();
      row.name = row.name.slice(0, comma).trim();
      changed = true;
    }

    if (!row.phone) {
      const match = row.name.match(/\b(?:1\d{10}|\d{10})\b/);
      if (match) {
        row.phone = normalizePhone(match[0]);
        row.name = row.name.replace(match[0], '').trim().replace(/\s+/g, ' ');
        changed = true;
      }
    }

    const name = row.name.toLowerCase();
    const nameAndAddress = `${name}|${row.address.toLowerCase()}`;
    const nameAndPhone = row.phone ? `${name}|${row.phone}` : '';
    if (changed) cleaned += 1;
    if (seenNamesAndAddresses.has(nameAndAddress) || (nameAndPhone && seenNamesAndPhones.has(nameAndPhone))) {
      duplicates += 1;
      return;
    }
    seenNamesAndAddresses.add(nameAndAddress);
    if (nameAndPhone) seenNamesAndPhones.add(nameAndPhone);
    cleanedRows.push(row);
  });

  return { rows: cleanedRows, cleaned, duplicates };
}

export function parseClientCsv(text) {
  const source = String(text || '').replace(/^\uFEFF/, '');
  const firstText = firstRecord(source);
  if (!firstText) return { rows: [], errors: [] };
  const delimiter = delimiterFor(firstText);
  const records = parseRecords(source, delimiter);
  const firstIndex = records.findIndex(record => record.cells.some(cell => cell.trim()));
  const first = records[firstIndex].cells;
  const normalized = first.map(cell => cell.toLowerCase().trim());
  const isHeader = normalized.some(cell => Object.values(ALIASES).some(values => values.includes(cell)));
  const indexes = {};
  if (isHeader) {
    Object.entries(ALIASES).forEach(([field, aliases]) => {
      indexes[field] = normalized.findIndex(cell => aliases.includes(cell));
    });
  } else ['name', 'address', 'phone', 'email', 'rate'].forEach((field, index) => { indexes[field] = index; });

  const rows = [];
  const errors = [];
  records.forEach((record, index) => {
    if (!record.cells.some(cell => cell.trim()) || (isHeader && index === firstIndex) || index < firstIndex) return;
    const row = Object.fromEntries(Object.entries(indexes).map(([field, column]) => [field, column >= 0 ? (record.cells[column] || '').trim() : '']));
    const missing = [!row.name && 'name', !row.address && 'address'].filter(Boolean);
    if (missing.length) errors.push({ row: record.row, message: `Missing ${missing.join(' and ')}` });
    else rows.push(row);
  });
  return { rows, errors };
}
