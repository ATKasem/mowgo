import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as conciergeRequest from '../../../client/src/lib/concierge-request.js';

const { isActiveConciergeRequest } = conciergeRequest;

const sql = readFileSync(new URL('../../../supabase/migrations/20260809190000_concierge_priority_review.sql', import.meta.url), 'utf8');

test('customer request classifier excludes terminal and missing history', () => {
  for (const status of ['pending', 'importing', 'review']) {
    assert.equal(isActiveConciergeRequest({ status }), true);
  }
  for (const request of [{ status: 'done' }, { status: 'skipped' }, null, undefined]) {
    assert.equal(isActiveConciergeRequest(request), false);
  }
});

test('dashboard claim classifier includes done but leaves skipped retryable', () => {
  assert.equal(typeof conciergeRequest.isActiveOrDoneConciergeRequest, 'function');
  for (const status of ['pending', 'importing', 'review', 'done']) {
    assert.equal(conciergeRequest.isActiveOrDoneConciergeRequest({ status }), true);
  }
  for (const request of [{ status: 'skipped' }, null, undefined]) {
    assert.equal(conciergeRequest.isActiveOrDoneConciergeRequest(request), false);
  }
});

test('concierge mutations use service-role-only transactional database functions', () => {
  for (const name of ['concierge_import_clients', 'concierge_schedule_first_week', 'concierge_undo_first_week', 'concierge_record_review', 'concierge_complete_review', 'concierge_skip_request']) {
    assert.match(sql, new RegExp(`CREATE OR REPLACE FUNCTION ${name}`));
    assert.match(sql, new RegExp(`REVOKE ALL ON FUNCTION ${name}\\([^;]+ FROM PUBLIC, anon, authenticated;`));
    assert.match(sql, new RegExp(`GRANT EXECUTE ON FUNCTION ${name}\\([^;]+ TO service_role;`));
  }
  assert.match(sql, /FOR UPDATE;/);
});

test('skip transition is audited, validates trimmed notes, and is idempotent', () => {
  assert.match(sql, /ADD COLUMN IF NOT EXISTS notes text/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS skipped_at timestamptz/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS skipped_by_operator_id uuid REFERENCES profiles\(id\)/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS skip_notes text/);
  assert.match(sql, /IF v_request\.status = 'skipped' THEN RETURN to_jsonb\(v_request\); END IF;/);
  assert.match(sql, /IF v_request\.status NOT IN \('pending', 'importing', 'review'\)/);
  assert.match(sql, /v_notes := btrim\(COALESCE\(p_notes,''\)\)/);
  assert.match(sql, /char_length\(v_notes\) NOT BETWEEN 1 AND 4000/);
  assert.match(sql, /EXISTS \(SELECT 1 FROM jobs WHERE concierge_request_id = p_request_id\)/);
  assert.match(sql, /request schedule must be fully undone before skip/);
  assert.match(sql, /status='skipped', skipped_at=now\(\), skip_notes=v_notes, skipped_by_operator_id=p_operator_id/);
});

test('first-week scheduling is bounded, timezone explicit, and undo preserves changed jobs', () => {
  assert.match(sql, /business_timezone = 'America\/Chicago'/);
  assert.match(sql, /v_end := v_start \+ 6;/);
  assert.match(sql, /jsonb_array_length\(p_clients\) > 70/);
  assert.match(sql, /'snapshot_version', 1/);
  assert.match(sql, /\(to_jsonb\(j\) - 'user_id' - 'concierge_request_id'\) = o\.snapshot/);
  assert.match(sql, /undo_retained_changed/);
  assert.match(sql, /v_request\.status NOT IN \('importing', 'review'\)/);
  assert.doesNotMatch(sql, /cardinality\(v_request\.scheduled_job_ids\) = 0 THEN RETURN/);
});

test('client import records an explicit outcome for every submitted row', () => {
  assert.doesNotMatch(sql, /concierge_request_clients[^;]+ON CONFLICT DO NOTHING/s);
  assert.match(sql, /'input_rows',jsonb_array_length\(p_clients\)/);
  assert.match(sql, /'outcome','duplicate_existing_client'/);
  assert.match(sql, /'duplicate_of_source_index',v_existing_source_index/);
  assert.match(sql, /import_summary = jsonb_build_object/);
  assert.match(sql, /'import', v_request\.import_summary/);
  assert.match(sql, /IF cardinality\(v_request\.imported_client_ids\) > 0 THEN/);
});

test('customer reads use a field-limited RPC while direct table reads are denied', () => {
  assert.match(sql, /DROP POLICY IF EXISTS "Concierge: owner select own" ON concierge_requests;/);
  assert.match(sql, /REVOKE SELECT ON TABLE concierge_requests FROM anon, authenticated;/);
  assert.match(sql, /GRANT ALL ON TABLE concierge_requests TO service_role;/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION get_my_concierge_request\(\)/);
  assert.match(sql, /WHERE cr\.user_id = auth\.uid\(\)/);
  assert.match(sql, /REVOKE ALL ON FUNCTION get_my_concierge_request\(\) FROM PUBLIC, anon, authenticated;/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION get_my_concierge_request\(\) TO authenticated;/);
  const rpcDefinition = sql.match(/CREATE OR REPLACE FUNCTION get_my_concierge_request\(\)[\s\S]+?\$\$;/)?.[0] || '';
  assert.match(rpcDefinition, /ORDER BY cr\.created_at DESC/);
  assert.doesNotMatch(rpcDefinition, /cr\.status\s+(?:IN|NOT IN|=|<>)/i);
  for (const internalField of ['skip_notes', 'notes', 'operator_checklist', 'last_operator_id', 'skipped_by_operator_id', 'csv_content']) {
    assert.doesNotMatch(rpcDefinition, new RegExp(`\\b${internalField}\\b`));
  }
});

test('only active requests are unique while done and skipped remain retryable history', () => {
  assert.match(sql, /CREATE UNIQUE INDEX concierge_requests_one_active_per_user\s+ON concierge_requests \(user_id\) WHERE status IN \('pending', 'importing', 'review'\);/);
  assert.doesNotMatch(sql, /CREATE UNIQUE INDEX concierge_requests_one_active_per_user[\s\S]+?WHERE status IN \([^)]*'skipped'/);
});

test('customer web flows do not read concierge_requests directly', () => {
  for (const relativePath of [
    '../../../client/src/pages/Settings.jsx',
    '../../../client/src/pages/Subscribe.jsx',
    '../../../client/src/pages/Dashboard.jsx',
  ]) {
    const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /\.from\(['"]concierge_requests['"]\)/);
    assert.match(source, /\.rpc\(['"]get_my_concierge_request['"]\)/);
  }
});

test('customer web flows treat skipped history as retryable instead of active', () => {
  const settings = readFileSync(new URL('../../../client/src/pages/Settings.jsx', import.meta.url), 'utf8');
  const subscribe = readFileSync(new URL('../../../client/src/pages/Subscribe.jsx', import.meta.url), 'utf8');
  const dashboard = readFileSync(new URL('../../../client/src/pages/Dashboard.jsx', import.meta.url), 'utf8');
  const status = readFileSync(new URL('../../../client/src/components/ConciergeStatus.jsx', import.meta.url), 'utf8');

  for (const source of [settings, subscribe]) {
    assert.match(source, /isActiveConciergeRequest/);
  }
  assert.match(dashboard, /isActiveOrDoneConciergeRequest/);
  assert.match(settings, /onRetry=/);
  assert.match(subscribe, /onRetry=/);
  assert.match(status, /request\.status === 'skipped'/);
  assert.match(status, /Start a new setup request/);
});
