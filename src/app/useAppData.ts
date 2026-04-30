import { useMemo } from 'react';
import type { AppPage } from '@/auth/pages';
import { hasNonEmptyFields, TAB_VALUES } from '@/app/appNavigation';
import { getRuntimeFeatureCapabilities } from '@/config/runtimeCapabilities';
import { checkOptionalEnv, requireEnv } from '@/config/runtimeEnv';
import { useApprovalQueueSummary } from '@/hooks/useApprovalQueueSummary';
import { useShopifyApprovalQueueSummary } from '@/hooks/useShopifyApprovalQueueSummary';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { useEbayListings } from '@/hooks/useEbayListings';
import { useHiFiShark } from '@/hooks/useHiFiShark';
import { useJotFormInquiries } from '@/hooks/useJotForm';
import { useListings } from '@/hooks/useListings';
import { useShopifyProducts } from '@/hooks/useShopifyProducts';
import { getAIProvider } from '@/services/equipmentAI';

interface AppDataParams {
  canAccessPage: (page: AppPage) => boolean;
  activeTab: AppPage;
  users: Array<{ role: string }>;
}

export function useAppData({ canAccessPage, activeTab, users }: AppDataParams) {
  const dashboardActive = activeTab === 'dashboard';
  const airtableEnabled = dashboardActive || activeTab === 'inventory';
  const shopifyEnabled = dashboardActive || activeTab === 'shopify';
  const runtimeFeatures = getRuntimeFeatureCapabilities();
  const jotformEnabled = runtimeFeatures.jotform.available && (dashboardActive || activeTab === 'jotform');
  const ebayEnabled = runtimeFeatures.ebay.available && canAccessPage('ebay') && (dashboardActive || activeTab === 'ebay');
  const tableName = requireEnv('VITE_AIRTABLE_TABLE_NAME');
  const viewId = checkOptionalEnv('VITE_AIRTABLE_VIEW_ID');
  const airtable = useListings(tableName, viewId, airtableEnabled);
  const nonEmptyListings = airtable.listings.filter((listing) => hasNonEmptyFields(listing.fields));

  const shopify = useShopifyProducts(shopifyEnabled);
  const market = useHiFiShark();
  const ebay = useEbayListings(ebayEnabled);
  const approval = useApprovalQueueSummary(canAccessPage('approval') && runtimeFeatures.approvalEbay.available);
  const shopifyApproval = useShopifyApprovalQueueSummary(canAccessPage('shopify-approval') && runtimeFeatures.approvalShopify.available);

  const JOTFORM_FORM_ID = runtimeFeatures.jotform.available ? checkOptionalEnv('VITE_JOTFORM_FORM_ID') : '';
  const jotform = useJotFormInquiries(JOTFORM_FORM_ID, 60_000, jotformEnabled);

  const totalNewSubmissions = jotform.submissions.filter((submission) => submission.new === '1').length;
  const visibleTabs = TAB_VALUES.filter((tab) => canAccessPage(tab));
  const aiProvider = getAIProvider().provider;
  const adminCount = useMemo(() => users.filter((user) => user.role === 'admin').length, [users]);
  const ebayPublishedCount = useMemo(() => ebay.offers.filter((offer) => offer.status === 'PUBLISHED').length, [ebay.offers]);
  const ebayDraftCount = useMemo(() => ebay.offers.filter((offer) => offer.status === 'UNPUBLISHED').length, [ebay.offers]);
  const metrics = useDashboardMetrics(nonEmptyListings, shopify.products, jotform.submissions);

  return {
    airtable: {
      nonEmptyListings,
      loading: airtable.loading,
      error: airtable.error,
      refetch: airtable.refetch,
    },
    shopify,
    market,
    ebay: {
      ...ebay,
      publishedCount: ebayPublishedCount,
      draftCount: ebayDraftCount,
    },
    approval,
    shopifyApproval,
    jotform,
    metrics,
    visibleTabs,
    totalNewSubmissions,
    aiProvider,
    adminCount,
    runtimeFeatures,
  };
}