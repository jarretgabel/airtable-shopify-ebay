import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EbayPolicySelectGroup } from '@/components/approval/EbayPolicySelectGroup';
import { useEbayShippingPolicyIssueStore } from '@/stores/ebayShippingPolicyIssueStore';
import { getEbayShippingPolicyWeightError } from '@contracts/ebayShippingPolicy';

vi.mock('@/services/app-api/ebay', () => ({
  getEbayBusinessPolicies: vi.fn(async () => ({
    fulfillmentPolicies: [
      { policyId: 'standard', name: 'Standard shipping' },
      { policyId: 'heavy', name: 'Heavy-item shipping' },
    ],
    paymentPolicies: [],
    returnPolicies: [],
  })),
  getEbayRuntimeConfig: vi.fn(async () => ({
    publishSetup: { policyConfig: { fulfillmentPolicyId: 'standard', paymentPolicyId: '', returnPolicyId: '' } },
  })),
}));

const message = 'This shipping policy cannot ship the package at its recorded weight. Choose a compatible shipping policy; keep the actual packed weight unchanged.';

function props() {
  return {
    recordId: 'rec-heavy',
    enabled: true,
    marketplaceId: 'EBAY_US',
    fulfillmentPolicyFieldName: 'eBay Offer Fulfillment Policy ID',
    formValues: { 'eBay Offer Fulfillment Policy ID': 'standard' },
    setFormValue: vi.fn(),
    disabled: false,
    renderFieldLabel: (name: string) => <span>{name}</span>,
    getSelectClassName: () => 'policy-select',
  };
}

describe('shipping policy weight feedback', () => {
  beforeEach(() => useEbayShippingPolicyIssueStore.setState({ issue: null }));

  it('attaches an accessible weight error to the rejected shipping policy only', async () => {
    const parameters = props();
    render(<EbayPolicySelectGroup {...parameters} />);
    const select = await screen.findByRole('combobox');
    await waitFor(() => expect(select).toHaveValue('standard'));
    act(() => useEbayShippingPolicyIssueStore.setState({
      issue: { recordId: parameters.recordId, policyId: 'standard', message },
    }));

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/choose a compatible shipping policy/i);
    expect(alert).toHaveTextContent(/keep the actual packed weight unchanged/i);
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(select).toHaveAttribute('aria-describedby', alert.id);
    fireEvent.change(select, { target: { value: 'heavy' } });
    expect(parameters.setFormValue).toHaveBeenCalledExactlyOnceWith('eBay Offer Fulfillment Policy ID', 'heavy');
  });

  it('hides the rejection for a different policy or record and restores it when returning to the rejected policy', async () => {
    useEbayShippingPolicyIssueStore.setState({ issue: { recordId: 'rec-heavy', policyId: 'standard', message } });
    const parameters = props();
    const { rerender } = render(<EbayPolicySelectGroup {...parameters} />);
    await screen.findByRole('alert');
    rerender(<EbayPolicySelectGroup {...parameters} formValues={{ 'eBay Offer Fulfillment Policy ID': 'heavy' }} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox')).not.toHaveAttribute('aria-invalid', 'true');
    rerender(<EbayPolicySelectGroup {...parameters} recordId="rec-other" />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    rerender(<EbayPolicySelectGroup {...parameters} />);
    expect(screen.getByRole('alert')).toHaveTextContent(message);
  });

  it('attaches default-policy rejection without requiring an explicit saved selection', async () => {
    useEbayShippingPolicyIssueStore.setState({ issue: { recordId: 'rec-heavy', policyId: 'standard', message } });
    render(<EbayPolicySelectGroup {...props()} formValues={{ 'eBay Offer Fulfillment Policy ID': '' }} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByRole('combobox')).toHaveValue('standard');
  });

  it('keeps an unidentified legacy default-policy rejection until an explicit policy is selected', () => {
    useEbayShippingPolicyIssueStore.setState({ issue: { recordId: 'rec-heavy', policyId: '', message } });
    const parameters = props();
    const { rerender } = render(<EbayPolicySelectGroup {...parameters} formValues={{ 'eBay Offer Fulfillment Policy ID': '' }} />);
    expect(screen.getByRole('alert')).toHaveTextContent(message);
    rerender(<EbayPolicySelectGroup {...parameters} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('confirmed eBay weight-limit error classification', () => {
  it.each([
    'Package weight is over the weight limit for service 70 lb. The maximum weight is err:216138|70 lb.',
    'Package weight exceeds the maximum weight for this service.',
    'Shipment weight is over the maximum limit.',
  ])('recognizes %s without inventing a numeric limit', (error) => {
    const result = getEbayShippingPolicyWeightError(error, 'standard');
    expect(result?.policyId).toBe('standard');
    expect(result?.message).toMatch(/keep the actual packed weight unchanged/i);
    expect(result?.message).not.toMatch(/70|err:216138/);
  });

  it('retains the actual policy ID from a server-formatted error rather than a different selected ID', () => {
    const error = getEbayShippingPolicyWeightError('Package weight exceeds the limit.', 'rejected-policy');
    expect(getEbayShippingPolicyWeightError(error?.message ?? '', 'different-policy')?.policyId).toBe('rejected-policy');
  });

  it.each([
    'Invalid category (errorId: 25007)',
    'Invalid Fulfillment policy: no valid shipping service options.',
    'Invalid package weight value.',
    'The maximum weight field is missing.',
  ])('does not misclassify %s', (error) => {
    expect(getEbayShippingPolicyWeightError(error)).toBeNull();
  });
});
