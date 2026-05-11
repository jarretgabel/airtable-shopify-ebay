import { describe, expect, it } from 'vitest';

import {
  canEnterAwaitingPreListingReview,
  deriveUsedGearIntakeDecision,
  deriveUsedGearNextTeams,
  hasPhotographySignoff,
  hasTestingSignoff,
  isAcceptedUsedGearWorkflowStatus,
  isUsedGearWorkflowStatus,
} from '@/services/usedGearWorkflow';

describe('usedGearWorkflow', () => {
  it('recognizes approved workflow statuses', () => {
    expect(isUsedGearWorkflowStatus('Pending Review')).toBe(true);
    expect(isUsedGearWorkflowStatus('Approved for Publish')).toBe(true);
    expect(isUsedGearWorkflowStatus('Needs Initial Processing')).toBe(false);
  });

  it('derives intake decision from workflow status', () => {
    expect(deriveUsedGearIntakeDecision('Pending Review')).toBe('Pending');
    expect(deriveUsedGearIntakeDecision('Unqualified')).toBe('Unqualified');
    expect(deriveUsedGearIntakeDecision('Testing and Photography In Progress')).toBe('Accepted');
    expect(isAcceptedUsedGearWorkflowStatus('Listed, Shopify')).toBe(true);
  });

  it('routes concurrent work to whichever teams still need signoff', () => {
    expect(deriveUsedGearNextTeams('Testing and Photography In Progress')).toEqual(['Testing', 'Photography']);

    expect(deriveUsedGearNextTeams('Testing and Photography In Progress', {
      testingSignedBy: 'Taylor',
      testingSignedAt: '2026-05-07T10:00:00.000Z',
    })).toEqual(['Photography']);

    expect(deriveUsedGearNextTeams('Testing and Photography In Progress', {
      testingSignedBy: 'Taylor',
      testingSignedAt: '2026-05-07T10:00:00.000Z',
      photographySignedBy: 'Jordan',
      photographySignedAt: '2026-05-07T11:15:00.000Z',
    })).toEqual([]);
  });

  it('requires both concurrent signoffs before pre-listing review', () => {
    expect(hasTestingSignoff({ testingSignedBy: 'Taylor' })).toBe(false);
    expect(hasPhotographySignoff({ photographySignedAt: '2026-05-07T11:15:00.000Z' })).toBe(false);

    expect(canEnterAwaitingPreListingReview({
      testingSignedBy: 'Taylor',
      testingSignedAt: '2026-05-07T10:00:00.000Z',
      photographySignedBy: 'Jordan',
      photographySignedAt: '2026-05-07T11:15:00.000Z',
    })).toBe(true);
  });
});