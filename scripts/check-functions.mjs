#!/usr/bin/env node
/**
 * check-functions.mjs — import-check every Cloudflare Pages Function and
 * edge-function-shared module so a missing file / broken import fails the
 * build BEFORE it reaches production. The CF Pages bundler would catch this
 * at deploy time only after push; this runs locally in `npm run build`.
 *
 * Usage: node scripts/check-functions.mjs
 * Exit 1 on any import failure or syntax error.
 */
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const roots = ['functions/api', 'supabase/functions'];

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      walk(p, acc);
    } else if (/\.(js|mjs|ts)$/.test(entry)) {
      acc.push(p);
    }
  }
  return acc;
}

let failed = 0;
const files = roots.flatMap((r) => walk(r));

for (const f of files) {
  try {
    await import(pathToFileURL(f).href);
  } catch (err) {
    // Deno edge functions import 'https://deno.land/...' / npm: URLs that
    // Node can't resolve — those are expected failures; skip them.
    const msg = String(err?.message || err);
    if (msg.includes('https://') || msg.startsWith('npm:')) {
      continue;
    }
    failed++;
    console.error(`FAIL ${relative(process.cwd(), f)}: ${msg.split('\n')[0]}`);
  }
}

if (failed > 0) {
  console.error(`check-functions: ${failed} file(s) failed import resolution`);
  process.exit(1);
}
console.log(`check-functions: OK (${files.length} files import-checked)`);
