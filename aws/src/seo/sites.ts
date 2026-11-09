import type { PageType } from './htmlSignals.js';
import { classifyUrl } from './htmlSignals.js';

export const SEO_SITE_IDS = ['resolutionav', 'stereobuyers'] as const;
export type SeoSiteId = (typeof SEO_SITE_IDS)[number];
export const DEFAULT_SEO_SITE: SeoSiteId = 'resolutionav';

export interface SeoSite {
  id: SeoSiteId;
  label: string;
  url: string;
  /** App page that gates access to this site's dashboard. */
  page: 'seo' | 'seo-stereobuyers';
  domain: string;
  brandPattern: RegExp;
  brandName: string;
  citationQuestions: string[];
  classify: (url: string) => PageType;
}

const RESOLUTION_QUESTIONS = [
  'Where can I buy pre-owned high-end audio equipment in New York City?',
  'What are the best places to buy used McIntosh amplifiers?',
  'Is there a trusted dealer for vintage tube amplifiers in NYC?',
  'Where can I sell my used hi-fi equipment in New York?',
  'Where can I buy used turntables from a reputable dealer?',
  'Which dealers sell pre-owned Bowers & Wilkins speakers?',
  'Who does hi-fi equipment repair and servicing in New York City?',
  'Where can I find used high-end headphones and DACs?',
  'What is Resolution AV in New York?',
];

const STEREOBUYERS_QUESTIONS = [
  'Who buys used high-end stereo equipment for cash?',
  'Where can I sell my vintage McIntosh amplifier?',
  'Who buys used Audio Research and Krell amplifiers?',
  'What is the best way to sell my used hi-fi equipment?',
  'Who will buy my vintage tube amplifiers and receivers?',
  'Where can I sell vintage JBL, Altec or Klipsch speakers?',
  'Who buys used turntables and high-end audio components in New York?',
  'Is there a trusted buyer for estate and collection stereo equipment?',
  'What is Stereobuyers?',
];

/** Stereobuyers is not a Shopify store: its equipment pages live under one folder. */
function classifyStereobuyers(url: string): PageType {
  let path = '/';
  try {
    path = new URL(url).pathname;
  } catch {
    return 'other';
  }
  if (path === '/' || path === '') return 'home';
  if (/^\/stereo-equipment-and-components-we-buy\/.+/i.test(path)) return 'equipment';
  return 'page';
}

export const SEO_SITES: Record<SeoSiteId, SeoSite> = {
  resolutionav: {
    id: 'resolutionav',
    label: 'Resolution AV',
    url: 'https://resolutionavnyc.com',
    page: 'seo',
    domain: 'resolutionavnyc.com',
    brandPattern: /resolution\s*a\.?v\b|resolutionavnyc/i,
    brandName: 'Resolution AV',
    citationQuestions: RESOLUTION_QUESTIONS,
    classify: classifyUrl,
  },
  stereobuyers: {
    id: 'stereobuyers',
    label: 'Stereobuyers',
    url: 'https://stereobuyers.com',
    page: 'seo-stereobuyers',
    domain: 'stereobuyers.com',
    brandPattern: /stereo\s*buyers/i,
    brandName: 'Stereobuyers',
    citationQuestions: STEREOBUYERS_QUESTIONS,
    classify: classifyStereobuyers,
  },
};

export function parseSeoSite(value: unknown): SeoSiteId {
  return SEO_SITE_IDS.find((id) => id === value) ?? DEFAULT_SEO_SITE;
}

/** The crawled URL; SEO_SITE_URL still overrides the Resolution AV site. */
export function seoSiteUrl(id: SeoSiteId): string {
  return (id === 'resolutionav' ? process.env.SEO_SITE_URL?.trim() : '') || SEO_SITES[id].url;
}
