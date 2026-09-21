import { fireEvent, render, screen } from '@testing-library/react';
import { within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
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

  it('allows selecting available uploads that differ by query-string identifiers', () => {
    function QueryIdHarness() {
      const [selectedUrls, setSelectedUrls] = useState([
        'https://lh3.googleusercontent.com/render?id=file-1&sz=w1600',
      ]);

      return (
        <WorkflowListingImageSelector
          attachments={[
            { id: 'att-1', url: 'https://lh3.googleusercontent.com/render?id=file-1&sz=w1600', filename: 'image-1-processed.jpg' },
            { id: 'att-2', url: 'https://lh3.googleusercontent.com/render?id=file-2&sz=w1600', filename: 'image-2-processed.jpg' },
          ]}
          selectedUrls={selectedUrls}
          onSelectionChange={setSelectedUrls}
        />
      );
    }

    render(<QueryIdHarness />);

    const availableCardsBefore = screen.getAllByTestId('available-listing-image-card');
    expect(availableCardsBefore).toHaveLength(1);
    expect(availableCardsBefore[0]).toHaveTextContent('image-2-processed.jpg');

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);

    const selectedCardsAfter = screen.getAllByTestId('selected-listing-image-card');
    expect(selectedCardsAfter).toHaveLength(2);
    expect(selectedCardsAfter[1]).toHaveTextContent('image-2-processed.jpg');
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

  it('does not show URL variants of selected images in available uploads', () => {
    const onSelectionChange = vi.fn();

    render(
      <WorkflowListingImageSelector
        attachments={[
          {
            id: 'att-photo-1',
            url: 'https://drive.google.com/uc?export=view&id=file-photo-1',
            filename: 'photo-1-processed.jpg',
          },
          {
            id: 'att-photo-1-variant',
            url: 'https://drive.google.com/thumbnail?id=file-photo-1&sz=w1600',
            filename: 'photo-1-processed.jpg',
          },
          {
            id: 'att-testing-1',
            url: 'https://drive.google.com/uc?export=view&id=file-testing-1',
            filename: 'testing-1-processed.jpg',
          },
        ]}
        selectedUrls={['https://drive.google.com/uc?export=view&id=file-photo-1']}
        onSelectionChange={onSelectionChange}
      />,
    );

    const selectedCards = screen.getAllByTestId('selected-listing-image-card');
    expect(selectedCards).toHaveLength(1);
    expect(selectedCards[0]).toHaveTextContent('photo-1-processed.jpg');

    const availableCards = screen.getAllByTestId('available-listing-image-card');
    expect(availableCards).toHaveLength(1);
    expect(availableCards[0]).toHaveTextContent('testing-1-processed.jpg');
  });

  it('hides same-filename URL variants from available uploads', () => {
    render(
      <WorkflowListingImageSelector
        attachments={[
          {
            id: 'att-photo-1-primary',
            url: 'https://images.example.com/proxy/abc123?asset=photo1',
            filename: 'photos--photos--rec-example-photos-1-processed.jpg',
          },
          {
            id: 'att-photo-1-variant',
            url: 'https://cdn.example.com/render/xyz789?variant=thumb',
            filename: 'photos--photos--rec-example-photos-1-processed.jpg',
          },
          {
            id: 'att-testing-1',
            url: 'https://cdn.example.com/testing-1.jpg',
            filename: 'testing--testing--rec-example-testing-1-processed.jpg',
          },
        ]}
        selectedUrls={['https://images.example.com/proxy/abc123?asset=photo1']}
        onSelectionChange={() => {}}
      />,
    );

    const selectedCards = screen.getAllByTestId('selected-listing-image-card');
    expect(selectedCards).toHaveLength(1);
    expect(selectedCards[0]).toHaveTextContent('photos--photos--rec-example-photos-1-processed.jpg');

    const availableCards = screen.getAllByTestId('available-listing-image-card');
    expect(availableCards).toHaveLength(1);
    expect(availableCards[0]).toHaveTextContent('testing--testing--rec-example-testing-1-processed.jpg');
  });

  it('dedupes filename variants that differ only by punctuation', () => {
    render(
      <WorkflowListingImageSelector
        attachments={[
          {
            id: 'att-photo-1-a',
            url: 'https://cdn.example.com/images/photos--rec-example-photos-1-processed.jpg?token=abc',
            filename: 'photos--rec-example-photos-1-processed.jpg',
          },
          {
            id: 'att-photo-1-b',
            url: 'https://cdn.example.com/images/photos__rec_example_photos_1_processed.jpg?token=xyz',
            filename: 'photos__rec_example_photos_1_processed.jpg',
          },
          {
            id: 'att-testing-1',
            url: 'https://cdn.example.com/images/testing-1-processed.jpg',
            filename: 'testing-1-processed.jpg',
          },
        ]}
        selectedUrls={['https://cdn.example.com/images/photos--rec-example-photos-1-processed.jpg?token=abc']}
        onSelectionChange={() => {}}
      />,
    );

    const selectedCards = screen.getAllByTestId('selected-listing-image-card');
    expect(selectedCards).toHaveLength(1);
    expect(selectedCards[0]).toHaveTextContent('photos--rec-example-photos-1-processed.jpg');

    const availableCards = screen.getAllByTestId('available-listing-image-card');
    expect(availableCards).toHaveLength(1);
    expect(availableCards[0]).toHaveTextContent('testing-1-processed.jpg');
  });

  it('does not duplicate available uploads after deselecting a selected URL variant', () => {
    function DeselectVariantHarness() {
      const [selectedUrls, setSelectedUrls] = useState([
        'https://drive.google.com/uc?export=view&id=file-photo-1',
      ]);

      return (
        <WorkflowListingImageSelector
          attachments={[
            {
              id: 'att-photo-1-drive',
              url: 'https://drive.google.com/uc?export=view&id=file-photo-1',
              filename: 'b-w-805-woofer-detail-processed.jpg',
            },
            {
              id: 'att-photo-1-proxy',
              url: 'https://lh3.googleusercontent.com/proxy/example-rendered-photo-1',
              filename: 'b-w-805-woofer-detail-processed.jpg',
            },
            {
              id: 'att-testing-1',
              url: 'https://cdn.example.com/testing-1-processed.jpg',
              filename: 'testing-1-processed.jpg',
            },
          ]}
          selectedUrls={selectedUrls}
          onSelectionChange={setSelectedUrls}
        />
      );
    }

    render(<DeselectVariantHarness />);

    const selectedCardsBefore = screen.getAllByTestId('selected-listing-image-card');
    expect(selectedCardsBefore).toHaveLength(1);

    const selectedCheckbox = within(selectedCardsBefore[0]).getByRole('checkbox');
    fireEvent.click(selectedCheckbox);

    expect(screen.queryAllByTestId('selected-listing-image-card')).toHaveLength(0);

    const availableCards = screen.getAllByTestId('available-listing-image-card');
    expect(availableCards).toHaveLength(2);
    const availableFilenames = availableCards.map((card) => card.textContent ?? '').join('\n');
    expect(availableFilenames).toContain('b-w-805-woofer-detail-processed.jpg');
    expect(availableFilenames).toContain('testing-1-processed.jpg');
  });

  it('keeps unmatched persisted selected URLs visible in Included In Listing', () => {
    render(
      <WorkflowListingImageSelector
        attachments={[
          {
            id: 'att-photo-1-drive',
            url: 'https://drive.google.com/uc?export=view&id=file-photo-1',
            filename: 'photo-1-processed.jpg',
          },
        ]}
        selectedUrls={['https://dl.airtableusercontent.com/.attachments/variant/photo-1.jpg']}
        onSelectionChange={() => {}}
      />,
    );

    const selectedCards = screen.getAllByTestId('selected-listing-image-card');
    expect(selectedCards).toHaveLength(1);
    expect(selectedCards[0]).toHaveTextContent('photo-1.jpg');
  });

  it('keeps unmatched explicit selected rows while deduping only confidently matched variants', () => {
    render(
      <WorkflowListingImageSelector
        attachments={[
          {
            id: 'att-photo-1-drive',
            url: 'https://drive.google.com/uc?export=view&id=file-photo-1',
            filename: 'mit-miterminator-4-badge-detail-processed.jpg',
          },
          {
            id: 'att-photo-2',
            url: 'https://cdn.example.com/photo-2-processed.jpg',
            filename: 'photo-2-processed.jpg',
          },
        ]}
        selectedUrls={[
          'https://dl.airtableusercontent.com/.attachments/variant/photo-1-token',
          'https://cdn.example.com/photo-2-processed.jpg',
          'https://drive.google.com/uc?export=view&id=file-photo-1',
        ]}
        onSelectionChange={() => {}}
      />,
    );

    const selectedCards = screen.getAllByTestId('selected-listing-image-card');
    expect(selectedCards).toHaveLength(3);
  });

  it('dedupes selected Google Drive URL variants for the same file id', () => {
    render(
      <WorkflowListingImageSelector
        attachments={[
          {
            id: 'att-photo-1-drive',
            url: 'https://drive.google.com/uc?export=view&id=file-photo-1',
            filename: 'mit-miterminator-4-badge-detail-processed.jpg',
          },
        ]}
        selectedUrls={[
          'https://drive.google.com/uc?export=view&id=file-photo-1',
          'https://drive.google.com/thumbnail?id=file-photo-1&sz=w1600',
        ]}
        onSelectionChange={() => {}}
      />,
    );

    const selectedCards = screen.getAllByTestId('selected-listing-image-card');
    expect(selectedCards).toHaveLength(1);
  });

  it('adds available query-id variants to selected images when checked', () => {
    function VariantReplacementHarness() {
      const [selectedUrls, setSelectedUrls] = useState([
        'https://cdn.example.com/rendered/photo-1.jpg?token=old',
      ]);

      return (
        <WorkflowListingImageSelector
          attachments={[
            {
              id: 'att-photo-1',
              url: 'https://cdn.example.com/rendered/photo-1.jpg?token=new',
              filename: 'photo-1-processed.jpg',
            },
            {
              id: 'att-photo-2',
              url: 'https://cdn.example.com/rendered/photo-2.jpg?token=abc',
              filename: 'photo-2-processed.jpg',
            },
          ]}
          selectedUrls={selectedUrls}
          onSelectionChange={setSelectedUrls}
        />
      );
    }

    render(<VariantReplacementHarness />);

    const availableCards = screen.getAllByTestId('available-listing-image-card');
    expect(availableCards).toHaveLength(2);

    const photo1AvailableCard = availableCards.find((card) => card.textContent?.includes('photo-1-processed.jpg'));
    expect(photo1AvailableCard).toBeDefined();
    const checkbox = within(photo1AvailableCard as HTMLElement).getByRole('checkbox');
    fireEvent.click(checkbox);

    const selectedCards = screen.getAllByTestId('selected-listing-image-card');
    expect(selectedCards).toHaveLength(2);
    const selectedText = selectedCards.map((card) => card.textContent ?? '').join('\n');
    expect(selectedText).toContain('photo-1.jpg');
    expect(selectedText).toContain('photo-1-processed.jpg');

    const availableCardsAfter = screen.getAllByTestId('available-listing-image-card');
    expect(availableCardsAfter).toHaveLength(1);
    expect(availableCardsAfter[0]).toHaveTextContent('photo-2-processed.jpg');
  });
});