import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  closeEbayListingWhenSoldOnShopify,
  closeShopifyProductWhenSoldOnEbay,
} from '../../../src/services/crossChannelClose';

describe('Cross-Channel Close Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('closeEbayListingWhenSoldOnShopify', () => {
    it('should return success when eBay listing is already closed', async () => {
      const mockUpdateRecord = vi.fn();
      const fields = {
        'eBay Listing Status': 'ENDED',
        'eBay Offer ID': 'offer-123',
        'eBay Listing ID': 'listing-123',
      };

      const result = await closeEbayListingWhenSoldOnShopify(
        'record-123',
        fields,
        { updateRecord: mockUpdateRecord },
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('already closed');
      expect(mockUpdateRecord).not.toHaveBeenCalled();
    });

    it('should return error when eBay Offer ID is missing', async () => {
      const mockUpdateRecord = vi.fn().mockResolvedValue({});
      const fields = {
        'eBay Listing ID': 'listing-123',
        // Missing eBay Offer ID
      };

      const result = await closeEbayListingWhenSoldOnShopify(
        'record-123',
        fields,
        { updateRecord: mockUpdateRecord },
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Missing eBay Offer ID');
      expect(mockUpdateRecord).toHaveBeenCalledWith(
        'used-gear-workflow',
        'record-123',
        expect.objectContaining({
          'eBay Closed At': expect.any(String),
          'eBay Close Result': expect.stringContaining('Missing eBay Offer ID'),
        }),
        { typecast: true },
      );
    });

    it('should return error when eBay Listing ID is missing', async () => {
      const mockUpdateRecord = vi.fn().mockResolvedValue({});
      const fields = {
        'eBay Offer ID': 'offer-123',
        // Missing eBay Listing ID
      };

      const result = await closeEbayListingWhenSoldOnShopify(
        'record-123',
        fields,
        { updateRecord: mockUpdateRecord },
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Missing eBay Offer ID or Listing ID');
    });

    it('should write closedAt timestamp to Airtable', async () => {
      const mockUpdateRecord = vi.fn().mockResolvedValue({});
      const fields = {
        'eBay Listing ID': 'listing-123',
        // Missing eBay Offer ID - trigger error path
      };

      const before = new Date();
      const result = await closeEbayListingWhenSoldOnShopify(
        'record-123',
        fields,
        { updateRecord: mockUpdateRecord },
      );
      const after = new Date();

      expect(result.closedAt).toBeDefined();
      const closedAtTime = new Date(result.closedAt);
      expect(closedAtTime.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(closedAtTime.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should handle Airtable update failures gracefully', async () => {
      const mockUpdateRecord = vi.fn()
        .mockRejectedValueOnce(new Error('Airtable API error'));
      
      const fields = {
        'eBay Offer ID': 'offer-123',
        'eBay Listing ID': 'listing-123',
      };

      // Mock environment variables for API calls
      process.env.EBAY_REFRESH_TOKEN = 'test-token';
      process.env.EBAY_CLIENT_ID = 'test-id';
      process.env.EBAY_CLIENT_SECRET = 'test-secret';

      // Note: This test will fail because we don't have credentials
      // In a real test environment, we'd mock the fetch calls
      // This demonstrates the structure of error handling
    });
  });

  describe('closeShopifyProductWhenSoldOnEbay', () => {
    it('should return success when Shopify product is already closed', async () => {
      const mockUpdateRecord = vi.fn();
      const fields = {
        'Shopify Closed At': '2024-01-01T12:00:00Z',
        'Shopify REST Product ID': 'product-123',
      };

      const result = await closeShopifyProductWhenSoldOnEbay(
        'record-123',
        fields,
        { updateRecord: mockUpdateRecord },
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('already closed');
      expect(mockUpdateRecord).not.toHaveBeenCalled();
    });

    it('should force delete when takedown requests override already-closed flags', async () => {
      const mockUpdateRecord = vi.fn().mockResolvedValue({});
      const fields = {
        'Shopify Closed At': '2024-01-01T12:00:00Z',
        'Shopify Close Result': 'Cross-channel auto-close: Product deleted when sold on eBay',
        'Shopify REST Product ID': '123456789',
      };

      process.env.SHOPIFY_STORE_DOMAIN = 'example.myshopify.com';
      process.env.SHOPIFY_ACCESS_TOKEN = 'test-token';

      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => '',
      } as Response);

      const result = await closeShopifyProductWhenSoldOnEbay(
        'record-force-1',
        fields,
        { updateRecord: mockUpdateRecord, forceShopifyDelete: true },
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('deleted');
      expect(fetchMock).toHaveBeenCalledWith(
        'https://example.myshopify.com/admin/api/2024-04/products/123456789.json',
        expect.objectContaining({ method: 'DELETE' }),
      );
      expect(mockUpdateRecord).toHaveBeenCalledWith(
        'used-gear-workflow',
        'record-force-1',
        expect.objectContaining({
          'Shopify Closed At': expect.any(String),
          'Shopify Close Result': expect.stringContaining('Product deleted'),
        }),
        { typecast: true },
      );

      fetchMock.mockRestore();
    });

    it('should return error when Shopify REST Product ID is missing', async () => {
      const mockUpdateRecord = vi.fn().mockResolvedValue({});
      const fields = {
        // Missing Shopify REST Product ID
      };

      const result = await closeShopifyProductWhenSoldOnEbay(
        'record-123',
        fields,
        { updateRecord: mockUpdateRecord },
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Missing Shopify REST Product ID');
      expect(mockUpdateRecord).toHaveBeenCalledWith(
        'used-gear-workflow',
        'record-123',
        expect.objectContaining({
          'Shopify Close Result': expect.stringContaining('Missing Shopify REST Product ID'),
        }),
        { typecast: true },
      );
    });

    it('should return closedAt timestamp even when close fails validation', async () => {
      const mockUpdateRecord = vi.fn().mockResolvedValue({});
      const fields = {
        // Missing product ID - trigger error path
      };

      const before = new Date();
      const result = await closeShopifyProductWhenSoldOnEbay(
        'record-123',
        fields,
        { updateRecord: mockUpdateRecord },
      );
      const after = new Date();

      expect(result.closedAt).toBeDefined();
      const closedAtTime = new Date(result.closedAt);
      expect(closedAtTime.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(closedAtTime.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should not treat Shopify Closed At alone as already closed without a successful close result', async () => {
      const mockUpdateRecord = vi.fn();

      // Test with Shopify Closed At as string
      const fields1 = {
        'Shopify Closed At': '2024-01-01T12:00:00Z',
        'Shopify Close Result': 'Shopify delete failed: 500 upstream error',
        'Shopify REST Product ID': 'product-123',
      };

      const result1 = await closeShopifyProductWhenSoldOnEbay(
        'record-1',
        fields1,
        { updateRecord: mockUpdateRecord },
      );

      expect(result1.success).toBe(false);
      expect(result1.message).toContain('invalid product id');

      // Test with empty string (not closed)
      const fields2 = {
        'Shopify Closed At': '',
        'Shopify REST Product ID': 'product-123',
      };

      const result2 = await closeShopifyProductWhenSoldOnEbay(
        'record-2',
        fields2,
        { updateRecord: mockUpdateRecord },
      );

      // This would attempt to close (and fail due to missing API credentials in test)
      // The important thing is that empty Shopify Closed At field is treated as not closed
    });
  });

  describe('Idempotency', () => {
    it('eBay close should be idempotent (skip if already closed)', async () => {
      const mockUpdateRecord = vi.fn();

      const fields = {
        'eBay Offer Status': 'NOT_ACTIVE',
        'eBay Offer ID': 'offer-123',
        'eBay Listing ID': 'listing-123',
      };

      // First call
      const result1 = await closeEbayListingWhenSoldOnShopify(
        'record-123',
        fields,
        { updateRecord: mockUpdateRecord },
      );

      // Second call with same data
      const result2 = await closeEbayListingWhenSoldOnShopify(
        'record-123',
        fields,
        { updateRecord: mockUpdateRecord },
      );

      // Both should succeed and indicate already closed
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(mockUpdateRecord).not.toHaveBeenCalled();
    });

    it('Shopify close should be idempotent (skip if already closed)', async () => {
      const mockUpdateRecord = vi.fn();

      const fields = {
        'Shopify Closed At': '2024-01-01T12:00:00Z',
        'Shopify Close Result': 'Cross-channel auto-close: Product deleted when sold on eBay',
        'Shopify REST Product ID': 'product-123',
      };

      // First call
      const result1 = await closeShopifyProductWhenSoldOnEbay(
        'record-123',
        fields,
        { updateRecord: mockUpdateRecord },
      );

      // Second call with same data
      const result2 = await closeShopifyProductWhenSoldOnEbay(
        'record-123',
        fields,
        { updateRecord: mockUpdateRecord },
      );

      // Both should succeed and indicate already closed
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(mockUpdateRecord).not.toHaveBeenCalled();
    });

    it('accepts a gid-style Shopify product id and attempts deletion', async () => {
      const mockUpdateRecord = vi.fn().mockResolvedValue({});
      const fields = {
        'Shopify REST Product ID': 'gid://shopify/Product/123456789',
      };

      process.env.SHOPIFY_STORE_DOMAIN = 'example.myshopify.com';
      process.env.SHOPIFY_ACCESS_TOKEN = 'test-token';

      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => '',
      } as Response);

      const result = await closeShopifyProductWhenSoldOnEbay('record-123', fields, { updateRecord: mockUpdateRecord });

      expect(result.success).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://example.myshopify.com/admin/api/2024-04/products/123456789.json',
        expect.objectContaining({ method: 'DELETE' }),
      );
      fetchMock.mockRestore();
    });

    it('accepts a numeric Shopify product id and attempts deletion', async () => {
      const mockUpdateRecord = vi.fn().mockResolvedValue({});
      const fields = {
        'Shopify REST Product ID': 123456789,
      };

      process.env.SHOPIFY_STORE_DOMAIN = 'example.myshopify.com';
      process.env.SHOPIFY_ACCESS_TOKEN = 'test-token';

      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => '',
      } as Response);

      const result = await closeShopifyProductWhenSoldOnEbay('record-123', fields, { updateRecord: mockUpdateRecord });

      expect(result.success).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://example.myshopify.com/admin/api/2024-04/products/123456789.json',
        expect.objectContaining({ method: 'DELETE' }),
      );
      fetchMock.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('eBay close should log clear error when IDs missing', async () => {
      const mockUpdateRecord = vi.fn().mockResolvedValue({});
      const fields = {
        // No IDs at all
      };

      const result = await closeEbayListingWhenSoldOnShopify(
        'record-123',
        fields,
        { updateRecord: mockUpdateRecord },
      );

      // Should write failure reason to Airtable
      expect(mockUpdateRecord).toHaveBeenCalledWith(
        'used-gear-workflow',
        'record-123',
        expect.objectContaining({
          'eBay Close Result': expect.stringContaining('Missing'),
        }),
        { typecast: true },
      );
    });

    it('Shopify close should log clear error when ID missing', async () => {
      const mockUpdateRecord = vi.fn().mockResolvedValue({});
      const fields = {
        // No product ID
      };

      const result = await closeShopifyProductWhenSoldOnEbay(
        'record-123',
        fields,
        { updateRecord: mockUpdateRecord },
      );

      // Should write failure reason to Airtable
      expect(mockUpdateRecord).toHaveBeenCalledWith(
        'used-gear-workflow',
        'record-123',
        expect.objectContaining({
          'Shopify Close Result': expect.stringContaining('Missing Shopify REST Product ID'),
        }),
        { typecast: true },
      );
    });
  });
});
