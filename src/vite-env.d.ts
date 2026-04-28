/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AIRTABLE_TABLE_NAME?: string;
  readonly VITE_AIRTABLE_VIEW_ID?: string;
  readonly VITE_AI_PROVIDER?: 'github' | 'openai' | 'none';
  readonly VITE_AIRTABLE_USERS_TABLE_REF?: string;
  readonly VITE_AIRTABLE_USERS_TABLE_NAME?: string;
  readonly VITE_AIRTABLE_APPROVAL_TABLE_REF?: string;
  readonly VITE_AIRTABLE_APPROVAL_TABLE_NAME?: string;
  readonly VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_REF?: string;
  readonly VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_NAME?: string;
  readonly VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_REF?: string;
  readonly VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_NAME?: string;
  readonly VITE_APP_API_BASE_URL?: string;
  readonly VITE_SHOPIFY_STORE_DOMAIN: string;
  readonly VITE_JOTFORM_FORM_ID?: string;
  readonly VITE_EBAY_AUTH_HOST?: string;
  readonly VITE_EBAY_OAUTH_SCOPES?: string;
  readonly VITE_EBAY_APP_SCOPE?: string;
  readonly VITE_ANALYTICS_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
