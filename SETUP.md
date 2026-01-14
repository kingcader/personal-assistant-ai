# Setup Guide - Email Processing System

This guide will help you set up the automated email processing system (Loop #1).

---

## 🎯 Overview

The system automatically:
1. Fetches emails from Gmail with label "AI/Work"
2. Extracts tasks using AI (OpenAI or Anthropic)
3. Creates suggestions in Supabase
4. Shows them in the `/approvals` page for review

**No N8N required** - everything runs in your Next.js app.

---

## ✅ Prerequisites

- [x] Supabase database deployed (already done)
- [x] Frontend running at http://localhost:3004 (already done)
- [ ] Gmail API credentials
- [ ] AI API key (OpenAI or Anthropic)

---

## 📝 Step 1: Set Up Gmail API

### 1.1 Enable Gmail API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable the **Gmail API**:
   - Navigate to "APIs & Services" → "Library"
   - Search for "Gmail API"
   - Click "Enable"

### 1.2 Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Application type: **Web application**
4. Name: "Personal Assistant AI"
5. Authorized redirect URIs:
   - Add: `http://localhost:3004`
   - Add: `http://localhost:3004/api/auth/google/callback`
6. Click "Create"
7. **Copy the Client ID and Client Secret**

### 1.3 Get Refresh Token

1. Add credentials to `.env.local`:
   ```bash
   GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret-here
   ```

2. Install TypeScript execution tool (if not already installed):
   ```bash
   npm install -g tsx
   ```

3. Run the OAuth setup script:
   ```bash
   npx tsx scripts/setup-gmail-oauth.ts
   ```

4. Follow the instructions:
   - Visit the authorization URL in your browser
   - Grant permissions
   - Copy the authorization code
   - Paste it into the terminal

5. Copy the refresh token to `.env.local`:
   ```bash
   GOOGLE_REFRESH_TOKEN=your-refresh-token-here
   ```

### 1.4 Create Gmail Label

1. Open Gmail
2. Create a new label called "AI/Work" (or customize in `.env.local`)
3. Apply this label to a test email

---

## 🤖 Step 2: Set Up AI Provider

### Option A: OpenAI (Recommended for beginners)

1. Get API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. Add to `.env.local`:
   ```bash
   AI_PROVIDER=openai
   OPENAI_API_KEY=sk-your-openai-api-key-here
   ```

### Option B: Anthropic Claude (Better at structured extraction)

1. Get API key from [Anthropic Console](https://console.anthropic.com/)
2. Add to `.env.local`:
   ```bash
   AI_PROVIDER=anthropic
   ANTHROPIC_API_KEY=sk-ant-your-anthropic-api-key-here
   ```

---

## 🔐 Step 3: Set Up Cron Secret (Optional but Recommended)

Generate a random secret to protect your cron endpoint:

```bash
# On macOS/Linux
openssl rand -base64 32

# On Windows (PowerShell)
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})
```

Add to `.env.local`:
```bash
CRON_SECRET=your-random-secret-here
```

---

## 🧪 Step 4: Test the System

### 4.1 Start the Dev Server

```bash
npm run dev
```

Server should be running at http://localhost:3004

### 4.2 Test Email Processing Manually

```bash
npx tsx scripts/trigger-email-processing.ts
```

You should see output like:
```
🚀 Triggering email processing...

📊 Result: {
  "success": true,
  "processed": 1,
  "skipped": 0,
  "suggestions_created": 2,
  "errors": []
}

✅ Email processing complete!
   Processed: 1
   Skipped: 0
   Suggestions created: 2
```

### 4.3 Verify in Database

Go to [Supabase SQL Editor](https://qprhkeaeaaizkagyqrtc.supabase.co/project/_/sql/new):

```sql
-- Check emails
SELECT * FROM emails ORDER BY created_at DESC LIMIT 5;

-- Check suggestions
SELECT s.title, s.priority, s.status, e.subject
FROM suggestions s
JOIN emails e ON s.email_id = e.id
ORDER BY s.created_at DESC
LIMIT 10;
```

### 4.4 Test Frontend

1. Go to http://localhost:3004/approvals
2. You should see pending suggestions
3. Try approving one → verify task is created

---

## 🚀 Step 5: Set Up Automated Trigger (Choose One)

### Option A: Local Cron (Development)

Create `scripts/cron.ts`:

```typescript
import cron from 'node-cron';
import { spawn } from 'child_process';

// Run every 5 minutes
cron.schedule('*/5 * * * *', () => {
  console.log('⏰ Running email processing...');
  spawn('npx', ['tsx', 'scripts/trigger-email-processing.ts'], {
    stdio: 'inherit',
  });
});

console.log('✅ Cron job started. Runs every 5 minutes.');
```

Install node-cron:
```bash
npm install node-cron
npm install -D @types/node-cron
```

Run:
```bash
npx tsx scripts/cron.ts
```

### Option B: Vercel Cron (Production - Easiest)

1. Deploy to Vercel:
   ```bash
   vercel
   ```

2. Add `vercel.json`:
   ```json
   {
     "crons": [
       {
         "path": "/api/cron/process-emails",
         "schedule": "*/5 * * * *"
       }
     ]
   }
   ```

3. Set environment variables in Vercel dashboard

### Option C: GitHub Actions (Free)

Create `.github/workflows/process-emails.yml`:

```yaml
name: Process Emails

on:
  schedule:
    - cron: '*/5 * * * *'  # Every 5 minutes
  workflow_dispatch:  # Allow manual trigger

jobs:
  process-emails:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger email processing
        run: |
          curl -X GET "https://your-app.vercel.app/api/cron/process-emails" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

---

## ✅ Verification Checklist

Once everything is set up, verify:

- [ ] Gmail API credentials working (`npx tsx scripts/setup-gmail-oauth.ts`)
- [ ] AI API key working (check API provider dashboard)
- [ ] Manual trigger works (`npx tsx scripts/trigger-email-processing.ts`)
- [ ] Emails appear in database
- [ ] Suggestions appear in `/approvals` page
- [ ] Approving creates tasks
- [ ] Cron job running (check logs)

---

## 🐛 Troubleshooting

### "Missing GOOGLE_CLIENT_ID"
→ Add Gmail credentials to `.env.local` (see Step 1.2)

### "Label 'AI/Work' not found"
→ Create the label in Gmail, or change `GMAIL_LABEL_NAME` in `.env.local`

### "OpenAI API error"
→ Check your API key at https://platform.openai.com/api-keys

### "Unauthorized"
→ Add `CRON_SECRET` to both `.env.local` AND the trigger script headers

### "No emails found"
→ Make sure you've applied the "AI/Work" label to at least one email

---

## 🎉 Loop #1 Complete!

Once the system is running:
1. Send yourself an email with "AI/Work" label
2. Wait 5 minutes (or trigger manually)
3. Check `/approvals` page
4. Approve/reject suggestions
5. Verify tasks created

**Next**: Move to Loop #2 (Task Lifecycle) 🚀
