import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsedGearLotTwoTab } from '@/components/tabs/UsedGearLotTwoTab';

const { navigateMock, usedGearLotTwoSectionMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  usedGearLotTwoSectionMock: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useLocation: () => ({
      pathname: '/parking-lot-2',
      search: '?workflowLotTwoSearch=luxman&workflowLotTwoSort=newest',
      hash: '',
    }),
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/components/app/WorkflowQueuePageTemplate', () => ({
  WorkflowQueuePageTemplate: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/components/tabs/airtable/UsedGearLotTwoSection', () => ({
  UsedGearLotTwoSection: (props: unknown) => {
    usedGearLotTwoSectionMock(props);
    return null;
  },
}));

describe('UsedGearLotTwoTab', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    usedGearLotTwoSectionMock.mockReset();
  });

  it('navigates grouped handoff rows to the dedicated Parking Lot 2 review route', () => {
    render(
      <UsedGearLotTwoTab
        currentUserName="Taylor Reviewer"
        onOpenReviewRecord={vi.fn()}
      />,
    );

    const sectionProps = usedGearLotTwoSectionMock.mock.calls[0]?.[0] as {
      onOpenGroupReview: (groupId: string) => void;
    };

    sectionProps.onOpenGroupReview('pickup:pickup-100');

    expect(navigateMock).toHaveBeenCalledWith({
      pathname: '/parking-lot-2/review/pickup%3Apickup-100',
      search: '?workflowLotTwoSearch=luxman&workflowLotTwoSort=newest',
    }, { replace: false });
  });
});