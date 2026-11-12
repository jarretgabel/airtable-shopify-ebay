import type { ReactNode } from 'react';

// Simple 24px stroke icons, grouped so related pages share a glyph.
const PATHS = {
  dashboard: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.5-4.5',
  chat: 'M21 12a8 8 0 0 1-11.6 7.1L3 20l1-4.6A8 8 0 1 1 21 12z',
  bug: 'M12 8a4 4 0 0 1 4 4v3a4 4 0 0 1-8 0v-3a4 4 0 0 1 4-4zM9 4l1.5 2M15 4l-1.5 2M4 12h4M16 12h4M5 19l3-2M19 19l-3-2',
  people: 'M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM21 19v-1a4 4 0 0 0-3-3.9M16 4.1a3.5 3.5 0 0 1 0 6.8',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5M9 7h6',
  form: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5',
  inbox: 'M3 13l3-8h12l3 8v6H3zM3 13h5l1 3h6l1-3h5',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  flask: 'M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2.2h12.4a1.5 1.5 0 0 0 1.3-2.2L14 9V3',
  camera: 'M4 8h3l2-3h6l2 3h3v12H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  tag: 'M3 12V3h9l9 9-9 9zM8 8h.01',
  package: 'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10',
  cart: 'M3 4h2l2.5 11h10L20 7H6.5M9 20h.01M17 20h.01',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 9h.01',
  bell: 'M6 9a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 21h4',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  download: 'M12 3v12M7 11l5 5 5-5M4 20h16',
  collapse: 'M15 6l-6 6 6 6M20 4v16',
  expand: 'M9 6l6 6-6 6M4 4v16',
  menu: 'M4 7h16M4 12h16M4 17h16',
  dot: 'M12 12h.01',
} as const;

type IconName = keyof typeof PATHS;

const PAGE_ICONS: Record<string, IconName> = {
  dashboard: 'dashboard',
  sales: 'chart',
  seo: 'search',
  'seo-stereobuyers': 'search',
  'assistant-insights': 'chat',
  issues: 'bug',
  people: 'people',
  'workflow-guide': 'book',
  'workflow-guide-editor': 'book',
  'manual-intake': 'form',
  'create-intake-item': 'form',
  jotform: 'form',
  'jotform-audit': 'form',
  'parking-lot': 'inbox',
  'trash-review': 'trash',
  inventory: 'package',
  'testing-queue': 'flask',
  testing: 'flask',
  'photography-queue': 'camera',
  photos: 'camera',
  listings: 'tag',
  'post-publish': 'package',
  archive: 'inbox',
  shopify: 'cart',
  ebay: 'globe',
  market: 'chart',
  imagelab: 'image',
  notifications: 'bell',
  settings: 'gear',
  users: 'people',
  'group-business': 'chart',
  'group-intake': 'form',
  'group-processing': 'flask',
  'group-selling': 'tag',
  'group-utilities': 'gear',
  export: 'download',
  collapse: 'collapse',
  expand: 'expand',
  menu: 'menu',
};

export function NavIcon({ page, className }: { page: string; className?: string }): ReactNode {
  const name = PAGE_ICONS[page] ?? 'dot';
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
