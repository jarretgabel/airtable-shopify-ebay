interface Criterion {
  label: string;
  points: number;
}

// Mirrors aws/src/seo/scoring.ts; keep the two in sync.
const SEO_CRITERIA: Criterion[] = [
  { label: 'Page is indexable (HTTP 200, no noindex)', points: 10 },
  { label: 'Has a meta description', points: 10 },
  { label: 'Has exactly one H1', points: 10 },
  { label: 'Enough content (150 words; 80 for home and collections; 300 for blog posts)', points: 10 },
  { label: 'Images have alt text', points: 10 },
  { label: 'Has structured data (JSON-LD)', points: 10 },
  { label: 'Has a title tag', points: 6 },
  { label: 'Title is 30-60 characters', points: 4 },
  { label: 'Meta description is 70-160 characters', points: 5 },
  { label: 'Has a canonical URL', points: 5 },
  { label: 'Has Open Graph title and image', points: 5 },
  { label: 'Links to at least 3 other pages', points: 5 },
  { label: 'Mobile viewport is set', points: 5 },
  { label: 'Page language is set', points: 5 },
];

const AIO_CRITERIA: Criterion[] = [
  { label: 'Schema that fits the page type (Product with price, availability and brand; Article for blogs; collection or organization schema)', points: 25 },
  { label: 'Enough descriptive text for an AI to quote', points: 15 },
  { label: 'Clear heading structure (an H1 and 2+ H2s)', points: 15 },
  { label: 'Clear summary (meta description)', points: 10 },
  { label: 'Specs or details in lists or tables', points: 10 },
  { label: 'Answers questions (FAQ schema or question headings)', points: 10 },
  { label: 'Breadcrumb schema', points: 5 },
  { label: 'Updated within the last year', points: 5 },
  { label: 'Image alt text', points: 5 },
];

function CriteriaList({ title, criteria }: { title: string; criteria: Criterion[] }) {
  return (
    <div>
      <p className="m-0 mb-1 font-semibold text-[var(--ink)]">{title}</p>
      <ul className="m-0 grid list-none gap-1 p-0">
        {criteria.map((criterion) => (
          <li key={criterion.label} className="flex items-baseline justify-between gap-3">
            <span>{criterion.label}</span>
            <span className="shrink-0 font-semibold [font-variant-numeric:tabular-nums]">{criterion.points}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SeoScoreExplainer() {
  return (
    <details className="rounded-lg border border-[var(--line)] px-3 py-2 text-[0.82rem] text-[var(--muted)]">
      <summary className="cursor-pointer font-semibold text-[var(--ink)]">How the scores are calculated</summary>
      <div className="mt-2 grid gap-4">
        <p className="m-0">
          Scores come from our own checklist of on-page SEO and AI-search readiness (structured data, answer-ready content, crawler access). Each page gets two scores out of 100. Every check has a point value that adds up to 100. A page earns the full value when it passes, partial credit when it partly passes (for example, 2 of 4 images with alt text earns half), and nothing when it fails. The run average is the mean of all audited pages. A page that cannot be fetched scores 0.
        </p>
        <div className="grid gap-x-14 gap-y-10 lg:grid-cols-2">
          <CriteriaList title="SEO score (on-page basics)" criteria={SEO_CRITERIA} />
          <CriteriaList title="AI search score (readiness to be cited by AI)" criteria={AIO_CRITERIA} />
        </div>
        <p className="m-0">Search Console rankings and clicks, PageSpeed and AI citation checks come from separate sources, are shown in their own panels, and are not part of these scores.</p>
      </div>
    </details>
  );
}
