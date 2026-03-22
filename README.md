# Airtable-Shopify-eBay Sync

## Setup Instructions

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
  - Copy `.env.example` to `.env.local`, then fill in your credentials:
     - `VITE_AIRTABLE_API_KEY`: Your Airtable personal access token
     - `VITE_AIRTABLE_BASE_ID`: Your Airtable base ID

3. Run setup doctor (recommended for onboarding):
```bash
npm run onboard
```
This verifies required env variables and reports optional integrations.

4. Running the app:
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

## Workflow Analytics (Operator Events)

The app now emits operator workflow events (tab views, refresh, exports, and approval actions).

- Local buffer: events are stored in browser localStorage under `workflow_analytics_events`
- Optional endpoint: set `VITE_ANALYTICS_ENDPOINT=https://your-endpoint/events` to receive POST/sendBeacon events
- Kill switch: set `VITE_ANALYTICS_ENABLED=false` to disable analytics

## Performance Notes

Large approval queues use deferred search input and precomputed sort/filter values to reduce render work on heavy screens.
