/**
 * Google OAuth Authorization URL Generator
 *
 * Visit this endpoint to get a new authorization URL with all required scopes.
 * Use this when you need to re-authorize with new scopes (like Drive).
 */

import { NextResponse } from 'next/server';
import { getAuthorizationUrl, getRequiredScopes } from '@/lib/google/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const authUrl = getAuthorizationUrl();
  const scopes = getRequiredScopes();

  return NextResponse.json({
    message: 'Visit the authUrl to authorize Google access with the following scopes:',
    scopes,
    authUrl,
    instructions: [
      '1. Click the authUrl link below',
      '2. Sign in with your Google account (kincaidgarrett@gmail.com)',
      '3. Grant all requested permissions',
      '4. You will be redirected to a callback URL',
      '5. Copy the "code" parameter from the URL',
      '6. Use the /api/auth/google/callback endpoint with that code to get a refresh token',
    ],
  });
}
