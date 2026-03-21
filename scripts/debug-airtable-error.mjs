import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const key = process.env.VITE_AIRTABLE_API_KEY;
const base = process.env.VITE_AIRTABLE_BASE_ID;

try {
  await axios.get(`https://api.airtable.com/v0/${base}/Listings`, {
    headers: { Authorization: `Bearer ${key}` },
  });
} catch (e) {
  console.log('status:', e.response?.status);
  console.log('data:', JSON.stringify(e.response?.data, null, 2));
}
