export interface SiteCheck {
  id: string;
  label: string;
  pass: boolean;
  detail?: string;
}

export const AI_CRAWLERS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'PerplexityBot', 'Google-Extended', 'CCBot'];

/** Returns the crawlers that robots.txt blocks from the whole site (Disallow: / for that agent or for all agents). */
export function blockedAiCrawlers(robots: string): string[] {
  const groups: Array<{ agents: string[]; disallowAll: boolean }> = [];
  let current: { agents: string[]; disallowAll: boolean } | null = null;
  let lastWasAgent = false;
  for (const rawLine of robots.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, '').trim();
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (field === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], disallowAll: false };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (field === 'disallow' && value === '/' && current) current.disallowAll = true;
  }
  const blockedFor = (agent: string) => groups.some((group) => group.disallowAll && (group.agents.includes(agent.toLowerCase()) || group.agents.includes('*')));
  return AI_CRAWLERS.filter(blockedFor);
}

export function buildSiteChecks(input: { robots: string | null; llmsTxt: boolean; sitemapPages: number; hasOrganizationSchema: boolean }): SiteCheck[] {
  const blocked = input.robots === null ? [] : blockedAiCrawlers(input.robots);
  return [
    { id: 'robots', label: 'robots.txt is available', pass: input.robots !== null },
    { id: 'ai-crawlers', label: 'AI crawlers are allowed in robots.txt', pass: input.robots !== null && blocked.length === 0, detail: blocked.length ? `Blocked: ${blocked.join(', ')}` : undefined },
    { id: 'sitemap', label: 'Sitemap lists pages', pass: input.sitemapPages > 0, detail: `${input.sitemapPages} pages` },
    { id: 'llms-txt', label: 'llms.txt is published for AI assistants', pass: input.llmsTxt },
    { id: 'organization-schema', label: 'Home page has Organization or LocalBusiness schema', pass: input.hasOrganizationSchema },
  ];
}
