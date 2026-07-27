import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('autopilot API uses DeepSeek with a 1024 token ceiling', async () => {
  const source = await read('functions/api/autopilot.js');
  assert.match(source, /const DEFAULT_MODEL = 'deepseek\/deepseek-chat'/);
  assert.match(source, /const MAX_TOKENS = 1024/);
});

test('system prompt is tool-first, terse, and no more than eight lines', async () => {
  const source = await read('client/src/lib/autopilotTools.js');
  const prompt = source.match(/export const SYSTEM_PROMPT = `([\s\S]*?)`;/)?.[1];
  assert.ok(prompt, 'SYSTEM_PROMPT must exist');
  assert.ok(prompt.split('\n').length <= 8, 'SYSTEM_PROMPT exceeds eight lines');
  assert.match(prompt, /If a tool exists for the request, you MUST call it/i);
  assert.match(prompt, /Only respond with text when no tool applies/i);
  assert.match(prompt, /short/i);
  assert.doesNotMatch(prompt, /friendly|personality/i);
});

test('migration creates user-owned sessions and messages with RLS', async () => {
  const files = await read('supabase/migrations/005_autopilot_sessions.sql');
  assert.match(files, /create table if not exists autopilot_sessions/i);
  assert.match(files, /create table if not exists autopilot_messages/i);
  assert.match(files, /alter table autopilot_sessions enable row level security/i);
  assert.match(files, /alter table autopilot_messages enable row level security/i);
  assert.match(files, /auth\.uid\(\) = user_id/i);
});

test('hook persists and restores UUID sessions with message limits', async () => {
  const source = await read('client/src/hooks/useAutopilot.js');
  assert.match(source, /const MAX_USER_MESSAGES = 10/);
  assert.match(source, /const RESET_SUGGESTION_THRESHOLD = 20/);
  assert.match(source, /crypto\.randomUUID\(\)/);
  assert.match(source, /\.from\('autopilot_sessions'\)/);
  assert.match(source, /\.from\('autopilot_messages'\)/);
  assert.match(source, /userMessageCount/);
  assert.match(source, /shouldSuggestReset/);
});

test('compact chat shows the session counter and disables the limit', async () => {
  const source = await read('client/src/components/AutopilotChat.jsx');
  assert.match(source, /userMessageCount/);
  assert.match(source, /MAX_USER_MESSAGES/);
  assert.match(source, /messages/);
  assert.match(source, /limitReached/);
  assert.match(source, /disabled=\{isBusy \|\| loading\}/);
  assert.match(source, /Not saved/);
});

test('hook serializes sends, waits for session readiness, and publishes reset UUID immediately', async () => {
  const source = await read('client/src/hooks/useAutopilot.js');
  assert.match(source, /sendInFlightRef\.current/);
  assert.match(source, /setIsSending\(true\)/);
  assert.match(source, /await sessionReadyRef\.current/);
  assert.match(source, /sessionIdRef\.current = id;\s+setSessionId\(id\)/);
  assert.match(source, /persistenceFailed/);
});
