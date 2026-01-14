/**
 * Get Refresh Token from Authorization Code
 * Usage: npx tsx scripts/get-refresh-token.ts "YOUR_AUTH_CODE"
 */

import { config } from 'dotenv';
import { google } from 'googleapis';

// Load .env.local file
config({ path: '.env.local' });

async function getRefreshToken() {
  const authCode = process.argv[2];

  if (!authCode) {
    console.error('❌ Please provide the authorization code as an argument');
    console.log('\nUsage: npx tsx scripts/get-refresh-token.ts "YOUR_AUTH_CODE"');
    process.exit(1);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3004';

  if (!clientId || !clientSecret) {
    console.error('❌ Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env.local');
    process.exit(1);
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  try {
    console.log('🔄 Exchanging authorization code for tokens...\n');
    const { tokens } = await oauth2Client.getToken(authCode);

    console.log('✅ Success! Add this to your .env.local:\n');
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log('\n');
  } catch (error) {
    console.error('❌ Error getting tokens:', error);
    process.exit(1);
  }
}

getRefreshToken();
