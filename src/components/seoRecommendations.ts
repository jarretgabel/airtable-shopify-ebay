import type { SeoIssue } from '@/services/app-api/seo';

const RECOMMENDATIONS: Record<string, string> = {
  'fetch-failed': 'Open the page in a browser. If it loads, run the audit again; temporary rate limits clear on their own.',
  indexable: 'Remove the noindex setting and make sure the page returns HTTP 200 so search engines can list it.',
  'title-present': 'Add a page title (in Shopify, the "Page title" field under Search engine listing).',
  'title-length': 'Rewrite the title to 30-60 characters, with the brand/model or topic first.',
  'description-present': 'Write a meta description (Shopify: "Meta description" under Search engine listing) that summarises the page.',
  'description-length': 'Rewrite the meta description to 70-160 characters so it is not cut off in results.',
  'single-h1': 'Use exactly one H1 heading that names the page topic. Most themes make the page or product title the H1, so check the theme template if it is missing.',
  canonical: 'Add a canonical link tag (usually a theme setting or missing from the layout).',
  'content-length': 'Add more useful text: condition, specs, what is included, and why it matters to a buyer.',
  'image-alt': 'Add alt text to each image describing it, e.g. "Brand Model product type key detail". Shopify: edit the image and choose "Add alt text".',
  'open-graph': 'Add Open Graph title and image tags so links look right when shared (usually set in the theme layout).',
  'internal-links': 'Link to at least 3 related pages, such as related products, collections or guides.',
  viewport: 'Add a viewport meta tag to the theme layout so the page is treated as mobile friendly.',
  lang: 'Set the lang attribute on the html tag in the theme layout.',
  'structured-data': 'Add JSON-LD structured data. Most Shopify themes include it for products; check the theme or an SEO app for other pages.',
  'aio-schema': 'Add schema that fits the page: Product (with price, availability and brand), Article for blog posts, or CollectionPage/ItemList for collections.',
  'aio-breadcrumbs': 'Add BreadcrumbList schema so AI and search engines understand where the page sits in the site.',
  'aio-answer-text': 'Add descriptive paragraphs an AI could quote directly: what it is, condition, history and key facts.',
  'aio-summary': 'Add a clear 70-200 character meta description that works as a one-sentence summary.',
  'aio-headings': 'Add one H1 plus at least two H2 subheadings that break the content into clear sections.',
  'aio-specs': 'Put specs and details in a bulleted list or table (model, year, inputs, power, condition).',
  'aio-questions': 'Add a short FAQ with question headings (e.g. "Does it come with a warranty?") and FAQPage schema.',
  'aio-freshness': 'Review and update the page content, then re-save it so the modified date is current.',
  'aio-alt': 'Add descriptive alt text to the images so AI can understand them.',
};

export function recommendationFor(issue: SeoIssue): string {
  return RECOMMENDATIONS[issue.id] ?? 'Review this item and improve it where possible.';
}
