# SEO & AIO Fix Plan for the Shopify Theme

Source: the in-app SEO & AI dashboard audit of https://resolutionavnyc.com (staging DB, run 5, 2026-11-08, 571 pages at HTTP 200).
Theme repo: `/Users/user/Sites/rav-shopify-theme` (has its own `docs/seo-plan.md`, `seo-checklist.md`, `seo-work-log.md` and the rule "one checklist item at a time, verify, log, pause for review"). Follow that workflow. Cross-reference existing F-##/C-##/EN-## IDs; don't redo finished work.

Averages today: SEO 90.9, AI 77.5. By type (SEO/AIO): product 92/83 (309 pages), collection 95/73 (130), page 81/69 (74), blog 90/71 (57), home 85/74.
The scores are our own 0-100 checklists (`aws/src/seo/scoring.ts`), not Google rankings. "Lost pts" below = summed points lost across all pages (priority signal).

## Step 0 - Before changing anything (important)
1. The audit crawls the LIVE theme. The dev theme (`RAV - Jarret Dev`, id 192268042562) may already fix some items (for example `snippets/structured-data-collection.liquid` already emits CollectionPage + ItemList, yet the live audit shows 130 collections without it). For each item below: check the dev theme first, and only code what's still missing. Anything already fixed just needs publishing.
2. Several "0 words / 0 internal links / 0 H1" pages are unlinked or unused templates (Adam Wexler, Press, Testimonials, per work log 2026-11-02). Confirm whether they're live and linked. If not, unpublish or noindex them rather than polishing them.
3. Re-run the audit after each publish (SEO & AI page > Run audit now, about 2 min) and compare.

## Baseline snapshot
Saved before any theme fixes: `docs/seo-snapshots/2026-11-08-baseline-before-theme-fixes.json` (571 pages, avg SEO 90.9, AIO 77.5). Each audit overwrites the live data, so compare against this file. After a publish and a fresh audit, run from `airtable-shopify-ebay`:
`npm run seo:snapshot -- compare docs/seo-snapshots/2026-11-08-baseline-before-theme-fixes.json`
It prints average and by-type scores, pages affected per check (fixed or WORSE), and the biggest page gains and drops. Save a milestone with `npm run seo:snapshot -- save <label>`.

## Priority list (largest gain first)

| # | Check | Pages | Lost pts | Where to fix |
|---|---|---|---|---|
| 1 | AIO: answers questions (FAQ schema or question headings) | 569 (all) | 5,690 | Theme + content |
| 2 | SEO: images have alt text | 468 | 2,736 | Theme (mostly) |
| 3 | AIO: collection ItemList/CollectionPage schema | 130 collections | 1,950 | Theme (check dev) |
| 4 | AIO: clear summary (meta description) | 340 | 1,720 | Theme fallback + content |
| 5 | AIO: image alt for AI image understanding | 468 | 1,370 | Same fix as #2 |
| 6 | AIO: enough quotable text | 128 | 1,065 | Content |
| 7 | SEO: meta description 70-160 chars | 349 | 1,055 | Theme fallback |
| 8 | AIO: heading structure (H1 + 2 or more H2) | 63 | 418 | Theme + content |
| 9 | SEO: title 30-60 chars | 152 | 365 | Theme title logic + content |
| 10 | AIO: specs in lists/tables | 33 | 330 | Content |
| 11 | SEO: at least 3 internal links | 56 | 278 | Content |
| 12 | SEO: 300 / 150 words of content | 96 | 504 | Content |
| 13 | AIO: freshness (updated within a year) | 60 | 238 | Theme (dateModified) + content |
| 14 | SEO: exactly one H1 | 25 | 220 | Theme (home) + pages |
| 15 | Blog: Article/BlogPosting schema | 3 | 53 | Theme |
| 16 | SEO: meta description missing | 4 | 40 | Content |
| 17 | AIO: breadcrumb schema (home) | 1 | 5 | Theme |

## Work packages

### WP1 - FAQ / question content (item 1, biggest win)
- Every page type lacks a FAQPage schema or question-style heading (an H2/H3 ending in "?"). Scored as all-or-nothing, so one real question block per page lifts it.
- Product template: add a "Common questions" block (is it serviced/tested, warranty, shipping, financing, trade-ins, in-store listening) driven by a section with block-based Q&A and a shared default set. Emit `FAQPage` JSON-LD from the same data (one source of truth, so schema always matches visible text). Allow per-product override via a metafield, and fall back to the shared set.
- Collection template: 3-5 buying questions per category (for example "What should I look for in a tube amplifier?"), stored as a collection metafield or section blocks.
- Blog, pages, home: a short FAQ section on home, About, Services and Contact; blogs use question H2s where natural.
- Rules: only real answers a customer would want. Don't invent claims. Google limits FAQ rich results, but the AI-readability benefit is the target.
- Verify: Rich Results Test on a product, a collection and home; the audit's `aio-questions` count drops.

### WP2 - Image alt text (items 2 and 5)
- Product pages: `snippets/section.flex-pdp.media-gallery.liquid` thumbnails and `snippets/section.flex-pdp.media-grid.liquid` omit alt (already noted in `seo-plan.md`). Fall back to `image.alt | default: product.title`. Example: 110 of 144 images have alt on an Accuphase product page, so check what the other 34 are (thumbnails, recommendations, cart or header icons).
- Collections: product cards and collection banners (0 of 2 on `/collections/accessories`). Pages: project pages with 0 of 10 images (section image blocks, `element.image.liquid`, `lazy-img.liquid`). Home: 9 of 19.
- Decorative images get `alt=""` explicitly. The audit counts `alt=""` as missing, so check how `htmlSignals.ts` counts them. We may need to treat explicit empty alt as decorative (a scoring fix on our side) rather than giving everything fake alt text.
- Product images should use alt like "Brand Model product-type detail" (matches our listing image alt standard).
- **Update (checked live on the Accuphase A-300 page):** the scorer now counts `alt=""` as decorative, and the main product photos already render alt (stored Shopify alt, with the theme falling back to the product title). The only `<img>` elements with no `alt` attribute are the two product photos in the **product gallery modal / zoom lightbox** (`product-gallery-modal__media...`). Fix the modal template to output `alt="{{ image.alt | default: product.title | escape }}"`. Updating Shopify alt text in bulk will not raise scores by itself; the missing alts are theme markup. Re-check other page types (collection, home, blog) for `<img>` without `alt` the same way (`document.querySelectorAll('img:not([alt])')`).
- Verify: pick 5 URLs across types, count `<img>` without `alt`.

### WP3 - Structured data (items 3, 15, 17)
- Collections: confirm `structured-data-collection` is rendered on `collection.json` and `collection.brand-collection-landing.json` and emits `CollectionPage`/`ItemList`. If it already exists on dev, publish it. Otherwise find the render condition.
- Blog posts: `structured-data-article` renders, but 3 pages still lack Article/BlogPosting. Likely `blogs/blog` index pages (not articles). Add `CollectionPage`/`Blog` for the index, or accept.
- Home: add `BreadcrumbList` (or `WebSite`+`Organization` alone is fine; breadcrumb on home is low value, so skip if it adds noise).
- Keep JSON-LD de-duplicated (the plan notes the block is duplicated across three layouts).

### WP4 - Titles and meta descriptions (items 4, 7, 9, 16)
- Descriptions are mostly 161-171 chars (just over 160), so truncate smartly at 155-160 at a word boundary in the theme's fallback (`page_description` / `og_description` in `layout/theme.liquid`). 340 pages lack a good summary: 293 are products, so generate a fallback from `product.vendor + title + condition + first sentence of description` when the meta field is blank. Never ship the same description on many pages (duplicate descriptions are an existing finding, Phase 1).
- Titles: 152 are under 30 chars (examples "Accuphase DC-1000 DAC" is 12 chars; "Anthem AV"; "Book Appointment"). Append a suffix in the title logic: product `{{ title }} | {{ vendor }} | Resolution AV` where it makes 30-60, and collections/pages `{{ title }} | Resolution AV NYC`. Cap at 60.
- 4 pages with no description (3 are the `homepage-v2` template, 1 collection `free-shipping-pre-owned-non-speakers`): fill in the admin or noindex the unused `homepage-v2`.
- Content-team items go to the existing copy deck (`docs/copy-deck.csv`).

### WP5 - Headings and H1 (items 8, 14)
- Home has 0 H1: banner headings render as `h2` in `sections/image-banner.liquid` (known finding). Make the first banner's heading an H1, only once per page, with a setting for heading level.
- Project pages: 24 pages have 0 H1 and 62 lack an H1 plus 2 or more H2. Template `page.proj-*.json` sections need a title H1 and section H2s.
- Verify: exactly one H1 per page in a spot check of home, a project page and a collection.

### WP6 - Content (items 6, 10, 11, 12)
Theme can't fix these. Create a list for the content team (the audit's page details have URLs and word counts):
- Blogs: 50-52 posts at about 100 words (many are old, last modified back to 2009). Expand the best ones, and redirect, noindex or merge the rest.
- Pages with 0 words and 0 links (project pages 57th Street etc.): add a short intro, a spec/materials list, and links to relevant collections and the contact page.
- 21 products with under about 160 words (for example accuphase-ad-60 phono board): expand the description.
- Specs as lists/tables: product descriptions should present specs as a bullet list or table (33 pages).
- Freshness (60 pages): theme should output `dateModified`/`article:modified_time` where missing (home has none), and refreshed posts update automatically.

### WP7 - Performance (PageSpeed, mobile)
Sample (mobile): home 74, a McIntosh product 60, WSJ press post 53, Wow Brooklyn post 61. LCP of 5 to 12 s on product pages, up to 8.7 s on home. Local Lighthouse baseline in `docs/baseline/2026-08-19/` showed the same pattern.
- Likely work: LCP image (`fetchpriority="high"`, no lazy-load on the hero, correct `sizes`/`srcset`), defer third-party scripts (Globo, reviews, analytics), preload fonts, stop layout shift.
- Treat as its own phase after WP1-5 (it follows the theme's existing Phase for performance).

## Suggested order and checkpoints
1. Step 0 (diff dev vs live; publish anything already fixed). Re-audit. Baseline numbers.
2. WP2 alt text and WP3 schema (fast, mechanical, high gain).
3. WP4 titles and descriptions.
4. WP1 FAQ system (largest gain, needs content decisions).
5. WP5 headings.
6. WP6 content backlog in parallel (content team).
7. WP7 performance.
After each package: dev theme preview, spot-check 5 URLs, publish, re-run audit, log scores in `docs/seo-work-log.md`.

## Expected result (estimate, not a promise)
WP1-5 touch about 14,000 lost points across about 570 pages (about 25 per page on average at most). Expect average AI score to move from about 77 toward the high 80s and SEO from about 91 toward 95+. The rest needs content.

## Notes for the other chat
- Our scorer is a heuristic. If a fix is correct but the audit disagrees (for example explicit `alt=""` counted as missing), tell us and we'll adjust the scorer at `aws/src/seo/` in `airtable-shopify-ebay` rather than bending the theme.
- Google Search Console sync (real rankings) is deferred until login is available.
