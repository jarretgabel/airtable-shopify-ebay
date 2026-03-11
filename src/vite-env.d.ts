/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AIRTABLE_API_KEY: string;
  readonly VITE_AIRTABLE_BASE_ID: string;
  readonly VITE_AIRTABLE_TABLE_NAME?: string;
  readonly VITE_AIRTABLE_VIEW_ID?: string;
  readonly VITE_SHOPIFY_STORE_DOMAIN: string;
  readonly VITE_SHOPIFY_ADMIN_API_TOKEN?: string;
  readonly VITE_SHOPIFY_OAUTH_ACCESS_TOKEN?: string;
  readonly VITE_SHOPIFY_CLIENT_ID?: string;
  readonly VITE_SHOPIFY_CLIENT_SECRET?: string;
  readonly VITE_JOTFORM_API_KEY?: string;
  readonly VITE_JOTFORM_FORM_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
