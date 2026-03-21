const dotenv = (await import('dotenv')).default;
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const { default: axios } = await import('axios');

const domain = process.env.VITE_SHOPIFY_STORE_DOMAIN;
const token = process.env.VITE_SHOPIFY_OAUTH_ACCESS_TOKEN || process.env.VITE_SHOPIFY_ADMIN_API_TOKEN;

const product = {
  title: 'Test Draft - High End Audio Component',
  body_html: '<p>Draft test product created from Airtable sync. Not published to storefront.</p>',
  vendor: 'Resolution Audio',
  product_type: 'Reference Audio Equipment',
  tags: 'test,airtable-sync,draft',
  status: 'draft',
  variants: [
    {
      price: '1999.00',
      sku: 'DRAFT-TEST-001',
      inventory_quantity: 1,
    }
  ],
};

console.log('Creating draft product (not visible to customers)...\n');

const res = await axios.post(
  `https://${domain}/admin/api/2024-04/products.json`,
  { product },
  { headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' } }
);

const p = res.data.product;
console.log('✓ Draft product created!');
console.log(`  ID:      ${p.id}`);
console.log(`  Title:   ${p.title}`);
console.log(`  Status:  ${p.status}  ← not live`);
console.log(`  Price:   $${p.variants[0].price}`);
console.log(`  SKU:     ${p.variants[0].sku}`);
console.log(`  Admin:   https://${domain}/admin/products/${p.id}`);
