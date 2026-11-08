import { describe, expect, it, vi } from 'vitest';
import { fillSeoValuesOnSave } from '@/services/seoOnSave';

const facts = { Title: 'Accuphase A-300', Brand: 'Accuphase', Condition: 'Used' };
const goodTitle = 'Accuphase A-300 Mono Power Amplifier | Pre-Owned';
const goodDescription = 'Pre-owned Accuphase A-300 Class A mono power amplifier in excellent condition, serviced and ready to ship from Brooklyn.';
const generate = vi.fn(async (kind: string) => (kind === 'seoTitle' ? goodTitle : goodDescription));

describe('fillSeoValuesOnSave', () => {
  it('fills blank SEO fields', async () => {
    expect(await fillSeoValuesOnSave({ ...facts }, generate as never)).toEqual({
      'Shopify Extra SEO Title': goodTitle,
      'Shopify Extra SEO Description': goodDescription,
    });
  });

  it('keeps in-range values and replaces out-of-range ones', async () => {
    const result = await fillSeoValuesOnSave({
      ...facts,
      'Shopify Extra SEO Title': 'Accuphase A-300 Mono Power Amplifier',
      'Shopify Extra SEO Description': 'too short',
    }, generate as never);
    expect(result).toEqual({ 'Shopify Extra SEO Description': goodDescription });
  });

  it('skips listings with too little detail and survives generator failures', async () => {
    expect(await fillSeoValuesOnSave({ Title: 'x' }, generate as never)).toEqual({});
    expect(await fillSeoValuesOnSave({ ...facts }, (async () => { throw new Error('down'); }) as never)).toEqual({});
  });
});
