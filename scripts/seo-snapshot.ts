// Usage:
//   npm run seo:snapshot -- save [label]      saves docs/seo-snapshots/<date>-<label>.json from the current audit data
//   SEO_SNAPSHOT_SITE=stereobuyers npm run seo:snapshot -- save [label]   (default site: resolutionav)
//   npm run seo:snapshot -- compare <before.json> [after.json]   (after defaults to the current data)
import fs from 'node:fs';
import path from 'node:path';
import { getPostgresPool } from '../aws/src/db/pool.js';

interface Issue { id: string; kind: string; label: string; lost: number }
interface PageRow { url: string; page_type: string; status_code: number | null; seo_score: number | null; aio_score: number | null; issues: Issue[]; title: string | null; meta_description: string | null; word_count: number | null }
interface Snapshot { takenAt: string; label: string; run: Record<string, unknown> | null; pages: PageRow[]; pageSpeed: Array<Record<string, unknown>> }

const DIR = path.resolve('docs/seo-snapshots');

async function load(label: string): Promise<Snapshot> {
  const pool = getPostgresPool();
  try {
    const site = process.env.SEO_SNAPSHOT_SITE?.trim() || 'resolutionav';
    const run = (await pool.query("SELECT id, finished_at, page_count, avg_seo_score, avg_aio_score, site_checks FROM seo_audit_runs WHERE site = $1 AND status = 'completed' ORDER BY id DESC LIMIT 1", [site])).rows[0] ?? null;
    const pages = (await pool.query('SELECT url, page_type, status_code, seo_score, aio_score, issues, title, meta_description, word_count FROM seo_pages WHERE site = $1 ORDER BY url', [site])).rows as PageRow[];
    const pageSpeed = (await pool.query('SELECT url, strategy, performance, accessibility, best_practices, seo, lcp_ms, cls, tbt_ms, error, checked_at FROM seo_pagespeed WHERE url IN (SELECT url FROM seo_pages WHERE site = $1) ORDER BY url', [site])).rows;
    return { takenAt: new Date().toISOString(), label, run, pages, pageSpeed };
  } finally {
    await pool.end();
  }
}

const ok = (pages: PageRow[]) => pages.filter((p) => p.status_code === 200);
const avg = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);
const fmt = (n: number) => n.toFixed(1);
const delta = (a: number, b: number) => `${fmt(a)} -> ${fmt(b)} (${b - a >= 0 ? '+' : ''}${fmt(b - a)})`;

function checkCounts(pages: PageRow[]): Map<string, { label: string; pages: number; lost: number }> {
  const map = new Map<string, { label: string; pages: number; lost: number }>();
  for (const page of ok(pages)) {
    for (const issue of page.issues ?? []) {
      const key = `${issue.kind}:${issue.id}`;
      const entry = map.get(key) ?? { label: issue.label, pages: 0, lost: 0 };
      entry.pages += 1;
      entry.lost += issue.lost;
      map.set(key, entry);
    }
  }
  return map;
}

function compare(before: Snapshot, after: Snapshot): void {
  console.log(`Before: ${before.label} (${before.takenAt.slice(0, 16)})   After: ${after.label} (${after.takenAt.slice(0, 16)})\n`);
  const b = ok(before.pages);
  const a = ok(after.pages);
  console.log(`Pages at 200: ${b.length} -> ${a.length}`);
  console.log(`Avg SEO: ${delta(avg(b.map((p) => p.seo_score ?? 0)), avg(a.map((p) => p.seo_score ?? 0)))}`);
  console.log(`Avg AIO: ${delta(avg(b.map((p) => p.aio_score ?? 0)), avg(a.map((p) => p.aio_score ?? 0)))}\n`);

  console.log('By page type (SEO / AIO)');
  for (const type of [...new Set([...b, ...a].map((p) => p.page_type))].sort()) {
    const bt = b.filter((p) => p.page_type === type);
    const at = a.filter((p) => p.page_type === type);
    console.log(`  ${type.padEnd(11)} n ${bt.length}->${at.length}  SEO ${delta(avg(bt.map((p) => p.seo_score ?? 0)), avg(at.map((p) => p.seo_score ?? 0)))}  AIO ${delta(avg(bt.map((p) => p.aio_score ?? 0)), avg(at.map((p) => p.aio_score ?? 0)))}`);
  }

  console.log('\nPages affected per check (before -> after)');
  const bc = checkCounts(before.pages);
  const ac = checkCounts(after.pages);
  const rows = [...new Set([...bc.keys(), ...ac.keys()])].map((key) => ({ key, label: (bc.get(key) ?? ac.get(key))!.label, before: bc.get(key)?.pages ?? 0, after: ac.get(key)?.pages ?? 0, lostBefore: bc.get(key)?.lost ?? 0 }));
  rows.sort((x, y) => y.lostBefore - x.lostBefore);
  for (const row of rows) console.log(`  ${row.before.toString().padStart(4)} -> ${row.after.toString().padEnd(4)} ${row.after < row.before ? 'fixed ' : row.after > row.before ? 'WORSE ' : '      '}${row.key}  ${row.label}`);

  const beforeByUrl = new Map(before.pages.map((p) => [p.url, p]));
  const moves = a.flatMap((p) => {
    const old = beforeByUrl.get(p.url);
    if (!old || old.status_code !== 200) return [];
    return [{ url: p.url, change: (p.seo_score ?? 0) + (p.aio_score ?? 0) - (old.seo_score ?? 0) - (old.aio_score ?? 0) }];
  }).filter((m) => m.change !== 0).sort((x, y) => x.change - y.change);
  console.log(`\nPages changed: ${moves.length}; improved ${moves.filter((m) => m.change > 0).length}, dropped ${moves.filter((m) => m.change < 0).length}`);
  if (moves.length) {
    console.log('Biggest drops:');
    for (const m of moves.slice(0, 5).filter((m) => m.change < 0)) console.log(`  ${m.change} ${m.url}`);
    console.log('Biggest gains:');
    for (const m of moves.slice(-5).reverse().filter((m) => m.change > 0)) console.log(`  +${m.change} ${m.url}`);
  }
  const newUrls = a.filter((p) => !beforeByUrl.has(p.url)).length;
  const gone = b.filter((p) => !a.some((x) => x.url === p.url)).length;
  if (newUrls || gone) console.log(`\nNew pages: ${newUrls}; no longer at 200: ${gone}`);

  const perf = (s: Snapshot) => s.pageSpeed.filter((p) => typeof p.performance === 'number');
  if (perf(before).length && perf(after).length) {
    console.log(`\nPageSpeed performance avg: ${delta(avg(perf(before).map((p) => Number(p.performance))), avg(perf(after).map((p) => Number(p.performance))))} (sampled pages rotate weekly, so compare the home page and trends, not individual pages)`);
  }
}

const [command, arg1, arg2] = process.argv.slice(2);
if (command === 'save') {
  const label = arg1 ?? 'baseline';
  const snapshot = await load(label);
  fs.mkdirSync(DIR, { recursive: true });
  const file = path.join(DIR, `${snapshot.takenAt.slice(0, 10)}-${label.replace(/[^a-z0-9-]/gi, '-')}.json`);
  fs.writeFileSync(file, JSON.stringify(snapshot));
  const good = ok(snapshot.pages);
  console.log(`Saved ${file}\n${good.length} pages at 200; avg SEO ${fmt(avg(good.map((p) => p.seo_score ?? 0)))}, avg AIO ${fmt(avg(good.map((p) => p.aio_score ?? 0)))}`);
} else if (command === 'compare' && arg1) {
  const before = JSON.parse(fs.readFileSync(arg1, 'utf8')) as Snapshot;
  const after = arg2 ? (JSON.parse(fs.readFileSync(arg2, 'utf8')) as Snapshot) : await load('current');
  compare(before, after);
} else {
  console.log('Usage: save [label] | compare <before.json> [after.json]');
  process.exit(1);
}
