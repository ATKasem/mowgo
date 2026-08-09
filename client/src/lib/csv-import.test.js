import test from 'node:test';
import assert from 'node:assert/strict';

import { prepareConciergeCsv } from './csv-import.js';

test('concierge cap counts raw valid rows even when duplicate cleanup shrinks the preview', () => {
  const duplicateRows = Array.from({ length: 75 }, () => 'Same Client,1 Main St');
  const result = prepareConciergeCsv(['name,address', ...duplicateRows].join('\n'));

  assert.equal(result.rawValidRowCount, 75);
  assert.equal(result.rows.length, 1);
  assert.equal(result.duplicates, 74);
  assert.equal(result.rawValidRowCount > 70, true);
});
