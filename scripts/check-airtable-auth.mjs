import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const key = process.env.VITE_AIRTABLE_API_KEY;

try {
  const resp = await axios.get('https://api.airtable.com/v0/meta/whoami', {
    headers: { Authorization: `Bearer ${key}` },
  });
  console.log('status:', resp.status);
  console.log(JSON.stringify(resp.data, null, 2));
} catch (e) {
  console.log('status:', e.response?.status);
  console.log('data:', JSON.stringify(e.response?.data, null, 2));
}
