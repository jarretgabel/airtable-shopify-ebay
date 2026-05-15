import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InfoHint } from '@/components/app/InfoHint';

describe('InfoHint', () => {
  it('uses the custom tooltip without a native title tooltip', () => {
    render(<InfoHint text="Review queue guidance" label="More about this queue" />);

    const button = screen.getByRole('button', { name: 'More about this queue' });
    const tooltip = screen.getByRole('tooltip');

    expect(button).not.toHaveAttribute('title');
    expect(button).toHaveAttribute('aria-describedby', tooltip.id);
    expect(tooltip).toHaveTextContent('Review queue guidance');
  });
});