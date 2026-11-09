// Pulls Google Search Console data into the database for every site (or one: --site stereobuyers).
//   add --store-credentials once so the deployed Lambda can read the key from the database.
//   node --env-file=.env.local --import tsx scripts/sync-search-console.ts
import { getPostgresPool } from '../aws/src/db/pool.js';
import { parseGscCredentials, storeGscCredentials, syncSearchConsole } from '../aws/src/seo/searchConsole.js';
import { parseSeoSite, SEO_SITE_IDS } from '../aws/src/seo/sites.js';

const siteArg = process.argv.indexOf('--site');
const sites = siteArg > 0 ? [parseSeoSite(process.argv[siteArg + 1])] : SEO_SITE_IDS;
const pool = getPostgresPool();
try {
  if (process.argv.includes('--store-credentials')) {
    const credentials = parseGscCredentials(process.env.GSC_SERVICE_ACCOUNT_JSON);
    if (!credentials) throw new Error('GSC_SERVICE_ACCOUNT_JSON is missing or invalid');
    await storeGscCredentials(pool, credentials);
    console.log('stored Search Console credentials');
  }
  for (const site of sites) console.log(site, JSON.stringify(await syncSearchConsole(pool, site)));
} finally {
  await pool.end();
}
