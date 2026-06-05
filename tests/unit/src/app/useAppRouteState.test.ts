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
  it('maps listings detail routes and decodes id', () => {
    const state = useAppRouteState(locationFor('/listings/abc%20123'), ['dashboard']);
    expect(state.activeTab).toBe('listings');
    expect(state.listingsRecordId).toBe('abc 123');
  });

  it('maps sold-ready listings routes and decodes id', () => {
    const state = useAppRouteState(locationFor('/sold-ready/rec%20sold'), ['dashboard']);
    expect(state.activeTab).toBe('post-publish');
    expect(state.soldReadyListingsRecordId).toBe('rec sold');
    expect(state.listingsRecordId).toBeNull();
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

  it('maps the dedicated manual-intake route', () => {
    const state = useAppRouteState(locationFor('/manual-intake'), ['dashboard', 'manual-intake']);
    expect(state.activeTab).toBe('manual-intake');
  });

  it('maps the dedicated manual-intake route without treating it as an inventory record id', () => {
    const state = useAppRouteState(locationFor('/manual-intake'), ['dashboard', 'manual-intake']);
    expect(state.activeTab).toBe('manual-intake');
    expect(state.manualIntakeMode).toBe(true);
    expect(state.inventoryRecordId).toBeNull();
  });

  it('maps the dedicated create-intake-item route', () => {
    const state = useAppRouteState(locationFor('/create-intake-item'), ['dashboard', 'create-intake-item']);
    expect(state.activeTab).toBe('create-intake-item');
    expect(state.manualIntakeMode).toBe(true);
  });

  it('maps the workflow guide route', () => {
    const state = useAppRouteState(locationFor('/workflow-guide'), ['dashboard', 'workflow-guide']);
    expect(state.activeTab).toBe('workflow-guide');
  });

  it('maps the workflow guide editor route', () => {
    const state = useAppRouteState(locationFor('/workflow-guide/edit'), ['dashboard', 'workflow-guide', 'workflow-guide-editor']);
    expect(state.activeTab).toBe('workflow-guide-editor');
  });

  it('maps the post-publish route', () => {
    const state = useAppRouteState(locationFor('/post-publish'), ['dashboard', 'post-publish']);
    expect(state.activeTab).toBe('post-publish');
  });

  it('maps the archive route', () => {
    const state = useAppRouteState(locationFor('/completed-shipments'), ['dashboard', 'archive']);
    expect(state.activeTab).toBe('archive');
  });

  it('maps completed shipment record routes and decodes id', () => {
    const state = useAppRouteState(locationFor('/completed-shipments/rec%20ship'), ['dashboard', 'archive']);
    expect(state.activeTab).toBe('archive');
    expect(state.shippedListingsRecordId).toBe('rec ship');
  });

  it('maps manual-intake deep links with record ids', () => {
    const state = useAppRouteState(locationFor('/manual-intake/rec%20123'), ['dashboard', 'manual-intake']);
    expect(state.activeTab).toBe('manual-intake');
    expect(state.manualIntakeRecordId).toBe('rec 123');
  });

  it('maps jotform deep links with record ids', () => {
    const state = useAppRouteState(locationFor('/jotform/rec%20jf-123'), ['dashboard', 'jotform']);
    expect(state.activeTab).toBe('jotform');
    expect(state.jotformDirectoryRecordId).toBe('rec jf-123');
  });

  it('maps the dedicated jotform audit route', () => {
    const state = useAppRouteState(locationFor('/jotform-audit'), ['dashboard', 'jotform-audit']);
    expect(state.activeTab).toBe('jotform-audit');
  });

  it('maps jotform record review deep links with record ids', () => {
    const state = useAppRouteState(locationFor('/parking-lot/rec%20pending'), ['dashboard', 'parking-lot']);
    expect(state.activeTab).toBe('parking-lot');
    expect(state.jotformReviewRecordId).toBe('rec pending');
  });

  it('maps Parking Lot arrival-stage group routes and decodes id', () => {
    const state = useAppRouteState(locationFor('/parking-lot/arrival/group/pickup%20set'), ['dashboard', 'parking-lot']);
    expect(state.activeTab).toBe('parking-lot');
    expect(state.parkingLotArrivalGroupId).toBe('pickup set');
  });

  it('maps Parking Lot arrival-stage record routes and decodes id', () => {
    const state = useAppRouteState(locationFor('/parking-lot/arrival/rec%20lot-two'), ['dashboard', 'parking-lot']);
    expect(state.activeTab).toBe('parking-lot');
    expect(state.parkingLotArrivalRecordId).toBe('rec lot-two');
  });

  it('maps testing deep links with record ids', () => {
    const state = useAppRouteState(locationFor('/testing/rec%20456'), ['dashboard', 'testing']);
    expect(state.activeTab).toBe('testing');
    expect(state.testingRecordId).toBe('rec 456');
  });

  it('maps the dedicated testing route to the testing queue', () => {
    const state = useAppRouteState(locationFor('/testing'), ['dashboard', 'testing-queue']);
    expect(state.activeTab).toBe('testing-queue');
  });

  it('maps the dedicated photography route', () => {
    const state = useAppRouteState(locationFor('/photography'), ['dashboard', 'photography-queue']);
    expect(state.activeTab).toBe('photography-queue');
  });

  it('maps photography deep links with record ids', () => {
    const state = useAppRouteState(locationFor('/photography/rec%20789'), ['dashboard', 'photos']);
    expect(state.activeTab).toBe('photos');
    expect(state.photosRecordId).toBe('rec 789');
  });

  it('maps the dedicated inventory route', () => {
    const state = useAppRouteState(locationFor('/workflow-hub'), ['dashboard', 'inventory']);
    expect(state.activeTab).toBe('inventory');
  });

  it('maps the inventory record detail route and decodes id', () => {
    const state = useAppRouteState(locationFor('/workflow-hub/rec%20123'), ['dashboard', 'inventory']);
    expect(state.activeTab).toBe('inventory');
    expect(state.inventoryRecordId).toBe('rec 123');
  });

  it('maps the inventory price editor route and decodes id', () => {
    const state = useAppRouteState(locationFor('/workflow-hub/price/rec%20workflow'), ['dashboard', 'inventory']);
    expect(state.activeTab).toBe('inventory');
    expect(state.inventoryPriceEditorRecordId).toBe('rec workflow');
    expect(state.inventoryRecordId).toBeNull();
  });

  it('maps trash review record deep links with record ids', () => {
    const state = useAppRouteState(locationFor('/trash-review/review/rec%20trash'), ['dashboard', 'trash-review']);
    expect(state.activeTab).toBe('trash-review');
    expect(state.trashReviewRecordId).toBe('rec trash');
  });

  it('maps trash review group deep links with group ids', () => {
    const state = useAppRouteState(locationFor('/trash-review/group/trash%20set'), ['dashboard', 'trash-review']);
    expect(state.activeTab).toBe('trash-review');
    expect(state.trashReviewGroupId).toBe('trash set');
  });

  it('maps Shopify listing detail routes and decodes id', () => {
    const state = useAppRouteState(locationFor('/shopify/rec%20shopify'), ['dashboard', 'shopify']);
    expect(state.activeTab).toBe('shopify');
    expect(state.shopifyListingsRecordId).toBe('rec shopify');
  });

  it('maps eBay listing detail routes and decodes id', () => {
    const state = useAppRouteState(locationFor('/ebay/rec%20ebay'), ['dashboard', 'ebay']);
    expect(state.activeTab).toBe('ebay');
    expect(state.ebayListingsRecordId).toBe('rec ebay');
  });
});
