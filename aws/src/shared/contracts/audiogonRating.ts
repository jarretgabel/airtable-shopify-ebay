export const AUDIOGON_RATINGS = [
  { score: 10, name: 'Mint', description: 'New in box, no visible imperfections.' },
  { score: 9, name: 'Excellent', description: 'Light use, no visible imperfections.' },
  { score: 8, name: 'Very Good', description: 'Flawless front face, other minor imperfections.' },
  { score: 7, name: 'Good', description: 'Light signs of wear, looks used but well-maintained.' },
  { score: 6, name: 'Fair', description: 'Pronounced signs of wear.' },
  { score: 5, name: 'Average', description: 'Noticeably used, imperfections on the front face.' },
  { score: 4, name: 'Mediocre', description: 'Looks worn out.' },
  { score: 3, name: 'Poor', description: 'Looks beat up.' },
  { score: 2, name: 'Very Poor', description: 'Looks beat up.' },
  { score: 1, name: 'Shot', description: 'For parts use only.' },
] as const;

export type AudiogonRating = typeof AUDIOGON_RATINGS[number];

export function audiogonRatingLabel(rating: AudiogonRating): string {
  return `${rating.score}/10: ${rating.name}`;
}

export function audiogonRatingDescription(rating: AudiogonRating): string {
  return `${audiogonRatingLabel(rating)} - ${rating.description}`;
}

export function findAudiogonRating(value: string): AudiogonRating | undefined {
  const score = value.trim().match(/^(10|[1-9])(?:\/10)?(?=$|[:\s])/);
  return score ? AUDIOGON_RATINGS.find((rating) => rating.score === Number(score[1])) : undefined;
}

export function getAudiogonRatingOptions(choices: readonly string[]): string[] {
  return AUDIOGON_RATINGS.map((rating) => {
    const value = [audiogonRatingDescription(rating), `${rating.score}/10`, String(rating.score)]
      .find((candidate) => choices.includes(candidate));
    if (!value) {
      throw new Error(`Audiogon Rating is missing the ${rating.score}/10 choice in Airtable.`);
    }
    return value;
  });
}

export function getAudiogonRatingUpdate(value: string, originalValue: string): string[] | undefined {
  const trimmed = value.trim();
  return trimmed && trimmed !== originalValue.trim() ? [trimmed] : undefined;
}
