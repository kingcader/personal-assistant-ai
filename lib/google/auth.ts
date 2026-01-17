/**
 * Shared Google OAuth Client
 *
 * Centralized OAuth configuration for Google APIs (Gmail, Calendar, etc.)
 * Extracts common authentication logic from individual API clients.
 */

import { google } from 'googleapis';

/**
 * Google API scopes used by the application
 */
export const GOOGLE_SCOPES = {
  GMAIL_READONLY: 'https://www.googleapis.com/auth/gmail.readonly',
  GMAIL_SEND: 'https://www.googleapis.com/auth/gmail.send',
  CALENDAR_READONLY: 'https://www.googleapis.com/auth/calendar.readonly',
};

/**
 * Get authenticated OAuth2 client for Google APIs
 *
 * Uses refresh token for persistent authentication.
 * The refresh token must be obtained through the OAuth flow
 * with the required scopes.
 */
export function getGoogleOAuth2Client() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });

  return oauth2Client;
}

/**
 * Check if the required scopes are available
 *
 * Note: This doesn't verify the token has these scopes,
 * it's a documentation helper for required scopes.
 */
export function getRequiredScopes(): string[] {
  return [
    GOOGLE_SCOPES.GMAIL_READONLY,
    GOOGLE_SCOPES.GMAIL_SEND,
    GOOGLE_SCOPES.CALENDAR_READONLY,
  ];
}

/**
 * Generate OAuth authorization URL for user consent
 *
 * Use this when setting up a new refresh token with calendar scope.
 */
export function getAuthorizationUrl(): string {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // Force consent to get new refresh token
    scope: getRequiredScopes(),
  });
}
