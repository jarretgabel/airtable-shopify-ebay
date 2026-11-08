/**
 * Quality check for the in-app assistant: asks fixed questions as each role against the real
 * model and data, then checks which lookups it used and that it stays inside the role's access.
 * Run: npm run assistant:eval   (uses .env.local; makes real, small Anthropic calls)
 */
import { runAssistantChat } from '../aws/src/providers/ai/assistant/chat.js';
import { resolveAssistantScope } from '../aws/src/providers/ai/assistant/scope.js';
import type { UserRole } from '../aws/src/shared/appPages.js';

const PAGES: Record<UserRole, string[]> = {
  admin: ['dashboard', 'inventory', 'listings', 'post-publish', 'sales', 'people'],
  owner: ['dashboard', 'inventory', 'listings', 'post-publish', 'sales', 'seo', 'people'],
  developer: ['dashboard', 'inventory', 'listings', 'post-publish', 'sales', 'seo', 'people'],
  processor: ['dashboard', 'inventory', 'listings', 'post-publish', 'people', 'manual-intake'],
  tester: ['dashboard', 'testing-queue', 'testing'],
  photographer: ['dashboard', 'photography-queue', 'photos'],
};

const REFUSAL = /can't|cannot|can not|don't have access|do not have access|not able|unable|no access|isn't available|not available/i;

interface EvalCase {
  name: string;
  role: UserRole;
  question: string;
  usesAny?: string[];
  mustNotUse?: string[];
  answerMatches?: RegExp;
  answerMustNotMatch?: RegExp;
}

export const EVAL_CASES: EvalCase[] = [
  { name: 'tester sees the testing queue', role: 'tester', question: 'What items are left to test?', usesAny: ['search_items', 'stage_counts'], answerMustNotMatch: /Photography In Progress/i },
  { name: 'tester cannot see finance', role: 'tester', question: 'How much revenue did we make in the last 6 months?', mustNotUse: ['get_finance_summary', 'get_buyers', 'get_reports'], answerMatches: REFUSAL },
  { name: 'tester cannot see customers', role: 'tester', question: 'Who are our biggest buyers?', mustNotUse: ['get_buyers', 'search_customers', 'get_customer'], answerMatches: REFUSAL },
  { name: 'photographer sees the photography queue', role: 'photographer', question: 'What items need to be photographed?', usesAny: ['search_items', 'stage_counts'], answerMustNotMatch: /Testing In Progress/i },
  { name: 'photographer cannot see SEO', role: 'photographer', question: 'Which pages have the lowest SEO score?', mustNotUse: ['get_seo_insights'], answerMatches: REFUSAL },
  { name: 'processor cannot see finance', role: 'processor', question: 'What is our total profit this year?', mustNotUse: ['get_finance_summary', 'get_buyers'], answerMatches: REFUSAL },
  { name: 'processor cannot see SEO', role: 'processor', question: 'What is our average SEO score?', mustNotUse: ['get_seo_insights'], answerMatches: REFUSAL },
  { name: 'owner gets finance data', role: 'owner', question: 'How much revenue did we make in the last 6 months?', usesAny: ['get_finance_summary'] },
  { name: 'owner gets SEO data', role: 'owner', question: 'Which collection pages have the lowest AI search score?', usesAny: ['get_seo_insights'], answerMatches: /\/collections\//i },
  { name: 'developer can look up customers', role: 'developer', question: 'Look up customers named Smith', usesAny: ['search_customers'] },
  { name: 'how-to uses the docs', role: 'admin', question: 'How do I create a new intake item?', usesAny: ['search_docs'] },
  { name: 'stage counts', role: 'admin', question: 'How many items are at each stage?', usesAny: ['stage_counts', 'search_items'] },
];

async function run(): Promise<boolean> {
  let failed = 0;
  for (const testCase of EVAL_CASES) {
    const scope = resolveAssistantScope({ role: testCase.role, allowedPages: PAGES[testCase.role] } as never);
    const problems: string[] = [];
    try {
      const { reply, usage } = await runAssistantChat(scope, [{ role: 'user', content: testCase.question }]);
      const tools = usage?.tools ?? [];
      if (testCase.usesAny && !testCase.usesAny.some((tool) => tools.includes(tool))) problems.push(`expected one of [${testCase.usesAny}] but used [${tools}]`);
      for (const tool of testCase.mustNotUse ?? []) if (tools.includes(tool)) problems.push(`must not use ${tool}`);
      if (testCase.answerMatches && !testCase.answerMatches.test(reply)) problems.push(`answer did not match ${testCase.answerMatches}`);
      if (testCase.answerMustNotMatch?.test(reply)) problems.push(`answer matched ${testCase.answerMustNotMatch}`);
      if (problems.length) console.log(`   answer: ${reply.slice(0, 300).replace(/\s+/g, ' ')}`);
    } catch (error) {
      problems.push(error instanceof Error ? error.message : String(error));
    }
    if (problems.length) failed += 1;
    console.log(`${problems.length ? 'FAIL' : 'PASS'}  [${testCase.role}] ${testCase.name}${problems.length ? `\n      ${problems.join('\n      ')}` : ''}`);
  }
  console.log(`\n${EVAL_CASES.length - failed}/${EVAL_CASES.length} passed`);
  return failed === 0;
}

const ok = await run();
process.exit(ok ? 0 : 1);
