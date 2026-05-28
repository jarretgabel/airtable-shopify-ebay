import { buildEbaySnapshotFromAirtable } from '@/services/ebaySnapshotFromAirtable';

describe('buildEbaySnapshotFromAirtable', () => {
  it('builds Airtable-backed eBay snapshot entries and published listing cards', () => {
    const snapshot = buildEbaySnapshotFromAirtable([
      {
        id: 'recEbay1',
        createdTime: '2026-05-08T00:00:00.000Z',
        fields: {
          SKU: 'EBAY-SHEET-1',
          'Workflow Status': 'Approved for Publish',
          'eBay Inventory SKU': 'EBAY-SHEET-1',
          'eBay Inventory Product Title': 'Sheet-backed eBay Listing',
          'eBay Inventory Product Description': '<p>Sheet snapshot HTML</p>',
          'eBay Inventory Product Brand': 'McIntosh',
          'eBay Offer Marketplace ID': 'EBAY_US',
          'eBay Offer Format': 'FIXED_PRICE',
          'eBay Offer Category ID': '3276',
          'eBay Offer Price Value': '2999.00',
          'eBay Offer Price Currency': 'USD',
          'eBay Listing ID': '1234567890',
          'eBay Offer ID': 'offer-123',
          'eBay Offer Status': 'Published',
        },
      },
    ]);

    expect(snapshot.total).toBe(1);
    expect(snapshot.items[0]).toMatchObject({
      snapshotId: 'recEbay1',
      sourceRecordId: 'recEbay1',
      sku: 'EBAY-SHEET-1',
      product: {
        title: 'Sheet-backed eBay Listing',
      },
    });
    expect(snapshot.offers[0]).toMatchObject({
      snapshotId: 'recEbay1',
      status: 'PUBLISHED',
      listingId: '1234567890',
      offerId: 'offer-123',
      pricingSummary: {
        price: {
          value: '2999.00',
          currency: 'USD',
        },
      },
    });
    expect(snapshot.recentListings).toHaveLength(1);
  });

  it('starts Airtable-backed snapshot visibility at awaiting pre-listing review', () => {
    const snapshot = buildEbaySnapshotFromAirtable([
      {
        id: 'recPending1',
        createdTime: '2026-05-08T00:00:00.000Z',
        fields: {
          SKU: 'PENDING-SKU',
          'Workflow Status': 'Awaiting Pre-Listing Review',
          'eBay Inventory SKU': 'PENDING-SKU',
          'eBay Inventory Product Title': 'Should surface',
          'eBay Offer Price Value': '1999.00',
          'eBay Offer Status': 'Published',
        },
      },
      {
        id: 'recReady1',
        createdTime: '2026-05-08T00:00:00.000Z',
        fields: {
          SKU: 'READY-SKU',
          'Workflow Status': 'Testing In Progress',
          'eBay Inventory SKU': 'READY-SKU',
          'eBay Inventory Product Title': 'Should not surface',
          'eBay Offer Price Value': '2499.00',
          'eBay Offer Status': 'Published',
        },
      },
    ]);

    expect(snapshot.total).toBe(1);
    expect(snapshot.items.map((item) => item.sku)).toEqual(['PENDING-SKU']);
  });
});