export interface AttachmentLike {
  id?: string;
  type?: string;
  [key: string]: unknown;
}

export interface CleanPlan {
  keep: AttachmentLike[];
  remove: AttachmentLike[];
}

// Some stored "images" are Google sign-in pages saved as .jpg; their content type is text/html.
export function planHtmlAttachmentRemoval(images: unknown): CleanPlan | null {
  if (!Array.isArray(images)) return null;
  const items = images.filter((item): item is AttachmentLike => typeof item === 'object' && item !== null);
  const remove = items.filter((item) => typeof item.type === 'string' && item.type.toLowerCase().startsWith('text/html'));
  if (remove.length === 0) return null;
  return { keep: items.filter((item) => !remove.includes(item)), remove };
}

// Airtable keeps an existing attachment when only its id is sent, so it never re-downloads our hosted URLs.
export function toAirtableImages(keep: AttachmentLike[]): Array<{ id: string }> | null {
  const ids = keep.map((item) => item.id);
  return ids.every((id): id is string => typeof id === 'string' && id.length > 0) ? ids.map((id) => ({ id })) : null;
}
