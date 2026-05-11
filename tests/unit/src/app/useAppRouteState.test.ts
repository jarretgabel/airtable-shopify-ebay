import type { Location } from 'react-router-dom';
import { useAppRouteState } from '@/app/useAppRouteState';

function locationFor(pathname: string, search = ''): Location {
  return {
    pathname,
    search,
    hash: '',
    state: null,
    key: 'test',
    unstable_mask: undefined,
  };
}

describe('useAppRouteState', () => {
  it('maps legacy approval detail routes to listings and decodes id', () => {
    const state = useAppRouteState(locationFor('/ebay/approval/abc%20123'), ['dashboard']);
    expect(state.activeTab).toBe('listings');
    expect(state.listingsRecordId).toBe('abc 123');
  });

  it('maps users detail route and decodes id', () => {
    const state = useAppRouteState(locationFor('/account/users/u%40id'), ['dashboard']);
    expect(state.activeTab).toBe('users');
    expect(state.userRecordId).toBe('u@id');
  });

  it('uses first accessible tab fallback', () => {
    const state = useAppRouteState(locationFor('/unknown'), ['market', 'dashboard']);
    expect(state.firstAccessibleTab).toBe('market');
    expect(state.activeTab).toBe('dashboard');
  });

  it('detects reset-password and token', () => {
    const state = useAppRouteState(locationFor('/reset-password', '?token=123'), ['dashboard']);
    expect(state.isResetPasswordPath).toBe(true);
    expect(state.resetToken).toBe('123');
  });

  it('maps the dedicated incoming-gear route', () => {
    const state = useAppRouteState(locationFor('/incoming-gear'), ['dashboard', 'incoming-gear']);
    expect(state.activeTab).toBe('incoming-gear');
  });

  it('maps incoming gear deep links with record ids', () => {
    const state = useAppRouteState(locationFor('/incoming-gear/rec%20123'), ['dashboard', 'incoming-gear']);
    expect(state.activeTab).toBe('incoming-gear');
    expect(state.incomingGearRecordId).toBe('rec 123');
  });

  it('maps jotform record review deep links with record ids', () => {
    const state = useAppRouteState(locationFor('/parking-lot-1/review-record/rec%20pending'), ['dashboard', 'jotform']);
    expect(state.activeTab).toBe('jotform');
    expect(state.jotformReviewRecordId).toBe('rec pending');
  });

  it('maps testing deep links with record ids', () => {
    const state = useAppRouteState(locationFor('/testing/rec%20456'), ['dashboard', 'testing']);
    expect(state.activeTab).toBe('testing');
    expect(state.testingRecordId).toBe('rec 456');
  });

  it('maps the dedicated photos route', () => {
    const state = useAppRouteState(locationFor('/photos'), ['dashboard', 'photos']);
    expect(state.activeTab).toBe('photos');
  });

  it('maps photos deep links with record ids', () => {
    const state = useAppRouteState(locationFor('/photos/rec%20789'), ['dashboard', 'photos']);
    expect(state.activeTab).toBe('photos');
    expect(state.photosRecordId).toBe('rec 789');
  });

  it('maps the dedicated inventory route', () => {
    const state = useAppRouteState(locationFor('/inventory'), ['dashboard', 'inventory']);
    expect(state.activeTab).toBe('inventory');
  });

  it('maps the inventory record detail route and decodes id', () => {
    const state = useAppRouteState(locationFor('/inventory/rec%20123'), ['dashboard', 'inventory']);
    expect(state.activeTab).toBe('inventory');
    expect(state.inventoryRecordId).toBe('rec 123');
  });

  it('maps the used gear workflow detail route and decodes id', () => {
    const state = useAppRouteState(locationFor('/inventory/workflow/rec%20workflow'), ['dashboard', 'inventory']);
    expect(state.activeTab).toBe('inventory');
    expect(state.usedGearWorkflowRecordId).toBe('rec workflow');
  });

  it('maps the workflow price editor route and decodes id', () => {
    const state = useAppRouteState(locationFor('/inventory/workflow/rec%20workflow/price'), ['dashboard', 'inventory']);
    expect(state.activeTab).toBe('inventory');
    expect(state.workflowPriceEditorRecordId).toBe('rec workflow');
    expect(state.usedGearWorkflowRecordId).toBeNull();
  });

  it('maps trash review record deep links with record ids', () => {
    const state = useAppRouteState(locationFor('/trash-review/review/rec%20trash'), ['dashboard', 'trash-review']);
    expect(state.activeTab).toBe('trash-review');
    expect(state.trashReviewRecordId).toBe('rec trash');
  });

  it('maps Shopify listing detail routes and decodes id', () => {
    const state = useAppRouteState(locationFor('/shopify/products/rec%20shopify'), ['dashboard', 'shopify']);
    expect(state.activeTab).toBe('shopify');
    expect(state.shopifyListingsRecordId).toBe('rec shopify');
  });

  it('maps eBay listing detail routes and decodes id', () => {
    const state = useAppRouteState(locationFor('/ebay/listings/rec%20ebay'), ['dashboard', 'ebay']);
    expect(state.activeTab).toBe('ebay');
    expect(state.ebayListingsRecordId).toBe('rec ebay');
  });
});
