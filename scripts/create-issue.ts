// Files issues in the tracker from the command line (used for planned work and major changes).
// Usage: node --env-file=.env.local --import tsx scripts/create-issue.ts --kind feature --title "..." [--description "..."] [--priority normal] [--area "..."]
//        node --env-file=.env.local --import tsx scripts/create-issue.ts --file issues.json   (array of {kind,title,description,priority,area})
import { readFileSync } from 'node:fs';
import { getPostgresPool } from '../aws/src/db/pool.js';
import { ISSUE_KINDS, ISSUE_PRIORITIES, createIssue, type IssueKind, type IssuePriority } from '../aws/src/db/issues.js';

const args = process.argv.slice(2);
const arg = (name: string) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required.');

const items: Array<Record<string, string>> = arg('file')
  ? JSON.parse(readFileSync(arg('file') as string, 'utf8'))
  : [{ kind: arg('kind') ?? 'feature', title: arg('title') ?? '', description: arg('description') ?? '', priority: arg('priority') ?? 'normal', area: arg('area') ?? '' }];

const client = getPostgresPool();
try {
  for (const item of items) {
    if (!item.title?.trim()) throw new Error('Every issue needs a title.');
    const kind = (ISSUE_KINDS.find((value) => value === item.kind) ?? 'feature') as IssueKind;
    const priority = (ISSUE_PRIORITIES.find((value) => value === item.priority) ?? 'normal') as IssuePriority;
    const issue = await createIssue(client, { kind, title: item.title.trim().slice(0, 200), description: (item.description ?? '').slice(0, 5000), priority, area: item.area || null, source: 'app' }, { name: 'Copilot', email: 'copilot@assistant.local' });
    console.log(`#${issue.id} ${issue.title}`);
  }
} finally {
  await client.end();
}
