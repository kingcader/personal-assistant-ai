# Personal Assistant AI - MVP Loop #1

AI-powered email task extraction and approval system. Gmail work emails → Supabase → AI extracts task suggestions → approve/edit/reject → approved tasks saved.

## Core Principles

- **Deterministic**: Same input always produces same output
- **Idempotent**: Email ingestion can run twice safely
- **Auditable**: Every task traces back to source email
- **Extensible**: No schema rewrites needed for future features

## Tech Stack

- **Frontend**: Next.js 15+ with TypeScript, Tailwind CSS, Radix UI
- **Database**: Supabase (PostgreSQL)
- **Automation**: N8N workflow
- **AI**: Provider-agnostic (works with Claude or GPT-4)

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

#### Option A: Local Development (Recommended)

```bash
# Install Supabase CLI (if not already installed)
npm install -g supabase

# Start Supabase locally
npm run supabase:start

# This will output:
# - API URL: http://127.0.0.1:54321
# - Anon key: eyJh... (long key)
# - Service role key: eyJh... (long key)
```

#### Option B: Supabase Cloud

1. Go to https://app.supabase.com
2. Create a new project
3. Go to Settings → API to get your URL and keys

### 3. Configure Environment Variables

```bash
# Copy the example file
cp .env.local.example .env.local

# Edit .env.local with your Supabase credentials
# NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 (or your cloud URL)
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Run Database Migrations

#### If using local Supabase:

```bash
# Apply the migration
supabase db reset
```

#### If using Supabase Cloud:

1. Go to https://app.supabase.com/project/YOUR_PROJECT/editor/sql
2. Copy the entire contents of `supabase/migrations/001_ai_task_schema.sql`
3. Paste and run in the SQL editor

### 5. Generate TypeScript Types

```bash
# Generate types from your schema
npm run supabase:types
```

This will create/update `types/database.ts` with auto-generated types.

### 6. Run the Development Server

```bash
npm run dev
```

Open http://localhost:3000 to see the app.

Navigate to http://localhost:3000/approvals to see the Task Approvals page.

### 7. Set Up N8N Workflow (Optional for testing frontend first)

#### Install N8N

```bash
npm install -g n8n

# Or use Docker
docker run -it --rm --name n8n -p 5678:5678 n8nio/n8n
```

#### Import Workflow

1. Open N8N at http://localhost:5678
2. Go to Workflows → Import from File
3. Select `n8n-workflows/gmail-task-extraction.json`

#### Configure Credentials

1. **Gmail OAuth**: Settings → Credentials → Create New → Gmail OAuth2
2. **Supabase**: Settings → Credentials → Create New → Supabase
   - Add your Supabase URL and anon key
3. **OpenAI** (or Anthropic): Settings → Credentials → Create New
   - Add your API key

#### Update Workflow Nodes

- Replace `YOUR_SUPABASE_CREDENTIAL_ID` with your credential ID
- Replace `YOUR_OPENAI_CREDENTIAL_ID` with your credential ID
- Update Gmail label from `AI/Work` to your label

#### Activate Workflow

Click "Active" toggle in the top right.

### 8. Test the System

#### Create Gmail Label

1. Go to Gmail
2. Create a new label: `AI/Work`
3. Apply this label to a test email

#### Send Test Email

```
Subject: Budget Review Needed
Body:
Hi team,

Please review the Q4 budget by Friday, January 17th.
Focus on marketing expenses.

Thanks!
John
```

#### Verify in Database

```sql
-- Check email was inserted
SELECT * FROM emails ORDER BY created_at DESC LIMIT 1;

-- Check suggestion was created
SELECT s.*, e.subject
FROM suggestions s
JOIN emails e ON s.email_id = e.id
WHERE s.status = 'pending'
ORDER BY s.created_at DESC;
```

#### Test Frontend

1. Go to http://localhost:3000/approvals
2. You should see the pending suggestion
3. Edit the title, due date, or priority
4. Click "Approve" to create the task

#### Verify Task Created

```sql
SELECT t.*, p.email AS owner_email
FROM tasks t
JOIN people p ON t.owner_id = p.id
ORDER BY t.created_at DESC
LIMIT 1;
```

## Project Structure

```
Personal Assistant AI/
├── app/
│   ├── approvals/
│   │   └── page.tsx          # Main approvals UI
│   ├── layout.tsx            # Root layout
│   ├── page.tsx              # Home page
│   └── globals.css           # Global styles
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts         # Supabase client
│   │   └── task-queries.ts   # Database queries
│   └── ai/
│       └── task-extraction-prompt.ts  # AI prompt & validation
│
├── types/
│   └── database.ts           # Auto-generated types
│
├── supabase/
│   └── migrations/
│       └── 001_ai_task_schema.sql  # Database schema
│
└── n8n-workflows/
    └── gmail-task-extraction.json  # N8N workflow
```

## Database Schema

### Tables

1. **people** - Email senders/recipients for task ownership
2. **emails** - Gmail messages (idempotent with `gmail_message_id` unique constraint)
3. **suggestions** - AI-generated task suggestions (pending/approved/rejected)
4. **tasks** - Approved tasks only (single source of truth)

### Key Features

- UUID primary keys
- Automatic timestamps (`created_at`, `updated_at`)
- Foreign key relationships with CASCADE/RESTRICT
- Indexes for all critical queries
- CHECK constraints for status/priority validation

## AI Task Extraction

### Data Contract

```json
[
  {
    "title": "Review Q4 budget (marketing section)",
    "why": "Email requests marketing section review by end of week",
    "suggested_due_date": "2026-01-17",
    "suggested_owner_email": "sarah@company.com",
    "priority": "high"
  }
]
```

### Validation Rules

- **title**: Max 200 chars, actionable verb phrase
- **why**: 1 sentence from email content
- **suggested_due_date**: YYYY-MM-DD or null (never hallucinate)
- **suggested_owner_email**: Valid email from sender/recipients
- **priority**: low | med | high

### When NOT to Create Tasks

- Automated notifications (calendar invites, system alerts)
- Newsletters, marketing emails
- Email confirmations (receipts, bookings)
- FYI emails with no action
- Social media notifications
- Out-of-office replies

## Troubleshooting

### Supabase Connection Issues

```bash
# Check if Supabase is running
supabase status

# Restart Supabase
supabase stop
supabase start
```

### Database Migration Errors

```bash
# Reset database (WARNING: deletes all data)
supabase db reset

# Or manually run migration
psql -h 127.0.0.1 -p 54322 -U postgres -f supabase/migrations/001_ai_task_schema.sql
```

### N8N Workflow Not Triggering

1. Check Gmail label is correct
2. Verify Gmail OAuth credentials are valid
3. Check workflow is "Active"
4. Look at N8N execution logs for errors

### Frontend Not Loading Suggestions

1. Check `.env.local` has correct Supabase URL and key
2. Verify database has suggestions with `status = 'pending'`
3. Check browser console for errors
4. Ensure Supabase is running

## Future Extensibility

This MVP is designed to support future features **without schema rewrites**:

- Task dependencies (blocked by relationships)
- Task comments/notes
- Email embeddings for RAG-powered search
- Multi-source ingest (Slack, Calendar, etc.)
- Google Calendar integration
- Notification system

See the plan file for implementation details: `.claude/plans/structured-roaming-floyd.md`

## Success Criteria

✅ Email ingestion is idempotent (can run twice safely)
✅ LLM extracts tasks with correct data contract
✅ Pending suggestions appear in Approvals UI
✅ Approving creates task and updates suggestion status
✅ Every task traces back to source email (auditability)
✅ Database queries are fast (<100ms for pending suggestions)

## License

Private project - not for public distribution.
