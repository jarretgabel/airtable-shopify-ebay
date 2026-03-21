import airtableService from '../src/services/airtable.js';

(async () => {
  try {
    console.log('Attempting to fetch listings from Airtable...');
    const listings = await airtableService.getRecords('Listings');
    console.log(`✓ Successfully connected to Airtable!`);
    console.log(`✓ Found ${listings.length} listings`);
    
    if (listings.length > 0) {
      console.log('\nFirst listing:');
      console.log(JSON.stringify(listings[0], null, 2));
    }
  } catch (error) {
    console.error('✗ Error connecting to Airtable:', error);
    console.error('Make sure:');
    console.error('1. VITE_AIRTABLE_API_KEY is set in .env.local');
    console.error('2. VITE_AIRTABLE_BASE_ID is set in .env.local');
    console.error('3. The table name "Listings" exists in your Airtable base');
  }
})();
