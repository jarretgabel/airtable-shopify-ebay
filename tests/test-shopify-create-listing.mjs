import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Load .env.local then .env
const dotenv = (await import('dotenv')).default;
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const domain = process.env.VITE_SHOPIFY_STORE_DOMAIN;
const token = process.env.VITE_SHOPIFY_ADMIN_API_TOKEN;
const oauthToken = process.env.VITE_SHOPIFY_OAUTH_ACCESS_TOKEN;
const accessToken = oauthToken || token;

if (!domain || !accessToken) {
  console.error('✗ Missing credentials');
  process.exit(1);
}

const { default: axios } = await import('axios');

try {
  console.log('\n📦 Test: Create a sample product listing\n');

  // Create a sample product
  const product = {
    title: 'Test Product - High End Audio',
    body_html: '<p>This is a test product from Airtable sync</p>',
    vendor: 'Resolution Audio',
    product_type: 'Reference Audio Equipment',
    tags: 'test,airtable-sync',
    variants: [
      {
        price: '2499.00',
        sku: 'TEST-HEA-001',
        inventory_quantity: 1,
      }
    ],
  };

  console.log('Creating product with these details:');
  console.log(JSON.stringify(product, null, 2));

  const response = await axios.post(
    `https://${domain}/admin/api/2024-04/products.json`,
    { product },
    {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      }
    }
  );

  const created = response.data.product;
  console.log(`\n✓ Product created successfully!`);
  console.log(`  Product ID:   ${created.id}`);
  console.log(`  Title:        ${created.title}`);
  console.log(`  Status:       ${created.status}`);
  console.log(`  Created At:   ${created.created_at}`);
  console.log(`  Store URL:    https://${domain}/admin/products/${created.id}`);

  if (created.variants && created.variants[0]) {
    console.log(`\n  Variant Details:`);
    console.log(`    Variant ID: ${created.variants[0].id}`);
    console.log(`    Price:      $${created.variants[0].price}`);
    console.log(`    SKU:        ${created.variants[0].sku}`);
  }

} catch (err) {
  const status = err.response?.status;
  const data = err.response?.data;
  console.error(`\n✗ Failed to create product (HTTP ${status ?? 'N/A'})`);
  console.error(JSON.stringify(data ?? { message: err.message }, null, 2));
  process.exit(1);
}
