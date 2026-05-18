import { fireEvent, render, screen } from '@testing-library/react';
import { within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { WorkflowListingImageSelector } from '@/components/approval/WorkflowListingImageSelector';

function SelectorHarness() {
  const [selectedUrls, setSelectedUrls] = useState([
    'https://cdn.example.com/image-a.jpg',
    'https://cdn.example.com/image-b.jpg',
  ]);

  return (
    <WorkflowListingImageSelector
      attachments={[
        { id: 'att-1', url: 'https://cdn.example.com/image-a.jpg', filename: 'image-a.jpg' },
        { id: 'att-2', url: 'https://cdn.example.com/image-b.jpg', filename: 'image-b.jpg' },
        { id: 'att-3', url: 'https://cdn.example.com/image-c.jpg', filename: 'image-c.jpg' },
      ]}
      selectedUrls={selectedUrls}
      imageAltByUrl={{
        'https://cdn.example.com/image-a.jpg': 'Front view',
        'https://cdn.example.com/image-b.jpg': 'Rear view',
        'https://cdn.example.com/image-c.jpg': 'Detail view',
      }}
      onSelectionChange={setSelectedUrls}
    />
  );
}

describe('WorkflowListingImageSelector', () => {
  it('reorders selected images with the move controls', () => {
    render(<SelectorHarness />);

    const selectedCardsBefore = screen.getAllByTestId('selected-listing-image-card');
    expect(selectedCardsBefore[0]).toHaveTextContent('image-a.jpg');
    expect(selectedCardsBefore[1]).toHaveTextContent('image-b.jpg');

    fireEvent.click(screen.getAllByRole('button', { name: 'Move image later' })[0]);

    const selectedCardsAfter = screen.getAllByTestId('selected-listing-image-card');
    expect(selectedCardsAfter[0]).toHaveTextContent('image-b.jpg');
    expect(selectedCardsAfter[1]).toHaveTextContent('image-a.jpg');
  });

  it('adds available workflow uploads to the selected section', () => {
    render(<SelectorHarness />);

    const availableCardsBefore = screen.getAllByTestId('available-listing-image-card');
    expect(availableCardsBefore).toHaveLength(1);
    expect(availableCardsBefore[0]).toHaveTextContent('image-c.jpg');

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[2]);

    const selectedCardsAfter = screen.getAllByTestId('selected-listing-image-card');
    expect(selectedCardsAfter).toHaveLength(3);
    expect(selectedCardsAfter[2]).toHaveTextContent('image-c.jpg');
  });

  it('shows image alt text under the filename', () => {
    render(<SelectorHarness />);

    const selectedCards = screen.getAllByTestId('selected-listing-image-card');
    expect(selectedCards[0]).toHaveTextContent('Front view');
    expect(selectedCards[1]).toHaveTextContent('Rear view');
  });

  it('opens an expanded preview when a thumbnail is clicked', () => {
    render(<SelectorHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Expand image-a.jpg' }));

    const previewDialog = screen.getByRole('dialog', { name: 'Expanded listing image preview' });
    expect(previewDialog).toBeInTheDocument();
    expect(within(previewDialog).getByRole('img', { name: 'image-a.jpg' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByRole('dialog', { name: 'Expanded listing image preview' })).not.toBeInTheDocument();
  });
});