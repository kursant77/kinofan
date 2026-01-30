#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

function ok(msg) { console.log('\x1b[32m✓\x1b[0m', msg); }
function warn(msg) { console.log('\x1b[33m!\x1b[0m', msg); }
function fail(msg) { console.error('\x1b[31m✗\x1b[0m', msg); process.exitCode = 1; }

const __filename = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(__filename), '..');
let problems = 0;

// 1) vercel.json presence
if (fs.existsSync(path.join(root, 'vercel.json'))) {
  ok('vercel.json found');
} else {
  problems++;
  fail('vercel.json is missing — SPA fallback may 404 for client routes (e.g. /room/:id)');
}

// 2) vite.config.js base check
const vite = fs.readFileSync(path.join(root, 'vite.config.js'), 'utf8');
if (/base:\s*import\.meta\.env\.VITE_PUBLIC_URL\s*\|\|\s*'\/'/m.test(vite)) {
  ok('vite.config.js sets `base` from VITE_PUBLIC_URL or `/`');
} else {
  problems++;
  warn('vite.config.js does not appear to set `base` from VITE_PUBLIC_URL — assets may 404 when deployed to a subpath');
}

// 3) .env.example presence
if (fs.existsSync(path.join(root, '.env.example'))) {
  ok('.env.example present');
} else {
  problems++;
  warn('.env.example missing — add VITE_PUBLIC_URL, VITE_API_URL, Supabase keys');
}

// 4) Recommend env vars
const required = ['VITE_PUBLIC_URL', 'VITE_API_URL'];
const missing = required.filter(k => !process.env[k]);
if (missing.length) {
  warn('Recommended env vars not set in environment: ' + missing.join(', '));
  console.log('  → These should be configured in your hosting provider (Vercel/GitHub) for predictable links.');
} else {
  ok('recommended env vars found in environment');
}

// 5) In CI we treat some issues as fatal
if (process.env.CI) {
  if (problems > 0) {
    fail(`CI: ${problems} configuration problem(s) found — fix before deploy`);
    process.exit(1);
  }
}

if (process.exitCode && process.exitCode !== 0) {
  console.error('\nDeployment checks failed. See messages above.');
  process.exit(process.exitCode);
}

console.log('\nAll quick deploy checks passed (or only non-fatal warnings).');
