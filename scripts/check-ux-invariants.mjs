#!/usr/bin/env node
/**
 * Deterministic UX-invariant checks — the mechanical floor that doesn't depend
 * on the model remembering. Mirrors the pitfalls in CLAUDE.md.
 *
 * Run: npm run check:ux
 * Exits non-zero if any violation is found. Wire into CI or a pre-commit hook.
 *
 * Scope: CSS only (deterministic, low false-positive). Judgment-level checks
 * live in the ux-invariants-build skill, not here.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const TOKENS_FILE = join('src', 'styles', 'app-tokens.css'); // the ONE place literals are allowed

/** Recursively collect files under dir matching extension. */
function walk(dir, ext, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, ext, out);
    else if (name.endsWith(ext)) out.push(full);
  }
  return out;
}

const cssFiles = walk(SRC, '.css');

/** Each rule: { id, desc, test(line) -> bool, skipFile?(relPath) -> bool } */
const RULES = [
  {
    id: 'hardcoded-color',
    desc: 'Hardcoded color literal in a component stylesheet (use a --sn-* token).',
    skipFile: (rel) => rel === TOKENS_FILE,
    test: (line) => {
      let l = line.trim();
      if (l.startsWith('/*') || l.startsWith('*') || l.startsWith('//')) return false;
      if (l.includes('@import')) return false;
      // Strip var(...) segments: a hex inside a var() fallback is still tokenized.
      l = l.replace(/var\([^)]*\)/g, '');
      return /#[0-9a-fA-F]{3,8}\b/.test(l) || /\brgba?\(/.test(l) || /\bhsla?\(/.test(l);
    },
  },
  {
    id: 'viewport-height',
    desc: 'Fixed viewport height on a page (use min-height: 100% — see Shell & Scroll).',
    test: (line) => /\b(100dvh|100vh)\b/.test(line),
  },
  {
    id: 'literal-color-scheme',
    desc: 'color-scheme set to a literal (use color-scheme: var(--sn-color-scheme, light)).',
    // Lookbehind excludes the --sn-color-scheme token *definition* (which must be a literal).
    test: (line) => /(?<![\w-])color-scheme\s*:\s*(dark|light)\b/.test(line) && !/var\(/.test(line),
  },
];

let violations = 0;
const perRule = new Map(RULES.map((r) => [r.id, []]));

for (const file of cssFiles) {
  const rel = relative(ROOT, file).split(sep).join('/');
  const relForSkip = relative(ROOT, file); // OS-native for skipFile comparison
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const rule of RULES) {
      if (rule.skipFile && rule.skipFile(relForSkip)) continue;
      if (rule.test(line)) {
        perRule.get(rule.id).push(`  ${rel}:${i + 1}  ${line.trim()}`);
        violations++;
      }
    }
  });
}

if (violations === 0) {
  console.log('✓ UX invariants: no mechanical violations.');
  process.exit(0);
}

console.error(`\n✗ UX invariants: ${violations} violation(s) found.\n`);
for (const rule of RULES) {
  const hits = perRule.get(rule.id);
  if (hits.length === 0) continue;
  console.error(`[${rule.id}] ${rule.desc}  (${hits.length})`);
  console.error(hits.join('\n'));
  console.error('');
}
console.error('Fix these or move the literal into src/styles/app-tokens.css.');
process.exit(1);
