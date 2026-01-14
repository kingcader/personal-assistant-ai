/**
 * Gmail OAuth Setup Helper
 *
 * This script helps you get a refresh token for Gmail API access.
 * Run this once to set up Gmail integration.
 *
 * Usage: npx tsx scripts/setup-gmail-oauth.ts
 */

import { config } from 'dotenv';
import { google } from 'googleapis';
import * as readline from 'readline';

// Load .env.local file
config({ path: '.env.local' });

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

async function setupGmailOAuth() {
  console.log('🔐 Gmail OAuth Setup\n');

  // Check if credentials are in .env.local
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3004';

  if (!clientId || !clientSecret) {
    console.error('❌ Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env.local\n');
    console.log('Please follow these steps:');
    console.log('1. Go to: https://console.cloud.google.com/apis/credentials');
    console.log('2. Create OAuth 2.0 Client ID (Web application)');
    console.log('3. Add redirect URI: http://localhost:3004');
    console.log('4. Copy Client ID and Client Secret to .env.local');
    process.exit(1);
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  // Generate auth URL
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });

  console.log('📋 Step 1: Authorize this app');
  console.log('Visit this URL in your browser:\n');
  console.log(authUrl);
  console.log('\n');

  // Get authorization code from user
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('📋 Step 2: Paste the authorization code here: ', async (code) => {
    try {
      const { tokens } = await oauth2Client.getToken(code);
      console.log('\n✅ Success! Add this to your .env.local:\n');
      console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
      console.log('\n');
    } catch (error) {
      console.error('❌ Error getting tokens:', error);
    } finally {
      rl.close();
    }
  });
}

setupGmailOAuth();
