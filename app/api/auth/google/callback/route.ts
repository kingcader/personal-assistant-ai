/**
 * Google OAuth Callback Handler
 *
 * Exchanges the authorization code for tokens.
 * Returns the refresh token to save in .env.local
 */

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.json({
      success: false,
      error: `Authorization failed: ${error}`,
    }, { status: 400 });
  }

  if (!code) {
    return NextResponse.json({
      success: false,
      error: 'No authorization code provided',
      hint: 'Visit /api/auth/google first to get the authorization URL',
    }, { status: 400 });
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    return NextResponse.json({
      success: true,
      message: 'Authorization successful! Update your .env.local with the new refresh token.',
      tokens: {
        refresh_token: tokens.refresh_token,
        access_token: tokens.access_token ? '(received)' : null,
        scope: tokens.scope,
        expiry_date: tokens.expiry_date,
      },
      action: `Update GOOGLE_REFRESH_TOKEN in .env.local to: ${tokens.refresh_token}`,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({
      success: false,
      error: `Token exchange failed: ${errorMessage}`,
    }, { status: 500 });
  }
}
