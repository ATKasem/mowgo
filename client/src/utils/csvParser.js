// Pure-JS CSV parser for the Yardbook import wizard — no npm dependencies.
// Handles quoted fields, commas inside quoted values, and newlines inside
// quoted values (RFC 4180-ish, tolerant of \n, \r\n and \r line endings).

export const MOWGO_FIELDS = ['name', 'address', 'phone', 'email', 'notes'];

const FIELD_ALIASES = {
  name: ['name', 'client name', 'client_name', 'customer name', 'customer', 'contact', 'contact name', 'full name'],
  address: ['address', 'street', 'street address', 'location', 'service address'],
  phone: ['phone', 'phone number', 'phone_number', 'mobile', 'cell', 'telephone'],
  email: ['email', 'e-mail', 'email address'],
  notes: ['notes', 'note', 'comments', 'comment', 'memo', 'description'],
};

// Tokenizes raw CSV text into rows of cells, respecting quoted fields that
// may contain commas, escaped quotes ("") and embedded newlines. Also
// collects errors for malformed quoting: a `"` appearing mid-field (not at
// the start of a field) is treated as a literal character rather than a
// quote-open, and a quoted field left unclosed at a delimiter/EOF is flagged.
// Returns { rows, errors } where errors[].rowIndex is 0-based into `rows`
// (row 0 = header row, since parseCsv hasn't split header/data yet).
function tokenize(text) {
  const source = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  const errors = [];
  let row = [];
  let value = '';
  let quoted = false;
  let atFieldStart = true;
  let i = 0;
  const n = source.length;

  function pushField() {
    if (quoted) {
      errors.push({ rowIndex: rows.length, message: `Unclosed quote in column ${row.length + 1}` });
      quoted = false;
    }
    row.push(value);
    value = '';
    atFieldStart = true;
  }

  function pushRow() {
    pushField();
    rows.push(row);
    row = [];
  }

  while (i < n) {
    const char = source[i];
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') { value += '"'; i += 2; continue; }
        quoted = false; i += 1; continue;
      }
      value += char; i += 1; continue;
    }
    if (char === '"') {
      if (atFieldStart) { quoted = true; atFieldStart = false; i += 1; continue; }
      errors.push({ rowIndex: rows.length, message: `Unexpected " in column ${row.length + 1} — value isn't fully quoted` });
      value += char; i += 1; continue;
    }
    if (char === ',') { pushField(); i += 1; continue; }
    if (char === '\r' || char === '\n') {
      if (char === '\r' && source[i + 1] === '\n') i += 1;
      pushRow();
      i += 1;
      continue;
    }
    value += char; atFieldStart = false; i += 1;
  }
  if (value !== '' || row.length) pushRow();

  // Drop fully-blank rows (e.g. trailing newline) but keep rows with at
  // least one non-empty cell. Remap error row indices to match.
  const keptRows = [];
  const indexMap = new Map();
  rows.forEach((cells, index) => {
    if (cells.some(cell => cell.trim() !== '')) {
      indexMap.set(index, keptRows.length);
      keptRows.push(cells);
    }
  });
  const remappedErrors = errors
    .filter(e => indexMap.has(e.rowIndex))
    .map(e => ({ rowIndex: indexMap.get(e.rowIndex), message: e.message }));

  return { rows: keptRows, errors: remappedErrors };
}

function detectColumns(headers) {
  const normalized = headers.map(h => h.toLowerCase().trim());
  const detectedMap = {};
  MOWGO_FIELDS.forEach(field => {
    const aliases = FIELD_ALIASES[field];
    const index = normalized.findIndex(h => aliases.includes(h));
    if (index >= 0) detectedMap[field] = headers[index];
  });
  return detectedMap;
}

/**
 * Parses raw CSV text into headers, row objects (keyed by the original CSV
 * header text), a best-guess mowgoField -> csvHeader mapping, and an errors
 * array ({ row, message }) for duplicate headers or malformed quoting.
 * `row` is 0 for header-row issues, or the 1-based data row number.
 */
export function parseCsv(text) {
  const { rows: records, errors: tokenizeErrors } = tokenize(text);
  if (records.length === 0) return { headers: [], rows: [], detectedMap: {}, errors: [] };

  const headers = records[0].map(cell => cell.trim());
  const errors = tokenizeErrors.map(e => ({ row: e.rowIndex, message: e.message }));

  const seenHeaders = new Map();
  headers.forEach((header, index) => {
    const key = header.toLowerCase();
    if (seenHeaders.has(key)) {
      errors.push({ row: 0, message: `Duplicate column header "${header}" (columns ${seenHeaders.get(key) + 1} and ${index + 1}) — later column overwrites earlier data` });
    } else {
      seenHeaders.set(key, index);
    }
  });

  const rows = records.slice(1).map(cells => {
    const row = {};
    headers.forEach((header, index) => { row[header] = (cells[index] ?? '').trim(); });
    return row;
  });

  return { headers, rows, detectedMap: detectColumns(headers), errors };
}
