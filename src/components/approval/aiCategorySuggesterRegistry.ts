import { useEffect, useRef } from 'react';

export type CategorySuggester = (fields: Record<string, string>) => Promise<void>;

const suggesters = new Map<string, CategorySuggester>();

// Lets "Generate all with AI" reach the category pickers that live in other page sections.
export function useRegisterCategorySuggester(id: string, suggester: CategorySuggester | null): void {
  const latest = useRef(suggester);
  latest.current = suggester;
  const enabled = suggester !== null;

  useEffect(() => {
    if (!enabled) return undefined;
    suggesters.set(id, (fields) => latest.current?.(fields) ?? Promise.resolve());
    return () => {
      suggesters.delete(id);
    };
  }, [enabled, id]);
}

// Returns an error message when any picker failed, or an empty string.
export async function runCategorySuggesters(fields: Record<string, string>): Promise<string> {
  const results = await Promise.allSettled(Array.from(suggesters.values()).map((suggester) => suggester(fields)));
  const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
  if (!failure) return '';
  return failure.reason instanceof Error ? failure.reason.message : 'Could not suggest a category.';
}
