import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { readSessionTokenFromEvent } from '../handlers/auth/sessionCookie.js';
import { resolveSession } from '../providers/auth/service.js';
import { requireSessionCsrf } from './csrf.js';
import { HttpError } from './errors.js';
import type { AppPage } from './appPages.js';

interface RouteAccessRequirement {
  adminOnly?: boolean;
  anyPage?: AppPage[];
}

export type AuthenticatedUser = Awaited<ReturnType<typeof resolveSession>>;

function requireAnyAllowedPage(user: AuthenticatedUser, pages: AppPage[]): void {
  if (user.role === 'admin') {
    return;
  }

  if (pages.some((page) => user.allowedPages.includes(page))) {
    return;
  }

  throw new HttpError(403, 'You do not have access to this area.', {
    service: 'auth',
    code: 'AUTH_FORBIDDEN',
    retryable: false,
  });
}

function requireAdmin(user: AuthenticatedUser): void {
  if (user.role === 'admin') {
    return;
  }

  throw new HttpError(403, 'Admin access is required.', {
    service: 'auth',
    code: 'AUTH_ADMIN_REQUIRED',
    retryable: false,
  });
}

function resolveAirtableRequirement(event: APIGatewayProxyEventV2): RouteAccessRequirement {
  const source = event.pathParameters?.source || event.queryStringParameters?.source || '';
  switch (source.trim()) {
    case 'users':
      return { adminOnly: true, anyPage: ['users'] };
    case 'inventory-directory':
      return { anyPage: ['inventory'] };
    case 'approval-ebay':
      return { anyPage: ['approval'] };
    case 'approval-shopify':
      return { anyPage: ['shopify-approval'] };
    case 'approval-combined':
      return { anyPage: ['approval', 'shopify-approval'] };
    default:
      return { anyPage: ['inventory'] };
  }
}

export function resolveRouteAccessRequirement(event: APIGatewayProxyEventV2): RouteAccessRequirement {
  const path = event.rawPath || event.requestContext?.http?.path || '';

  if (path.startsWith('/api/shopify/approval-listings/')) {
    return { anyPage: ['shopify-approval'] };
  }

  if (path.startsWith('/api/shopify/')) {
    return { anyPage: ['shopify'] };
  }

  if (path.startsWith('/api/ebay/approval-listings/')) {
    return { anyPage: ['approval'] };
  }

  if (path.startsWith('/api/ebay/')) {
    return { anyPage: ['ebay'] };
  }

  if (path.startsWith('/api/jotform/')) {
    return { anyPage: ['jotform'] };
  }

  if (path.startsWith('/api/airtable/configured-') || path.startsWith('/api/airtable/configured-records/')) {
    return resolveAirtableRequirement(event);
  }

  if (path === '/api/airtable/listings') {
    return { anyPage: ['listings'] };
  }

  if (path.startsWith('/api/ai/')) {
    return { anyPage: ['imagelab'] };
  }

  if (path.startsWith('/api/gmail/')) {
    return { adminOnly: true, anyPage: ['users'] };
  }

  if (path.startsWith('/api/hifishark/')) {
    return { anyPage: ['market'] };
  }

  if (path.startsWith('/api/analytics/')) {
    return {};
  }

  return {};
}

export async function requireRouteAccess(
  event: APIGatewayProxyEventV2,
  override?: RouteAccessRequirement,
): Promise<AuthenticatedUser> {
  const sessionToken = readSessionTokenFromEvent(event) || '';
  const user = await resolveSession(sessionToken);
  requireSessionCsrf(event, sessionToken);
  const requirement = override ?? resolveRouteAccessRequirement(event);

  if (requirement.adminOnly) {
    requireAdmin(user);
  }

  if (requirement.anyPage && requirement.anyPage.length > 0) {
    requireAnyAllowedPage(user, requirement.anyPage);
  }

  return user;
}
