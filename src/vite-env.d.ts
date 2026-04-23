/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AIRTABLE_API_KEY: string;
  readonly VITE_AIRTABLE_BASE_ID: string;
  readonly VITE_AIRTABLE_TABLE_NAME?: string;
  readonly VITE_AIRTABLE_VIEW_ID?: string;
  readonly VITE_AIRTABLE_USERS_TABLE_REF?: string;
  readonly VITE_AIRTABLE_USERS_TABLE_NAME?: string;
  readonly VITE_AIRTABLE_INCOMING_GEAR_FORM_EMBED_URL?: string;
  readonly VITE_AIRTABLE_INCOMING_GEAR_FORM_URL?: string;
  readonly VITE_SHOPIFY_STORE_DOMAIN: string;
  readonly VITE_SHOPIFY_OAUTH_REDIRECT_URI?: string;
  readonly VITE_SHOPIFY_ADMIN_API_TOKEN?: string;
  readonly VITE_SHOPIFY_OAUTH_ACCESS_TOKEN?: string;
  readonly VITE_SHOPIFY_CLIENT_ID?: string;
  readonly VITE_SHOPIFY_CLIENT_SECRET?: string;
  readonly VITE_JOTFORM_API_KEY?: string;
  readonly VITE_JOTFORM_FORM_ID?: string;
  readonly VITE_GOOGLE_GMAIL_ACCESS_TOKEN?: string;
  readonly VITE_GOOGLE_GMAIL_FROM_EMAIL?: string;
  readonly VITE_EBAY_AUTH_HOST?: string;
  readonly VITE_EBAY_OAUTH_SCOPES?: string;
  readonly VITE_EBAY_APP_SCOPE?: string;
  readonly VITE_HIFISHARK_WEB_BASE?: string;
  readonly VITE_ANALYTICS_ENDPOINT?: string;
  readonly VITE_ANALYTICS_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
