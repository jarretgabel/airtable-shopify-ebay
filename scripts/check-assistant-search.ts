/** Runs the assistant's search as an admin. Run: npm run assistant:search -- 11750 */
import { runAssistantTool } from '../aws/src/providers/ai/assistant/tools.js';
import { resolveAssistantScope } from '../aws/src/providers/ai/assistant/scope.js';

const query = process.argv.slice(2).join(' ');
const scope = resolveAssistantScope({ role: 'admin', allowedPages: ['inventory', 'listings', 'post-publish'] });
try {
  const result = await runAssistantTool(scope, 'search_items', { query, limit: 3 }) as { total: number; items: Array<Record<string, unknown>> };
  console.log(`total: ${result.total}`);
  for (const item of result.items) console.log(JSON.stringify({ id: item.id, kind: item.kind, SKU: JSON.stringify(item.SKU), status: item['Workflow Status'], title: item['Item Title'] }));
} catch (error) {
  console.error('Search threw:', error);
}
process.exit(0);
