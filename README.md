# Airtable-Shopify-eBay Sync

## Setup Instructions

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
   - Copy `.env.local` and fill in your Airtable credentials:
     - `VITE_AIRTABLE_API_KEY`: Your Airtable personal access token
     - `VITE_AIRTABLE_BASE_ID`: Your Airtable base ID

3. Running the app:
```bash
npm run dev
```

This will start a development server on `http://localhost:3000`

## Getting Your Airtable Credentials

1. **API Key**: Visit [Airtable Account](https://airtable.com/account/tokens) to generate a personal access token
2. **Base ID**: Found in your Airtable base URL: `https://airtable.com/app{BASE_ID}/...`

## Project Structure

- `src/services/airtable.ts` - Airtable API client
- `src/hooks/useListings.ts` - React hook to fetch listings
- `src/types/airtable.ts` - TypeScript types for Airtable records
- `src/App.tsx` - Main application component
