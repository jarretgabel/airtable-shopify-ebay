import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { getRequestOrigin, jsonError, jsonOk, requireJsonBody } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { getProductTags } from '../../providers/shopify/client.js';
import { generateCategoryQueries, pickCategory, pickCollections, pickTags, generateDescription, generateKeyFeatures, generateSeoDescription, generateSeoTitle, generateTitle } from '../../providers/ai/client.js';

interface GenerateDescriptionBody {
  fields?: Record<string, unknown>;
  existingDescription?: string;
  kind?: 'description' | 'title' | 'features' | 'seoTitle' | 'seoDescription' | 'categoryQueries' | 'categoryPick' | 'collectionsPick' | 'tagsPick';
  vocabulary?: unknown;
  target?: unknown;
  candidates?: unknown;
  existingFeatureNames?: unknown;
  excludedFeatureNames?: unknown;
}

function toStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').slice(0, 60)
    : [];
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const origin = getRequestOrigin(event);
  try {
    await requireRouteAccess(event);
    const body = requireJsonBody<GenerateDescriptionBody>(event, 'ai', 'INVALID_AI_REQUEST_BODY');

    const fields: Record<string, string> = {};
    for (const [name, value] of Object.entries(body.fields ?? {})) {
      if (typeof value === 'string' && value.trim()) {
        fields[name] = value;
      }
    }

    if (Object.keys(fields).length === 0) {
      return jsonError(400, {
        message: 'At least one listing field is required',
        service: 'ai',
        code: 'MISSING_AI_LISTING_FIELDS',
        retryable: false,
      }, { origin });
    }

    const existing = typeof body.existingDescription === 'string' ? body.existingDescription : '';

    if (body.kind === 'features') {
      const features = await generateKeyFeatures(
        fields,
        toStringList(body.existingFeatureNames),
        toStringList(body.excludedFeatureNames),
      );
      logInfo('Generated listing key features via AI', { count: features.length });
      return jsonOk({ features }, { origin });
    }

    if (body.kind === 'title') {
      const title = await generateTitle(fields, existing);
      logInfo('Generated listing title via AI', { fieldCount: Object.keys(fields).length });
      return jsonOk({ title }, { origin });
    }

    if (body.kind === 'tagsPick') {
      const vocabulary = (Array.isArray(body.vocabulary) ? body.vocabulary : [])
        .filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
        .slice(0, 400);
      // Store tags are optional context, so a Shopify failure still leaves the collection tags to choose from.
      const storeTags = await getProductTags().catch(() => [] as string[]);
      const suggestions = await pickTags(fields, vocabulary, storeTags);
      logInfo('Picked tags via AI', {
        collectionTagCount: vocabulary.length,
        storeTagCount: storeTags.length,
        picked: suggestions.tags.length,
        proposed: suggestions.newTags.length,
      });
      return jsonOk(suggestions, { origin });
    }

    if (body.kind === 'collectionsPick') {
      const candidates = (Array.isArray(body.candidates) ? body.candidates : [])
        .filter((item): item is { id: string; label: string } => (
          typeof item === 'object' && item !== null
          && typeof (item as { id?: unknown }).id === 'string'
          && typeof (item as { label?: unknown }).label === 'string'
        ))
        .slice(0, 150);
      const ids = await pickCollections(fields, candidates);
      logInfo('Picked collections via AI', { candidateCount: candidates.length, picked: ids.length });
      return jsonOk({ ids }, { origin });
    }

    if (body.kind === 'categoryQueries' || body.kind === 'categoryPick') {
      const target = body.target === 'ebay' ? 'ebay' : 'shopify';
      if (body.kind === 'categoryQueries') {
        const queries = await generateCategoryQueries(target, fields);
        logInfo('Generated category search phrases via AI', { target, count: queries.length });
        return jsonOk({ queries }, { origin });
      }

      const candidates = (Array.isArray(body.candidates) ? body.candidates : [])
        .filter((item): item is { id: string; label: string } => (
          typeof item === 'object' && item !== null
          && typeof (item as { id?: unknown }).id === 'string'
          && typeof (item as { label?: unknown }).label === 'string'
        ))
        .slice(0, 30);
      const id = await pickCategory(target, fields, candidates);
      logInfo('Picked category via AI', { target, candidateCount: candidates.length, picked: Boolean(id) });
      return jsonOk({ id }, { origin });
    }

    if (body.kind === 'seoTitle') {
      const seoTitle = await generateSeoTitle(fields, existing);
      logInfo('Generated listing SEO title via AI', { fieldCount: Object.keys(fields).length });
      return jsonOk({ seoTitle }, { origin });
    }

    if (body.kind === 'seoDescription') {
      const seoDescription = await generateSeoDescription(fields, existing);
      logInfo('Generated listing SEO description via AI', { fieldCount: Object.keys(fields).length });
      return jsonOk({ seoDescription }, { origin });
    }

    const description = await generateDescription(fields, existing);
    logInfo('Generated listing description via AI', { fieldCount: Object.keys(fields).length });
    return jsonOk({ description }, { origin });
  } catch (error) {
    logError('Failed to generate listing description via AI', error);
    return jsonError(getStatusCode(error), toApiErrorBody('ai', error, 'AI_DESCRIPTION_FAILED'), { origin });
  }
}
